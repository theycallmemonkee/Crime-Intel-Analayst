'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { StatusBadge } from '@/components/StatusBadge';
import { GraphView } from '@/components/GraphView';
import { useApi, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { EgoGraph, PersonDetail } from '@/lib/types';

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const { user } = useAuth();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [egoGraph, setEgoGraph] = useState<EgoGraph | null>(null);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const canSeeNetwork = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  function load() {
    api<PersonDetail>(`/persons/${id}`)
      .then((p) => {
        setPerson(p);
        setPhoneNumber(p.phoneNumber ?? '');
        setAddressLine(p.addressLine ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load person'));
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!canSeeNetwork) return;
    api<EgoGraph>(`/network/person/${id}/graph`).then(setEgoGraph).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canSeeNetwork]);

  async function save() {
    try {
      await api(`/persons/${id}`, { method: 'PATCH', body: { phoneNumber, addressLine } });
      setEditing(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    }
  }

  if (error && !person) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!person) return <ProtectedShell><p className="muted">Loading…</p></ProtectedShell>;

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>
          {person.fullName} {person.alias && <span className="muted">alias &quot;{person.alias}&quot;</span>}
        </h1>
        {canWrite && !editing && (
          <button className="btn secondary" onClick={() => setEditing(true)}>
            Edit Contact Info
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <p className="muted">
          {person.gender} · {person.dateOfBirth ? new Date(person.dateOfBirth).toLocaleDateString() : 'DOB unknown'}
        </p>
        {editing ? (
          <div className="stacked" style={{ maxWidth: 400, marginTop: '0.75rem' }}>
            <div className="field">
              <label>Phone Number</label>
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>Address</label>
              <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={save}>
                Save
              </button>
              <button className="btn secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p>Phone: {person.phoneNumber ?? '—'}</p>
            <p>Address: {person.addressLine ?? '—'}</p>
          </>
        )}
      </div>

      <div className="card">
        <p className="section-title">Crime History ({person.crimeLinks.length})</p>
        <table>
          <thead>
            <tr>
              <th>FIR No.</th>
              <th>Role</th>
              <th>Category</th>
              <th>Station</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {person.crimeLinks.map((link) => (
              <tr key={link.id}>
                <td>
                  <Link href={`/crimes/${link.crime.id}`}>{link.crime.fir?.firNumber ?? '—'}</Link>
                </td>
                <td>{link.role}</td>
                <td>{link.crime.category?.name}</td>
                <td>{link.crime.station?.name}</td>
                <td>
                  <StatusBadge status={link.crime.status} />
                </td>
              </tr>
            ))}
            {person.crimeLinks.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No crime involvement on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {person.crimeLinks.length >= 3 && !canSeeNetwork && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Appears in {person.crimeLinks.length} cases — an Analyst or Admin can review this person under
            Network &amp; Link Analysis.
          </p>
        )}
      </div>

      {canSeeNetwork && (
        <div className="card">
          <p className="section-title">Network Graph</p>
          <p className="chart-subtitle">
            This person&apos;s crimes, co-suspects, vehicles, weapons, and shared phone/address connections.
          </p>
          {egoGraph ? (
            <GraphView nodes={egoGraph.nodes} edges={egoGraph.edges} centerNodeId={person.id} />
          ) : (
            <p className="muted">Loading graph…</p>
          )}
        </div>
      )}

      {person.ownedVehicles.length > 0 && (
        <div className="card">
          <p className="section-title">Owned Vehicles</p>
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {person.ownedVehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vehicles/${v.id}`}>{v.registrationNumber}</Link>
                  </td>
                  <td>{v.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProtectedShell>
  );
}
