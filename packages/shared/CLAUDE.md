# CLAUDE.md — @learn-workbench/shared

## Purpose
Zod schemas + pure types/utils shared by web+mobile. The single source of truth for API contracts and domain types (`JobPosting`, `MarketAnalysis`, `CareerReadiness`, `WellbeingToday`, `DashboardSummary`, `MarketGapItem`, `SkillRecommend` …).

## Surface
- `packages/shared/src/index.ts` — re-exports everything (main entry, `"./src/index.ts"`).
- Zod schemas (e.g. `marketAnalysisSchema`, `jobSchema`) + `z.infer` types; domain helpers (`formatRelativeTime`, `formatDateCN`, `jobSourceLabel`, `SUPPORTED_CITIES`).

## Key files
- `src/index.ts` — barrel (types + schemas + helpers).

## Dependencies
- `zod` (^4). No runtime framework deps.

## Usage
- Import from `@learn-workbench/shared`. Add new types/schemas here, then reference from web/mobile.
- Every new schema is consumed by an API route (web) and/or mobile store; keep field names aligned with DB columns.

## Architecture notes
- Pure module, no I/O. Types mirror `db/schema.sql` + API JSON responses.
- Bigint ids are serialized as strings (see `job.id` cast), keep that in mind for number-typed fields.

## Testing
- No unit runtime; validated downstream via `pnpm -F web test` / `pnpm -F mobile test`.
