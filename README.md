# elecbits-hr-frontend

Frontend for the Elecbits HRMS. **React 19 · Vite 7 · TypeScript · React Router 7 ·
TanStack Query · Zustand · Tailwind v4 · Axios.** No Supabase — the app talks only to
`elecbits-hr-backend` over its versioned REST API with a local-JWT session.

**Docs** live in the backend repo: `docs/technical-reference.md` (incl. §1.6 consoles,
navigation and the route-guard / sidebar de-drift rule) and `docs/database-schema.md`.

## Getting started

```bash
npm install
copy .env.example .env     # Windows; on macOS/Linux use cp. VITE_API_URL points at the backend (default :4000)
npm run dev                # http://localhost:5173
```

## Layout

```
src/
├── App.tsx / main.tsx     # shell (router → boundary → providers → routes) / mount only
├── providers/             # AppProviders (React Query), ProtectedRoute guard
├── routes/                # the whole route table in one file + RouteScreen wrapper
├── layouts/               # one thin layout per console over the shared PortalShell
│   ├── Employee/          #   / — everyone: home, profile, my team, my assets, resignation
│   ├── Hr/                #   /hr — HRBP + TA + PR + OPS: people, org, exits, hiring, payroll, assets…
│   └── Admin/             #   /admin — batches, grant requests, audit log
├── pages/                 # one folder per screen, grouped by section (Common, Employee, Hrbp, Ta, Pr, Ops, Admin)
├── components/            # Common/ shared UI (PortalShell, PlaceholderScreen, error boundary)
├── services/              # auth.service + api/ per backend feature (axios)
├── store/                 # zustand: the session only — server state lives in React Query
├── constants/             # routes, titles, app sections
├── hooks/ · types/ · utils/
```

The four HR portals (HRBP/TA/PR/OPS, design doc §1) are **overlapping capabilities of one
signed-in employee**, not separate apps — so this is one SPA with a single HR console
(`/hr`) enclosing all four sections, unlocked by the batches `GET /me` returns. HRBP, PR and OPS screens are built; TA (hiring) is still a `PlaceholderScreen`.
