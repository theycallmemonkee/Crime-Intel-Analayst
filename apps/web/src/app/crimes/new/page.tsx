'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Crime, CrimeCategory, District, PoliceStation } from '@/lib/types';

export default function NewCrimePage() {
  const api = useApi();
  const { user } = useAuth();
  const router = useRouter();

  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [categories, setCategories] = useState<CrimeCategory[]>([]);

  const isOfficer = user?.role === 'OFFICER';
  const [districtId, setDistrictId] = useState('');
  const [stationId, setStationId] = useState(isOfficer ? user?.stationId ?? '' : '');
  const [categoryId, setCategoryId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [firNarrative, setFirNarrative] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<District[]>('/districts').then(setDistricts).catch(() => {});
    api<CrimeCategory[]>('/crime-categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOfficer) return; // Officers file only at their own station — no district/station picker needed.
    api<PoliceStation[]>(`/stations${districtId ? `?districtId=${districtId}` : ''}`)
      .then(setStations)
      .catch(() => {});
  }, [districtId, isOfficer]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const crime = await api<Crime>('/crimes', {
        method: 'POST',
        body: {
          categoryId,
          stationId,
          occurredAt: new Date(occurredAt).toISOString(),
          description,
          addressLine,
          latitude: Number(latitude),
          longitude: Number(longitude),
          firNarrative,
        },
      });
      router.push(`/crimes/view?id=${crime.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create crime');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>File New Crime</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <form className="stacked" onSubmit={onSubmit}>
          {isOfficer ? (
            <p className="muted">
              Filing at your assigned station: <strong>{user?.fullName}</strong>
            </p>
          ) : (
            <>
              <div className="field">
                <label>District</label>
                <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} required>
                  <option value="">Select district…</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Police Station</label>
                <select value={stationId} onChange={(e) => setStationId(e.target.value)} required>
                  <option value="">Select station…</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="field">
            <label>Crime Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Date/Time Occurred</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={5}
            />
          </div>

          <div className="field">
            <label>Address</label>
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>FIR Narrative</label>
            <textarea
              rows={4}
              value={firNarrative}
              onChange={(e) => setFirNarrative(e.target.value)}
              required
              minLength={10}
              placeholder="Describe the complaint as reported…"
            />
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Filing…' : 'File Crime & FIR'}
          </button>
        </form>
      </div>
    </ProtectedShell>
  );
}
