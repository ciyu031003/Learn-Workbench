@AGENTS.md

# CLAUDE.md — apps/web (Next.js 16 App Router)

## Purpose
Primary Web app: dashboard, roadmap, tasks/focus, logs, wellbeing, jobs(招花), career(skills/resume/interview/applications/market), settings. Server shell + client components; API routes direct to PostgreSQL.

## Public surface / routes
`app/*/page.tsx`: `/dashboard /roadmap /tasks /logs /wellbeing /jobs /career(/skills /resume /interview /applications /market) /settings /login`. Guarded by `proxy.ts` (307→/login unauthenticated).

## Key files
- `app/globals.css` — Liquid-Glass tokens, `@theme inline` colors, `.glass` utils, animations.
- `components/app-shell.tsx` — top/mobile nav(5-entry), wellbeing float, toaster.
- `components/ui/*` — shadcn-style primitives (button/card/badge/tabs/modal/input/progress/switch/textarea/empty-state/toaster).
- `components/jobs/*`, `components/skills/*`, `components/market/market-charts.tsx` (SVG chart kit).
- `lib/*` — db/auth/session/http/api/readiness/skills/jobs/market/wellbeing/domains/*.
- `app/api/**/route.ts` — API endpoints (each ships `route.test.ts`).
- `store/*` — zustand stores.

## Entry / wiring
- `app/layout.tsx` → `AppShell` + `DailyBackground`. Next 16 (Turbopack), Tailwind v4, React 19, Radix+cva, lucide-react, zustand.
- API auth: Cookie/Bearer (`lib/session.ts`); PG via `lib/db.ts` (`pgPool`).

## Dependencies
`next 16.3`, `react 19.2`, `@learn-workbench/{shared,content,ui,config}`, `pg`, `pino`, `zod`, `zustand`, `lucide-react`, Radix, cva, tailwind-merge, playwright-core.

## Scripts
`pnpm -F web dev|build|start|lint|typecheck|test`.

## Testing
- Vitest for lib + route handlers; `pnpm -F web test`. Migrations appended in `db/migrations/*`.

## Notes
- Hydration: gate `new Date()` reads behind `mounted` (React #418). No external font CDN. Reduced-motion respected.
