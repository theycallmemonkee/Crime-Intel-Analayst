# Milestone 4 — Advanced Dashboards

## 1. Objective

Turn the crime records built in Milestone 3 into the intelligence dashboard the brief specifies: Total Crimes, Crime Categories, District-wise Analysis, Police Station Drill-down, Time-based/Monthly/Yearly Trends, Crime Growth, and Investigation Status — as a single landing page investigators see immediately after login, not a buried report.

## 2. Functional Requirements Covered

- **Total Crimes** — KPI tile.
- **Crime Categories** — ranked bar chart, all categories.
- **District-wise Analysis** — ranked bar chart (Admin/Analyst; state-wide).
- **Police Station Drill-down** — clicking a district in the chart above drills into that district's stations (Admin/Analyst); Officers see their own district's stations directly, since a 1-district breakdown would be a pointless chart.
- **Time-based Trends / Monthly Trends** — line chart, 12 months, year-selectable.
- **Yearly Trends** — table of yearly totals with year-over-year growth.
- **Crime Growth** — KPI tile: current month's count vs. previous month, as a %.
- **Investigation Status** — stacked bar across the four workflow states, direct-labeled counts and percentages.

## 3. Architecture Decision: Live Aggregation Queries, Not Materialized Rollups

Milestone 1's architecture sketch mentioned "materialized aggregates (rollup tables refreshed on event)" for the dashboard module — that was written before there was real data to size against. At 901 seeded crimes, every aggregation query in this milestone (grouped counts, monthly `date_trunc`, yearly `date_trunc`) runs in single-digit milliseconds against indexed columns. Building a rollup-table-plus-refresh-trigger pipeline now would be solving a performance problem that doesn't exist yet, at the cost of a staleness problem that would exist immediately (rollups are only as fresh as their last refresh). Live queries are simpler, always correct, and fast enough — this is revisited if/when real data volume changes that calculus, not before.

## 4. Backend: `DashboardsModule`

One service, one controller, seven endpoints — all under `/dashboards`, all going through the same `districtScopeFilter` used by Crimes in Milestone 3A (Officers see their district only; Admin/Analyst see state-wide), so jurisdiction rules don't have to be re-derived per widget.

| Endpoint | Returns |
|---|---|
| `GET /dashboards/summary` | total crimes, active investigations, chargesheeted, closed, month-over-month growth % |
| `GET /dashboards/by-category` | crime counts per category, sorted desc |
| `GET /dashboards/by-district` | crime counts per district, sorted desc |
| `GET /dashboards/by-station?districtId=` | crime counts per station, optionally scoped to one district |
| `GET /dashboards/by-status` | counts for all 4 `InvestigationStatus` values, always zero-filled (never omits a status with zero cases — a missing segment on a stacked bar reads as "doesn't exist," not "zero") |
| `GET /dashboards/trends/monthly?year=` | 12 zero-filled monthly buckets for the given year |
| `GET /dashboards/trends/yearly` | one row per year present in the data, with year-over-year growth % |

Category/district/station/status use Prisma's `groupBy` (simple, type-safe). Monthly/yearly trends use `$queryRaw` with `date_trunc`, because `groupBy` can't group by a derived expression — the raw SQL is built from `Prisma.sql` fragments joined with `Prisma.join`, so filters stay parameterized (no string-built SQL, no injection surface) despite being hand-written.

## 5. Frontend: Chart Design (per the `dataviz` skill)

The skill was loaded and followed before any chart code was written — color chosen last, form chosen first, palette validated by script rather than eyeballed. Concretely:

- **Category / District / Station charts are single-hue bars, not rainbow bars.** Per the skill's job table, comparing magnitude across named categories is a *sequential* color job — the bar's own axis label already identifies it, so a different hue per bar would encode nothing and just be noise. This also sidesteps a real constraint: there are 10 crime categories, over the skill's 8-color categorical ceiling, so a multi-hue treatment would have needed a fold-into-"Other" strategy for no visual benefit.
- **Investigation Status is the one true categorical chart** (4 distinct states, part-to-whole) — a single stacked bar, fixed color order (workflow order: Reported → Under Investigation → Chargesheeted → Closed, never reordered by filters), with counts and percentages always visible in the legend. 4 series crosses the skill's "CVD floor" threshold where direct labels stop being optional — confirmed via `validate_palette.js`, which passed the chosen 4-hue set but flagged 2 of them below 3:1 surface contrast, meaning the direct-label requirement is load-bearing, not decorative.
- **Monthly Trend is a single-series line** with a real hover layer — crosshair + tooltip on mousemove, snapping to the nearest month — because the skill treats hover as non-optional for line/area charts, not a nice-to-have. Verified live: hovering the chart shows "Jun: 17" tracking the cursor.
- **Crime Growth is a stat tile, not a chart.** Per the skill's "is it even a chart?" table, a single current value with a trend is a stat tile (value + delta), not a forced one-bar bar chart — this is exactly that case.
- **Yearly Trend is a table, not a chart.** Four data points (2023–2026) don't earn a line chart; a table with colored deltas (green/red, reusing the same ink tokens as the stat tile's growth indicator) is more precise and consistent with the skill's "a handful of headline numbers → KPI row / table" guidance.

## 6. Two real bugs caught by browser verification, not code review

1. **Station name truncation.** The ranked-bar-chart's label column was a fixed 140px, which clipped "Bengaluru Urban Town PS" mid-word on the Officer's drill-down view. Invisible in a props/data check, obvious in the actual screenshot — widened the column and added a `title` attribute for the full name on hover.
2. **Unhandled promise rejections on logout.** Several `.then()` chains across both this milestone's dashboard page and three pages carried over from Milestone 3B (`persons`, `vehicles`, `weapons`, `reference`) had no `.catch()`. Logging out while a request was in flight produced a genuine `pageerror` in the browser console — caught only because the verification script checks `console --errors` after every interaction, not just whether the page rendered. Fixed by adding `.catch()` throughout (silent for secondary/dropdown data, a visible error banner for primary content), consistent with the pattern already used correctly in the Crimes and Crime Detail pages.

This is the second milestone in a row where a real defect surfaced only through an actual browser pass rather than a data/API check — reinforcing that this is the right verification bar to keep using, not a one-off.

## 7. Testing Strategy (this milestone)

- Verified every `/dashboards/*` endpoint via curl against seeded data, including confirming Officer vs. Admin scoping (65 vs. 901 total crimes) matches Milestone 3A's established pattern.
- Full browser pass (Playwright): Admin dashboard renders all six widgets correctly; clicking a district drills into its stations with a working breadcrumb back; hovering the monthly trend line shows the correct month/count tooltip; logging out and back in as Officer shows the district-scoped view with "Police Station Drill-down" instead of "District-wise Analysis" (no district chart with a single, meaningless bar); zero console errors after fixes.

## 8. Future Enhancements

- Materialized rollups + refresh pipeline, if data volume ever makes live aggregation too slow (§3) — not a speculative build now.
- Category/date-range filtering on the dashboard itself (currently the dashboard shows all-time category/status/district data; only the monthly trend has a year selector).
- Dark mode for the chart palette (the `dataviz` skill's reference palette has validated dark-mode steps ready to use; the app has no theme toggle yet to hang them on).
- Exportable dashboard snapshots, once Milestone 8 (Reporting) exists to hang that off of.

---

**Awaiting your review. Next up per the roadmap: Milestone 5 — Geospatial Intelligence.**
