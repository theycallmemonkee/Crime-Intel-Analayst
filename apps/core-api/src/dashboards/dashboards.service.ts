import { Injectable } from '@nestjs/common';
import { InvestigationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { districtScopeFilter, RequestUser } from '../common/jurisdiction.util';
import { buildCrimeScopeConditions, crimeWhereClause } from '../common/sql-scope.util';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

const ALL_STATUSES: InvestigationStatus[] = [
  'REPORTED',
  'UNDER_INVESTIGATION',
  'CHARGESHEETED',
  'CLOSED',
];

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(user: RequestUser, query: QueryDashboardDto): Prisma.CrimeWhereInput {
    return {
      ...districtScopeFilter(user),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.stationId ? { stationId: query.stationId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
  }

  async summary(user: RequestUser, query: QueryDashboardDto) {
    const where = this.buildWhere(user, query);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, active, closed, chargesheeted, currentMonthCount, previousMonthCount] =
      await this.prisma.$transaction([
        this.prisma.crime.count({ where }),
        this.prisma.crime.count({
          where: { ...where, status: { in: ['REPORTED', 'UNDER_INVESTIGATION'] } },
        }),
        this.prisma.crime.count({ where: { ...where, status: 'CLOSED' } }),
        this.prisma.crime.count({ where: { ...where, status: 'CHARGESHEETED' } }),
        this.prisma.crime.count({ where: { ...where, occurredAt: { gte: currentMonthStart } } }),
        this.prisma.crime.count({
          where: { ...where, occurredAt: { gte: previousMonthStart, lt: currentMonthStart } },
        }),
      ]);

    const growthPct =
      previousMonthCount === 0
        ? null
        : Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 1000) / 10;

    return {
      totalCrimes: total,
      activeInvestigations: active,
      closedCases: closed,
      chargesheeted,
      growth: { currentMonthCount, previousMonthCount, percentChange: growthPct },
    };
  }

  async byCategory(user: RequestUser, query: QueryDashboardDto) {
    const where = this.buildWhere(user, query);
    const [grouped, categories] = await Promise.all([
      this.prisma.crime.groupBy({ by: ['categoryId'], where, _count: true }),
      this.prisma.crimeCategory.findMany(),
    ]);
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    return grouped
      .map((g) => ({ categoryId: g.categoryId, name: nameById.get(g.categoryId) ?? 'Unknown', count: g._count }))
      .sort((a, b) => b.count - a.count);
  }

  async byDistrict(user: RequestUser, query: QueryDashboardDto) {
    const where = this.buildWhere(user, query);
    const [grouped, districts] = await Promise.all([
      this.prisma.crime.groupBy({ by: ['districtId'], where, _count: true }),
      this.prisma.district.findMany(),
    ]);
    const nameById = new Map(districts.map((d) => [d.id, d.name]));
    return grouped
      .map((g) => ({ districtId: g.districtId, name: nameById.get(g.districtId) ?? 'Unknown', count: g._count }))
      .sort((a, b) => b.count - a.count);
  }

  async byStation(user: RequestUser, query: QueryDashboardDto) {
    const where = this.buildWhere(user, query);
    const [grouped, stations] = await Promise.all([
      this.prisma.crime.groupBy({ by: ['stationId'], where, _count: true }),
      this.prisma.policeStation.findMany(),
    ]);
    const nameById = new Map(stations.map((s) => [s.id, s.name]));
    return grouped
      .map((g) => ({ stationId: g.stationId, name: nameById.get(g.stationId) ?? 'Unknown', count: g._count }))
      .sort((a, b) => b.count - a.count);
  }

  async byStatus(user: RequestUser, query: QueryDashboardDto) {
    const where = this.buildWhere(user, query);
    const grouped = await this.prisma.crime.groupBy({ by: ['status'], where, _count: true });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count]));
    // Always return all four statuses, zero-filled — the UI draws one
    // stacked bar and a missing segment would misread as "doesn't exist"
    // rather than "zero".
    return ALL_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }

  async monthlyTrend(user: RequestUser, query: QueryDashboardDto, year: number) {
    const conditions = buildCrimeScopeConditions(user, query);
    conditions.push(Prisma.sql`"occurredAt" >= ${new Date(year, 0, 1)}`);
    conditions.push(Prisma.sql`"occurredAt" < ${new Date(year + 1, 0, 1)}`);
    const where = crimeWhereClause(conditions);

    const rows = await this.prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT date_trunc('month', "occurredAt") AS month, COUNT(*) AS count
      FROM "Crime"
      ${where}
      GROUP BY month
      ORDER BY month
    `;
    const countByMonth = new Map(rows.map((r) => [r.month.toISOString().slice(0, 7), Number(r.count)]));
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { month: key, count: countByMonth.get(key) ?? 0 };
    });
  }

  async yearlyTrend(user: RequestUser, query: QueryDashboardDto) {
    const conditions = buildCrimeScopeConditions(user, query);
    const where = crimeWhereClause(conditions);

    const rows = await this.prisma.$queryRaw<{ year: Date; count: bigint }[]>`
      SELECT date_trunc('year', "occurredAt") AS year, COUNT(*) AS count
      FROM "Crime"
      ${where}
      GROUP BY year
      ORDER BY year
    `;
    const series = rows.map((r) => ({ year: r.year.getFullYear(), count: Number(r.count) }));
    return series.map((point, i) => {
      const prev = series[i - 1];
      const growthPct = !prev || prev.count === 0 ? null : Math.round(((point.count - prev.count) / prev.count) * 1000) / 10;
      return { ...point, growthPct };
    });
  }
}
