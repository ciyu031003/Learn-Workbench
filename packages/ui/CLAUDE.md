# CLAUDE.md — @learn-workbench/ui

## Purpose
Cross-end design tokens / theme constants to keep Web (Tailwind + shadcn style) and Mobile (React Native) visually consistent (Liquid-Glass palette, glass + indigo accent).

## Surface
- `packages/ui/src/index.ts` — token/color constants, `"./src/index.ts"`.

## Key files
- `src/index.ts`.

## Dependencies
- (type-only) `@learn-workbench/shared`, `typescript`.

## Usage
- Tokens referenced by `apps/web/app/globals.css` (CSS vars `--color-primary: #4f46e5`, glass blur/saturate) and RN theme in mobile.

## Notes
- Keep Web `globals.css` @theme tokens and the `--color-*`/glass vars the canonical source; mobile mirrors same values.
