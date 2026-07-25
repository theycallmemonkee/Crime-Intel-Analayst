import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { linearRegression, mean, minMaxNormalize, riskBand, stdDev, zScore } from '../common/stats.util';

const DAY_MS = 86_400_000;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  // --- Crime Trend Prediction ----------------------------------------------
  // Ordinary least squares over the last 12 months of counts, projected
  // forward. A straight-line fit, not a seasonal model — appropriate here
  // because the underlying synthetic data has no real seasonality to model;
  // see Milestone 7 docs for why this is the honest choice for this dataset.
  async trendPrediction(filters: { districtId?: string; stationId?: string; categoryId?: string }, monthsAhead: number) {
    const where: Prisma.CrimeWhereInput = {
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
      ...(filters.stationId ? { stationId: filters.stationId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };

    const now = new Date();
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const crimes = await this.prisma.crime.findMany({
      where: { ...where, occurredAt: { gte: historyStart } },
      select: { occurredAt: true },
    });

    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    const countByMonth = new Map(months.map((m) => [m, 0]));
    crimes.forEach((c) => {
      const key = monthKey(c.occurredAt);
      if (countByMonth.has(key)) countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1);
    });

    const historical = months.map((m, i) => ({ month: m, count: countByMonth.get(m) ?? 0, x: i }));
    const { slope, intercept, residualStdDev } = linearRegression(historical.map((h) => ({ x: h.x, y: h.count })));

    const predicted = Array.from({ length: monthsAhead }, (_, i) => {
      const x = 12 + i;
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const predictedCount = Math.max(0, Math.round(slope * x + intercept));
      const band = Math.round(residualStdDev);
      return {
        month: monthKey(futureDate),
        predictedCount,
        lowerBound: Math.max(0, predictedCount - band),
        upperBound: predictedCount + band,
      };
    });

    const trend = slope > 0.5 ? 'INCREASING' : slope < -0.5 ? 'DECREASING' : 'STABLE';

    return {
      historical: historical.map(({ month, count }) => ({ month, count })),
      predicted,
      slope: Math.round(slope * 100) / 100,
      trend,
      method: 'Linear regression (ordinary least squares) over the trailing 12 months.',
    };
  }

  // --- High-Risk Area Prediction --------------------------------------------
  // A composite risk index (recent volume + growth rate + severity mix,
  // each min-max normalized to 0-100 and weighted) — the standard technique
  // for combining heterogeneous indicators into one comparable score
  // (the same method behind indices like the HDI), not a trained model.
  async highRiskAreas(level: 'DISTRICT' | 'STATION', limit: number) {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 90 * DAY_MS);
    const priorStart = new Date(now.getTime() - 180 * DAY_MS);

    const crimes = await this.prisma.crime.findMany({
      where: { occurredAt: { gte: priorStart } },
      select: {
        occurredAt: true,
        districtId: true,
        stationId: true,
        district: { select: { name: true } },
        station: { select: { name: true } },
        category: { select: { severityWeight: true } },
      },
    });

    type Bucket = { id: string; name: string; recent: number; prior: number; severities: number[] };
    const buckets = new Map<string, Bucket>();

    for (const c of crimes) {
      const id = level === 'DISTRICT' ? c.districtId : c.stationId;
      const name = level === 'DISTRICT' ? c.district.name : c.station.name;
      if (!buckets.has(id)) buckets.set(id, { id, name, recent: 0, prior: 0, severities: [] });
      const b = buckets.get(id)!;
      if (c.occurredAt >= recentStart) {
        b.recent += 1;
        b.severities.push(c.category.severityWeight);
      } else {
        b.prior += 1;
      }
    }

    const rows = Array.from(buckets.values());
    const recentCounts = rows.map((r) => r.recent);
    const growthRates = rows.map((r) => (r.recent - r.prior) / Math.max(1, r.prior)) .map((g) => g * 100);
    const avgSeverities = rows.map((r) => (r.severities.length ? mean(r.severities) : 0));

    const normRecent = minMaxNormalize(recentCounts);
    const normGrowth = minMaxNormalize(growthRates);
    const normSeverity = minMaxNormalize(avgSeverities);

    const scored = rows.map((r, i) => {
      const score = Math.round(0.4 * normRecent[i] + 0.3 * normGrowth[i] + 0.3 * normSeverity[i]);
      return {
        id: r.id,
        name: r.name,
        recentCount: r.recent,
        priorCount: r.prior,
        growthRatePct: Math.round(growthRates[i] * 10) / 10,
        avgSeverity: Math.round(avgSeverities[i] * 10) / 10,
        riskScore: score,
        band: riskBand(score),
      };
    });

    return scored.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
  }

  // --- Anomaly Detection -----------------------------------------------------
  // z-score of each month's count against the other 11 months in that same
  // area's own history — flags months that stand out from that area's own
  // baseline, not against a global average (a quiet rural station and a busy
  // urban one shouldn't share a threshold).
  async anomalies(level: 'DISTRICT' | 'STATION', limit: number) {
    const now = new Date();
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const crimes = await this.prisma.crime.findMany({
      where: { occurredAt: { gte: historyStart } },
      select: {
        occurredAt: true,
        districtId: true,
        stationId: true,
        district: { select: { name: true } },
        station: { select: { name: true } },
      },
    });

    const months: string[] = [];
    for (let i = 11; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));

    type AreaSeries = { id: string; name: string; counts: Map<string, number> };
    const areas = new Map<string, AreaSeries>();
    for (const c of crimes) {
      const id = level === 'DISTRICT' ? c.districtId : c.stationId;
      const name = level === 'DISTRICT' ? c.district.name : c.station.name;
      if (!areas.has(id)) areas.set(id, { id, name, counts: new Map(months.map((m) => [m, 0])) });
      const series = areas.get(id)!.counts;
      const key = monthKey(c.occurredAt);
      if (series.has(key)) series.set(key, (series.get(key) ?? 0) + 1);
    }

    const anomalies: Array<{
      areaId: string;
      areaName: string;
      month: string;
      actualCount: number;
      expectedCount: number;
      zScore: number;
      direction: 'SPIKE' | 'DROP';
    }> = [];

    for (const area of areas.values()) {
      const series = months.map((m) => area.counts.get(m) ?? 0);
      for (let i = 0; i < series.length; i++) {
        const baseline = series.filter((_, j) => j !== i);
        const z = zScore(series[i], baseline);
        if (Math.abs(z) >= 2 && stdDev(baseline) > 0) {
          anomalies.push({
            areaId: area.id,
            areaName: area.name,
            month: months[i],
            actualCount: series[i],
            expectedCount: Math.round(mean(baseline)),
            zScore: Math.round(z * 100) / 100,
            direction: z > 0 ? 'SPIKE' : 'DROP',
          });
        }
      }
    }

    return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, limit);
  }

  // --- Pattern Discovery -------------------------------------------------
  // Descriptive analytics: when (day of week / time of day) each crime
  // category actually happens, from real occurrence timestamps — not a
  // learned model, just a question the data can answer directly.
  async patterns() {
    const crimes = await this.prisma.crime.findMany({
      select: { occurredAt: true, category: { select: { name: true } } },
    });

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periodOf = (hour: number) => {
      if (hour >= 6 && hour < 12) return 'Morning';
      if (hour >= 12 && hour < 18) return 'Afternoon';
      if (hour >= 18 && hour < 22) return 'Evening';
      return 'Night';
    };

    const byDay = new Map<string, Map<string, number>>(); // category -> day -> count
    const byPeriod = new Map<string, Map<string, number>>(); // category -> period -> count

    for (const c of crimes) {
      const cat = c.category.name;
      const day = DAY_NAMES[c.occurredAt.getDay()];
      const period = periodOf(c.occurredAt.getHours());

      if (!byDay.has(cat)) byDay.set(cat, new Map());
      const dayMap = byDay.get(cat)!;
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

      if (!byPeriod.has(cat)) byPeriod.set(cat, new Map());
      const periodMap = byPeriod.get(cat)!;
      periodMap.set(period, (periodMap.get(period) ?? 0) + 1);
    }

    const categories = Array.from(byDay.keys()).sort();
    const dayOfWeek = categories.map((cat) => ({
      category: cat,
      counts: DAY_NAMES.map((d) => byDay.get(cat)?.get(d) ?? 0),
    }));
    const timeOfDay = categories.map((cat) => ({
      category: cat,
      counts: ['Morning', 'Afternoon', 'Evening', 'Night'].map((p) => byPeriod.get(cat)?.get(p) ?? 0),
    }));

    const summary = categories.map((cat) => {
      const dayMap = byDay.get(cat)!;
      const periodMap = byPeriod.get(cat)!;
      const peakDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const peakPeriod = Array.from(periodMap.entries()).sort((a, b) => b[1] - a[1])[0][0];
      return { category: cat, peakDay, peakPeriod };
    });

    return { dayLabels: DAY_NAMES, periodLabels: ['Morning', 'Afternoon', 'Evening', 'Night'], dayOfWeek, timeOfDay, summary };
  }

  // --- Risk Scoring (persons) ----------------------------------------------
  // Composite of frequency (how many crimes), recency (exponential decay —
  // recent activity counts more than old activity), and severity (what kind
  // of crimes) — same normalize-and-weight approach as area risk scoring,
  // applied to suspects instead of places. Deliberately explainable: each
  // component is shown, not just a final number.
  async personRiskScores(limit: number, minCrimes: number) {
    const links = await this.prisma.crimePerson.findMany({
      where: { role: 'SUSPECT' },
      select: {
        personId: true,
        person: { select: { fullName: true } },
        crime: { select: { occurredAt: true, category: { select: { severityWeight: true } } } },
      },
    });

    type Agg = { personId: string; fullName: string; crimes: { occurredAt: Date; severity: number }[] };
    const byPerson = new Map<string, Agg>();
    for (const l of links) {
      if (!byPerson.has(l.personId)) byPerson.set(l.personId, { personId: l.personId, fullName: l.person.fullName, crimes: [] });
      byPerson.get(l.personId)!.crimes.push({ occurredAt: l.crime.occurredAt, severity: l.crime.category.severityWeight });
    }

    const now = Date.now();
    const candidates = Array.from(byPerson.values()).filter((p) => p.crimes.length >= minCrimes);

    const frequency = candidates.map((p) => p.crimes.length);
    const recency = candidates.map((p) =>
      p.crimes.reduce((sum, c) => sum + Math.exp(-((now - c.occurredAt.getTime()) / DAY_MS) / 180), 0),
    );
    const severity = candidates.map((p) => mean(p.crimes.map((c) => c.severity)));

    const normFreq = minMaxNormalize(frequency);
    const normRecency = minMaxNormalize(recency);
    const normSeverity = minMaxNormalize(severity);

    const scored = candidates.map((p, i) => {
      const score = Math.round(0.4 * normFreq[i] + 0.3 * normRecency[i] + 0.3 * normSeverity[i]);
      return {
        personId: p.personId,
        fullName: p.fullName,
        crimeCount: p.crimes.length,
        avgSeverity: Math.round(mean(p.crimes.map((c) => c.severity)) * 10) / 10,
        mostRecentCrime: p.crimes.map((c) => c.occurredAt).sort((a, b) => b.getTime() - a.getTime())[0],
        riskScore: score,
        band: riskBand(score),
      };
    });

    return scored.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
  }
}
