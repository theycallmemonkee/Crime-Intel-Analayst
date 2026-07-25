# Contributing to Crime Intelligence & Analytical Platform

Thanks for your interest in improving this project. It's a prototype/MVP, so
expect the codebase to be small and opinionated rather than exhaustively
configurable — please keep that spirit in mind for contributions.

## Getting set up

Follow the [Installation](README.md#installation) and
[Running Locally](README.md#running-locally) sections of the README to get
the full stack (Postgres+PostGIS, Neo4j, `core-api`, `web`) running before
you start making changes.

## Project structure

This is an npm-workspaces monorepo:

- `apps/core-api` — NestJS REST API (TypeScript, Prisma, PostgreSQL/PostGIS, Neo4j)
- `apps/web` — Next.js frontend (TypeScript, React, Leaflet, d3-force)
- `infra` — local Docker Compose services
- `docs` — milestone-by-milestone architecture and design notes

See the README's [Folder Structure](README.md#folder-structure) section for
more detail.

## Making a change

1. Create a branch off `main` for your change.
2. Keep changes scoped — a bug fix shouldn't carry along unrelated
   refactors, and a new feature shouldn't touch unrelated modules.
3. Match the existing conventions in the file/module you're editing (see
   below) rather than introducing a new pattern for a single change.
4. If you touch `apps/core-api/prisma/schema.prisma`, generate a migration
   with `npm run prisma:migrate --workspace apps/core-api` and commit the
   generated `prisma/migrations/*` folder alongside your change.
5. Run the build for any app you changed before opening a PR (see below).
6. Open a pull request describing what changed and why. Screenshots are
   appreciated for `apps/web` UI changes.

## Conventions

- **Language**: TypeScript everywhere, `strict` mode on. Avoid `any`.
- **Backend modules**: one NestJS module per domain
  (`crimes`, `persons`, `network`, `ai`, ...), each with its own
  `*.controller.ts`, `*.service.ts`, `*.module.ts`, and a `dto/` folder for
  request DTOs. Follow this shape for new modules.
- **Naming**: kebab-case for files and folders, PascalCase for
  classes/types, camelCase for variables/functions, SCREAMING_SNAKE_CASE for
  environment variables.
- **Access control**: protected endpoints use `JwtAuthGuard` +
  `RolesGuard` (`@Roles(...)`) and, where relevant, the jurisdiction-scoping
  helpers in `apps/core-api/src/common/`. New endpoints that expose
  district/station-level data should follow the same pattern rather than
  reinventing scoping logic.
- **Frontend data fetching**: use the shared `apiFetch`/`useApi` helpers in
  `apps/web/src/lib/api.ts` and `apps/web/src/lib/auth-context.tsx` instead
  of calling `fetch` directly, so auth headers and 401 handling stay
  consistent.
- **No new heavy dependencies** for something a few dozen lines of code can
  do — this prototype intentionally avoids a chart library, an HTTP client
  library, and a PDF library. If you think one is genuinely needed, raise it
  in your PR description rather than adding it silently.

## Verifying your change builds

```bash
# Backend
npm run build --workspace apps/core-api

# Frontend
npm run build --workspace apps/web
```

Both should complete with no TypeScript errors.

## Reporting issues

Open a GitHub issue with steps to reproduce, what you expected, and what
actually happened.
