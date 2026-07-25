# Milestone 8 — Reporting

## 1. Objective

Deliver the four report types from the brief — Intelligence Reports, Crime Trend Reports, District Reports, Investigation Reports — as real exportable documents, by composing data already built across Milestones 3–7 rather than duplicating any of it.

## 2. Architecture Decision: Browser Print-to-PDF, Not a Server-Side PDF Library

Flagged upfront rather than silently decided: PDF export here is styled HTML report pages + the browser's native print dialog (`window.print()` → Save as PDF), not a server-side library (`pdfkit`, `@react-pdf/renderer`, or a headless-Chrome-based renderer). This is the same "no new infra without genuine need" pattern followed since Milestone 5 (heatmaps over fabricated boundaries), Milestone 6 (no Python service), and Milestone 7 (no ML service) — and it holds up on inspection, not just as a lean default:

- Zero new backend dependencies. The report pages are just more Next.js pages, styled with the design system already in place since Milestone 3B.
- The output is genuinely professional — confirmed by rendering an actual report under Chromium's print-media emulation (`page.emulateMedia({ media: 'print' })`) and inspecting the result: nav chrome and buttons cleanly hidden, full-width layout, card borders instead of screen shadows, tables that don't split awkwardly across a page break.
- The report is also just... a normal web page. It's useful on-screen without exporting anything, which a server-generated PDF blob wouldn't be.

The tradeoff, stated plainly: this depends on the user's browser and its print/PDF engine rather than a controlled server-side renderer, so pixel-perfect consistency across browsers isn't guaranteed the way it would be with a dedicated PDF library. For an internal tool where the reports are read on-screen or saved via a modern browser, this is a reasonable tradeoff, not a corner cut — flagged as a Future Enhancement if server-controlled PDF output is ever a hard requirement.

## 3. Backend: Composition, Not Duplication

`ReportsService` doesn't re-implement any aggregation logic — it *injects and calls* `DashboardsService`, `NetworkService`, `AiService`, and `CrimesService` directly, reusing their existing, already-tested methods. This required adding `exports: [...]` to four module files that hadn't needed to export their service before (nothing had imported them cross-module until now) — a small, mechanical change, not a redesign.

| Report | Composed from | Access |
|---|---|---|
| **Intelligence Report** | Dashboards (summary/category/district/status) + Network (repeat offenders, gang networks) + AI (high-risk districts, anomalies, trend) | Admin/Analyst only — it embeds Network & AI Intelligence findings, which are themselves Admin/Analyst-only capabilities (Milestones 6/7); a report can't grant access the underlying data doesn't have. |
| **Crime Trend Report** | Dashboards (monthly/yearly trend, category) + AI (trend prediction) | All roles; Officer sees it scoped to their district. |
| **District Report** | Dashboards (summary/station/category/status/monthly, all district-filtered) + AI (station risk, filtered down to just that district's stations) | All roles; Officer can only request their own district (`assertCanReadDistrict` — new jurisdiction helper, throws 403 on a foreign district rather than silently returning an empty report). |
| **Investigation Report** | `CrimesService.findOne` directly — the exact same jurisdiction-checked query the Crime Detail page uses | All roles; a report is just a formatted export of a case the requester can already see. |

One access-control subtlety worth recording: `AiService`/`NetworkService` methods don't take a `user` parameter — they don't need to, because their *controllers* are Admin/Analyst-gated, so an Officer never reaches them directly. `ReportsService` calls these services as a library, which bypasses that controller gate. For the Crime Trend Report (open to all roles) and District Report (open to all roles, but district-restricted), this means `ReportsService` has to enforce district-scoping on those specific calls itself (`effectiveAiFilters` helper) — otherwise an Officer's "my district" trend report could accidentally embed a state-wide AI trend calculation. This was caught during design (before shipping), not after.

## 4. A Real, Application-Wide Bug Found While Testing This Milestone

Not a Reports bug — a bug in every page in the app, discovered because Reports pages were the first ones tested via direct URL navigation / hard reload rather than always clicking through in-app links.

**Symptom:** loading a page via `page.goto()` (equivalent to a user refreshing the browser or opening a bookmarked/shared URL) intermittently logged the user straight back out to `/login`, even with a completely valid session.

**Root cause:** every page fetches its own data in a `useEffect(() => { api(...) }, [])` that runs on mount. React runs *child* effects before *parent* effects. `AuthProvider` (the parent, wrapping the whole app) reads the JWT from `localStorage` inside its own `useEffect` — but on a hard page load, a deeply-nested page's fetch effect can run *before* that parent effect has had a chance to hydrate the token. The request goes out with `token: null`, the backend correctly returns 401, and `useApi`'s catch-401 handler — reasonably, on its own terms — calls `logout()`. The session was never actually invalid; the very first request just fired before the token existed in memory.

**Fix, and why it's one change instead of twenty:** the obvious fix is to make every page's fetch effect wait for auth to finish loading — but that means editing ~20 page files and hoping none are missed. Instead, `auth-context.tsx` now exposes a `tokenRef` (always current, unlike a value closed over by an effect that already ran) and a `ready` promise (resolves once the hydration effect completes) through an internal context that only `useApi()` consumes. Every `api(...)` call now `await`s `ready` before reading the *current* token off `tokenRef` — fixing the race for every existing and future page from one file, with zero changes to any page. Verified by re-running the exact hard-reload scenario that reproduced the bug and confirming the page now renders correctly instead of bouncing to `/login`.

## 5. Frontend

- `/reports` — index page; Admin/Analyst see all four report types, Officer sees three (no Intelligence Report card) with the District Report pre-scoped to their own district.
- `/reports/intelligence`, `/reports/trends`, `/reports/district/[id]`, `/reports/investigation/[crimeId]` — one page per report type, each a `ReportHeader` (title, generated-by/at, Print button) plus report-specific sections, all reusing existing chart components (`TrendPredictionChart`, `RiskBadge`, `StatusBadge`) rather than inventing new ones.
- **"Print Case File"** added directly to the existing Crime Detail page (`/crimes/[id]`) — the natural place an investigator would want to generate an Investigation Report from, rather than requiring a trip through the Reports index.
- Print stylesheet (`@media print` in `globals.css`): hides nav and any `.no-print` element, strips backgrounds/shadows for print, keeps table rows from splitting across a page break.

## 6. Verified

Full browser pass as Admin: all four report types render with real, correct data (Intelligence Report's repeat-offender and gang-network sections match Milestones 6/7's own pages exactly) → print-media emulation confirmed nav/buttons cleanly hidden and layout reflowing to full width → "Print Case File" from a live crime detail page correctly lands on that crime's Investigation Report. As Officer: Reports index has no Intelligence Report option, District Report is pre-scoped to their own district, and a direct API call to `/reports/intelligence` correctly returns 403. The auth-race fix was verified by reproducing the original bug (hard reload → incorrectly logged out) and confirming it no longer occurs.

## 7. Future Enhancements

- Server-controlled PDF rendering (headless Chrome or a PDF library) if cross-browser print-output consistency ever becomes a hard requirement — not needed for this deployment.
- Saved/scheduled reports (e.g., a weekly Intelligence Report emailed automatically) — no scheduling infrastructure exists yet, and nothing in the brief calls for it.
- Investigation Report status history — currently shows current status only, not a timeline of transitions (the platform doesn't log status-change events with old/new values yet, only current state).

---

**Milestone 8 completes the platform's full Milestone 1 roadmap (Milestones 1–8).**
