'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { Vehicle } from '@/lib/types';

export default function VehiclesListPage() {
  const api = useApi();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const path = query.trim().length >= 2 ? `/vehicles/search?q=${encodeURIComponent(query)}` : '/vehicles';
    const timeout = setTimeout(() => {
      api<Vehicle[]>(path)
        .then(setVehicles)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Vehicles</h1>
        {canCreate && (
          <Link href="/vehicles/new" className="btn">
            + Add Vehicle
          </Link>
        )}
      </div>

      <div className="card">
        <div className="field" style={{ maxWidth: 420, marginBottom: '1rem' }}>
          <label>Search by registration number</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. KA05" />
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Registration No.</th>
                <th>Type</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vehicles/${v.id}`}>{v.registrationNumber}</Link>
                  </td>
                  <td>{v.type}</td>
                  <td>{v.color ?? '—'}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </ProtectedShell>
  );
}
