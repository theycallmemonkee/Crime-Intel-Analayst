'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { TrendPredictionChart } from '@/components/charts/TrendPredictionChart';
import { RiskBadge, RiskBar } from '@/components/RiskBadge';
import { useApi } from '@/lib/auth-context';
import {
  CrimeAnomaly,
  HighRiskArea,
  PatternData,
  PersonRiskScore,
  TrendPrediction,
} from '@/lib/types';

type Tab = 'trend' | 'risk-areas' | 'anomalies' | 'patterns' | 'risk-scores';

// Sequential blue ramp (same family as the dashboard/dataviz palette). The
// last two steps are dark enough that the app's default dark text fails
// contrast — those cells switch to light text rather than assuming a
// screenshot at reduced resolution hides the problem.
const HEAT_STEPS = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab', '#0d366b'];
const HEAT_DARK_STEP_INDEX = 4; // steps at/after this index need light text

function heatCellStyle(value: number, max: number): { background: string; color?: string } {
  if (max === 0 || value === 0) return { background: 'transparent' };
  const t = value / max;
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(t * HEAT_STEPS.length));
  return { background: HEAT_STEPS[idx], color: idx >= HEAT_DARK_STEP_INDEX ? '#ffffff' : undefined };
}

export default function IntelligencePage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('trend');

  const [trend, setTrend] = useState<TrendPrediction | null>(null);
  const [riskAreas, setRiskAreas] = useState<HighRiskArea[] | null>(null);
  const [areaLevel, setAreaLevel] = useState<'DISTRICT' | 'STATION'>('DISTRICT');
  const [anomalies, setAnomalies] = useState<CrimeAnomaly[] | null>(null);
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [riskScores, setRiskScores] = useState<PersonRiskScore[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (tab === 'trend' && trend === null) {
      setLoading(true);
      api<TrendPrediction>('/ai/trend-prediction?monthsAhead=3')
        .then(setTrend)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (tab === 'anomalies' && anomalies === null) {
      setLoading(true);
      api<CrimeAnomaly[]>('/ai/anomalies?level=STATION&limit=20')
        .then(setAnomalies)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (tab === 'patterns' && patterns === null) {
      setLoading(true);
      api<PatternData>('/ai/patterns')
        .then(setPatterns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (tab === 'risk-scores' && riskScores === null) {
      setLoading(true);
      api<PersonRiskScore[]>('/ai/risk-scores?limit=25')
        .then(setRiskScores)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'risk-areas') return;
    setLoading(true);
    setError(null);
    api<HighRiskArea[]>(`/ai/high-risk-areas?level=${areaLevel}&limit=10`)
      .then(setRiskAreas)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, areaLevel]);

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>AI Intelligence</h1>
      </div>
      <p className="chart-subtitle" style={{ marginTop: '-0.75rem' }}>
        Explainable statistical methods (linear regression, z-score anomaly detection, weighted composite
        scoring) over real crime records — every score below shows the factors behind it, not just a number.
      </p>

      <div className="filters" style={{ marginBottom: '1rem' }}>
        <button className={`btn ${tab === 'trend' ? '' : 'secondary'}`} onClick={() => setTab('trend')}>
          Crime Trend Prediction
        </button>
        <button className={`btn ${tab === 'risk-areas' ? '' : 'secondary'}`} onClick={() => setTab('risk-areas')}>
          High-Risk Areas
        </button>
        <button className={`btn ${tab === 'anomalies' ? '' : 'secondary'}`} onClick={() => setTab('anomalies')}>
          Anomaly Detection
        </button>
        <button className={`btn ${tab === 'patterns' ? '' : 'secondary'}`} onClick={() => setTab('patterns')}>
          Pattern Discovery
        </button>
        <button className={`btn ${tab === 'risk-scores' ? '' : 'secondary'}`} onClick={() => setTab('risk-scores')}>
          Risk Scoring
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {tab === 'trend' && trend && (
        <div className="card">
          <p className="section-title">
            State-wide Crime Trend — {trend.trend} (slope {trend.slope}/month)
          </p>
          <p className="chart-subtitle">{trend.method} Dashed segment = projected next 3 months, shaded band = uncertainty range.</p>
          <TrendPredictionChart data={trend} />
        </div>
      )}

      {tab === 'risk-areas' && riskAreas && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: '0.5rem' }}>
            <p className="section-title" style={{ margin: 0 }}>
              Composite Risk Index — last 90 days vs. prior 90 days
            </p>
            <select value={areaLevel} onChange={(e) => setAreaLevel(e.target.value as 'DISTRICT' | 'STATION')}>
              <option value="DISTRICT">By District</option>
              <option value="STATION">By Station</option>
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>{areaLevel === 'DISTRICT' ? 'District' : 'Station'}</th>
                <th>Recent (90d)</th>
                <th>Growth</th>
                <th>Avg. Severity</th>
                <th>Risk Score</th>
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              {riskAreas.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.recentCount}</td>
                  <td className={a.growthRatePct > 0 ? 'stat-delta bad' : a.growthRatePct < 0 ? 'stat-delta good' : ''}>
                    {a.growthRatePct > 0 ? '+' : ''}
                    {a.growthRatePct}%
                  </td>
                  <td>{a.avgSeverity}/10</td>
                  <td>
                    <RiskBar score={a.riskScore} band={a.band} /> {a.riskScore}
                  </td>
                  <td>
                    <RiskBadge band={a.band} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'anomalies' && anomalies && (
        <div className="card">
          <p className="section-title">Statistically anomalous months (|z-score| ≥ 2 vs. that station's own baseline)</p>
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Month</th>
                <th>Actual</th>
                <th>Expected</th>
                <th>Z-score</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => (
                <tr key={i}>
                  <td>{a.areaName}</td>
                  <td>{a.month}</td>
                  <td>{a.actualCount}</td>
                  <td>{a.expectedCount}</td>
                  <td>{a.zScore}</td>
                  <td>
                    <span className={`anomaly-direction ${a.direction}`}>
                      {a.direction === 'SPIKE' ? '▲ SPIKE' : '▼ DROP'}
                    </span>
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No statistically significant anomalies detected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'patterns' && patterns && (
        <>
          <div className="card">
            <p className="section-title">Peak day &amp; time by category</p>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Peak Day</th>
                  <th>Peak Time</th>
                </tr>
              </thead>
              <tbody>
                {patterns.summary.map((s) => (
                  <tr key={s.category}>
                    <td>{s.category}</td>
                    <td>{s.peakDay}</td>
                    <td>{s.peakPeriod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="section-title">Day-of-week distribution</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th></th>
                    {patterns.dayLabels.map((d) => (
                      <th key={d}>{d.slice(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patterns.dayOfWeek.map((row) => {
                    const max = Math.max(...row.counts);
                    return (
                      <tr key={row.category}>
                        <td className="heatmap-label">{row.category}</td>
                        {row.counts.map((c, i) => (
                          <td key={i} className="heatmap-cell" style={heatCellStyle(c, max)}>
                            {c || ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'risk-scores' && riskScores && (
        <div className="card">
          <p className="section-title">Suspect risk scores — frequency (40%) + recency (30%) + severity (30%)</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th># Crimes</th>
                <th>Avg. Severity</th>
                <th>Most Recent</th>
                <th>Risk Score</th>
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              {riskScores.map((r) => (
                <tr key={r.personId}>
                  <td>
                    <Link href={`/persons/${r.personId}`}>{r.fullName}</Link>
                  </td>
                  <td>{r.crimeCount}</td>
                  <td>{r.avgSeverity}/10</td>
                  <td>{new Date(r.mostRecentCrime).toLocaleDateString()}</td>
                  <td>
                    <RiskBar score={r.riskScore} band={r.band} /> {r.riskScore}
                  </td>
                  <td>
                    <RiskBadge band={r.band} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProtectedShell>
  );
}
