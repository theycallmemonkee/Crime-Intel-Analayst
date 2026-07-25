'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedShell } from '@/components/ProtectedShell';
import { StatTile } from '@/components/charts/StatTile';
import { RankedBarChart } from '@/components/charts/RankedBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { StatusStackedBar } from '@/components/charts/StatusStackedBar';
import { useApi, useAuth } from '@/lib/auth-context';
import {
  CategoryCount,
  DashboardSummary,
  DistrictCount,
  MonthlyPoint,
  StationCount,
  StatusCount,
  YearlyPoint,
} from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  REPORTED: 'Reported',
  UNDER_INVESTIGATION: 'Under Investigation',
  CHARGESHEETED: 'Chargesheeted',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  REPORTED: 'var(--chart-status-reported)',
  UNDER_INVESTIGATION: 'var(--chart-status-investigation)',
  CHARGESHEETED: 'var(--chart-status-chargesheeted)',
  CLOSED: 'var(--chart-status-closed)',
};

export default function DashboardPage() {
  const api = useApi();
  const { user } = useAuth();
  const isStateWide = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [districts, setDistricts] = useState<DistrictCount[]>([]);
  const [stations, setStations] = useState<StationCount[]>([]);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [yearly, setYearly] = useState<YearlyPoint[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<{ id: string; name: string } | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<DashboardSummary>('/dashboards/summary'),
      api<CategoryCount[]>('/dashboards/by-category'),
      api<StatusCount[]>('/dashboards/by-status'),
      api<YearlyPoint[]>('/dashboards/trends/yearly'),
      isStateWide ? api<DistrictCount[]>('/dashboards/by-district') : Promise.resolve([]),
      !isStateWide ? api<StationCount[]>('/dashboards/by-station') : Promise.resolve([]),
    ])
      .then(([s, c, st, y, d, stn]) => {
        setSummary(s);
        setCategories(c);
        setStatuses(st);
        setYearly(y);
        setDistricts(d);
        setStations(stn);
        if (y.length > 0) setYear(y[y.length - 1].year);
      })
      .catch(() => {
        // Swallowed on purpose here: a 401 mid-navigation (e.g. logging out
        // while a request is in flight) is handled by useApi's own
        // logout-and-redirect; surfacing it again as a page error would be
        // noise for something the user already navigated away from.
        setError('Failed to load dashboard data.');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStateWide]);

  useEffect(() => {
    if (selectedDistrict) {
      api<StationCount[]>(`/dashboards/by-station?districtId=${selectedDistrict.id}`)
        .then(setStations)
        .catch(() => {});
    }
  }, [selectedDistrict]);

  useEffect(() => {
    api<MonthlyPoint[]>(`/dashboards/trends/monthly?year=${year}`)
      .then(setMonthly)
      .catch(() => {});
  }, [year]);

  const monthlyChartData = useMemo(
    () =>
      monthly.map((m) => ({
        label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }),
        value: m.count,
      })),
    [monthly],
  );

  const statusChartData = statuses.map((s) => ({
    status: s.status,
    label: STATUS_LABELS[s.status],
    count: s.count,
    color: STATUS_COLORS[s.status],
  }));

  if (loading || (!summary && !error)) {
    return (
      <ProtectedShell>
        <p className="muted">Loading dashboard…</p>
      </ProtectedShell>
    );
  }

  if (error || !summary) {
    return (
      <ProtectedShell>
        <div className="error-banner">{error ?? 'Failed to load dashboard data.'}</div>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Intelligence Dashboard</h1>
        <span className="muted">{isStateWide ? 'State-wide' : 'Your district'}</span>
      </div>

      <div className="kpi-row">
        <StatTile label="Total Crimes" value={summary.totalCrimes} />
        <StatTile label="Active Investigations" value={summary.activeInvestigations} />
        <StatTile label="Chargesheeted" value={summary.chargesheeted} />
        <StatTile label="Closed Cases" value={summary.closedCases} />
        <StatTile
          label="Crime Growth (MoM)"
          value={summary.growth.currentMonthCount}
          delta={{
            pct: summary.growth.percentChange,
            caption: 'vs. last month',
          }}
        />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <p className="chart-title">Crime Categories</p>
          <p className="chart-subtitle">Total cases by category</p>
          <RankedBarChart data={categories.map((c) => ({ key: c.categoryId, label: c.name, value: c.count }))} />
        </div>

        <div className="card">
          <p className="chart-title">Investigation Status</p>
          <p className="chart-subtitle">Case pipeline distribution</p>
          <StatusStackedBar data={statusChartData} />
        </div>

        <div className="card">
          <p className="chart-title">
            {isStateWide ? 'District-wise Analysis' : 'Police Station Drill-down'}
          </p>
          <p className="chart-subtitle">
            {isStateWide ? 'Click a district to drill into its stations' : 'Cases by station in your district'}
          </p>
          {isStateWide && selectedDistrict && (
            <div className="drill-breadcrumb">
              <button onClick={() => setSelectedDistrict(null)}>← All Districts</button> / {selectedDistrict.name}
            </div>
          )}
          <RankedBarChart
            data={
              isStateWide && !selectedDistrict
                ? districts.map((d) => ({ key: d.districtId, label: d.name, value: d.count }))
                : stations.map((s) => ({ key: s.stationId, label: s.name, value: s.count }))
            }
            onSelect={
              isStateWide && !selectedDistrict
                ? (key) => {
                    const d = districts.find((x) => x.districtId === key);
                    if (d) setSelectedDistrict({ id: d.districtId, name: d.name });
                  }
                : undefined
            }
          />
        </div>

        <div className="card">
          <div className="page-header" style={{ marginBottom: '0.25rem' }}>
            <p className="chart-title" style={{ margin: 0 }}>
              Monthly Trend
            </p>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearly.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </select>
          </div>
          <p className="chart-subtitle">Crimes reported per month</p>
          <TrendLineChart data={monthlyChartData} />
        </div>

        <div className="card">
          <p className="chart-title">Yearly Trend &amp; Growth</p>
          <p className="chart-subtitle">Year-over-year case volume</p>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Crimes</th>
                <th>YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{y.count}</td>
                  <td>
                    {y.growthPct === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span
                        className={y.growthPct > 0 ? 'stat-delta good' : y.growthPct < 0 ? 'stat-delta bad' : 'stat-delta flat'}
                      >
                        {y.growthPct > 0 ? '+' : ''}
                        {y.growthPct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedShell>
  );
}
