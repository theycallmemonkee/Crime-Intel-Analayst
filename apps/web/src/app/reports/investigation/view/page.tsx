'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { ReportHeader } from '@/components/ReportHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { InvestigationReport } from '@/lib/types';

function InvestigationReportPageInner() {
  const id = useSearchParams().get('id');
  const api = useApi();
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<InvestigationReport>(`/reports/investigation/${id}`)
      .then(setReport)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load report'));
  }, [id]);

  if (error) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!report) return <ProtectedShell><p className="muted">Generating report…</p></ProtectedShell>;

  const { crime } = report;

  return (
    <ProtectedShell>
      <ReportHeader
        title={`Investigation Report — ${crime.fir?.firNumber ?? 'No FIR'}`}
        subtitle={`${crime.category?.name} · ${crime.district?.name} / ${crime.station?.name}`}
        generatedAt={report.generatedAt}
        generatedBy={report.generatedBy}
      />

      <div className="report-section card">
        <h2>Case Details <StatusBadge status={crime.status} /></h2>
        <p>{crime.description}</p>
        <p className="muted">
          Location: {crime.addressLine} · Occurred {new Date(crime.occurredAt).toLocaleString()} · Reported{' '}
          {new Date(crime.reportedAt).toLocaleString()}
        </p>
      </div>

      {crime.fir && (
        <div className="report-section card">
          <h2>FIR Narrative</h2>
          <p>{crime.fir.narrative}</p>
          <p className="muted">
            Filed by {crime.fir.filedBy.fullName} on {new Date(crime.fir.dateFiled).toLocaleString()}
          </p>
        </div>
      )}

      <div className="report-section card">
        <h2>Suspects, Victims &amp; Witnesses</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Phone</th><th>Address</th></tr>
          </thead>
          <tbody>
            {crime.personLinks.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/persons/view?id=${l.person.id}`}>{l.person.fullName}</Link></td>
                <td>{l.role}</td>
                <td>{l.person.phoneNumber ?? '—'}</td>
                <td>{l.person.addressLine ?? '—'}</td>
              </tr>
            ))}
            {crime.personLinks.length === 0 && <tr><td colSpan={4} className="muted">None on record.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="dashboard-grid report-section">
        <div className="card">
          <h2>Vehicles</h2>
          <table>
            <thead><tr><th>Registration</th><th>Type</th><th>Role</th></tr></thead>
            <tbody>
              {crime.vehicleLinks.map((l) => (
                <tr key={l.id}><td>{l.vehicle.registrationNumber}</td><td>{l.vehicle.type}</td><td>{l.role}</td></tr>
              ))}
              {crime.vehicleLinks.length === 0 && <tr><td colSpan={3} className="muted">None on record.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Weapons</h2>
          <table>
            <thead><tr><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              {crime.weaponLinks.map((l) => (
                <tr key={l.id}><td>{l.weapon.type}</td><td>{l.weapon.description ?? '—'}</td></tr>
              ))}
              {crime.weaponLinks.length === 0 && <tr><td colSpan={2} className="muted">None on record.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section card">
        <h2>Evidence Log</h2>
        <table>
          <thead>
            <tr><th>Type</th><th>Description</th><th>Collected By</th><th>Collected At</th></tr>
          </thead>
          <tbody>
            {crime.evidenceItems.map((e) => (
              <tr key={e.id}>
                <td>{e.type}</td>
                <td>{e.description}</td>
                <td>{e.collectedBy.fullName}</td>
                <td>{new Date(e.collectedAt).toLocaleString()}</td>
              </tr>
            ))}
            {crime.evidenceItems.length === 0 && <tr><td colSpan={4} className="muted">None logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </ProtectedShell>
  );
}

export default function InvestigationReportPage() {
  return (
    <Suspense fallback={<ProtectedShell><p className="muted">Generating report…</p></ProtectedShell>}>
      <InvestigationReportPageInner />
    </Suspense>
  );
}
