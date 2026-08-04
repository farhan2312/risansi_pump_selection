---
name: pump-selection-app
description: Project context for the Risansi PCP Pump Selection Portal — architecture, DB schema, wizard flow, and conventions. Load this at the start of any session working in this repo, or whenever you need to recall how the app fits together (schema shape, which tables are live vs. unbuilt, the wizard's step order, established patterns) before making a change.
---

# Risansi PCP Pump Selection Portal — project memory

Read this whole file before making changes. It is the durable memory of this
project across sessions — update it (not just your own scratch notes) whenever
you add a table, a wizard step, or change an established convention.

## What this app is

A Next.js 15 (App Router) sales-engineering tool for Risansi Industries: given
a duty point (capacity + head) and fluid/media properties, it screens
`pump_model_master` for every Progressive Cavity Pump (PCP) model that can
satisfy it, then walks a sales engineer through a multi-step wizard to
configure sealing, MOC (material of construction), motor rating, and drive
selection for a chosen model — producing a full spec sheet per project.

It is a from-scratch Next.js port of an older Azure Functions app
(`azure-functions/shared/*.py` — referenced in code comments as the origin of
several formulas/models, e.g. `recommendation_engine.py`). Only the
`pump_family='PCP'` path is in scope; ROTA pumps are out of scope.

## Tech stack

- **Next.js 15 App Router**, React 19, TypeScript
- **Drizzle ORM** (`drizzle-orm/node-postgres`) over **Azure Postgres**
- No migration tool — `src/lib/db/schema.ts` is a hand-maintained mirror of
  the live DB; schema changes are applied directly via one-off Node scripts
  (see "How schema changes are made" below), not `drizzle-kit push`.
- Auth: JWT in an httpOnly cookie (`src/lib/auth.ts`), verified in
  `middleware.ts` for **pages** only. **`/api/*` routes are NOT covered by the
  page middleware** — every API route that needs auth must call
  `requireAdmin(req)` / `decodeToken(req)` itself.
- Styling: Tailwind utility classes for the wizard (`formStyles.ts` shared
  constants) + plain CSS modules for other pages (design system: flat panels,
  hairline borders, no shadows — see `--bg-paper`/`--line`/`--fg` CSS vars).

## Directory map

```
src/lib/db/schema.ts        Drizzle table definitions (source of truth for DB shape)
src/lib/db/index.ts         Lazy pool + Drizzle instance (Proxy-wrapped so `next build` doesn't need DB creds)
src/lib/recommendation-engine.ts   Core engine: findCandidates, computeMotorRating, computeVBeltDrive
src/lib/auth.ts             JWT create/verify/requireAdmin
src/lib/api.ts              json()/error() response helpers, toFloat, snake_case dict serializers
src/app/api/**/route.ts     API route handlers (Next.js route handlers, not Azure Functions anymore)
src/services/*Service.ts    Client-side fetch wrappers (axios via apiClient.ts, baseURL "/api")
src/components/pump-selection/*Step.tsx   The 8-step wizard's per-step components
src/screens/**              Page-level components (imported by src/app/**/page.tsx via `export { default } from ...`)
src/data/Recommendations.ts Shared TS types: PumpSelectionFormData (wizard state), PumpRecommendation (engine output)
middleware.ts               Page-level auth gate (NOT applied to /api/*)
```

Route files under `src/app/**/page.tsx` are almost always one-liners:
`export { default } from "@/screens/.../XPage";` — the real component lives in
`src/screens/`.

## Database — live tables (as of this writing)

Everything else in `schema.ts` below `pblGearbox`/`ptlGearbox`/`topGearGearbox`
is **commented out** (`/* ... */`) — unbuilt master tables from the old Python
app, kept as a reference for what *might* get built later. Check the file
directly before assuming a table exists; this list can drift.

| Table | Purpose |
|---|---|
| `users_pump` (exported as `users`) | Forked from a shared `users` table (owned by a separate testing-portal project — **never touch the original `users` table**). Seeded once; no ongoing sync. |
| `projects` | One row per sales project. `project_code` auto-numbered `PRJ-NNN`. |
| `pump_selection_input` | Autosaved wizard state for **steps 1-4 only** (General/Fluid/Operating/Sealing), one row per project (`project_id` UNIQUE, cascade-delete). Restores the form after a page refresh. Steps 5-8 (MOC/Motor Rating/Drive/Recommendation) are re-derived live, not persisted. |
| `pump_model_master` | The core catalog: one row per **(model, head)** point (540+ rows / ~55 models incl. 2H\*/4H\*/L-variants/Barrel\*). Columns include `stage` (1/2/4/8, derived from model name), `hard_solid_mm`/`soft_solid_mm`, `size_visc_*_in` (5 columns, per-viscosity-band suction/discharge pipe size). |
| `moc_recommendation` | Curated media→MOC/elastomer/seal-type reference (200 rows: 190 Non-Sugar + 10 Sugar). Also the source of the General Info step's Media dropdown. Has a derived `seal_type` (MS/GD) column — NOT sourced from any PDF, it's a rule applied over corrosive/hazard/temp columns (see schema.ts comment for the exact rule + citations). |
| `moc_nomenclature` | Decomposes a 4-letter MOC code (e.g. `"AAAN"`, `"BBBE"`) into per-component material (Pump Housing, Shaft, Rotor, ... 11 parts) + stator rubber. 30 rows = 6 metal-prefixes × 5 rubber-suffixes. |
| `pulley_motor_option` + `pulley_belt_option` | V-belt drive master, mirroring the source sheet's own nested structure: a parent "motor option" (model × motor RPM × HP/KW tier, with belt-groove code) with child belt-ratio rows (target RPM → pump/motor pulley sizes, achieved RPM, V-belt number). Cascade-delete FK. |
| `pbl_gearbox`, `ptl_gearbox`, `top_gear_gearbox` | Three independent gearbox-selection masters (from one source sheet with 3 side-by-side blocks sharing a merged Power Rating per row-group). Each has `power_rating_raw`/`power_rating_kw`, `output_rpm`, `model`, `gear_box_type`, `service_factor`, `rate_per_nos`. |

### How schema changes are made (important — this is NOT the standard Drizzle flow)

This project does not use `drizzle-kit push`/migrations. The pattern, followed
consistently across every schema change so far:

1. Write a one-off Node script (kept in the session's scratchpad directory,
   NOT committed to the repo) that: opens a `pg` client using the same
   `.env.local` DB_* vars, runs `BEGIN`, does `ALTER TABLE .../CREATE TABLE
   ...`, does the data migration/backfill, runs verification queries
   (row counts, spot-checks against known source values, consistency checks),
   and only `COMMIT`s if every check passes — otherwise `ROLLBACK`.
2. Mirror the resulting live-DB shape into `src/lib/db/schema.ts` by hand
   (Drizzle camelCase field ↔ snake_case column).
3. Run `npm run typecheck` then an **isolated** `rm -rf .next && npm run
   build` (never concurrently with a running dev/start server — corrupts
   `.next` and produces misleading "Cannot find module" errors).
4. If the task allows live testing, start the built server (`npm run start`,
   after checking port 3000 isn't already held by a stale process from an
   earlier session) and `curl` the new/changed endpoints directly.

`.env.local` uses `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`/
`DB_SSLMODE` (not a single `DATABASE_URL`) — a scratch script needs its own
tiny `.env.local` parser (see any prior migration script for the pattern) or
to import `src/lib/db/index.ts`'s connection logic if run inside the Next
process. Azure Postgres requires SSL with `rejectUnauthorized: false` (self-
signed-looking chain).

**Data-mirroring discipline learned the hard way**: when a spreadsheet is the
source of truth for a table, match its headers/rows exactly — don't aggregate
or normalize without asking. Excel merged cells must be forward-filled onto
every row they visually span (check `ws['!merges']`), not just their anchor
row. Placeholder cells like `"-"` mean "no data here", not zero — skip that
row/column for that record rather than inserting a null-ish garbage row.
Slash-separated alternatives in a source cell (`"CI / MS"`) are meaningful
engineering options — preserve them, don't split them into separate columns.

## The wizard (`src/screens/pump-selection/PumpSelectionPage.tsx`)

8 steps, all sharing one `formData` object (typed as `PumpSelectionFormData`
in `src/data/Recommendations.ts`):

1. **General Information** — capacity, head, media (dropdown from
   `moc_recommendation`), temperature (+ unit, canonical °C stored
   separately), SG, pH, RPM range filter.
2. **Fluid Properties** — viscosity (+ unit, canonical cP stored separately),
   viscosity range (5 buckets: `0-1000`/`1000-3000`/`3000-5000`/
   `5000-10000`/`>10000` cP — mirrors `Model_vs_Viscosity_vs_Size.xlsx`,
   upper-inclusive boundaries), solid % + solid size (manual entry, filtered
   `>=` against the model's `hard_solid_mm`/`soft_solid_mm`) + solid type.
3. **Operating Conditions** — Pump Type, which cascades the valid AG/BK and
   Suction Housing options (Horizontal Standard → no AG/BK, standard housing
   only; Vertical → AG only, vertical housing only; Horizontal Bucket with
   Auger → AG&BK, all housings; Horizontal Auger Only → AG only, standard
   housing).
4. **Sealing Details** — Mechanical Seal / Gland Packing (+ MSA/SCG/DCG/MSK
   subtype for Mechanical Seal). Shows a **recommendation hint** (not
   auto-forced) looked up from `moc_recommendation.seal_type` for the chosen
   media, and defaults the select from it once if unset.
5. **MOC & Elastomer** — auto-looks-up `moc_recommendation` by exact
   media match, shows Recommended/Min-Acceptable MOC + Elastomer + reference
   pH/temp (flags if entered pH/temp are outside that reference row's range).
   Also has a **manual final-MOC selector**: two dropdowns (3-letter MOC
   prefix: AAA/AAB/ABB/BBB/CCC/XXX; 1-letter rubber suffix: N/E/V/F/X),
   defaulted from the recommendation, combined live into `mocFinalCode`
   (e.g. `"BBBE"`). When complete, fetches `moc_nomenclature` and shows the
   full per-component material breakdown.
6. **Motor Rating (KW)** — `computeMotorRating()`: BKW = Capacity×Head/367/
   (ME/100), Motor KW = BKW×1.2, recommendation = nearest pulley-table KW ≥
   Motor KW (flagged if it exceeds the model's "min KW so far tested" cap,
   but still shown). Final KW is a manual pick from the pulley-table dropdown
   (falls back to free-text entry if the model has no pulley data).
7. **Drive Details** — Drive System Type (Direct Drive / V-Belt Drive /
   "Geared Motor Drive/Gear Box + Motor"). Motor RPM field only appears after
   a drive type is chosen; fixed at 1440 (read-only) for the Geared option,
   selectable 960/1440 otherwise. When V-Belt is chosen + Motor RPM + Motor
   KW (from step 6) are known, `computeVBeltDrive()` recommends a belt/pulley
   set from `pulley_motor_option`/`pulley_belt_option`, picking the belt
   whose achieved pump speed falls inside the model's required RPM window
   (derived from its VE band), or the nearest one flagged as "next best" if
   none land exactly inside. A separate "Drive System Inputs" block (Motor
   Speed/Make/Mounting/Type/Starter Type/Power Supply/Std-NonStd) shows for
   V-Belt.
8. **Recommendation** (read-only summary) — re-fetches `findCandidates()` for
   the confirmed model, shows `PumpDetailsCard` (Model, Stage, Pump Type,
   AG/BK, RPM range, Head, VOLE, Mech Eff, per-model Suction/Discharge Size
   looked up from `pump_model_master.size_visc_*` for the chosen viscosity
   range, Sealing Type, MOC code, Testing Status) plus every other configured
   field.

**Model confirm/lock gate**: a pump model must be picked in the live
recommendation panel (bottom of every step 1-7 page) and explicitly confirmed
before the wizard allows navigating past step 2 (`formData.modelConfirmed`).
"Change model" re-opens the picker without losing the confirmation flag.

**Autosave**: steps 1-4's fields debounce-save (800ms) to
`pump_selection_input` keyed by the open project's id, and are restored on
page load — this is why that table only covers steps 1-4, not the whole wizard.

## The recommendation engine (`src/lib/recommendation-engine.ts`)

- `findCandidates(db, capacityM3hr, headMwc, solidSizeMm?, solidType?)` — the
  Step-3 model screening. Returns **every** model that satisfies the duty
  point, no ranking/cutoff (selection is manual, per spec). Key rules:
  - RPM formula: `RPM = 100 × Capacity / (QTH × VE)`, computed at both
    VOLE_MIN and VOLE_MAX (two output RPMs).
  - **Stage-tier gate**: a model's `stage` column must match
    `headMwc <= 60 ? 1 : headMwc <= 120 ? 2 : headMwc <= 240 ? 4 : 8` — hard
    catalog limit, not a preference.
  - Solid filter (when both size+type given): model's
    `hard_solid_mm`/`soft_solid_mm` must be `>=` the entered size (not exact
    match — the rating is the largest particle the model can pass).
- `computeMotorRating(db, model, capacityM3hr, headMwc)` — see step 6 above.
- `computeVBeltDrive(db, model, capacityM3hr, headMwc, motorRpm, motorKw)` —
  see step 7 above.
- Unit conversions (`toM3PerHr`, `toMwc`, `toCp`) live here (server-only,
  imports `./db`) **and are duplicated** in `src/utils/units.ts` (client-safe,
  no DB import) for use inside `"use client"` components — keep both in sync
  if you change a formula; this drifted once already (MWC/MLC multiply vs.
  divide) and caused a real bug.

## Established conventions (read before writing new code)

- **API routes return the raw Drizzle row** (camelCase) via `json(row)` for
  most new tables — no snake_case conversion needed unless the frontend
  service type expects otherwise. Only `projects`/`users` use the older
  `projectToDict()`/`userToDict()` snake_case serializers (legacy, ported from
  the Python app's `_row_to_dict` convention).
- **Every `/api/*` route that touches admin-only data self-gates** with
  `requireAdmin(req)` (or `decodeToken(req)` if just "any logged-in user" is
  enough) — the page middleware does not cover `/api/*`.
- **Numeric Postgres columns come back as strings** via `pg`/Drizzle;
  `integer` columns come back as real numbers. Don't conflate the two parsing
  helpers (`numOrNull` vs `intOrNull` in the PATCH routes).
- **Multi-row inserts under one logical parent use `db.transaction()`**
  (see `pulley-motor-option` POST/PATCH for the belts-array replace-all
  pattern) — never insert a parent and its children as separate unguarded
  calls.
- When a shared column-definition object would be reused across multiple
  `pgTable()` calls (e.g. the 3 gearbox tables), use a **factory function**
  (`() => ({...})`) — Drizzle column builders are stateful per-table, and
  reusing the same object literal across 3 `pgTable()` calls silently
  misbehaves.
- **Never push to GitHub** — the user pushes manually.
- **Confirm genuine judgment calls before writing to the DB or making a
  design choice with more than one reasonable interpretation** — this project
  has a strong established pattern (many `AskUserQuestion` calls throughout
  its history) of proposing 2-3 options with a recommendation rather than
  silently picking one, especially for: derived/inferred data not literally
  in a source file, ambiguous terminology, and anything affecting real
  engineering recommendations shown to a sales engineer.
- When asked to skip testing ("do not do testing" / similar), still run
  `npm run typecheck` and an isolated `npm run build` — those aren't "testing"
  in the sense meant, they're basic correctness gates. Skip live `curl`/browser
  verification only.
- The browser-based Claude preview tools can't get past this app's login
  screen without real credentials — don't attempt to bypass auth to verify UI
  changes; verify via typecheck/build/curl instead and say so.

## Where to look for more detail

- `src/lib/db/schema.ts` — always the ground truth for current DB shape;
  read it directly rather than trusting this file if something seems off.
- Inline comments throughout the codebase are unusually thorough and explain
  *why*, not just what — read them before assuming behavior.
