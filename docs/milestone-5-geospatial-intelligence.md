# Milestone 5 — Geospatial Intelligence

## 1. Objective

Give investigators a real map: an interactive Karnataka view, density heatmaps scoped to a district or station, and genuine algorithmic hotspot/cluster detection over time — built on the PostGIS `geom` column that's existed since Milestone 2 but hasn't been used for anything spatial until now.

## 2. Functional Requirements Covered

- **Interactive Karnataka Map** — pannable/zoomable Leaflet map, OSM tiles, centered on Karnataka.
- **Crime Hotspots** — PostGIS `ST_ClusterDBSCAN` clustering, not visual marker-bundling.
- **District Heatmaps** / **Police Station Heatmaps** — point-density heatmap layer, scoped by district or station filter and auto-zoom.
- **Time-based Crime Clusters** — the same DBSCAN endpoint, parameterized by a date range, so hotspots can be compared across time windows (all-time / 30 / 90 / 365 days).

## 3. Two Deliberate, Documented Approximations

Both were flagged to you before writing any code, not discovered after the fact:

### 3.1 Heatmaps, not choropleths

A true choropleth ("District Heatmap" in the literal GIS sense) needs administrative boundary polygons — precise district/taluk shapefiles. This project has none, and fabricating approximate Karnataka district boundaries would be presenting invented data as if it were authoritative, which is worse than not having the feature. Instead, District/Station "heatmaps" here are **point-density heatmaps** (kernel-density visualization over actual crime coordinates via `leaflet.heat`), scoped by the district/station filter. This is arguably the more honest technique anyway: it shows where crimes actually cluster geographically rather than shading an entire administrative region uniformly by its total count (which can be misleading for large, unevenly-populated districts). Real boundary polygons remain a Future Enhancement if a verified Karnataka GeoJSON dataset is sourced later.

### 3.2 DBSCAN `eps` in kilometers is an approximation, not survey-grade

`ST_ClusterDBSCAN` operates in the units of the geometry's SRID — degrees, for our SRID 4326 `geom` column. There's no built-in geography (meters) variant of this function in standard PostGIS. The API accepts `epsKm` (a human-meaningful "cluster radius in km") and converts it internally via the standard approximation **1° ≈ 111.32km**, which is accurate enough at Karnataka's latitude for a regional-scale prototype but is not the same as a proper geodesic distance calculation. Documented in code (`geospatial.service.ts`) so nobody mistakes it for more precise than it is.

## 4. Backend: `GeospatialModule`

| Endpoint | Returns |
|---|---|
| `GET /geospatial/points?districtId=&stationId=&categoryId=&from=&to=` | raw crime coordinates + category/status/station, for the heatmap layer |
| `GET /geospatial/hotspots?…&epsKm=&minPoints=` | DBSCAN cluster centroids + point counts |

Both go through the same jurisdiction scoping as Crimes and Dashboards (Officer → their district only; verified: 65 points/1 cluster for an Officer vs. 901 points/18 clusters for Admin). The hotspot query's raw SQL:

```sql
WITH clustered AS (
  SELECT id, geom, ST_ClusterDBSCAN(geom, eps::float8, minpoints::int) OVER () AS cluster_id
  FROM "Crime" WHERE <scope + filters>
)
SELECT cluster_id, COUNT(*), ST_Y(ST_Centroid(ST_Collect(geom))), ST_X(ST_Centroid(ST_Collect(geom)))
FROM clustered WHERE cluster_id IS NOT NULL GROUP BY cluster_id
```

Two implementation snags worth recording, both caught by actually running the query rather than assuming it would work:
- PostGIS function names (`ST_ClusterDBSCAN`, `ST_Y`, etc.) must **not** be double-quoted in the SQL — quoting makes Postgres treat them as case-sensitive identifiers, which fails to match the actual lowercase-stored function names. An easy mistake since table/column names in this codebase *are* quoted (Prisma's convention) and the two rules look inconsistent side by side.
- `ST_ClusterDBSCAN(geometry, eps, minpoints)` needs `eps::float8` and `minpoints::int` explicit casts — Prisma's `$queryRaw` sends JS numbers as `numeric`/`bigint` by default, and Postgres won't implicitly cast those to the `double precision`/`integer` the function signature expects. Failed with `function st_clusterdbscan(geometry, numeric, bigint) does not exist` until cast explicitly.

**Refactor while here:** extracted `common/sql-scope.util.ts` (`buildCrimeScopeConditions` / `crimeWhereClause`) from what was duplicated jurisdiction-filtering logic in `DashboardsService`, now shared with `GeospatialService`. Two independent copies of "how do we scope a raw SQL query by role" is a security-relevant duplication worth eliminating on sight, not deferring.

## 5. Frontend: One Map, Two Modes

`/map` — a single page rather than separate District/Station/Hotspot pages, since they're all the same map with different data layers and filters:

- **Mode**: Heatmap (density) or Hotspot Clusters (DBSCAN).
- **Filters**: District (Admin/Analyst only — Officers are locked to their own, matching the same pattern used everywhere else in the app), Police Station (cascading), Category, Time Range.
- **Auto-focus**: selecting a station flies the map to its coordinates (zoom 13); selecting a district flies to the average position of that district's stations (zoom 10, since District has no stored centroid of its own — computed client-side from the stations already being fetched for the cascading dropdown, rather than adding a new backend field for it).
- Leaflet mounts client-side only (`next/dynamic` with `ssr:false`) since it touches `window` at layer-construction time — this is a hard requirement, not a preference, or the page would crash on the server render pass.
- The heatmap gradient reuses the exact same sequential blue ramp as the Milestone 4 dashboard charts (`dataviz` skill's reference palette) instead of the heat-plugin's default rainbow gradient — a density heatmap *is* a sequential magnitude encoding, so it gets the same hue family as every other magnitude chart in the app, not a different visual language.

## 6. Verified

Full browser pass, both roles: state-wide heatmap over real OSM tiles (Bengaluru/Mysuru/Hubballi and other Karnataka cities render correctly from the tile server) → switched to Hotspot Clusters and got 18 real DBSCAN clusters with sizes proportional to point count → drilled into a district (map flew and re-centered) → drilled further into a single station (map flew to street-level Ballari, individual heat blobs visible along real roads) → applied a 30-day time filter to hotspot mode and got a different (smaller) cluster set, confirming "time-based crime clusters" actually changes with the window → logged in as Officer and confirmed the District selector is entirely absent (not just disabled) and the station list is pre-scoped to their own district only. Zero JavaScript errors across the entire pass.

## 7. Future Enhancements

- Real Karnataka district/taluk boundary polygons (GeoJSON) for a literal choropleth, if a verified dataset is sourced — not fabricated.
- Self-hosted OSM tile server (Milestone 1 flagged this as optional; public OSM tiles are used for now, within their documented low-volume/dev-use policy).
- Marker-level click-through from a hotspot cluster to the underlying crime list (currently a cluster shows a count tooltip only, not a drill-in).
- Geodesic (not degree-approximated) DBSCAN distance, if cluster precision ever needs to be tighter than a regional prototype requires.

---

**Awaiting your review. Next up per the roadmap: Milestone 6 — Network & Link Analysis.**
