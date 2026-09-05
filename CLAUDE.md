# CLAUDE.md — Learn-Workbench

> **新会话先读** [`docs/改动记录与任务看板.md`](docs/改动记录与任务看板.md)——近期改动明细、待办任务看板、踩坑点清单（部署链路/CRLF/迁移/图标管线等全在里面），持续更新。

## Project-wide rules
- Monorepo: pnpm workspace + Turborepo. Commands run from repo root: `pnpm -F web dev` (web), `pnpm mobile` (Expo).
- Never edit compiled output (`.next`, `dist`, `/build`). Never commit `.env`, `deploy-credentials.txt`, `config/job-hosts/storageState.json`.
- Every `app/api/**/route.ts` ships a sibling `route.test.ts`. Run `pnpm -F web test` before touching routes.
- Database: PostgreSQL (`scripts/start_pg.ps1` → `127.0.0.1:5432`, db `Learn-Workbench`, user `lwb`). Schema in `db/schema.sql`; `db/migrations/` are incremental, appended not modified.
- Data isolation: every business query filters by `user_id` (or `anon_id` when anonymous).
- Auth: Cookie/Bearer session in `apps/web/lib/session.ts`; router guard in `apps/web/proxy.ts` (`/dashboard /roadmap /tasks /logs /settings` → 307 to `/login`).

## Workspace layout
`apps/web` (Next.js 16 App Router, primary) · `apps/mobile` (Expo/RN) · `packages/shared`(zod types+tools) · `packages/content`(content data) · `packages/ui`(tokens) · `packages/config`(config) · `e2e`(Playwright) · `db` · `scripts` · `docs` · `deploy`.

## Member docs (prefer these first)
- [apps/web/CLAUDE.md](apps/web/CLAUDE.md) — Web app (routes, components, UI kit, APIs)
- [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md) — Expo mobile
- [packages/shared/CLAUDE.md](packages/shared/CLAUDE.md) — shared zod types + tools
- [packages/content/CLAUDE.md](packages/content/CLAUDE.md) — route content data
- [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md) — cross-end design tokens
- [packages/config/CLAUDE.md](packages/config/CLAUDE.md) — config constants (readiness weights)
- [e2e/CLAUDE.md](e2e/CLAUDE.md) — Playwright regression

## Global build/test/verification
- `pnpm -F web typecheck` / `pnpm -F web lint` / `pnpm -F web test` (Vitest)
- `pnpm -F web build` (Next 16 + Turbopack; `pnpm -r test` runs all workspaces)
- `pnpm test:e2e` — Playwright against a running server (`E2E_BASE_URL`, credentials via env)
- Deploy: `bash deploy-docker.sh` (Docker compose db+init+web) or `bash deploy.sh` (PM2); prod at `106.55.2.197`, domain `https://learn.yuanabd.cn`.
