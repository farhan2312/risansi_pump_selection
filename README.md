# Sales Portal — Next.js

The sales portal, migrated from the Vite + React SPA (`../sales-portal`) and the
Python Azure Functions backend (`../azure-functions`) into a single **Next.js 15
(App Router)** application. Frontend and backend now live in one TypeScript
codebase — the React UI is served by Next, and every API endpoint the portal
uses is a Next.js route handler talking to the same Postgres database.

## Stack

| Concern        | Old                              | Now                                          |
| -------------- | -------------------------------- | -------------------------------------------- |
| Framework      | Vite + React 19 SPA              | Next.js 15 App Router (React 19)             |
| Routing        | react-router-dom v7              | App Router file routes + `next/navigation`   |
| Backend        | Python Azure Functions           | Next.js route handlers (`src/app/api/*`)     |
| DB access      | SQLAlchemy + psycopg2            | Drizzle ORM + `pg`                           |
| Auth           | PyJWT + bcrypt                   | `jsonwebtoken` + `bcryptjs` (HS256, same tokens) |
| AI suggestions | `anthropic` (Python)             | `@anthropic-ai/sdk`                          |

The Postgres schema is unchanged — Drizzle maps the existing tables (no
migrations are run against the DB). JWTs stay compatible: same HS256 secret,
same `{sub,email,role,iat,exp}` claims. bcrypt `$2b$` hashes verify across both
stacks, so existing user passwords keep working.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real DB creds + JWT_SECRET
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Var                     | Purpose                                                    |
| ----------------------- | --------------------------------------------------------- |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Postgres connection |
| `DB_SSLMODE`            | `require` (default, Azure) or `disable` (local)           |
| `JWT_SECRET`            | HS256 signing secret (reuse the old one to keep sessions) |
| `ANTHROPIC_API_KEY`     | Optional — enables AI gap-suggestions in the report       |
| `NEXT_PUBLIC_API_BASE_URL` | Optional — defaults to `/api` (same origin)            |

## Project layout

```
src/
  app/                       # App Router
    layout.tsx               # root: <html>, global CSS, ThemeProvider
    page.tsx                 # "/"  -> login
    not-found.tsx            # 404
    (dashboard)/             # auth-guarded route group (sidebar + navbar chrome)
      layout.tsx             # AuthGuard + DashboardLayout
      dashboard/ projects/ pump-selection/ pump-details/
      selection-summary/ admin/access-requests/
    api/                     # route handlers (the former Azure Functions)
      health/ auth/login/ auth/change-password/ access-requests/
      users/ users/[userId]/ recommendations/
      recommendations/[recommendationId]/report/
      projects/ masters/ pump-selections/
  lib/                       # ported backend
    db/schema.ts             # Drizzle tables (was shared/models.py)
    db/index.ts              # lazy pooled connection (was shared/database.py)
    auth.ts                  # JWT (was shared/auth.py)
    recommendation-engine.ts # PCP engine (was shared/recommendation_engine.py)
    ai-suggestions.ts        # (was shared/ai_suggestions.py)
    api.ts / report-types.ts # response serializers + shared types
  screens/                   # page components (rendered by app/ routes)
  components/ layouts/ contexts/ services/ data/ styles/
```

> `screens/` deliberately isn't named `pages/` — Next treats a top-level
> `src/pages` as the legacy Pages Router.

## Routing notes (react-router → App Router)

- `useNavigate()` → `useRouter().push()` / `.back()`.
- `useLocation().state` had no direct equivalent, so cross-page hand-offs became:
  - Projects → Pump Selection: selected project stashed in `sessionStorage`.
  - Recommendation → Selection Summary: `recommendationId` passed as a query param.
- `<NavLink>` → `next/link` + `usePathname()` for the active class.
- `ProtectedRoute` / `AdminRoute` → `components/auth/AuthGuard` (client-side,
  localStorage-based, same as before).

## What was intentionally left out

Testing-portal endpoints (`requisitions`, `reports`, `requisitions/dedup-check`)
were **not** ported here — they belong to the separate testing portal, which
gets its own Next.js migration. Only the sales-portal surface and the master
tables its recommendation engine reads are included.
