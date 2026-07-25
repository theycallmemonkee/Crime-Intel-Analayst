import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface RequestUser {
  userId: string;
  username: string;
  role: Role;
  districtId: string | null;
  stationId: string | null;
}

// Officers are scoped to their own station; Admin and Analyst are state-wide.
// This is the one rule every crime-data write/read path in this module goes
// through, so it lives in one place rather than being re-derived per-module.
export function assertCanWriteToStation(user: RequestUser, targetStationId: string): void {
  if (user.role === Role.ADMIN) return;
  if (user.role === Role.OFFICER && user.stationId === targetStationId) return;
  throw new ForbiddenException('You do not have write access to this police station\'s records.');
}

// Read scope is district-wide for Officers (broader than their station-only
// write scope, per the Milestone 1 role table) and unrestricted for
// Admin/Analyst — spread the result into a Prisma `where` clause.
export function districtScopeFilter(user: RequestUser): { districtId: string } | undefined {
  if (user.role === Role.OFFICER && user.districtId) {
    return { districtId: user.districtId };
  }
  return undefined;
}

// For endpoints that take an explicit districtId param (e.g. "generate the
// report for district X") rather than filtering a list — an Officer asking
// for a foreign district should get a clear 403, not a silently empty
// result from districtScopeFilter ANDing two contradictory conditions.
export function assertCanReadDistrict(user: RequestUser, districtId: string): void {
  if (user.role === Role.OFFICER && user.districtId !== districtId) {
    throw new ForbiddenException('You do not have read access to this district.');
  }
}
