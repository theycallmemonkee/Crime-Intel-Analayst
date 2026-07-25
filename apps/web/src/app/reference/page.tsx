'use client';

import { useEffect, useState } from 'react';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { District, PoliceStation } from '@/lib/types';

export default function ReferenceDataPage() {
  const api = useApi();
  const { user } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  function loadDistricts() {
    api<District[]>('/districts').then(setDistricts).catch(() => {});
  }

  useEffect(loadDistricts, []);

  useEffect(() => {
    api<PoliceStation[]>(`/stations${selectedDistrict ? `?districtId=${selectedDistrict}` : ''}`)
      .then(setStations)
      .catch(() => {});
  }, [selectedDistrict]);

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Districts &amp; Police Stations</h1>
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
        Reference/master data{isAdmin ? ' — manage via the API for now (admin-only write, no UI form yet).' : '.'}
      </p>

      <div className="card">
        <p className="section-title">Districts ({districts.length})</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: '0.75rem' }}>
          <p className="section-title" style={{ margin: 0 }}>
            Police Stations ({stations.length})
          </p>
          <div className="field">
            <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>District</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.code}</td>
                <td>{s.district?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProtectedShell>
  );
}
