import { Prisma } from '@prisma/client';
import { districtScopeFilter, RequestUser } from './jurisdiction.util';

export interface CrimeScopeFilters {
  districtId?: string;
  stationId?: string;
  categoryId?: string;
}

// Shared by every raw-SQL query that needs to scope "Crime" rows by
// jurisdiction + optional filters (currently Dashboards and Geospatial —
// both bypass Prisma's query builder for PostGIS/date_trunc functions it
// can't express). Kept in one place because this is jurisdiction-enforcement
// logic: duplicating it risks the two copies drifting and one of them
// under-scoping a role's read access.
export function buildCrimeScopeConditions(user: RequestUser, filters: CrimeScopeFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  const scope = districtScopeFilter(user);
  if (scope) conditions.push(Prisma.sql`"districtId" = ${scope.districtId}`);
  if (filters.districtId) conditions.push(Prisma.sql`"districtId" = ${filters.districtId}`);
  if (filters.stationId) conditions.push(Prisma.sql`"stationId" = ${filters.stationId}`);
  if (filters.categoryId) conditions.push(Prisma.sql`"categoryId" = ${filters.categoryId}`);
  return conditions;
}

export function crimeWhereClause(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}
