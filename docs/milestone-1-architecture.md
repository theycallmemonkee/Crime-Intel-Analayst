# Milestone 1 — Requirement Analysis, Architecture & Technology Selection

> **Scope note (revised):** this is a **prototype/MVP**, run entirely on a local machine via Docker Compose. No production deployment, no government SSO/CCTNS integration, no live sensitive data. All demo data is **synthetic**, generated to plausibly represent Karnataka districts/stations/crime records. Local auth with three fixed roles (Admin, Analyst, Officer). Production-hardening items (compliance, sovereign cloud, real SSO) are captured as Future Enhancements (§9) rather than built now — the architecture is still designed so they're an *addition* later, not a rewrite.

## 1. Objective

Establish the architectural foundation for a Crime Intelligence & Analytical Platform **prototype**, demonstrating every required capability (crime data management, dashboards, geospatial intelligence, network/link analysis, AI intelligence, reporting) against a synthetic dataset on a local Docker setup. This milestone produces no application code — it produces the decisions that all later milestones build on: what the system must do, how it is structured, what technology it runs on, and in what order it gets built.

Getting this wrong is expensive to undo later (a graph-shaped problem forced into a relational schema, or a monolith that can't isolate ML workloads), so we spend the effort here — even for a prototype, since the whole point is to demonstrate the *right* architecture, not just a working demo.

---

## 2. Requirement Analysis

### 2.1 Who uses this system

| Role | Primary need | Access level |
|---|---|---|
| Station-level Investigating Officer | Enter/update FIRs, crimes, suspects, evidence for their station | Write within own station, read within own district |
| District Superintendent | District-wide dashboards, drill-down into stations | Read district, read-only cross-station |
| SCRB Analyst | Network analysis, hotspot detection, AI predictions, state-wide reports | Read state-wide, no PII edit |
| SCRB Admin | User/role management, master data (districts, stations), audit review | Full admin, no case-data edit |

**For the prototype**, this collapses to three fixed roles — **Admin**, **Analyst**, **Officer** — matching the brief. Officer ≈ station-level investigator (CRUD on crime data), Analyst ≈ SCRB analyst (read + dashboards/network/AI/reports, no PII edit), Admin ≈ full access + user management. Fine-grained jurisdiction scoping (district superintendent seeing only their district) is a natural extension of this model (a `stationId`/`districtId` field on the user + a query filter) and is worth including even in the prototype since it's cheap and directly demonstrates the "Police Station Drill-down" requirement — but it rides on the same three roles, not a separate permission system.

This role table still matters architecturally: it's why **RBAC** is a first-class module from Milestone 2, not bolted on, and why every write (and, eventually, sensitive read) should go through an **audit log** — a real feature of the platform worth demonstrating, not compliance theater.

### 2.2 Functional requirements (from the brief, organized into capabilities)

1. **Crime Data Management** — CRUD + workflow for Crime Records, FIRs, Suspects, Victims, Witnesses, Police Stations, Districts, Crime Locations, Evidence, Weapons, Vehicles, with relationships between all of them (a Crime has an FIR, occurs at a Location, involves N Suspects/Victims/Witnesses/Weapons/Vehicles, is investigated by a Station).
2. **Dashboards** — aggregate views (counts, categories, district/station drill-down, monthly/yearly trends, growth rates, investigation status funnels).
3. **Geospatial Intelligence** — map-based visualization of Karnataka, hotspot detection, heatmaps at district/station granularity, time-windowed clustering.
4. **Network & Link Analysis** — multi-hop relationship discovery across suspects/victims/crimes/locations/vehicles/weapons/phone numbers/addresses; repeat-offender detection; hidden association discovery; gang/organization discovery via community detection.
5. **AI Intelligence** — trend prediction, high-risk area prediction, anomaly detection, pattern discovery, risk scoring.
6. **Reporting** — generate formatted intelligence/trend/district/investigation reports (exportable, likely PDF).

### 2.3 Non-functional requirements (not in the brief verbatim, but implied by the domain — flagging these explicitly rather than assuming them away)

- **Data sensitivity & chain of custody (design pattern, not enforced compliance)**: real crime data would demand attributable, immutable audit trails and evidence-integrity hashing. For the prototype we **build the pattern** (append-only audit log table, hash field on evidence records) against synthetic data, so the architecture demonstrates the requirement without claiming real compliance.
- **Jurisdictional data scoping**: simplified to a `stationId`/`districtId` field on the user plus a query filter (see §2.1) rather than a full claims/ABAC system — same idea, prototype-weight implementation.
- **Availability vs. consistency**: crime-record writes (FIR filing) should be strongly consistent (ACID). Analytical views (dashboards, hotspots, graph analysis) can tolerate eventual consistency (seconds-to-minutes staleness) — this is the key insight that justifies a polyglot-persistence architecture (Section 4), and it holds regardless of prototype vs. production.
- **Auditability over raw performance**: even as a demo, outputs like risk scores should be explainable ("why was this person flagged") rather than a black-box number — this pushes toward interpretable techniques over opaque ones where the two are close in quality (Milestone 7 will revisit this).
- **Deployability**: local machine, Docker Compose only. No Kubernetes, no cloud, no sovereign-region concerns for this iteration — explicitly deferred (§9).
- **Scale**: synthetic dataset sized to comfortably demonstrate every feature (thousands of crime records across Karnataka's ~30 districts) — not a real-scale load test. Indexing/partitioning strategy is chosen for correctness and to *illustrate* scale-awareness, not to survive a genuine tens-of-millions-of-rows workload.

---

## 3. System Architecture

### 3.1 Architecture style: Modular Monolith + specialized satellite services

**Options considered:**

| Style | Pros | Cons | Verdict |
|---|---|---|---|
| Monolith (single stack, single DB) | Simplest to build/deploy/debug | Cannot cleanly host graph queries, ML workloads, or geospatial clustering in one paradigm; becomes a ball of mud as modules grow | Rejected |
| Full microservices (10+ services from day one) | Maximum decomposition, independent scaling | High operational overhead (service mesh, distributed tracing, distributed transactions) for a team starting from zero; premature for current scale | Rejected |
| **Modular monolith (core API) + 2 satellite services (Graph service, AI/ML service)** | Clean module boundaries via bounded contexts inside one deployable; genuinely different tech needs (Cypher, Python ML) get their own service instead of being forced into the main stack; can peel modules into microservices later per bounded context without a rewrite | Slightly more moving parts than a pure monolith at the start | **Chosen** |

Rationale: two of the six capabilities (Network & Link Analysis, AI Intelligence) have hard technology requirements that don't fit a single-language monolith — graph traversal wants a native graph database and Cypher/Gremlin, and ML wants Python's ecosystem. Rather than shoehorning both into the main API's language, we isolate them as separate services from day one, communicating over well-defined APIs and an event feed. Everything else (Crime Data Management, Dashboards, Geospatial via PostGIS, Reporting) shares one modular core, organized internally by bounded context (SOLID module boundaries, not physical separation) so it *could* be split later, but isn't yet, because there's no forcing requirement to.

### 3.2 High-level module map (bounded contexts)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Frontend (Next.js)                  │
│   Dashboards | Map/Geo UI | Network Graph UI | Reports | Admin   │
└───────────────────────────────┬───────────────────────────────---┘
                                 │ REST/GraphQL (BFF)
┌────────────────────────────────▼──────────────────────────────---┐
│                     Core API — Modular Monolith (NestJS)        │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐ │
│  │ Identity &    │ │ Crime Data    │ │ Geospatial Intelligence│ │
│  │ Access (RBAC, │ │ Management    │ │ (PostGIS: hotspots,    │ │
│  │ Audit Log)    │ │ (FIR, Crimes, │ │ heatmaps, clustering)  │ │
│  │               │ │ Persons,      │ │                        │ │
│  │               │ │ Evidence,     │ │                        │ │
│  │               │ │ Weapons,      │ │                        │ │
│  │               │ │ Vehicles)     │ │                        │ │
│  └───────────────┘ └───────────────┘ └────────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐                            │
│  │ Dashboard &   │ │ Reporting     │                            │
│  │ Analytics     │ │ Service       │                            │
│  └───────────────┘ └───────────────┘                            │
└──────┬───────────────────────┬───────────────────────────┬──--───┘
       │ events (outbox)       │ sync query                │ sync query
┌──────▼──────────┐   ┌────────▼─────────┐        ┌─────────▼────────┐
│  PostgreSQL +    │   │  Network & Link  │        │  AI Intelligence │
│  PostGIS         │   │  Analysis Service│        │  Service (Python │
│  (system of      │   │  (Python/FastAPI │        │  /FastAPI)       │
│  record)         │   │  + Neo4j)        │        │                  │
└──────────────────┘   └──────────────────┘        └──────────────────┘
       │
┌──────▼──────────┐   ┌──────────────────┐
│  Redis (cache,   │   │  MinIO (object   │
│  queues)         │   │  storage: evidence)│
└──────────────────┘   └──────────────────┘
```

Data flows one direction for analytics: PostgreSQL is the **system of record** for all writes (FIRs, crimes, persons, evidence). An outbox/event stream propagates changes to Neo4j (graph projections) and materialized aggregates (dashboards) asynchronously. This means the Network Analysis and AI services never write back to the record system directly — they are read-side consumers, which keeps the system-of-record simple and auditable while letting graph/ML workloads scale and evolve independently.

### 3.3 Why this shape specifically answers the six capability areas

- **Crime Data Management** → Core API + PostgreSQL (strong consistency, relational integrity, foreign keys between FIR/crime/persons/stations).
- **Dashboards** → Dashboard module reading materialized aggregates (rollup tables refreshed on event, not computed live on every request at scale).
- **Geospatial Intelligence** → PostGIS extension on the same Postgres (avoids a separate geo-database; PostGIS is mature enough for hotspot/heatmap queries via `ST_ClusterDBSCAN` and spatial indexes).
- **Network & Link Analysis** → dedicated Neo4j-backed service — this is the one capability that is fundamentally graph-shaped (multi-hop "suspect shares a phone number with a witness who co-owns a vehicle used in another case" queries are natural in Cypher, painful as recursive SQL CTEs).
- **AI Intelligence** → dedicated Python service — trend prediction/anomaly detection/risk scoring all live in Python's data-science ecosystem; isolating it means ML model updates/retraining don't risk the transactional core.
- **Reporting** → a module that composes data from the other modules (mostly the Core API's own data plus optional graph/AI summaries) into exportable documents.

---

## 4. Technology Selection (with alternatives compared)

### 4.1 Backend — Core API

| Option | Assessment |
|---|---|
| **NestJS (Node.js/TypeScript)** | Opinionated, modular by design (modules/providers/DI mirror bounded contexts directly), first-class TypeScript, mature ecosystem for REST/GraphQL, guards/interceptors map cleanly to RBAC + audit-logging cross-cutting concerns. |
| Django (Python) | Batteries-included, but ORM/admin conventions push toward monolith-first thinking that fights our modular boundaries; would also mean the Core API and AI service share a language, tempting future engineers to blur the boundary we deliberately drew in 3.1. |
| Spring Boot (Java) | Excellent for large regulated enterprises (this *is* a regulated domain), very mature security ecosystem (Spring Security), but slower dev velocity and heavier ceremony than justified at this stage; a defensible future migration target if the org standardizes on JVM, not a reason to start there. |
| Go (Gin/Fiber) | Excellent performance/simplicity, but weaker fit for rapidly evolving CRUD-heavy business logic with many entities and relationships (more boilerplate per entity, less mature ORM/validation ecosystem than TS or Java). |

**Chosen: NestJS.** Best balance of structure (SOLID/DI baked in, so "clean architecture" isn't something we have to bolt on), TypeScript's type safety across a schema with a lot of interrelated entities, and shared language with the frontend (reduces context-switching, enables shared DTO/type packages in a monorepo).

### 4.2 AI/ML & Network Analysis services

**Python (FastAPI)** for both — not really a contest. NetworkX/`neo4j-graph-data-science`, scikit-learn, Prophet/statsmodels, PyOD (anomaly detection) are the standard tools for exactly this work, and re-implementing them in Node/Java would be pure cost with no benefit. FastAPI gives async performance and automatic OpenAPI docs, keeping it consistent with the rest of the API surface.

### 4.3 Frontend

| Option | Assessment |
|---|---|
| **Next.js (React + TypeScript)** | File-based routing, good DX, strong charting (Recharts/visx) and mapping (react-leaflet) ecosystem, can run as SSR or pure SPA depending on deployment constraints. |
| Vue/Nuxt | Comparable capability, smaller hiring pool for this domain, no material advantage over Next.js here. |
| Angular | Strong for large enterprise teams with strict conventions, but steeper learning curve and heavier bundle than needed for a dashboard-and-map-heavy app. |

**Chosen: Next.js.** Also lets us share TypeScript types with the NestJS backend in a monorepo, cutting down integration bugs.

### 4.4 Databases — polyglot persistence, justified per workload

| Store | Used for | Why not something else |
|---|---|---|
| **PostgreSQL + PostGIS** | System of record: FIR, crimes, persons, stations, districts, evidence metadata, weapons, vehicles; also geospatial queries (hotspots, heatmaps) | Relational integrity (FKs) matters for legal records; PostGIS is a mature, widely-deployed geospatial extension — no need for a separate geo-database (e.g., a dedicated spatial DB) for our scale. |
| **Neo4j** | Network & link analysis: suspects/victims/vehicles/weapons/phones/addresses graph, repeat-offender & gang detection via graph algorithms (PageRank, Louvain/community detection, shortest path) | Relational recursive CTEs *can* express multi-hop joins but degrade badly past 2-3 hops and are unreadable/unmaintainable; a native graph DB with Cypher plus the Graph Data Science library is purpose-built for exactly "hidden association" and "gang network" discovery. |
| **Redis** | Caching, session store, job queues (BullMQ) for the event propagation pipeline | Standard choice, lightweight enough to run as one more Docker Compose service. |
| **Object storage (MinIO, self-hosted, via Docker Compose)** | Evidence files (photos, documents) | Keeps large binaries out of Postgres; MinIO is one `docker-compose` service and is S3-API-compatible, so a real AWS S3 swap later is config-only, not a rewrite. |

**Deferred for the prototype: Elasticsearch.** Full-text/fuzzy search over names and FIR narrative text is a real requirement, but for MVP scope Postgres's own full-text search + `pg_trgm` (trigram similarity, handles typos/misspellings reasonably well) covers it without adding a fourth datastore to run locally. If fuzzy-match quality turns out to matter for the demo, Elasticsearch is a clean drop-in later (§9) — not adding it now is a deliberate scope cut, not an oversight.

**Data sync between stores:** transactional outbox pattern (write to Postgres + outbox table in one transaction → a worker publishes to Redis Streams/BullMQ → a consumer updates Neo4j). Simple enough to run and reason about locally, and the same pattern would scale to Kafka/Debezium later (§9) without changing the producer side.

### 4.5 Maps

**Leaflet + self-hostable OSM tiles**, not Mapbox/Google Maps. Reasoning: government crime-location data displayed on a third-party-hosted map service means every map pan/zoom potentially leaks investigation-area-of-interest metadata to that vendor, and recurring per-load costs/vendor lock-in are avoidable. Leaflet is open-source, works with a self-hosted tile server, and is fully sufficient for the choropleth/heatmap/marker-cluster needs described. (Mapbox GL remains a fallback option if 3D/vector-tile rendering becomes a hard requirement later — noted as a future option, not adopted now.)

### 4.6 Auth & Security (prototype scope)

- **Local authentication**: email/username + password (bcrypt-hashed), issued as a short-lived JWT access token + refresh token via NestJS + Passport — no external identity provider. This is a straightforward, well-understood pattern that fully demonstrates the auth flow without needing an OIDC provider running locally.
- **RBAC with three seeded roles** — Admin, Analyst, Officer — enforced via NestJS guards on every endpoint. Officer/Analyst additionally scoped by `stationId`/`districtId` (§2.1) for the drill-down/jurisdiction demo.
- **Audit log** (append-only Postgres table: who, what, when, on which record) for all writes — kept in scope for the prototype because it's cheap to build and directly demonstrates a named platform requirement, not because of real compliance need.
- **Not in scope for the prototype** (see §9): OIDC/government SSO, field-level encryption at rest, penetration testing, key-management infrastructure. The auth module is still built behind an interface so a real identity provider could replace the local strategy later without touching RBAC/guard logic.

### 4.7 Infrastructure (prototype scope)

- **Docker Compose only** — one `docker-compose up` brings up Postgres+PostGIS, Neo4j, Redis, MinIO, the core API, the two Python services, and the frontend. This *is* the deployment target; no Kubernetes, no Terraform, no cloud environment for this phase.
- **GitHub Actions** for CI (lint, unit tests, build) — no deploy step needed since there's no deployment target yet.
- Production infrastructure (Kubernetes, IaC, sovereign-cloud/on-prem decision) is explicitly deferred to a future phase, if/when this moves beyond prototype (§9).

---

## 5. Monorepo Folder Structure (target shape — created incrementally per milestone, not all at once)

```
crime-intel-platform/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── core-api/               # NestJS modular monolith
│   ├── network-analysis-service/   # Python/FastAPI + Neo4j
│   └── ai-intelligence-service/    # Python/FastAPI ML service
├── packages/
│   ├── shared-types/            # Shared TS DTOs/interfaces (frontend <-> core-api)
│   └── ui-components/           # Shared React component library
├── infra/
│   └── docker-compose.yml       # Postgres+PostGIS, Neo4j, Redis, MinIO, all apps
├── docs/
│   ├── milestone-1-architecture.md   # this document
│   └── ...                      # one doc per milestone going forward
└── .github/workflows/
```

Nothing beyond `README.md` and `docs/` has been created yet — the rest is scaffolded starting in Milestone 2 once this plan is approved.

---

## 6. Development Roadmap

| # | Milestone | Delivers |
|---|---|---|
| 1 | **Architecture & Planning** *(this milestone)* | Requirements, architecture, tech selection, roadmap |
| 2 | Foundation | Monorepo scaffold, Docker Compose (Postgres+PostGIS, Neo4j, Redis, MinIO), Postgres schema v1, local auth/RBAC (Admin/Analyst/Officer) + audit log, synthetic data generator/seed script, CI skeleton |
| 3 | Crime Data Management | CRUD APIs + UI for FIR, Crimes, Suspects, Victims, Witnesses, Stations, Districts, Evidence, Weapons, Vehicles |
| 4 | Dashboards | Aggregation APIs, materialized rollups, dashboard UI (totals, categories, district/station drill-down, time trends) |
| 5 | Geospatial Intelligence | PostGIS hotspot/heatmap queries, Karnataka map UI, time-windowed clustering |
| 6 | Network & Link Analysis | Neo4j service, sync pipeline, repeat-offender/gang/hidden-association queries, graph visualization UI |
| 7 | AI Intelligence | Trend prediction, high-risk area prediction, anomaly detection, risk scoring |
| 8 | Reporting | Report generation/export (PDF), templated intelligence/trend/district/investigation reports |
| 9 | Polish & Demo Readiness | Basic input validation/rate limiting, cross-feature bug pass, seed-data refinement, one-command run instructions, final documentation |

Each milestone will follow the full format the brief requires (objective → requirements → architecture → design → implementation → decisions → testing → future enhancements) and stops for approval before the next begins.

---

## 7. Testing Strategy (overview — detailed per-milestone)

- **Unit**: Jest (NestJS/frontend), pytest (Python services) — target high coverage on business logic, not on framework glue.
- **Integration**: Testcontainers spinning up real Postgres/Neo4j/Redis instances in CI (not mocks) — a passing test against a mocked DB that doesn't match real query behavior (especially PostGIS/Cypher queries) would be worse than no test.
- **E2E**: Playwright for critical investigator workflows (file FIR → add suspect → see it on dashboard/map/graph).
- **Security**: dependency scanning (Dependabot) and basic input-validation tests. Load testing and formal pen-testing are out of scope for a local prototype (§9).

---

## 8. MVP Scope Decisions (resolved)

Per your direction, these replace the open questions from the original draft:

1. **Deployment**: local machine only, via Docker Compose. No production target, no Kubernetes/Terraform for this phase.
2. **Data source**: no live/government database connection. A synthetic dataset generator (Milestone 2) produces realistic Karnataka crime/FIR/person/vehicle/weapon records — sized to comfortably demonstrate dashboards, hotspots, and network/AI features.
3. **Auth**: simple local authentication (username/password, JWT) with three fixed roles — Admin, Analyst, Officer. No government SSO/OIDC integration.
4. **Scale**: sized for demonstration, not load-tested at production volume.

---

## 9. Future Enhancements (explicitly deferred, not forgotten — the path from prototype to production)

- **Elasticsearch** for fuzzy/full-text search, if Postgres `pg_trgm` proves insufficient.
- **Kubernetes + Terraform + a real deployment target** (on-prem/sovereign cloud/cloud — a decision for if/when this leaves prototype stage).
- **Government SSO/OIDC integration**, replacing local auth behind the same interface.
- **Field-level encryption, formal audit/compliance review, pen-testing** — the audit-log/RBAC scaffolding built in the prototype is designed to carry this later without a rewrite.
- **Kafka/Debezium CDC** if event volume outgrows the outbox+queue pattern.
- Mobile app for field officers (offline-first FIR capture).
- Integration with real external systems (CCTNS, e-Courts) once/if a live data source is identified.
- Multi-state / multi-bureau federation if scope expands beyond Karnataka.
- Explainable-AI layer (SHAP/LIME) on top of risk-scoring models for defensible AI output.

---

**Awaiting your approval to proceed to Milestone 2 (Foundation: monorepo scaffold, Docker Compose stack, schema v1, local auth/RBAC, synthetic data generator, CI skeleton).**
