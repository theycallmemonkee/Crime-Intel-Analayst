# Milestone 6 — Network & Link Analysis

## 1. Objective

Put Neo4j to work. Milestones 2–5 built the graph model and seeded it with realistic co-offending/shared-attribute patterns, but nothing had queried it for relationships yet. This milestone delivers the four capabilities the brief names — Repeat Offender Detection, Hidden Associations, Gang Networks, Criminal Organization Discovery — plus a real interactive link-chart visualization, not just tables.

## 2. Architecture Decision: NestJS + Cypher, Not a Separate Python Service

Milestone 1's target architecture sketched a standalone Python/FastAPI "Network Analysis Service" specifically to run Neo4j's Graph Data Science (GDS) algorithms. That assumption doesn't hold up: **GDS runs as in-database procedures**, invoked with plain Cypher (`CALL gds.louvain.stream(...)`) from any driver — there is no GDS-specific Python requirement. None of the four required capabilities need anything Python-only (no custom NetworkX algorithm, no scikit-learn model); they're all Cypher pattern-matching plus one GDS procedure call. Standing up a second service, a second deployment unit, and a second language runtime for this would be infrastructure with nothing forcing it — directly against the "no infra before it's needed" principle this build has followed since Milestone 2. The existing `Neo4jService` (Milestone 2) was extended with a new `NetworkModule` instead. The GDS plugin itself was already provisioned in Docker Compose since Milestone 2 (`NEO4J_PLUGINS: '["graph-data-science"]'`) — it just sat unused until this milestone gave it something to do.

If a genuinely Python-only technique becomes necessary later (e.g., a custom ML risk-scoring model that isn't a graph algorithm), that's Milestone 7's AI Intelligence service, not a retroactive justification for this one.

## 3. "Gang Networks" and "Criminal Organization Discovery" Are One Feature, Not Two

Both are graph community detection under the hood: a densely-connected group of co-offending people. Building two separate features that would produce identical output from the same algorithm would be manufacturing a distinction that doesn't exist, just to check two boxes in the brief. One feature — Louvain community detection over the co-suspect graph — is presented as "Gang & Criminal Networks" and documented as covering both named requirements.

## 4. The Graph Addition: `CO_SUSPECT`

Every other relationship in the Neo4j model (Milestones 2–5) came directly from a source record (a crime has an FIR, a person has a phone number). `CO_SUSPECT` is different — it's *derived*: two people connected because they were both `SUSPECT` on the same crime at least once, with a `sharedCrimeCount` weight. This is what Louvain actually runs against (GDS community detection needs a real monopartite Person-Person relationship to project; it can't run directly on the bipartite Person→Crime graph).

**Materialized at seed time, not computed per-request.** `seed-neo4j.ts` now derives all co-suspect pairs from the same synthetic dataset used for everything else, in one batch of `MERGE` statements (429 pairs from the current seed). This is the standard pattern for algorithm-ready derived relationships — an ETL/projection step, not something recomputed inside a hot request path. If new crimes are added later without a reseed, `CO_SUSPECT` would go stale; there's no live-update trigger for it yet (see §8).

## 5. Backend: `NetworkModule`

Restricted to **Admin and Analyst only** — Officers get a 403. This isn't an arbitrary lockdown; it's Milestone 1's own role table, verbatim: *"SCRB Analyst: Network analysis, hotspot detection, AI predictions, state-wide reports."* Network/link analysis was scoped as an Analyst specialty from the very first milestone, not something bolted on now. This also simplified the implementation — no district-scoping logic needed anywhere in this module, since only state-wide roles call it.

| Endpoint | Technique |
|---|---|
| `GET /network/repeat-offenders?minCrimes=&limit=` | Cypher aggregation: persons with 3+ distinct `SUSPECT` crimes, enriched with Postgres case details (FIR number, category, station) — Neo4j supplies *who and how many*, Postgres supplies *what the case actually is*. This split is the Milestone 1 architecture working as designed, now actually exercised. |
| `GET /network/hidden-associations?limit=` | Three Cypher patterns (shared address / shared phone / shared vehicle across different crimes) filtered by `NOT EXISTS` on a direct co-suspect crime — i.e., links invisible from case records alone. |
| `GET /network/gangs?minSize=` | GDS Louvain over a native `CO_SUSPECT` projection; communities below `minSize` are dropped; each result includes the actual edges among its members so the frontend can render a real graph, not just a name list. |
| `GET /network/person/:id/graph` | A bounded ego-network (crimes, co-participants, vehicles, weapons, shared phone/address) for one person — the data behind the link-chart visualization. |

### Two real bugs, caught only by actually running the queries

- **PostGIS-style habits don't transfer to Cypher parameter typing.** `LIMIT $limit` rejected every call with `'5.0' is not a valid value. Must be a non-negative integer` — the neo4j-driver sends plain JS numbers as Cypher `Float` by default, and `LIMIT` (along with GDS's `minpoints`-style parameters) requires a strict integer. Fixed by wrapping every integer-typed parameter with `neo4j.int(...)` rather than passing bare numbers — a driver-level gotcha with no analog in the SQL/Prisma work from earlier milestones, so nothing in this codebase had hit it before.
- **Cypher integers need a driver setting to behave like plain numbers.** Configured `disableLosslessIntegers: true` on the driver so counts/community IDs come back as ordinary JS numbers instead of the driver's lossless `Integer` wrapper objects — safe here since nothing in this domain (crime counts, community IDs) approaches the range where that precision would matter.

## 6. Frontend: `GraphView` — a Real Link Chart, Not Just Tables

`d3-force` (physics simulation only, ~30KB) + hand-rendered SVG — the same "one focused library, own rendering" pattern as Leaflet in Milestone 5. Nodes are colored by type (Person/Crime/Vehicle/Weapon/Phone/Address) using the same categorical palette validated back in Milestone 4; edges are draggable, hoverable, and link through to the underlying Person record.

Used in two places:
- **`/network`**, "Gang & Criminal Networks" tab — one graph per detected community.
- **Person detail page**, new "Network Graph" section (Admin/Analyst only) — the person's own ego-network, replacing what used to be a placeholder line of text ("worth checking Network & Link Analysis... once available") written back in Milestone 3B specifically anticipating this milestone.

### A third real bug, caught by looking at the actual rendered graph, not the data

A 27-member detected community rendered with only ~8 visible nodes — the rest were physically off-screen. `forceCenter` only recenters the *average* position of the whole simulation; it does nothing to stop an individual weakly-connected node from being repelled by `forceManyBody` out past the visible viewBox, which is exactly what happens in a sparse, large community. Fixed two ways: a mild `forceX`/`forceY` containment force pulling every node toward the canvas center regardless of its own connectivity, plus a hard position clamp at render time as a backstop — so no node can ever be invisible, no matter what the physics does. Verified by re-screenshotting the same 27-member community and counting all 27 circles.

### A fourth bug, unrelated to this milestone's own code but caught while reviewing its output

Looking at the Person detail page's Network Graph section surfaced that its Crime History table had shown "—" in the FIR column for *every single row, for every person, since Milestone 3B* — the `PersonsService.findOne` Prisma query never included `fir` on the nested crime relation, so `link.crime.fir` was always `undefined`. The exact same omission existed in `VehiclesService.findOne`. Both fixed. This wasn't something Milestone 6 broke — it was a real defect sitting in production-facing UI for three milestones, only caught because a fresh visual artifact (the ego-graph) prompted a close look at a screen that hadn't been scrutinized that carefully since.

## 7. Verified

Full browser pass as Analyst: Repeat Offenders tab (top offender: 38 crimes, expandable case list with real FIR numbers/categories/stations) → Hidden Associations tab (10 results across all three via-types: address, phone, vehicle) → Gang Networks tab (14 communities detected, sizes 3–27) → expanded a 27-member community's graph and confirmed all 27 nodes visible and clustered correctly → clicked into a repeat offender's Person page and confirmed the new Network Graph section renders their ego-network with the center node visually highlighted. Confirmed as Officer: no "Network" nav link at all, and a direct API call returns 403. Zero console errors throughout.

## 8. Future Enhancements

- Keep `CO_SUSPECT` edges live as new crimes are recorded, rather than only at seed time (an incremental update on crime-person link creation, or a scheduled recompute) — not built now since there's no live data-entry pipeline yet to keep it in sync with.
- Centrality metrics (e.g., PageRank/betweenness within a detected community) to surface "who's the key figure" — degree is implicitly visible in the graph today (more edges = more connected) but isn't computed or ranked explicitly.
- Pan/zoom on `GraphView` (currently fixed viewport + drag-to-reposition only).
- Extend hidden-association detection to co-location patterns (shared crime address/scene proximity), not just phone/address/vehicle.

---

**Awaiting your review. Next up per the roadmap: Milestone 7 — AI Intelligence.**
