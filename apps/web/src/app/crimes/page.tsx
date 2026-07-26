'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/lib/auth-context';
import { useAuth } from '@/lib/auth-context';
import { CrimeCategory, District, InvestigationStatus, Paginated, PoliceStation, Crime } from '@/lib/types';

const STATUSES: InvestigationStatus[] = ['REPORTED', 'UNDER_INVESTIGATION', 'CHARGESHEETED', 'CLOSED'];
const PAGE_SIZE = 15;

export default function CrimesListPage() {
  const api = useApi();
  const { user } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [categories, setCategories] = useState<CrimeCategory[]>([]);

  const [districtId, setDistrictId] = useState('');
  const [stationId, setStationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<Crime> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<District[]>('/districts').then(setDistricts).catch(() => {});
    api<CrimeCategory[]>('/crime-categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api<PoliceStation[]>(`/stations${districtId ? `?districtId=${districtId}` : ''}`)
      .then(setStations)
      .catch(() => {});
  }, [districtId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (districtId) params.set('districtId', districtId);
    if (stationId) params.set('stationId', stationId);
    if (categoryId) params.set('categoryId', categoryId);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api<Paginated<Crime>>(`/crimes?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [districtId, stationId, categoryId, status, page]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Crimes</h1>
        {canCreate && (
          <Link href="/crimes/new" className="btn">
            + File New Crime
          </Link>
        )}
      </div>

      <div className="filters card">
        <div className="field">
          <label>District</label>
          <select
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setStationId('');
              setPage(1);
            }}
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Station</label>
          <select
            value={stationId}
            onChange={(e) => {
              setStationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>FIR No.</th>
                  <th>Category</th>
                  <th>District / Station</th>
                  <th>Occurred</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/crimes/view?id=${c.id}`}>{c.fir?.firNumber ?? '—'}</Link>
                    </td>
                    <td>{c.category?.name}</td>
                    <td>
                      {c.district?.name} / {c.station?.name}
                    </td>
                    <td>{new Date(c.occurredAt).toLocaleDateString()}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No crimes match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="pagination">
              <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages} ({data?.total ?? 0} total)
              </span>
              <button
                className="btn secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedShell>
  );
}
