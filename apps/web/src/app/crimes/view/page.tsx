'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import {
  CrimeDetail,
  CrimePersonRole,
  EvidenceType,
  InvestigationStatus,
  Person,
  Vehicle,
  VehicleInvolvementRole,
  Weapon,
} from '@/lib/types';

const STATUSES: InvestigationStatus[] = ['REPORTED', 'UNDER_INVESTIGATION', 'CHARGESHEETED', 'CLOSED'];
const PERSON_ROLES: CrimePersonRole[] = ['SUSPECT', 'VICTIM', 'WITNESS'];
const VEHICLE_ROLES: VehicleInvolvementRole[] = ['USED_IN_CRIME', 'GETAWAY', 'STOLEN'];
const EVIDENCE_TYPES: EvidenceType[] = ['PHOTO', 'DOCUMENT', 'DIGITAL', 'PHYSICAL_OBJECT', 'OTHER'];

function CrimeDetailPageInner() {
  const id = useSearchParams().get('id');
  const api = useApi();
  const { user } = useAuth();
  const [crime, setCrime] = useState<CrimeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  const load = useCallback(() => {
    setLoading(true);
    api<CrimeDetail>(`/crimes/${id}`)
      .then(setCrime)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load crime'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: InvestigationStatus) {
    try {
      const updated = await api<CrimeDetail>(`/crimes/${id}/status`, { method: 'PATCH', body: { status } });
      setCrime(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    }
  }

  if (loading) return <ProtectedShell><p className="muted">Loading…</p></ProtectedShell>;
  if (error && !crime) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!crime) return null;

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>{crime.fir?.firNumber}</h1>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Link href={`/reports/investigation/view?id=${crime.id}`} className="btn secondary">
            Print Case File
          </Link>
          <StatusBadge status={crime.status} />
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <p className="section-title">{crime.category?.name}</p>
        <p>{crime.description}</p>
        <p className="muted">
          {crime.addressLine} · {crime.district?.name} / {crime.station?.name}
        </p>
        <p className="muted">
          Occurred {new Date(crime.occurredAt).toLocaleString()} · Reported{' '}
          {new Date(crime.reportedAt).toLocaleString()}
        </p>
        {canWrite && (
          <div className="field" style={{ maxWidth: 260, marginTop: '0.75rem' }}>
            <label>Investigation Status</label>
            <select value={crime.status} onChange={(e) => updateStatus(e.target.value as InvestigationStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {crime.fir && (
        <div className="card">
          <p className="section-title">FIR Narrative</p>
          <p>{crime.fir.narrative}</p>
          <p className="muted">
            Filed by {crime.fir.filedBy.fullName} on {new Date(crime.fir.dateFiled).toLocaleString()}
          </p>
        </div>
      )}

      <PersonsSection crime={crime} canWrite={canWrite} onChanged={load} api={api} />
      <VehiclesSection crime={crime} canWrite={canWrite} onChanged={load} api={api} />
      <WeaponsSection crime={crime} canWrite={canWrite} onChanged={load} api={api} />
      <EvidenceSection crime={crime} canWrite={canWrite} onChanged={load} api={api} />
    </ProtectedShell>
  );
}

export default function CrimeDetailPage() {
  return (
    <Suspense fallback={<ProtectedShell><p className="muted">Loading…</p></ProtectedShell>}>
      <CrimeDetailPageInner />
    </Suspense>
  );
}

type Api = ReturnType<typeof useApi>;

function PersonsSection({
  crime,
  canWrite,
  onChanged,
  api,
}: {
  crime: CrimeDetail;
  canWrite: boolean;
  onChanged: () => void;
  api: Api;
}) {
  const [role, setRole] = useState<CrimePersonRole>('SUSPECT');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api<Person[]>(`/persons/search?q=${encodeURIComponent(query)}`).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function link(personId: string) {
    await api(`/crimes/${crime.id}/persons`, { method: 'POST', body: { personId, role } });
    setQuery('');
    setResults([]);
    onChanged();
  }

  async function unlink(linkId: string) {
    await api(`/crimes/${crime.id}/persons/${linkId}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <div className="card">
      <p className="section-title">Suspects, Victims &amp; Witnesses</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Address</th>
            {canWrite && <th></th>}
          </tr>
        </thead>
        <tbody>
          {crime.personLinks.map((link) => (
            <tr key={link.id}>
              <td>
                <Link href={`/persons/view?id=${link.person.id}`}>{link.person.fullName}</Link>
              </td>
              <td>{link.role}</td>
              <td>{link.person.phoneNumber ?? '—'}</td>
              <td>{link.person.addressLine ?? '—'}</td>
              {canWrite && (
                <td>
                  <button className="btn danger" onClick={() => unlink(link.id)}>
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {crime.personLinks.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No persons linked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <div style={{ marginTop: '1rem' }}>
          <div className="filters">
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as CrimePersonRole)}>
                {PERSON_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Search person by name / address / phone</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing…" />
            </div>
          </div>
          {results.length > 0 && (
            <ul className="link-list">
              {results.map((p) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {p.fullName} <span className="muted">· {p.phoneNumber ?? 'no phone'}</span>
                  </span>
                  <button className="btn secondary" onClick={() => link(p.id)}>
                    Link as {role}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function VehiclesSection({
  crime,
  canWrite,
  onChanged,
  api,
}: {
  crime: CrimeDetail;
  canWrite: boolean;
  onChanged: () => void;
  api: Api;
}) {
  const [role, setRole] = useState<VehicleInvolvementRole>('USED_IN_CRIME');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api<Vehicle[]>(`/vehicles/search?q=${encodeURIComponent(query)}`).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function link(vehicleId: string) {
    await api(`/crimes/${crime.id}/vehicles`, { method: 'POST', body: { vehicleId, role } });
    setQuery('');
    setResults([]);
    onChanged();
  }

  return (
    <div className="card">
      <p className="section-title">Vehicles</p>
      <table>
        <thead>
          <tr>
            <th>Registration</th>
            <th>Type</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {crime.vehicleLinks.map((link) => (
            <tr key={link.id}>
              <td>
                <Link href={`/vehicles/view?id=${link.vehicle.id}`}>{link.vehicle.registrationNumber}</Link>
              </td>
              <td>{link.vehicle.type}</td>
              <td>{link.role}</td>
            </tr>
          ))}
          {crime.vehicleLinks.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No vehicles linked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <div style={{ marginTop: '1rem' }}>
          <div className="filters">
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as VehicleInvolvementRole)}>
                {VEHICLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Search by registration number</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. KA05..." />
            </div>
          </div>
          {results.length > 0 && (
            <ul className="link-list">
              {results.map((v) => (
                <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {v.registrationNumber} <span className="muted">· {v.type}</span>
                  </span>
                  <button className="btn secondary" onClick={() => link(v.id)}>
                    Link as {role}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function WeaponsSection({
  crime,
  canWrite,
  onChanged,
  api,
}: {
  crime: CrimeDetail;
  canWrite: boolean;
  onChanged: () => void;
  api: Api;
}) {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (canWrite) api<Weapon[]>('/weapons').then(setWeapons).catch(() => {});
  }, [canWrite]);

  async function link() {
    if (!selected) return;
    await api(`/crimes/${crime.id}/weapons`, { method: 'POST', body: { weaponId: selected } });
    setSelected('');
    onChanged();
  }

  return (
    <div className="card">
      <p className="section-title">Weapons</p>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {crime.weaponLinks.map((link) => (
            <tr key={link.id}>
              <td>{link.weapon.type}</td>
              <td>{link.weapon.description ?? '—'}</td>
            </tr>
          ))}
          {crime.weaponLinks.length === 0 && (
            <tr>
              <td colSpan={2} className="muted">
                No weapons linked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <div className="filters" style={{ marginTop: '1rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Weapon</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a weapon…</option>
              {weapons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.type} {w.serialNumber ? `(${w.serialNumber})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="btn secondary" onClick={link} disabled={!selected}>
            Link Weapon
          </button>
        </div>
      )}
    </div>
  );
}

function EvidenceSection({
  crime,
  canWrite,
  onChanged,
  api,
}: {
  crime: CrimeDetail;
  canWrite: boolean;
  onChanged: () => void;
  api: Api;
}) {
  const [type, setType] = useState<EvidenceType>('PHOTO');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await api(`/crimes/${crime.id}/evidence`, { method: 'POST', body: { type, description } });
      setDescription('');
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <p className="section-title">Evidence</p>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Collected By</th>
            <th>Collected At</th>
          </tr>
        </thead>
        <tbody>
          {crime.evidenceItems.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.type}</td>
              <td>{ev.description}</td>
              <td>{ev.collectedBy.fullName}</td>
              <td>{new Date(ev.collectedAt).toLocaleString()}</td>
            </tr>
          ))}
          {crime.evidenceItems.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No evidence logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <div className="filters" style={{ marginTop: '1rem' }}>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="btn secondary" onClick={submit} disabled={submitting || !description.trim()}>
            Add Evidence
          </button>
        </div>
      )}
    </div>
  );
}
