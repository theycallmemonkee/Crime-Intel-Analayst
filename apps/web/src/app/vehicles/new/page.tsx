'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Vehicle } from '@/lib/types';

export default function NewVehiclePage() {
  const api = useApi();
  const router = useRouter();
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [type, setType] = useState('Two-Wheeler');
  const [color, setColor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const vehicle = await api<Vehicle>('/vehicles', {
        method: 'POST',
        body: { registrationNumber, type, color: color || undefined },
      });
      router.push(`/vehicles/view?id=${vehicle.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create vehicle');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Add Vehicle</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <form className="stacked" onSubmit={onSubmit}>
          <div className="field">
            <label>Registration Number</label>
            <input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              required
              minLength={4}
              placeholder="KA05AB1234"
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {['Two-Wheeler', 'Car', 'Auto Rickshaw', 'Truck', 'Tempo'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Color (optional)</label>
            <input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Vehicle'}
          </button>
        </form>
      </div>
    </ProtectedShell>
  );
}
