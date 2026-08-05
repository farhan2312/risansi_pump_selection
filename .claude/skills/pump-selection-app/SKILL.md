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
  Green "positive" tokens (`--pos`/`--pos-soft`/`--pos-strong`, Tailwind
  `bg-pos`/`text-pos`/`border-pos` + arbitrary-value `bg-[var(--pos-soft)]`
  for the soft/strong shades) are the established way to badge something as a
  confirmed/AI-suggested value — used for the AI-recommendation cells on the
  MOC step.
- **AI integration**: Google **Gemini** (`GEMINI_API_KEY` in `.env.local`),
  called via plain `fetch` against the REST API — no SDK dependency. Use
  model **`gemini-flash-latest`**, not `gemini-2.0-flash` — the latter 429s
  with `RESOURCE_EXHAUSTED (limit: 0)` on at least this project's free-tier
  key (verified by hitting the API directly). `gemini-flash-latest` is a
  "thinking" model that spends tokens on internal reasoning before the visible
  answer (shows up as `thoughtsTokenCount`) — give `maxOutputTokens` real
  headroom (2048, not 1024) or responses truncate with `finishReason:
  MAX_TOKENS` and no usable output. Use `generationConfig.responseSchema`
  (with `enum` on constrained fields) for structured JSON output rather than
  parsing free text. See `src/lib/moc-ai-suggestion.ts` for the working
  pattern. There is also an older, separate, currently-unwired
  `src/lib/ai-suggestions.ts` that uses `@anthropic-ai/sdk` — that one was
  ported from the Python app for a not-yet-built report feature; don't
  confuse the two or assume `ANTHROPIC_API_KEY` is what powers the MOC AI
  button (it doesn't — that's Gemini).

## Directory map

```
src/lib/db/schema.ts        Drizzle table definitions (source of truth for DB shape)
src/lib/db/index.ts         Lazy pool + Drizzle instance (Proxy-wrapped so `next build` doesn't need DB creds)
src/lib/recommendation-engine.ts   Core engine: findCandidates, computeMotorRating, computeVBeltDrive, findGearboxOptions
src/lib/moc-ai-suggestion.ts       Gemini-backed per-component MOC/elastomer/sealing suggestion (advisory only)
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

Admin-only master-data pages live under `/admin/*` (page-level gate via
middleware's role check) and mirror the same Details/Edit/Add/Delete modal
pattern: `src/screens/pump-model-master/PumpModelMasterPage.tsx` and
`src/screens/pulley-master/PulleyMasterPage.tsx` (the latter's Details modal
also lists/edits the belt-option children inline). Both reuse
`PumpModelMasterPage.css`'s `pmm-*` classes.

## Database — live tables (as of this writing)

Everything else in `schema.ts` below `motorRating` is **commented out**
(`/* ... */`) — unbuilt master tables from the old Python app, kept as a
reference for what *might* get built later. Check the file directly before
assuming a table exists; this list can drift.

| Table | Purpose |
|---|---|
| `users_pump` (exported as `users`) | Forked from a shared `users` table (owned by a separate testing-portal project — **never touch the original `users` table**). Seeded once; no ongoing sync. |
| `projects` | One row per sales project. `project_code` auto-numbered `PRJ-NNN`. Full CRUD: `GET/POST /api/projects`, `PATCH/DELETE /api/projects/[id]` (any authenticated user, no ownership check — small internal tool). |
| `pump_selection_input` | Autosaved wizard state for **steps 1-4 only** (General/Fluid/Operating/Sealing), one row per project (`project_id` UNIQUE, cascade-delete on project delete). Restores the form after a page refresh. Steps 5-8 (MOC/Motor Rating/Drive/Recommendation) are re-derived live, not persisted. |
| `pump_model_master` | The core catalog: one row per **(model, head)** point (540+ rows / ~55 models incl. 2H\*/4H\*/L-variants/Barrel\*). Columns include `stage` (1/2/4/8, derived from model name), `hard_solid_mm`/`soft_solid_mm`, `size_visc_*_in` (5 columns, per-viscosity-band suction/discharge pipe size — 2H\*/4H\* auto-inherit their bare-H\* base's values, L-variants deliberately left NULL, per an explicit user rule). |
| `moc_recommendation` | Curated media→MOC/elastomer/seal-type reference (200 rows: 190 Non-Sugar + 10 Sugar). Also the source of the General Info step's Media dropdown. Has a derived `seal_type` (MS/GD) column — NOT sourced from any PDF, it's a rule applied over corrosive/hazard/temp columns (see schema.ts comment for the exact rule + citations). |
| `moc_nomenclature` | Decomposes a 4-letter MOC code (e.g. `"AAAN"`, `"BBBE"`) into per-component material (Pump Housing, Shaft, Rotor, ... 11 parts) + stator rubber. 30 rows = 6 metal-prefixes × 5 rubber-suffixes. **Currently unused by the wizard UI** (the MOC step's manual-code selector and nomenclature-breakdown panel were removed — see wizard step 5 below) — the table and its API/service (`moc-nomenclature` route, `mocNomenclatureService.ts`) still exist, just nothing calls them right now. |
| `pulley_motor_option` + `pulley_belt_option` | V-belt drive master, mirroring the source sheet's own nested structure: a parent "motor option" (model × motor RPM × HP/KW tier, with belt-groove code) with child belt-ratio rows (target RPM → pump/motor pulley sizes, achieved RPM, V-belt number). Cascade-delete FK. Admin CRUD at `/admin/pulley-master`, including inline belt-child add/edit via a `belts` array on the POST/PATCH body (replace-all-children semantics on PATCH). |
| `pbl_gearbox`, `ptl_gearbox`, `top_gear_gearbox` | Three independent gearbox-selection masters (from one source sheet with 3 side-by-side blocks sharing a merged Power Rating per row-group). Each has `power_rating_raw`/`power_rating_kw`, `output_rpm`, `model`, `gear_box_type` (PBL/PTL are always `"IN LINE HELICAL"`, Top Gear is always `"PLANTERY"` — i.e. GB Type effectively selects which table applies), `service_factor`, `rate_per_nos`. |
| `motor_rating` | Standard KW↔HP reference (25 rows, `kw` UNIQUE, from `MOTOR RATING.xlsx`). This is now the source for the Motor Rating step's KW dropdown (see step 6 below) — not model-specific pulley data, so every model gets full coverage. |

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
   `.next` and produces misleading "Cannot find module" errors; a stray
   flaky "Cannot find module for page: ..." on an unrelated route right after
   a build has also shown up as pure `.next`-cache flake — just retry a full
   `rm -rf .next && npm run build` before assuming it's a real regression).
4. If the task allows live testing, start the built server (`npm run start`,
   after checking port 3000 isn't already held by a stale process from an
   earlier session — `netstat -ano | grep :3000` then kill it) and `curl` the
   new/changed endpoints directly.

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
When a variant model (2H\*/4H\*) isn't explicitly in a source sheet, check
whether the user wants it auto-inherited from its bare-H\* base before
leaving it NULL — this has gone both ways depending on the attribute (pulley
data: yes, inherit; viscosity-size L-variants: explicitly no, per user rule).

## The wizard (`src/screens/pump-selection/PumpSelectionPage.tsx`)

8 steps, all sharing one `formData` object (typed as `PumpSelectionFormData`
in `src/data/Recommendations.ts`):

1. **General Information** — capacity, head, media (dropdown from
   `moc_recommendation`), temperature (+ unit, canonical °C stored
   separately), SG, pH, RPM range filter.
2. **Fluid Properties** — viscosity (+ unit, canonical cP stored separately),
   viscosity range (5 buckets: `0-1000`/`1000-3000`/`3000-5000`/
   `5000-10000`/`>10000` cP — mirrors `Model_vs_Viscosity_vs_Size.xlsx`,
   upper-inclusive boundaries), solid % + solid size (manual number entry,
   filtered `>=` against the model's `hard_solid_mm`/`soft_solid_mm` — NOT a
   dropdown; that was tried and explicitly reverted) + solid type.
3. **Operating Conditions** — Pump Type, which cascades the valid AG/BK and
   Suction Housing options (Horizontal Standard → no AG/BK, standard housing
   only; Vertical → AG only, vertical housing only; Horizontal Bucket with
   Auger → AG&BK, all housings; Horizontal Auger Only → AG only, standard
   housing).
4. **Sealing Details** — Mechanical Seal / Gland Packing (+ MSA/SCG/DCG/MSK
   subtype for Mechanical Seal). Shows a **recommendation hint** (not
   auto-forced) looked up from `moc_recommendation.seal_type` for the chosen
   media, and defaults the select from it once if unset.
5. **MOC & Elastomer** — the curated `moc_recommendation` lookup still runs
   in the background (gates "not-found" vs "ready", silently seeds
   `mocCode`/`mocRubberCode`/`mocFinalCode` once) but **its result is no
   longer displayed** — the old "Recommended MOC / Min. Acceptable / Elastomer
   / reference pH-temp" panel, the manual MOC-prefix + rubber-suffix code
   selector, and the `moc_nomenclature` breakdown panel were all removed at
   the user's request. What's shown instead is the **AI Recommendation**
   panel (Gemini-backed, see below) — this is now the step's primary UI.
6. **Motor Rating (KW)** — `computeMotorRating()`: BKW = Capacity×Head/367/
   (ME/100), Motor KW = BKW×1.2. The KW dropdown (`kwOptions`) is sourced from
   the **`motor_rating`** table (not model-specific pulley data anymore),
   filtered to every standard KW **strictly above Motor KW** (not raw BKW —
   this was corrected once; every option offered already carries the 1.2×
   safety margin). Recommendation = nearest of those (i.e. `kwOptions[0]`),
   flagged if it exceeds the model's "min KW so far tested" cap but still
   shown. Because `motor_rating` is model-agnostic, every model now gets a
   real dropdown (previously some models with no pulley data fell back to
   free-text entry).
7. **Drive Details** — Drive System Type: Direct Drive / V-Belt Drive /
   **"Geared Motor Drive/Gear Box + Motor"** (renamed from "Geared Motor
   Drive"). Motor RPM field only appears after a drive type is chosen; fixed
   at 1440 (read-only) for the Geared option, selectable 960/1440 otherwise.
   - **V-Belt**: once Motor RPM + Motor KW (step 6) are known,
     `computeVBeltDrive()` returns **every** belt option whose achieved pump
     speed falls inside the model's required RPM window (VE-band derived) as
     clickable candidate cards — not a single auto-pick. If none land inside
     the window, the single nearest one is returned as a flagged "next best"
     fallback. Selection is manual (click a card); nothing is auto-filled
     into formData on fetch anymore. A "Drive System Inputs" block (Motor
     Speed/Make/Mounting/Type/Starter Type/Power Supply) also shows.
   - **Geared Motor Drive/Gear Box + Motor**: a **Configuration** dropdown
     ("Gear Box + Motor" vs "Geared Motor") cascades Mounting and Coupling:
     Gear Box + Motor → Mounting fixed to Foot Mount (B3, read-only), Coupling
     fixed to "2 Drive + Driven Coupling"; Geared Motor → Mounting is a real
     2-option dropdown (Flange Mount B5 / Foot cum Flange B35), Coupling
     fixed to "1 Drive + Driven Coupling". Also: **GB Type** dropdown (IN
     LINE HELICAL / PLANTERY — matches `gear_box_type` values in the gearbox
     tables), the existing Gear Box Shaft Type (HISO/SISO, unrelated
     concept), ASF Range, and a **Gearbox Recommendation** panel:
     `findGearboxOptions()` screens `pbl_gearbox`/`ptl_gearbox`/
     `top_gear_gearbox` by the pump's required RPM window **widened ±20%**
     (catalog gearboxes only offer discrete RPMs, so a hard window excludes
     everything) and an **exact match** on Motor KW; ASF Range and GB Type
     (if set) narrow the already-screened result further rather than gating
     the initial screen. Every match across all 3 tables is shown as a
     clickable card grouped by source table; manual pick only.
8. **Recommendation** (read-only summary) — re-fetches `findCandidates()` for
   the confirmed model, shows `PumpDetailsCard` (Model, Stage, Pump Type,
   AG/BK, RPM range, Head, VOLE, Mech Eff, per-model Suction/Discharge Size
   looked up from `pump_model_master.size_visc_*` for the chosen viscosity
   range, Sealing Type, MOC code, Testing Status) plus every other configured
   field, including the V-Belt/Gearbox picks and the per-component MOC AI
   selections (see below) with their remarks folded into each summary line.

**Model confirm/lock gate**: a pump model must be picked in the live
recommendation panel (bottom of every step 1-7 page) and explicitly confirmed
before the wizard allows navigating past step 2 (`formData.modelConfirmed`).
"Change model" re-opens the picker without losing the confirmation flag. The
live panel's pinned card shows Stage, RPM, VOLE, Mech Eff, per-model Size, and
a spec-chain line (`Pump Type · AG/BK · Seal · MOC`).

**Autosave**: steps 1-4's fields debounce-save (800ms) to
`pump_selection_input` keyed by the open project's id, and are restored on
page load — this is why that table only covers steps 1-4, not the whole wizard.

### MOC AI Recommendation panel (step 5) — the current primary MOC UI

`src/lib/moc-ai-suggestion.ts` + `POST /api/moc-recommendation/ai-suggest` +
`getMocAiSuggestion()` in `mocRecommendationService.ts`. Advisory only, never
throws (unset key / blocked response / request failure → `null` →
`204 No Content` → UI shows "unavailable"), opt-in via a button click (not
auto-fetched). The prompt is scoped to only the process data this wizard
actually collects (media, pH, temperature, viscosity, SG, flow rate, solids
%, particle size) — it explicitly tells the model which other attributes
(chemical composition, differential pressure, abrasiveness/corrosiveness
ratings, required speed, duty cycle, industry standard) aren't collected yet
rather than silently omitting them.

UI layout (top to bottom), per explicit user design direction:
1. Button — while loading, cycles through `AI_LOADING_MESSAGES` (rotating
   status text) every 1.4s rather than a static "Loading…".
2. **Summary** box (the AI's `rationale`) — always at the top once fetched.
3. **Recommended Sealing** box — kept separate from Summary.
4. Three **always-visible** tables (Non-Wettable Components: Bearing
   Housing/Bearing Plate/Tie Rod/Nut & Bolt; Wettable Casting Components:
   Pump Housing/Rotor/Shaft; Elastomer: Stator Rubber Parts) — each row has
   Component | AI Recommendation (green-boxed via `--pos`/`--pos-soft`/
   `--pos-strong` tokens once fetched, `—` before that) | Manual dropdown
   (`MOC_AI_MATERIALS`: Cast Iron/Mild Steel/SS304/SS316/SS316L/SDSS 2507/
   DSS 2505/Hastelloy/Ni-Hard CI/SS410, or `MOC_AI_ELASTOMERS`: Nitrile/FG
   Nitrile/White Nitrile/Natural/Hypalon/EPDM/Viton for the elastomer row) |
   Open Remarks (free text). The tables render regardless of AI-fetch status
   (once a media is entered) — only the AI column is gated on having a
   response. Manual dropdown + remarks are independent `formData` fields per
   row (`mocAi<Component>` / `mocAi<Component>Remarks`), never auto-filled
   from the AI suggestion.

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
- `computePumpRpmWindow(db, model, headMwc, capacityM3hr)` — private helper,
  factored out of `computeVBeltDrive` and reused by `findGearboxOptions`; the
  VE-band-derived `{rpmLo, rpmHi}` window shared by every drive-selection
  calculation.
- `computeVBeltDrive(db, model, capacityM3hr, headMwc, motorRpm, motorKw)` —
  see step 7 above. Returns `candidates: VBeltOption[]` (every in-range
  match, or a single next-best fallback), not a single `recommended` pick —
  changed from an earlier single-pick design at the user's request.
- `findGearboxOptions(db, model, capacityM3hr, headMwc, motorKw, asfRange?,
  gbConstructionType?)` — see step 7 above (±20%-padded RPM window + exact
  Motor KW match, ASF/GB Type as post-filters).
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
- **Advisory AI suggestions are never auto-applied** — always a separate
  "AI Recommendation" affordance next to (not replacing) the real manual
  input, clearly badged, opt-in via a button click, and explicitly disclaimed
  as "not a verified specification". This is a firm, repeated user
  preference, not a one-off choice.
- **Gemini quirks to remember**: use `gemini-flash-latest`, give
  `maxOutputTokens` generous headroom (thinking-token overhead), use
  `responseSchema` with `enum` for constrained fields instead of prompting
  for exact strings and hoping.
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
- This user iterates fast and often corrects direction mid-feature (e.g. "not
  BKW, Motor KW", "remove the panel I just asked for", "all candidates not
  just one") — treat your own just-built UI as provisional until they've seen
  it, and be ready to cleanly remove/replace it rather than layering patches.

## Where to look for more detail

- `src/lib/db/schema.ts` — always the ground truth for current DB shape;
  read it directly rather than trusting this file if something seems off.
- Inline comments throughout the codebase are unusually thorough and explain
  *why*, not just what — read them before assuming behavior.
