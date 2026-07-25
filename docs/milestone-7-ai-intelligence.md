# Milestone 7 — AI Intelligence

## 1. Objective

Deliver the five AI Intelligence capabilities from the brief — Crime Trend Prediction, High-Risk Area Prediction, Anomaly Detection, Pattern Discovery, Risk Scoring — as explainable, verifiable statistics over real crime records, and decide honestly whether that needs a dedicated ML service or not.

## 2. Architecture Decision — Asked, Not Assumed

Unlike Milestone 6 (where skipping the separate Python service was an easy, unambiguous call — GDS runs via Cypher regardless of language), this one was a genuine judgment call with reasonable arguments either way: Python's data-science ecosystem (Prophet, scikit-learn, statsmodels) really is more capable than anything Node offers, and Milestone 1's original architecture specifically earmarked this as a Python/FastAPI service. So rather than deciding unilaterally, this was put to you directly, with the tradeoff stated plainly — and you chose **extend the existing NestJS backend**.

That decision holds up on its own merits, not just as a lean-scope default: the synthetic dataset (900 randomly-generated crimes, no real seasonality, no genuine holiday/weather/socioeconomic covariates) doesn't actually contain the kind of signal that would make Prophet or a trained model outperform a straight-line trend fit. Standing up a heavier stack to model noise this dataset doesn't have would be a worse outcome than the honest simpler method — and Milestone 1's own non-functional requirements said as much: *"Auditability over raw performance... pushes toward explainable AI techniques over black-box models."* Every score this milestone produces shows its inputs; nothing is a black box.

## 3. Schema Addition: `CrimeCategory.severityWeight`

Two of the five capabilities (risk area scoring, person risk scoring) need a notion of "how serious is this crime category." Rather than hardcoding a name-matched lookup table in application code (fragile — breaks silently if a category is renamed, invisible to anyone browsing the schema), `severityWeight` (1–10) is a real column on `CrimeCategory`, exposed through the existing category API, settable by Admin. Values follow conventional offense-severity ordering (Murder=10 down to Vandalism=3) — a policy weight, not a learned value, and explicitly documented as tunable by the Bureau rather than fixed in code.

## 4. The Five Capabilities

All five are Admin/Analyst only — same restriction and same reasoning as Milestone 6 (Milestone 1's role table lists "AI predictions" as an explicit Analyst responsibility). Confirmed live: Officer gets 403 on every `/ai/*` endpoint and the nav link doesn't render for them at all.

| Capability | Method | Why this method |
|---|---|---|
| **Crime Trend Prediction** | Ordinary least squares (linear regression) over the trailing 12 months, projected 3 months forward with a residual-stddev uncertainty band | A straight line is the honest fit for data with no real seasonality. Slope also classifies the trend as INCREASING/DECREASING/STABLE. |
| **High-Risk Area Prediction** | Composite index: recent-90-day volume (40%) + 90-day growth rate (30%) + average crime severity (30%), each min-max normalized to 0–100 before weighting | The standard technique for combining incompatible units (a crime count, a percentage, a 1–10 severity score) into one comparable score — the same method behind real composite indices like the HDI. |
| **Anomaly Detection** | z-score of each month's count against that *same area's own* other 11 months, flagged at \|z\| ≥ 2 | Compares each station to its own baseline, not a global one — a quiet rural station and a busy urban one shouldn't share a threshold. |
| **Pattern Discovery** | Day-of-week and time-of-day distributions per category, directly aggregated from real `occurredAt` timestamps, plus a peak-day/peak-time summary per category | Descriptive analytics — the data can answer "when does this happen" directly; no model needed to ask it. |
| **Risk Scoring** | Composite of frequency (40%) + recency (30%, exponential decay with a 180-day half-life) + average severity (30%) per suspect | Same normalize-and-weight approach as area risk, applied to people. Consistent methodology across both risk-scoring features rather than two different techniques for the same underlying idea. |

### A genuinely important caveat, stated plainly rather than glossed over

Anomaly detection on sparse per-station monthly data can produce dramatic-looking z-scores (4.87 in the current seed) that reflect a very low baseline (a station that normally sees ~0 crimes/month) more than a truly exceptional event. This is a real, known limitation of z-score methods on sparse count data, not a bug — flagged here so it isn't mistaken for more statistical weight than it carries. A production system with more historical volume per area would see this stabilize.

## 5. Frontend

`/intelligence` — five tabs mirroring the five capabilities:

- **Trend Prediction**: a purpose-built chart (`TrendPredictionChart`) — solid line for history, dashed continuation for the forecast, shaded polygon for the uncertainty band, shared hover/tooltip behavior with the rest of the app's charts.
- **High-Risk Areas**: district/station toggle, sortable-by-eye table with a risk bar + band badge (new `RiskBadge`/`RiskBar` components, reused identically for person risk scoring).
- **Anomaly Detection**: table with a colored SPIKE/DROP direction indicator.
- **Pattern Discovery**: peak-day/peak-time summary table plus a real day-of-week heatmap (category × weekday, sequential blue shading — same palette family as every other chart in the app).
- **Risk Scoring**: ranked suspect list linking through to the existing Person detail page.

### A real accessibility bug caught by looking at the actual rendered heatmap, not just the data

The day-of-week heatmap's darkest cells (`#0d366b`, `#1c5cab` — the top of the sequential ramp, used for each row's own maximum value) were rendered with the app's default dark text color, which fails contrast against navy. Not obvious from a props/data check; obvious once actually looking at the rendered table. Fixed by switching to white text specifically on the two darkest ramp steps, verified by re-screenshotting the same heatmap and confirming every cell's number is legible.

## 6. Verified

Full browser pass as Analyst: Trend Prediction tab renders 12 months of history + 3 months forecast with working hover tooltip → High-Risk Areas correctly re-ranks when switching District→Station scope (Mysuru Rural PS surfaced as CRITICAL, 88, driven by +200% growth) → Anomaly Detection lists 20 real spikes sorted by |z-score| → Pattern Discovery's heatmap and peak-day/time summary both populated correctly, contrast bug fixed → Risk Scoring's top suspect (Manjunath Shetty, score 85) matches Milestone 6's repeat-offender leaderboard exactly, confirming the two features are reading consistent underlying data → clicked through to that suspect's Person page and landed correctly. Confirmed as Officer: no "AI Intelligence" nav link, 403 on direct API access. Zero console errors throughout.

## 7. Future Enhancements

- If real (non-synthetic) crime data with genuine seasonality is ever ingested, revisit the trend-prediction method — a seasonal model would then earn its complexity, which it doesn't with this dataset.
- Larger historical windows per area before trusting anomaly z-scores at face value (§4 caveat).
- Explainability UI beyond "the formula is documented" — e.g., a per-score breakdown showing exactly how much each weighted component contributed, not just the final number and the raw inputs.
- If a genuinely Python-only technique becomes necessary later (e.g. a trained classifier that needs scikit-learn), that's the point where the Milestone 1 Python service sketch would actually get built — not before.

---

**Awaiting your review. Next up per the roadmap: Milestone 8 — Reporting.**
