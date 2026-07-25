'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { CrimeCategory, District, GeoCrimePoint, HotspotClusterApi, PoliceStation } from '@/lib/types';
import type { MapFocus } from '@/components/CrimeMap';

// Leaflet touches `window` at layer-construction time, so the map can only
// exist client-side — ssr:false is load-bearing here, not a style choice.
const CrimeMap = dynamic(() => import('@/components/CrimeMap').then((m) => m.CrimeMap), { ssr: false });

type Mode = 'heatmap' | 'hotspots';
type TimeRange = 'all' | '30' | '90' | '365';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  all: 'All time',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '365': 'Last 365 days',
};

export default function MapPage() {
  const api = useApi();
  const { user } = useAuth();
  const isStateWide = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [categories, setCategories] = useState<CrimeCategory[]>([]);

  const [districtId, setDistrictId] = useState('');
  const [stationId, setStationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [mode, setMode] = useState<Mode>('heatmap');

  const [points, setPoints] = useState<GeoCrimePoint[]>([]);
  const [clusters, setClusters] = useState<HotspotClusterApi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<CrimeCategory[]>('/crime-categories').then(setCategories).catch(() => {});
    if (isStateWide) {
      api<District[]>('/districts').then(setDistricts).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStateWide]);

  useEffect(() => {
    // /stations itself isn't jurisdiction-scoped server-side (it's reference
    // data, not case data), so an Officer's district restriction is applied
    // here on the client to keep the station picker consistent with what
    // they can actually see on the map — the map data itself is still
    // independently enforced server-side regardless of what this sends.
    const scopedDistrictId = isStateWide ? districtId : user?.districtId ?? '';
    const path = `/stations${scopedDistrictId ? `?districtId=${scopedDistrictId}` : ''}`;
    api<PoliceStation[]>(path).then(setStations).catch(() => {});
  }, [districtId, isStateWide, user?.districtId]);

  const fromDate = useMemo(() => {
    if (timeRange === 'all') return undefined;
    return new Date(Date.now() - Number(timeRange) * 86_400_000).toISOString();
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (districtId) params.set('districtId', districtId);
    if (stationId) params.set('stationId', stationId);
    if (categoryId) params.set('categoryId', categoryId);
    if (fromDate) params.set('from', fromDate);

    const request =
      mode === 'heatmap'
        ? api<GeoCrimePoint[]>(`/geospatial/points?${params.toString()}`).then((data) => {
            setPoints(data);
            setClusters([]);
          })
        : api<HotspotClusterApi[]>(`/geospatial/hotspots?${params.toString()}`).then((data) => {
            setClusters(data);
            setPoints([]);
          });

    request.catch(() => {}).finally(() => setLoading(false));
  }, [mode, districtId, stationId, categoryId, fromDate]);

  const focus: MapFocus | null = useMemo(() => {
    if (stationId) {
      const s = stations.find((x) => x.id === stationId);
      if (s) return { lat: s.latitude, lng: s.longitude, zoom: 13 };
    }
    if (districtId) {
      const inDistrict = stations.filter((s) => s.districtId === districtId);
      if (inDistrict.length > 0) {
        const lat = inDistrict.reduce((sum, s) => sum + s.latitude, 0) / inDistrict.length;
        const lng = inDistrict.reduce((sum, s) => sum + s.longitude, 0) / inDistrict.length;
        return { lat, lng, zoom: 10 };
      }
    }
    return null;
  }, [districtId, stationId, stations]);

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Geospatial Intelligence</h1>
      </div>

      <div className="card">
        <div className="filters">
          <div className="field">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="heatmap">Heatmap (density)</option>
              <option value="hotspots">Hotspot Clusters (DBSCAN)</option>
            </select>
          </div>

          {isStateWide && (
            <div className="field">
              <label>District</label>
              <select
                value={districtId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setStationId('');
                }}
              >
                <option value="">All districts (Karnataka)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Police Station</label>
            <select value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="">{isStateWide ? 'All stations' : 'All stations in your district'}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Time Range</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
              {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((k) => (
                <option key={k} value={k}>
                  {TIME_RANGE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="chart-subtitle" style={{ marginTop: '-0.4rem' }}>
          {mode === 'heatmap'
            ? `${loading ? 'Loading…' : `${points.length} crime locations`} — point-density heatmap. District/Station filters scope it to that area (this is what "District/Police Station Heatmap" means here — see docs for why this isn't a boundary-polygon choropleth).`
            : `${loading ? 'Loading…' : `${clusters.length} clusters detected`} via PostGIS DBSCAN — a real clustering algorithm, not just visual marker-bundling. Time Range makes these "time-based crime clusters."`}
        </p>

        <CrimeMap
          mode={mode}
          heatPoints={points.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
          clusters={clusters.map((c) => ({ lat: c.latitude, lng: c.longitude, count: c.pointCount }))}
          focus={focus}
        />
      </div>
    </ProtectedShell>
  );
}
