# CLAUDE.md — @learn-workbench/content

## Purpose
Static route/learning content data (phases, topics, resources, practices, projects, checkpoints) — mirrors `db/seed_content.sql` so libraries and DB stay in sync.

## Surface
- `packages/content/src/index.ts` — barrels content types/data; `tsconfig` external `./src/index.ts`.

## Key files
- `src/index.ts`; exported content collections (phases/topics per career, e.g. ICT).

## Dependencies
- `@learn-workbench/shared` (workspace).

## Usage
- Import content in web/mobile for static rendering; DB seed is the runtime source of truth (`db/seed_content.sql`).

## Notes
- Add new phases/topics to `db/seed_content.sql` AND reflect in content package to keep parity; content_topics are keyed by `career_key`.
