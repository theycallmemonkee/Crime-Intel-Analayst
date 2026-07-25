-- PostGIS ships as a Postgres extension; it must be explicitly created in
-- each database that uses it (the postgis/postgis image doesn't do this for
-- Prisma's shadow database, only for the main one).
CREATE EXTENSION IF NOT EXISTS postgis;

-- Adds a real PostGIS geometry column to "Crime", generated automatically
-- from the latitude/longitude columns Prisma already manages. Prisma never
-- needs to know about the `geom` column — it's derived, not written to
-- directly — which is why it's a hand-written migration rather than
-- something modeled in schema.prisma.

ALTER TABLE "Crime"
  ADD COLUMN "geom" geometry(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)) STORED;

CREATE INDEX "Crime_geom_idx" ON "Crime" USING GIST ("geom");
