'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Leaflet + public OSM raster tiles — not Mapbox/Google (see Milestone 1:
// avoids sending investigation-area-of-interest data to a third-party map
// vendor, and avoids per-load vendor cost/lock-in). Milestone 1 also floated
// a *self-hosted* tile server as an option; that's real infra with nothing
// forcing it yet, so this prototype uses OSM's public tile service directly
// (within its documented low-volume/dev use policy) and leaves self-hosting
// as a Future Enhancement, not a requirement.
const KARNATAKA_CENTER: [number, number] = [15.317, 75.7139];
const KARNATAKA_ZOOM = 7;

// Same sequential "blue" ramp as the dashboard's bar/line charts
// (dataviz skill's reference palette, references/palette.md) — a heatmap's
// gradient IS a sequential magnitude encoding, so it uses the same hue
// family (light→dark) rather than the default heat-plugin rainbow.
const HEAT_GRADIENT: Record<number, string> = {
  0.2: '#cde2fb',
  0.4: '#86b6ef',
  0.6: '#3987e5',
  0.8: '#1c5cab',
  1.0: '#0d366b',
};
const HOTSPOT_FILL = '#2a78d6';
const HOTSPOT_STROKE = '#184f95';

export interface HeatPoint {
  lat: number;
  lng: number;
}

export interface HotspotCluster {
  lat: number;
  lng: number;
  count: number;
}

export interface MapFocus {
  lat: number;
  lng: number;
  zoom: number;
}

export function CrimeMap({
  mode,
  heatPoints,
  clusters,
  focus,
}: {
  mode: 'heatmap' | 'hotspots';
  heatPoints: HeatPoint[];
  clusters: HotspotCluster[];
  focus: MapFocus | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  // Mount the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(KARNATAKA_CENTER, KARNATAKA_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the data layer when mode or data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (mode === 'heatmap') {
      const heat = L.heatLayer(
        heatPoints.map((p) => [p.lat, p.lng, 0.55] as [number, number, number]),
        { radius: 22, blur: 18, maxZoom: 12, gradient: HEAT_GRADIENT },
      );
      heat.addTo(map);
      layerRef.current = heat;
    } else {
      const group = L.layerGroup();
      const maxCount = Math.max(1, ...clusters.map((c) => c.count));
      clusters.forEach((c) => {
        const radius = 9 + (c.count / maxCount) * 28;
        L.circleMarker([c.lat, c.lng], {
          radius,
          fillColor: HOTSPOT_FILL,
          fillOpacity: 0.5,
          color: HOTSPOT_STROKE,
          weight: 1.5,
        })
          .bindTooltip(`${c.count} crimes in this cluster`)
          .addTo(group);
      });
      group.addTo(map);
      layerRef.current = group;
    }
  }, [mode, heatPoints, clusters]);

  // District/station drill-down: fly to the requested focus, or reset to
  // the state-wide view when cleared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focus) {
      map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
    } else {
      map.flyTo(KARNATAKA_CENTER, KARNATAKA_ZOOM, { duration: 0.8 });
    }
  }, [focus]);

  return <div ref={containerRef} style={{ height: '620px', width: '100%', borderRadius: 8 }} />;
}
