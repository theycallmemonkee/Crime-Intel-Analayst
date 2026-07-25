'use client';

import { useEffect, useState } from 'react';
import { ProtectedShell } from '@/components/ProtectedShell';
import { ReportHeader } from '@/components/ReportHeader';
import { TrendPredictionChart } from '@/components/charts/TrendPredictionChart';
import { useApi } from '@/lib/auth-context';
import { CrimeTrendReport } from '@/lib/types';

export default function CrimeTrendReportPage() {
  const api = useApi();
  const [report, setReport] = useState<CrimeTrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<CrimeTrendReport>('/reports/crime-trends')
      .then(setReport)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!report) return <ProtectedShell><p className="muted">Generating report…</p></ProtectedShell>;

  return (
    <ProtectedShell>
      <ReportHeader
        title="Crime Trend Report"
        subtitle="Monthly and yearly trends with a 3-month forecast"
        generatedAt={report.generatedAt}
        generatedBy={report.generatedBy}
      />

      <div className="report-section card">
        <h2>Monthly Trend &amp; Forecast</h2>
        <TrendPredictionChart data={report.trend} />
      </div>

      <div className="report-section card">
        <h2>Yearly Trend</h2>
        <table>
          <thead>
            <tr><th>Year</th><th>Crimes</th><th>YoY Growth</th></tr>
          </thead>
          <tbody>
            {report.yearly.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{y.count}</td>
                <td>{y.growthPct === null ? '—' : `${y.growthPct > 0 ? '+' : ''}${y.growthPct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-section card">
        <h2>By Category</h2>
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th></tr>
          </thead>
          <tbody>
            {report.byCategory.map((c) => (
              <tr key={c.categoryId}><td>{c.name}</td><td>{c.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProtectedShell>
  );
}
