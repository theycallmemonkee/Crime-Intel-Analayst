'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedShell } from '@/components/ProtectedShell';
import { ReportHeader } from '@/components/ReportHeader';
import { RiskBadge } from '@/components/RiskBadge';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { DistrictReport } from '@/lib/types';

export default function DistrictReportPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const [report, setReport] = useState<DistrictReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DistrictReport>(`/reports/district/${id}`)
      .then(setReport)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load report'));
  }, [id]);

  if (error) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!report) return <ProtectedShell><p className="muted">Generating report…</p></ProtectedShell>;

  return (
    <ProtectedShell>
      <ReportHeader
        title={`District Report — ${report.district.name}`}
        subtitle={`District code: ${report.district.code}`}
        generatedAt={report.generatedAt}
        generatedBy={report.generatedBy}
      />

      <div className="report-section card">
        <h2>Summary</h2>
        <p>
          <strong>{report.summary.totalCrimes}</strong> total crimes · {report.summary.activeInvestigations} active ·{' '}
          {report.summary.chargesheeted} chargesheeted · {report.summary.closedCases} closed.
        </p>
      </div>

      <div className="report-section card">
        <h2>Police Stations</h2>
        <table>
          <thead>
            <tr><th>Station</th><th>Crimes</th></tr>
          </thead>
          <tbody>
            {report.byStation.map((s) => (
              <tr key={s.stationId}><td>{s.name}</td><td>{s.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-section card">
        <h2>Station Risk Ranking (AI Composite Index)</h2>
        <table>
          <thead>
            <tr><th>Station</th><th>Recent (90d)</th><th>Growth</th><th>Risk Score</th><th>Band</th></tr>
          </thead>
          <tbody>
            {report.stationRisk.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.recentCount}</td>
                <td>{s.growthRatePct > 0 ? '+' : ''}{s.growthRatePct}%</td>
                <td>{s.riskScore}</td>
                <td><RiskBadge band={s.band} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-grid report-section">
        <div className="card">
          <h2>By Category</h2>
          <table>
            <thead><tr><th>Category</th><th>Count</th></tr></thead>
            <tbody>
              {report.byCategory.map((c) => (
                <tr key={c.categoryId}><td>{c.name}</td><td>{c.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>By Status</h2>
          <table>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {report.byStatus.map((s) => (
                <tr key={s.status}><td>{s.status.replace('_', ' ')}</td><td>{s.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedShell>
  );
}
