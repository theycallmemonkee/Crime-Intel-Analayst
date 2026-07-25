'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { District } from '@/lib/types';

export default function ReportsIndexPage() {
  const api = useApi();
  const { user } = useAuth();
  const router = useRouter();
  const isAnalystCapable = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');

  useEffect(() => {
    if (isAnalystCapable) {
      api<District[]>('/districts').then(setDistricts).catch(() => {});
    } else if (user?.districtId) {
      setSelectedDistrict(user.districtId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalystCapable]);

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Reports</h1>
      </div>
      <p className="chart-subtitle" style={{ marginTop: '-0.75rem' }}>
        Each report opens as a formatted page — use your browser&apos;s Print (Ctrl/Cmd+P → Save as PDF) to
        export it.
      </p>

      <div className="dashboard-grid">
        {isAnalystCapable && (
          <div className="card">
            <p className="chart-title">Intelligence Report</p>
            <p className="chart-subtitle">
              State-wide briefing: crime summary, network findings (repeat offenders, gang networks), AI
              high-risk areas and anomalies.
            </p>
            <button className="btn" onClick={() => router.push('/reports/intelligence')}>
              Open Report
            </button>
          </div>
        )}

        <div className="card">
          <p className="chart-title">Crime Trend Report</p>
          <p className="chart-subtitle">Monthly/yearly trends, category breakdown, and a 3-month forecast.</p>
          <button className="btn" onClick={() => router.push('/reports/trends')}>
            Open Report
          </button>
        </div>

        <div className="card">
          <p className="chart-title">District Report</p>
          <p className="chart-subtitle">Station breakdown, category mix, and station risk ranking for one district.</p>
          {isAnalystCapable ? (
            <div className="filters">
              <div className="field" style={{ flex: 1 }}>
                <label>District</label>
                <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
                  <option value="">Select a district…</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                disabled={!selectedDistrict}
                onClick={() => router.push(`/reports/district/${selectedDistrict}`)}
              >
                Open Report
              </button>
            </div>
          ) : (
            <button
              className="btn"
              disabled={!selectedDistrict}
              onClick={() => router.push(`/reports/district/${selectedDistrict}`)}
            >
              Open Report for Your District
            </button>
          )}
        </div>

        <div className="card">
          <p className="chart-title">Investigation Report</p>
          <p className="chart-subtitle">
            A formatted case file for one crime. Open it from any crime&apos;s detail page (&quot;Print Case
            File&quot;) — it needs a specific case, so there&apos;s no generic entry point here.
          </p>
        </div>
      </div>
    </ProtectedShell>
  );
}
