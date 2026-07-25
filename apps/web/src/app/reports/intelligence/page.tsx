'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { ReportHeader } from '@/components/ReportHeader';
import { RiskBadge } from '@/components/RiskBadge';
import { useApi } from '@/lib/auth-context';
import { IntelligenceReport } from '@/lib/types';

export default function IntelligenceReportPage() {
  const api = useApi();
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<IntelligenceReport>('/reports/intelligence')
      .then(setReport)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!report) return <ProtectedShell><p className="muted">Generating report…</p></ProtectedShell>;

  return (
    <ProtectedShell>
      <ReportHeader
        title="State-wide Intelligence Report"
        subtitle="Crime summary, network findings, and AI risk indicators"
        generatedAt={report.generatedAt}
        generatedBy={report.generatedBy}
      />

      <div className="report-section card">
        <h2>Summary</h2>
        <p>
          <strong>{report.summary.totalCrimes}</strong> total crimes on record · {report.summary.activeInvestigations}{' '}
          active investigations · {report.summary.chargesheeted} chargesheeted · {report.summary.closedCases} closed.
          Month-over-month change:{' '}
          {report.summary.growth.percentChange === null ? '—' : `${report.summary.growth.percentChange}%`}.
        </p>
      </div>

      <div className="report-section card">
        <h2>Crime Trend</h2>
        <p>
          State-wide trend is <strong>{report.trend.trend}</strong> (regression slope {report.trend.slope}/month).
          Projected next 3 months: {report.trend.predicted.map((p) => `${p.month}: ${p.predictedCount}`).join(', ')}.
        </p>
      </div>

      <div className="dashboard-grid report-section">
        <div className="card">
          <h2>Top Categories</h2>
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
        <div className="card">
          <h2>Top Districts by Volume</h2>
          <table>
            <thead>
              <tr><th>District</th><th>Count</th></tr>
            </thead>
            <tbody>
              {report.byDistrict.map((d) => (
                <tr key={d.districtId}><td>{d.name}</td><td>{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section card">
        <h2>High-Risk Districts (AI Composite Index)</h2>
        <table>
          <thead>
            <tr><th>District</th><th>Recent (90d)</th><th>Growth</th><th>Risk Score</th><th>Band</th></tr>
          </thead>
          <tbody>
            {report.highRiskDistricts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.recentCount}</td>
                <td>{a.growthRatePct > 0 ? '+' : ''}{a.growthRatePct}%</td>
                <td>{a.riskScore}</td>
                <td><RiskBadge band={a.band} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-section card">
        <h2>Recent Statistical Anomalies</h2>
        <table>
          <thead>
            <tr><th>Station</th><th>Month</th><th>Actual</th><th>Expected</th><th>Direction</th></tr>
          </thead>
          <tbody>
            {report.recentAnomalies.map((a, i) => (
              <tr key={i}>
                <td>{a.areaName}</td><td>{a.month}</td><td>{a.actualCount}</td><td>{a.expectedCount}</td>
                <td><span className={`anomaly-direction ${a.direction}`}>{a.direction}</span></td>
              </tr>
            ))}
            {report.recentAnomalies.length === 0 && <tr><td colSpan={5} className="muted">None detected.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="report-section card">
        <h2>Top Repeat Offenders</h2>
        <table>
          <thead>
            <tr><th>Name</th><th># Crimes</th></tr>
          </thead>
          <tbody>
            {report.repeatOffenders.map((r) => (
              <tr key={r.personId}>
                <td><Link href={`/persons/${r.personId}`}>{r.fullName}</Link></td>
                <td>{r.crimeCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-section card">
        <h2>Gang &amp; Criminal Networks ({report.totalNetworksDetected} detected, top 5 shown)</h2>
        {report.largestNetworks.map((g) => (
          <div key={g.communityId} style={{ marginBottom: '0.75rem' }}>
            <strong>Network #{g.communityId}</strong> — {g.size} members: {g.members.map((m) => m.fullName).join(', ')}
            {g.size > g.members.length ? '…' : ''}
          </div>
        ))}
      </div>
    </ProtectedShell>
  );
}
