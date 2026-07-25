# Milestone 2 — Foundation

## 1. Objective

Stand up the runnable skeleton everything else builds on: a monorepo, a local Docker stack, a PostgreSQL schema covering every entity from the brief, a Neo4j graph model, working JWT authentication with three-role RBAC, and a synthetic Karnataka crime dataset seeded into both databases — consistently, from the same source data. No feature UI/CRUD yet; that's Milestone 3.

## 2. Functional Requirements Covered

- Monorepo scaffold (npm workspaces) with a single running app: `core-api`.
- Docker Compose stack: PostgreSQL+PostGIS, Neo4j (with the Graph Data Science plugin, needed later for community detection in Milestone 6).
- PostgreSQL schema (Prisma) for every entity in the brief: Crime, FIR, Person (suspects/victims/witnesses), Police Station, District, Evidence, Weapon, Vehicle, User, AuditLog.
- Neo4j graph model: nodes and relationships for Person/Crime/Vehicle/Weapon/PhoneNumber/Address/PoliceStation.
- JWT auth (login → access token) with three roles: Admin, Analyst, Officer, enforced via guards.
- Synthetic data generator producing a plausible Karnataka crime dataset.
- Seed scripts loading that dataset into both Postgres and Neo4j from a single generation pass (so IDs match across both stores).

## 3. Architecture — what actually got built vs. Milestone 1's target shape

Milestone 1 sketched a modular monolith with two satellite services (Network Analysis, AI Intelligence) plus Redis and MinIO. None of that is warranted yet:

- **No Redis, no MinIO in this milestone.** Redis exists in the target architecture to move data from Postgres to Neo4j asynchronously (Milestone 6) and MinIO exists to store evidence *files* (which don't have an upload flow until Milestone 3 builds Evidence CRUD). Adding either now would be infrastructure with nothing using it — directly against your instruction to avoid infra the problem statement doesn't yet require. The seed script proves the Postgres→Neo4j sync pattern works by generating both from the same in-memory dataset; the outbox/queue mechanics get built when there's a real write path to sync from.
- **No `network-analysis-service` or `ai-intelligence-service` app yet.** Those are Milestone 6/7 concerns. `core-api` talks to Neo4j directly for now (`Neo4jModule` — a thin wrapper over the official driver, no OGM) since there's no Python service to own that relationship yet.
- **No frontend yet.** Nothing to display until Milestone 3 has APIs worth calling.

This keeps Milestone 2 to exactly what you asked for: scaffold, compose, two schemas, auth, generator, seed — nothing else.

## 4. Folder Structure (as built)

```
crime-intel-platform/
├── package.json                 # npm workspaces root
├── infra/
│   └── docker-compose.yml       # postgres+postgis, neo4j
├── apps/
│   └── core-api/                # NestJS app
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   │   ├── ..._init/
│       │   │   └── ..._add_postgis_geometry/
│       │   └── seed.ts          # orchestrates Postgres + Neo4j seeding
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── prisma/          # PrismaService/PrismaModule
│       │   ├── neo4j/           # Neo4jService/Neo4jModule (thin driver wrapper)
│       │   ├── auth/            # login, JWT strategy/guard
│       │   ├── users/           # /users/me, /users (admin-only)
│       │   ├── common/          # RolesGuard, @Roles, @CurrentUser
│       │   └── database/synthetic/
│       │       ├── karnataka-data.ts   # reference data (districts, categories, names)
│       │       ├── generator.ts        # faker-based dataset generator
│       │       └── seed-neo4j.ts       # graph loader
│       └── .env / .env.example
└── docs/
    ├── milestone-1-architecture.md
    └── milestone-2-foundation.md
```

## 5. Database Design

### 5.1 PostgreSQL (Prisma schema — see `apps/core-api/prisma/schema.prisma`)

Key modeling decision, worth calling out explicitly: **suspects, victims, and witnesses are all rows in one `Person` table**, not three separate tables. The per-crime role (`SUSPECT` / `VICTIM` / `WITNESS`) lives on the join table `CrimePerson`, not on the person. This is deliberate, not an oversimplification — the platform's core value is finding the same identity across roles and across cases (someone who was a witness in one case and a suspect in another; two crimes sharing a phone number). Three separate tables would fragment identity and work against exactly the queries Milestone 6 needs. `phoneNumber`/`addressLine` are kept as plain scalar columns on `Person` in Postgres (source of truth, simple) — they only become *shared graph nodes* in Neo4j, where the fan-in actually matters (see 5.2).

Other notable decisions:
- **Real PostGIS**, not just lat/lng floats: `Crime.geom` is a `geometry(Point, 4326)` column, `GENERATED ALWAYS ... STORED` from `latitude`/`longitude`, with a GiST index (`prisma/migrations/..._add_postgis_geometry/migration.sql`). Prisma has no native geometry type, so this is a hand-written migration layered on top of the Prisma-managed columns — Prisma never touches `geom` directly, it's derived. This means Milestone 5's hotspot/heatmap queries (`ST_ClusterDBSCAN` etc.) have a real spatial column and index to run against, not something bolted on later.
- **`AuditLog`** is append-only (no update/delete path in application code) and already records every login. Write-side audit logging for crime-record CRUD gets wired up in Milestone 3 when that CRUD exists.
- **Jurisdiction scoping** is a nullable `districtId`/`stationId` on `User` — Admin/Analyst leave both null (state-wide), Officers are scoped to one station. The seed data includes two Officers at different stations specifically so scoped-query behavior (Milestone 3+) has something real to test against.
- Enums (`Role`, `InvestigationStatus`, `CrimePersonRole`, `VehicleInvolvementRole`, `EvidenceType`, `Gender`) are native Postgres enums via Prisma — cheap correctness (invalid values are a DB-level error, not just an app-level one).

### 5.2 Neo4j (see `apps/core-api/src/database/synthetic/seed-neo4j.ts`)

Nodes: `Person`, `Crime`, `Vehicle`, `Weapon`, `PhoneNumber`, `Address`, `PoliceStation`.
Relationships:
```
(Person)-[:INVOLVED_IN {role}]->(Crime)      # SUSPECT | VICTIM | WITNESS
(Crime)-[:OCCURRED_AT]->(PoliceStation)
(Crime)-[:USED_VEHICLE {role}]->(Vehicle)
(Crime)-[:USED_WEAPON]->(Weapon)
(Person)-[:OWNS_VEHICLE]->(Vehicle)
(Person)-[:HAS_PHONE]->(PhoneNumber)          # shared node = the link
(Person)-[:HAS_ADDRESS]->(Address)            # shared node = the link
```
`PhoneNumber` and `Address` are modeled as their own nodes rather than Person properties specifically so that "two people share a phone number/address" is a one-hop graph pattern (`MATCH (p1)-[:HAS_PHONE]->(ph)<-[:HAS_PHONE]-(p2)`) instead of a string-equality scan — this is the mechanism Milestone 6's "hidden associations" and "gang network" features run on. Uniqueness constraints are created on every node's natural key (`id`, or `number`/`value` for the shared nodes) so `MERGE` stays idempotent across reseeds.

The seed script uses the official `neo4j-driver` directly (no OGM) with batched `UNWIND` + `MERGE` Cypher — the graph is small enough (7 node types, 7 relationship types) that an abstraction layer would cost more than it'd save.

## 6. API Design (this milestone's slice)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | none | `{ username, password }` → `{ accessToken, user }`. Records an `AuditLog` entry on success. |
| GET | `/users/me` | any authenticated role | Returns the caller's own profile (password hash stripped). |
| GET | `/users` | **Admin only** | Lists all users — exists specifically to prove `@Roles(Role.ADMIN)` + `RolesGuard` work, and because user management is a named Admin responsibility. |

Full Crime/FIR/Person/Evidence/etc. CRUD is Milestone 3's job — this milestone only needed *an* endpoint provably behind each role to validate the auth/RBAC plumbing, which is why `/users` is the only "real" resource endpoint so far.

## 7. Implementation Notes / Decisions Worth Flagging

- **Prisma** was chosen over TypeORM for the ORM: the schema file doubles as living documentation of the data model (directly satisfies the "PostgreSQL schema" deliverable), and its migration workflow is more predictable for iterative schema growth across nine more milestones.
- **Deterministic synthetic data**: `faker.seed(42)` means every `npm run db:seed` regenerates the *same* dataset. That matters for a demo — dashboards look the same on every run, and if something looks wrong it's reproducible rather than "well it was random."
- **The dataset isn't uniformly random on purpose.** ~18 persons are drawn from disproportionately as `SUSPECT` (repeat-offender pattern for Milestone 6), and ~45% of persons share one of a smaller pool of addresses / ~12% share one of a smaller pool of phone numbers (household/gang clustering). Fully independent random data would make Milestone 6's link-analysis features have nothing real to find.
- **Scale**: 15 districts, 30 stations, 320 persons, 130 vehicles, 45 weapons, 900 crimes over 3 years, ~3,150 crime-person links, ~1,800 evidence items. Sized to make dashboards/hotspots/network queries visually meaningful without being a load test (consistent with the MVP framing).
- **Local environment quirk, documented for whoever runs this next**: this machine already runs other local Postgres instances on ports 5432 *and* 5433 (Homebrew, a separate EDB install, and PgBouncer), so `docker-compose.yml` maps the containerized Postgres to host port **55432**, not the default 5432. `.env.example` reflects this. If you run this on a clean machine with no local Postgres, 5432 would work fine too — 55432 was a defensive choice for *this* machine, not a general recommendation.
- **Seed users** (printed at the end of every `npm run db:seed`):

  | Role | Username | Password |
  |---|---|---|
  | Admin | `admin` | `Admin@123` |
  | Analyst | `analyst` | `Analyst@123` |
  | Officer (Bengaluru Urban) | `officer.blr` | `Officer@123` |
  | Officer (Dakshina Kannada) | `officer.mys` | `Officer@123` |

  These are seeded plaintext-then-bcrypt-hashed for prototype convenience and are clearly not production credentials.

## 8. How to Run This

```bash
npm install                                   # from repo root
npm run docker:up                             # starts Postgres+PostGIS and Neo4j
npm run db:migrate --workspace apps/core-api  # applies schema (first time only)
npm run db:seed                                # generates + seeds synthetic dataset
npm run dev:core-api                           # starts the API on :3000
```

Verified end-to-end this milestone: containers healthy → migrations applied → geometry column confirmed via `\d "Crime"` → seed populates 900 crimes/320 persons/etc. in Postgres and a matching graph in Neo4j → app boots cleanly → login works for all four seeded users → `/users/me` works for any authenticated role → `/users` correctly returns 403 for Officer/Analyst and 200 for Admin → missing token and wrong password both correctly return 401 → sample Cypher queries for repeat offenders and shared-address associations return sensible results against the seeded graph.

## 9. Testing Strategy (this milestone)

Verified manually end-to-end per Section 8 above (this is foundation/infra work — the meaningful unit/integration tests start in Milestone 3 once there's business logic to test, per the Milestone 1 testing strategy: Jest for units, Testcontainers-backed integration tests against real Postgres/Neo4j).

## 10. Future Enhancements Reconfirmed (not built now, still on purpose)

- Redis + outbox pattern (Milestone 6, when there's a real write path to sync from).
- MinIO for evidence file storage (Milestone 3, when Evidence CRUD + file upload exists).
- `network-analysis-service` / `ai-intelligence-service` as separate Python apps (Milestones 6/7).
- Jurisdiction-scoped query filtering applied to actual data endpoints (Milestone 3 — the `districtId`/`stationId` fields and JWT claims exist now, the enforcement lands with the endpoints that need it).

---

**Awaiting your review before proceeding to Milestone 3 (Crime Data Management: CRUD APIs + UI for FIR, Crimes, Persons, Stations, Districts, Evidence, Weapons, Vehicles).**
