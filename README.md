# Crime Intelligence & Analytical Platform

A prototype/MVP investigation intelligence platform for a state crime
records bureau — crime records, geospatial intelligence, network/link
analysis, and statistical prediction over a synthetic Karnataka crime
dataset. Runs entirely locally via Docker.

This project follows an iterative, milestone-based development process.
Each milestone is documented under [`docs/`](docs/) before implementation
began; milestones 1–8 are complete.

## Table of contents

- [Project overview](#project-overview)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Running locally](#running-locally)
- [API overview](#api-overview)
- [Folder structure](#folder-structure)
- [Future scope](#future-scope)
- [License](#license)

## Project overview

The platform gives an investigator a single place to go from "file a case"
to "find the pattern": crime records and FIRs, a geospatial hotspot map, a
suspect/vehicle relationship graph, and a small transparent statistics
engine (trend forecasting, anomaly detection, risk scoring) sit behind one
role-based, jurisdiction-scoped API.

It is a working MVP, not a finished product — see [Future scope](#future-scope)
for what's intentionally out of scope today.

## Features

- **Authentication & access control** — JWT login, three roles
  (`ADMIN` / `ANALYST` / `OFFICER`), and jurisdiction scoping so an Officer
  automatically sees only their own station/district.
- **Crime management** — file a crime with an auto-generated FIR number,
  link persons/vehicles/weapons/evidence to a case, track investigation
  status, filter and search the case list.
- **Dashboards** — KPI summary, breakdowns by category/district/station/status,
  monthly and yearly trend charts.
- **Geospatial intelligence** — an interactive map with a crime-density
  heatmap and PostGIS `ST_ClusterDBSCAN`-powered hotspot clustering.
- **Network / link analysis** — repeat-offender detection, hidden-association
  discovery (suspects linked by a shared phone/address/vehicle who've never
  been charged together), and gang/community detection via Neo4j's Graph
  Data Science Louvain algorithm, rendered as an interactive force-directed
  graph.
- **Statistical intelligence** — linear-regression trend forecasting,
  z-score anomaly detection, weighted high-risk-area scoring, and per-suspect
  risk scoring. Every method is a documented formula, not a black-box model.
- **Reports** — an intelligence briefing, a trend report, a per-district
  report, and a per-case investigation report, each exportable via the
  browser's native print-to-PDF.
- **Search** — typo-tolerant fuzzy search over persons and vehicles
  (PostgreSQL trigram similarity).

See [`docs/`](docs/) for the milestone-by-milestone design notes behind each
of these.

## Technology stack

| Layer | Technology |
|---|---|
| Backend framework | [NestJS](https://nestjs.com/) (TypeScript) |
| ORM / migrations | [Prisma](https://www.prisma.io/) |
| Relational + spatial database | [PostgreSQL 16](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) |
| Fuzzy search | PostgreSQL `pg_trgm` extension |
| Graph database | [Neo4j 5](https://neo4j.com/) Community + Graph Data Science plugin |
| Authentication | JWT (`@nestjs/jwt`, `passport-jwt`), `bcrypt` password hashing |
| Validation | `class-validator` / `class-transformer` |
| Frontend framework | [Next.js 15](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) |
| Maps | [Leaflet](https://leafletjs.com/) + `leaflet.heat`, OpenStreetMap tiles |
| Graph visualization | [d3-force](https://github.com/d3/d3-force) (physics) + hand-built SVG rendering |
| Language | TypeScript throughout, `strict` mode |
| Local orchestration | Docker Compose |
| Synthetic data | [Faker.js](https://fakerjs.dev/) (seed script only) |

No paid or external APIs are required — map tiles are free OpenStreetMap,
and report export uses the browser's native print dialog.

## Architecture

```
                     ┌──────────────────────────────┐
                     │  USER — browser, localhost    │
                     └───────────────┬────────────────┘
                                     │
                                     ▼
                     ┌──────────────────────────────┐
                     │  apps/web — Next.js 15         │  http://localhost:3001
                     │  Leaflet map · d3-force graph  │
                     └───────────────┬────────────────┘
                                     │ REST/JSON, Bearer JWT
                                     ▼
                     ┌──────────────────────────────┐
                     │  apps/core-api — NestJS         │  http://localhost:3000
                     │  JwtAuthGuard → RolesGuard →    │
                     │  jurisdiction scope             │
                     └───────┬─────────────────┬────────┘
                Prisma (SQL) │                 │ neo4j-driver (Cypher)
                             ▼                 ▼
              ┌───────────────────┐  ┌───────────────────────┐
              │ PostgreSQL+PostGIS │  │ Neo4j 5 + GDS           │
              │ crime records,     │  │ suspect/case graph,     │
              │ hotspot clustering,│  │ Louvain community        │
              │ fuzzy search       │  │ detection, ego-graphs    │
              └───────────────────┘  └───────────────────────┘
```

The AI/statistics module runs in-process inside `core-api` and reads from
PostgreSQL only — there is no separate AI service and no external model
call. The Neo4j graph is populated by a one-time seed script
(`npm run db:seed:neo4j`, see below) rather than kept live-synced with new
crimes filed through the API.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) with Docker Compose

### Setup

```bash
git clone <this-repository-url>
cd crime-intel-platform
npm install
```

Copy the example environment files:

```bash
cp apps/core-api/.env.example apps/core-api/.env
cp apps/web/.env.example apps/web/.env.local
```

The defaults work out of the box with the bundled Docker Compose services —
note that Postgres is mapped to host port `55432` (not the default `5432`)
to avoid clashing with a local Postgres install; adjust `DATABASE_URL` if
that's not a concern on your machine.

## Running locally

```bash
npm run docker:up                               # Postgres+PostGIS and Neo4j
npm run db:migrate                              # first time only — applies Prisma migrations
npm run db:seed                                 # synthetic Karnataka dataset — seeds both Postgres and Neo4j
npm run dev:core-api                            # http://localhost:3000
npm run dev --workspace apps/web                # http://localhost:3001 (falls back if 3000 is taken)
```

Then open the web app and log in with one of the seeded accounts
(username / password):

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | ADMIN |
| `analyst` | `Analyst@123` | ANALYST |
| `officer.blr` | `Officer@123` | OFFICER (Bengaluru) |
| `officer.mys` | `Officer@123` | OFFICER (Mysuru) |

To stop the Docker services: `npm run docker:down`.

## API overview

All endpoints are served from `core-api` (`http://localhost:3000`) and,
except `POST /auth/login`, require an `Authorization: Bearer <token>`
header. Endpoints are further gated by role (`ADMIN` / `ANALYST` /
`OFFICER`) and, for Officers, scoped to their own district/station.

| Module | Base path | Purpose |
|---|---|---|
| Auth | `/auth` | Login, JWT issuance |
| Users | `/users` | Current user profile, user listing (admin) |
| Districts | `/districts` | District reference data |
| Stations | `/stations` | Police station reference data |
| Crime categories | `/crime-categories` | Category master data with severity weighting |
| Weapons | `/weapons` | Weapon registry |
| Persons | `/persons` | Person records, fuzzy search |
| Vehicles | `/vehicles` | Vehicle records, fuzzy search |
| Crimes | `/crimes` | Case filing, FIR, status, linking persons/vehicles/weapons/evidence |
| Dashboards | `/dashboards` | KPI summary and breakdowns |
| Geospatial | `/geospatial` | Crime points and PostGIS hotspot clustering |
| Network | `/network` | Repeat offenders, hidden associations, gang/community detection, ego-graphs |
| AI | `/ai` | Trend prediction, high-risk areas, anomalies, patterns, risk scores |
| Reports | `/reports` | Composed intelligence, trend, district, and case reports |

Full request/response shapes are defined by the DTOs in each module's
`dto/` folder and the Prisma schema (`apps/core-api/prisma/schema.prisma`).

## Folder structure

```
crime-intel-platform/
├── apps/
│   ├── core-api/                 # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # data model (source of truth)
│   │   │   ├── migrations/       # versioned SQL migrations
│   │   │   └── seed.ts           # Postgres synthetic data seed
│   │   ├── src/
│   │   │   ├── auth/             # JWT strategy, guards, login
│   │   │   ├── common/           # roles guard, jurisdiction scoping, shared stats
│   │   │   ├── crimes/           # case filing, FIR, linking
│   │   │   ├── dashboards/       # KPI aggregation
│   │   │   ├── geospatial/       # PostGIS hotspot/heatmap queries
│   │   │   ├── network/          # Neo4j Cypher + GDS queries
│   │   │   ├── ai/               # regression/anomaly/risk scoring
│   │   │   ├── reports/          # composed report endpoints
│   │   │   ├── database/synthetic/ # Faker-based dataset + Neo4j seed generator
│   │   │   └── ...               # persons, vehicles, weapons, stations, districts, users
│   │   └── .env.example
│   └── web/                      # Next.js frontend
│       ├── src/
│       │   ├── app/               # route pages (App Router)
│       │   ├── components/        # CrimeMap, GraphView, charts, shared UI
│       │   └── lib/                # api client, auth context, types
│       └── .env.example
├── infra/
│   └── docker-compose.yml         # Postgres+PostGIS and Neo4j services
├── docs/                          # milestone-by-milestone design notes
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Future scope

Documented gaps, called out explicitly rather than left implicit:

- **Live graph sync** — Neo4j is populated by a one-time seed script; crimes
  filed through the API after seeding don't yet appear in network/graph
  results.
- **Evidence file upload** — the `Evidence` model has an integrity-hash
  field, but there's no file upload endpoint or hashing logic yet.
- **Full audit logging** — an `AuditLog` model exists, but only login events
  currently write to it; record create/update actions don't yet.
- **User management UI/API** — users are provisioned via the seed script
  only; there's no create/update/deactivate endpoint or admin UI.
- **Server-side report export** — reports currently export via the
  browser's print-to-PDF; there's no server-generated PDF/CSV download.
- **Trained ML models** — the AI module is intentionally transparent
  statistics (regression, z-scores, weighted composites), not a trained
  model; a future iteration could add one alongside it.
- **Master-data management UI** — districts/stations are created via the
  API only; there's no admin form for this yet.

## License

Released under the [MIT License](LICENSE).
