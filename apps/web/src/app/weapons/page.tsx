'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Weapon } from '@/lib/types';

export default function WeaponsPage() {
  const api = useApi();
  const { user } = useAuth();
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  function load() {
    setLoading(true);
    api<Weapon[]>('/weapons')
      .then(setWeapons)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/weapons', {
        method: 'POST',
        body: { type, description: description || undefined, serialNumber: serialNumber || undefined },
      });
      setType('');
      setDescription('');
      setSerialNumber('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add weapon');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Weapons</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {canCreate && (
        <div className="card">
          <p className="section-title">Register Weapon</p>
          <form onSubmit={onSubmit} className="filters">
            <div className="field">
              <label>Type</label>
              <input value={type} onChange={(e) => setType(e.target.value)} required placeholder="e.g. Knife" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Description (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="field">
              <label>Serial Number (optional)</label>
              <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={submitting || !type.trim()}>
              Add
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Serial No.</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map((w) => (
                <tr key={w.id}>
                  <td>{w.type}</td>
                  <td>{w.description ?? '—'}</td>
                  <td>{w.serialNumber ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ProtectedShell>
  );
}
