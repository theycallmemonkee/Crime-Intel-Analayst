-- pg_trgm powers fuzzy/typo-tolerant name search (see Milestone 1: chosen
-- over standing up Elasticsearch for the prototype). Prisma's schema diff
-- doesn't understand generated columns, so this file replaces its
-- auto-generated (and destructive) draft rather than using it as-is.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Person_fullName_trgm_idx" ON "Person" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX "Person_addressLine_trgm_idx" ON "Person" USING GIN ("addressLine" gin_trgm_ops);
CREATE INDEX "Vehicle_registrationNumber_trgm_idx" ON "Vehicle" USING GIN ("registrationNumber" gin_trgm_ops);
