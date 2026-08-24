# CLAUDE.md — @learn-workbench/e2e

## Purpose
Playwright regression baseline for key user paths (login/dashboard hydration, roadmap custom topic add/remove, nav dropdown + add-modal centering, focus page). Runs against a live server.

## Surface
- `e2e/playwright.config.ts`, `e2e/global-setup.ts` (login → `storageState`), `e2e/helpers/*`, `e2e/tests/*.spec.ts`.

## Key files
- `playwright.config.ts` (baseURL from `E2E_BASE_URL`; browser via `E2E_BROWSER`), `tests/job-plan.spec.ts`, `tests/skills-gaps.spec.ts`, `global-setup.ts`.

## Dependencies
- `@playwright/test` (^1.62), `@types/node`. Uses system Chrome (`channel: chrome`), no browser download.

## Scripts
- `pnpm test:e2e` (`playwright test`); `test:e2e:headed`; `test:e2e:report`.

## Notes
- Credentials via env (`E2E_ADMIN_USER`/pass), never committed; tests auto-skip when unset. Add specs for new flows; run against local or `http://106.55.2.197`.
