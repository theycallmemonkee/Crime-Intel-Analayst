-- Only the intended change — Prisma's auto-diff also proposed dropping the
-- pg_trgm and PostGIS indexes it doesn't track in schema.prisma (see prior
-- migrations' comments); that draft is discarded rather than applied.

ALTER TABLE "CrimeCategory" ADD COLUMN "severityWeight" INTEGER NOT NULL DEFAULT 5;
