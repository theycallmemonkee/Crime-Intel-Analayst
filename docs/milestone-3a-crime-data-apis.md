# Milestone 3A — Crime Data Management: Backend APIs

## 1. Objective

Build working CRUD APIs for every entity in the brief (Crime, FIR, Person/Suspect/Victim/Witness, Police Station, District, Crime Category, Evidence, Weapon, Vehicle), with the RBAC and jurisdiction-scoping rules from Milestone 1/2 actually enforced on real endpoints — not just proven on `/users`.

**Scope note:** the original roadmap bundled backend APIs and frontend UI into one Milestone 3. Given how much surface area nine entities' worth of CRUD + a first frontend represents, this milestone was split into 3A (this one — backend only) and 3B (frontend, next). Building both in one pass would be the "everything at once" the brief explicitly warns against; splitting keeps each piece reviewable.

## 2. Functional Requirements Covered

- Full CRUD (or CRUD-appropriate subset — see §7 on deletes) for: District, PoliceStation, CrimeCategory, Person, Vehicle, Weapon, Crime, FIR (created with its Crime, not standalone), Evidence, and the three link tables (CrimePerson, CrimeVehicle, CrimeWeapon).
- Fuzzy search on Person (name, address) and Vehicle (registration number) via `pg_trgm`.
- Filterable, paginated crime listing (district, station, category, status, date range).
- Jurisdiction enforcement: Officers write only within their own station, read only within their own district; Admin unrestricted; Analyst read-only everywhere.

## 3. Architecture Decisions

### 3.1 Jurisdiction scoping lives in one shared utility, not per-module logic

`src/common/jurisdiction.util.ts` has exactly two functions: `assertCanWriteToStation` (throws 403 if an Officer tries to write outside their station) and `districtScopeFilter` (returns a Prisma `where` fragment scoping an Officer's reads to their district, or `undefined` for state-wide roles). Every write path in `crimes.service.ts` goes through `getOwnedCrimeOrThrow`, which calls the former; every read path spreads the latter into its `where` clause. This was worth centralizing (not "premature abstraction") because it's the same rule enforced in ~8 different places, and getting it right in one spot beats getting it *approximately* right eight times.

One nuance worth flagging: Officer read scope is **district**-wide, write scope is **station**-only — this matches the Milestone 1 role table (`"Write within own station, read within own district"`) rather than using one scope for both, which would either over-restrict reads or under-restrict writes.

### 3.2 FIR is created *with* its Crime, not as a separate resource

`POST /crimes` takes crime fields plus `firNarrative` and creates both in one nested Prisma write. There's no `POST /firs`. This matches the real workflow (a crime record isn't really "on the books" without an FIR) and avoids a two-step create where the first step could succeed and the second fail, leaving an orphaned crime. The FIR number itself is server-generated (`{stationCode}/{year}/{sequence}`), not client-supplied — sequence is counted per-station (not per-station-per-year; see the comment in `crimes.service.ts::generateFirNumber` for why: the synthetic seed data's own numbering is a per-station running count stamped with each crime's actual year, so a per-year counter would eventually regenerate a number that already exists for a different year-slice — this was caught by the end-to-end test, not designed around in advance).

### 3.3 Evidence and the link tables are sub-resources of Crime, not their own top-level modules

`POST /crimes/:id/evidence`, `/persons`, `/vehicles`, `/weapons` rather than standalone `EvidenceModule`/etc. None of these make sense without a parent crime, and a standalone module would just be a controller with no independent listing/filtering value — the sub-resource routes are simpler and the jurisdiction check (owning the parent crime) only has to be written once, in `getOwnedCrimeOrThrow`.

### 3.4 Deletes are intentionally limited

Crime, FIR, and Evidence have no delete endpoint — consistent with the append-only/chain-of-custody posture established in Milestone 2 (`AuditLog` is append-only for the same reason). Unlinking a person/vehicle/weapon from a crime *is* supported (`DELETE /crimes/:id/persons/:linkId`) since that's correcting a data-entry link, not erasing a case record. Reference data (District, Station, Category) and Person/Vehicle/Weapon have no delete endpoint yet either — nothing in the brief calls for removing a district or a person record, and adding it speculatively isn't warranted.

### 3.5 pg_trgm, not Elasticsearch — the Milestone 1 decision, now actually implemented

Migration `add_person_search` enables `pg_trgm` and adds GIN trigram indexes on `Person.fullName`, `Person.addressLine`, and `Vehicle.registrationNumber`. `PersonsService.search()` / `VehiclesService.search()` use the `%` similarity operator via `$queryRaw` (parameterized, not string-interpolated — no injection risk). This is the concrete follow-through on "Postgres search now, Elasticsearch later if needed."

One migration-authoring note worth recording: Prisma's schema-diffing doesn't understand `GENERATED ALWAYS AS ... STORED` columns, so after adding `geom` in Milestone 2 it started proposing to drop it on every subsequent `migrate dev`. Fixed by declaring `geom` as an `Unsupported("geometry(Point, 4326)")` field in `schema.prisma` — Prisma Client ignores `Unsupported` fields entirely (can't be `@ignore`d explicitly, it's automatic), but `migrate` now knows the column exists and stops trying to remove it. Worth knowing if a future migration touches `Crime` again.

## 4. API Surface (this milestone)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/districts`, `/districts/:id` | any | |
| POST | `/districts` | Admin | reference data |
| GET | `/stations`, `/stations/:id` | any | `?districtId=` filter |
| POST | `/stations` | Admin | |
| GET | `/crime-categories` | any | |
| POST | `/crime-categories` | Admin | |
| GET | `/persons`, `/persons/:id` | any | |
| GET | `/persons/search?q=` | any | pg_trgm fuzzy match |
| POST/PATCH | `/persons`, `/persons/:id` | Admin, Officer | Analyst is read-only (no PII edit) |
| GET | `/vehicles`, `/vehicles/:id` | any | |
| GET | `/vehicles/search?q=` | any | |
| POST/PATCH | `/vehicles`, `/vehicles/:id` | Admin, Officer | |
| GET | `/weapons`, `/weapons/:id` | any | |
| POST | `/weapons` | Admin, Officer | |
| GET | `/crimes` | any | district-scoped for Officer; filters: `districtId, stationId, categoryId, status, from, to, page, pageSize` |
| GET | `/crimes/:id` | any | district-scoped for Officer (404, not 403, outside scope) |
| POST | `/crimes` | Admin, Officer | station-scoped for Officer; creates Crime + FIR together |
| PATCH | `/crimes/:id/status` | Admin, Officer | station-scoped |
| POST/DELETE | `/crimes/:id/persons[/:linkId]` | Admin, Officer | station-scoped |
| POST | `/crimes/:id/vehicles` | Admin, Officer | station-scoped |
| POST | `/crimes/:id/weapons` | Admin, Officer | station-scoped |
| POST | `/crimes/:id/evidence` | Admin, Officer | station-scoped; `collectedById` is always the caller, never client-supplied |

## 5. Implementation Notes

- All new DTOs use `class-validator` decorators, enforced globally by the `ValidationPipe` already configured in `main.ts` (Milestone 2) — invalid payloads reject before reaching a service.
- `UpdatePersonDto`/`UpdateVehicleDto` use `@nestjs/mapped-types`'s `PartialType` rather than hand-duplicating every field as optional — this is the one place a small abstraction was worth it, since NestJS ships this exact pattern for exactly this case.
- `CrimesService.findOne` returns 404 (not 403) when an Officer requests a crime outside their district — deliberately not distinguishing "doesn't exist" from "exists but you can't see it," so the API doesn't leak the existence of out-of-jurisdiction case records.
- `DETAIL_INCLUDE` (a `satisfies Prisma.CrimeInclude` constant) is shared between `findOne` and every mutation that returns the updated crime (link/unlink, status update, evidence) — one source of truth for "what a full crime detail response looks like," not five copies that could drift.

## 6. Testing Strategy (this milestone)

Verified end-to-end via curl against the running app + seeded data (see conversation log for the full run): login → reference-data reads → fuzzy search → crime creation with FIR auto-numbering → cross-station write correctly rejected (403) → link person/vehicle/weapon → add evidence → status update → full detail reflects all of it → Officer district-scoped totals differ correctly by district (65 vs. 69 vs. 901 for Admin) → cross-district read returns 404. Formal Jest/Testcontainers suites are still the plan per Milestone 1's testing strategy but weren't the priority for this pass — manual end-to-end verification caught one real bug (the FIR numbering collision in §3.2) that a narrower unit test likely wouldn't have.

## 7. Future Enhancements

- Automated test suite (Jest unit tests for services, Testcontainers-backed integration tests for the Prisma/pg_trgm queries) — flagged in Milestone 1, still pending.
- Delete/soft-delete for reference data and Person/Vehicle/Weapon, if a real need shows up (none has yet).
- Evidence file upload (MinIO) — still deferred to whenever the frontend needs to exercise it.

---

**Awaiting your review before proceeding to Milestone 3B (Frontend UI for everything built here).**
