# CLAUDE.md — @learn-workbench/config

## Purpose
Small constants/config shared across workspaces. Currently the readiness weights used by the career-readiness dimension.

## Surface
- `packages/config/src/index.ts` — `readinessWeights` (`skill/project/resume/interview` weights, parsed by schema), exported via `"./src/index.ts"`.

## Key files
- `src/index.ts`.

## Dependencies
- `zod` (^4).

## Usage
- `import { readinessWeights } from "@learn-workbench/config"` (used by `apps/web/lib/readiness.ts`).
- Add new shared constants here (e.g. job category/education/experience option lists) if used by both ends.

## Notes
- Keep options aligned with DB CHECK constraints (see schema `job_postings.category`, education/experience enums).
