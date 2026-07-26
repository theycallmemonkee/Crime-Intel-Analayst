'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { VehicleDetail } from '@/lib/types';

function VehicleDetailPageInner() {
  const id = useSearchParams().get('id');
  const api = useApi();
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<VehicleDetail>(`/vehicles/${id}`)
      .then(setVehicle)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load vehicle'));
  }, [id]);

  if (error && !vehicle) return <ProtectedShell><div className="error-banner">{error}</div></ProtectedShell>;
  if (!vehicle) return <ProtectedShell><p className="muted">Loading…</p></ProtectedShell>;

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>{vehicle.registrationNumber}</h1>
      </div>

      <div className="card">
        <p>
          {vehicle.type} {vehicle.color && `· ${vehicle.color}`}
        </p>
        <p className="muted">
          Owner:{' '}
          {vehicle.ownerPerson ? (
            <Link href={`/persons/view?id=${vehicle.ownerPerson.id}`}>{vehicle.ownerPerson.fullName}</Link>
          ) : (
            'Unknown'
          )}
        </p>
      </div>

      <div className="card">
        <p className="section-title">Crime Involvement ({vehicle.crimeLinks.length})</p>
        <table>
          <thead>
            <tr>
              <th>FIR No.</th>
              <th>Role</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {vehicle.crimeLinks.map((link) => (
              <tr key={link.id}>
                <td>
                  <Link href={`/crimes/view?id=${link.crime.id}`}>{link.crime.fir?.firNumber ?? '—'}</Link>
                </td>
                <td>{link.role}</td>
                <td>{link.crime.category?.name}</td>
              </tr>
            ))}
            {vehicle.crimeLinks.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No crime involvement on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ProtectedShell>
  );
}

export default function VehicleDetailPage() {
  return (
    <Suspense fallback={<ProtectedShell><p className="muted">Loading…</p></ProtectedShell>}>
      <VehicleDetailPageInner />
    </Suspense>
  );
}
