# Milestone 3B — Crime Data Management: Frontend UI

## 1. Objective

Give every backend capability from Milestone 3A a working UI: login, crime filing (with FIR), status workflow, linking suspects/victims/witnesses/vehicles/weapons, evidence logging, and person/vehicle search — with the same RBAC rules enforced visually (not just on the backend) so each role sees an interface that matches what they're actually allowed to do.

## 2. Architecture Decisions

### 2.1 Client-rendered SPA, not SSR — and why that's a real tradeoff, not a shortcut

`apps/web` is Next.js (App Router) but every page is a client component doing its own `fetch` against `core-api`, with the JWT held in `localStorage` rather than an httpOnly cookie + server session. For an internal investigator tool with no public pages and no SEO need, Next.js's SSR/RSC machinery buys nothing, so a client-rendered app is simpler to reason about and to secure at this scale.

**The tradeoff, stated plainly:** a token in `localStorage` is readable by any script on the page, which makes it more exposed to XSS than an httpOnly cookie would be. That's an acceptable risk for a local prototype behind no public deployment, and is exactly the kind of thing flagged in Milestone 1 (§9) as a hardening item — "real auth hardening" — for if this ever moves past prototype. It should not be copied into a production build without revisiting this.

### 2.2 RBAC is enforced twice, on purpose, and the two enforcements do different jobs

The backend (Milestone 3A) is the actual authority — every write is checked there regardless of what the UI shows. The frontend *additionally* hides buttons/forms an Analyst or wrong-station Officer can't use (`user?.role === 'ADMIN' || user?.role === 'OFFICER'` gates on `canWrite` throughout). This isn't redundant defense-in-depth theater: hiding the "Remove" button for an Analyst is a UX decision (don't show controls that would just 403), while the backend check is the security boundary. Verified live: an Analyst's crime detail page shows no status dropdown, no Remove/Add buttons, and no create button anywhere — confirmed by an automated browser pass, not just code review.

### 2.3 One shared `useApi()` hook, not fetch calls scattered per page

`lib/auth-context.tsx` exports `useApi()`, which wraps `apiFetch` with the current token and auto-logout-on-401. Every page calls through this rather than re-deriving the token/header logic — worth the small abstraction since it's the same three lines (attach token, handle 401, handle error) needed in every one of the ~13 pages.

### 2.4 Sub-resource linking UI mirrors the backend's sub-resource design

Because Milestone 3A modeled evidence/person-links/vehicle-links/weapon-links as sub-resources of Crime rather than independent entities, the crime detail page follows the same shape: one page, four sections (Persons/Vehicles/Weapons/Evidence), each with its own small search-and-link interaction rather than a generic "add relation" widget. Person/Vehicle linking uses live `pg_trgm` search-as-you-type (debounced 250ms) against `/persons/search` and `/vehicles/search` — the same fuzzy search built in Milestone 3A, now actually load-bearing in the UI rather than just an API that returns JSON.

## 3. Pages Built

| Route | Purpose | Access |
|---|---|---|
| `/login` | Auth | public |
| `/crimes` | Filterable, paginated list (district/station/category/status) | all roles; district-scoped for Officer (enforced server-side, reflected automatically since the UI just renders what the API returns) |
| `/crimes/new` | File a crime + FIR | Admin, Officer (Officer's station is fixed, not a picker) |
| `/crimes/[id]` | Full detail: FIR, status workflow, person/vehicle/weapon links, evidence | all roles read; write controls hidden for Analyst |
| `/persons`, `/persons/new`, `/persons/[id]` | List+fuzzy search, create, detail with crime history | write hidden for Analyst |
| `/vehicles`, `/vehicles/new`, `/vehicles/[id]` | Same pattern as Persons | write hidden for Analyst |
| `/weapons` | List + inline add form | write hidden for Analyst |
| `/reference` | Districts + Police Stations (read-only browse; write stays API-only — see §5) | all roles |

## 4. Implementation Notes

- Styling is hand-written CSS (`globals.css`), no component library — reduces dependency surface for what's fundamentally tables, forms, and badges; revisit if the design needs grow past what plain CSS comfortably covers.
- `StatusBadge` centralizes the status→color mapping used across the crimes list and detail page — the one place that mapping is defined.
- The crime-detail page's four sub-sections (`PersonsSection`, `VehiclesSection`, `WeaponsSection`, `EvidenceSection`) are separate components in the same file rather than a shared generic component — each does a materially different query/mutation shape (fuzzy search vs. a plain `<select>` for the small Weapons list vs. a form for Evidence), so a shared abstraction would need enough escape hatches to not be worth it.
- `next.config.js` pins `outputFileTracingRoot` — this machine has an unrelated `package-lock.json` directly in the home directory (a different, older project) that Next.js was mistaking for the monorepo root; pinning it explicitly avoids relying on inference.

## 5. What's Deliberately Not Here

- **No delete UI** for anything — matches Milestone 3A's backend (no delete endpoints for case data; consistent with the chain-of-custody posture).
- **No District/Station create form** — the backend endpoint exists (Admin-only) but a form for "add a new district to Karnataka" isn't a realistic workflow for the demo; noted in the Reference page copy rather than silently omitted.
- **No map picker for crime location** — Milestone 1 scoped Leaflet/OSM map integration to Milestone 5 (Geospatial Intelligence); the crime creation form takes raw lat/lng numbers for now, which is enough to exercise the PostGIS column but not a real UX for filing a crime. Flagging this now so it isn't mistaken for the finished geospatial experience.
- **No automated frontend test suite** — verified via a one-off Playwright script (see §6) rather than a committed test file, consistent with Milestone 3A's approach of prioritizing manual end-to-end verification over test scaffolding at this stage (still on the roadmap, not forgotten).

## 6. Testing Strategy (this milestone)

Verified with a real headless-Chromium pass (Playwright, installed on demand — not a project dependency) driving the actual running app against the actual running backend and seeded data:

- Officer login → crimes list correctly shows only their district's 65 records (not all 901) → opened a crime detail → confirmed FIR narrative, linked persons/vehicles, empty-state Weapons section, and Evidence table all render with real data.
- Logged out, logged in as Admin → Persons search for "Manjunath" correctly fuzzy-matched 7 people despite exact spelling differences → Vehicles search for "KA" returned real registration numbers.
- Logged in as Analyst → confirmed the crimes list has no "File New Crime" button, and a crime detail page has no status dropdown, no "Remove" buttons, and no "Add Evidence" control — the read-only role renders a genuinely read-only page, not just a technically-blocked one.
- Officer's `/crimes/new` form correctly shows a locked "Filing at your assigned station" message instead of a district/station picker.
- Checked `console --errors` after every interaction: zero JavaScript errors across the entire pass.

One real bug was caught by this process and fixed before sign-off: `PersonsService.search()`'s raw SQL didn't select `gender`, so the Gender column was silently blank on search results (visible only in the actual screenshot, not in a JSON response spot-check) — added the missing column to the query. This is exactly the kind of bug type-checking and API-level testing wouldn't have caught, which is the reason this milestone insisted on a real browser pass rather than treating "the API returns 200" as sufficient.

## 7. Future Enhancements

- Real automated E2E suite (Playwright, committed) — the ad hoc script from this milestone is a reasonable starting point to formalize.
- District/Station admin UI (currently API-only for those two writes).
- Map-based location picker (Milestone 5).
- Revisit token storage (httpOnly cookie + server session) if this platform ever moves past local-prototype deployment.

---

**Awaiting your review. This completes Milestone 3 (3A + 3B). Next up per the roadmap: Milestone 4 — Advanced Dashboards.**
