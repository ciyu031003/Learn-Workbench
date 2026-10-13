# Beokayy 408 snapshot scripts

These scripts collect and validate the public 408 content exposed by
`https://zhenti.beokayy.club/`. They are isolated from the application and do
not modify the UI, content package, database, or package manifests.

## Scope

- Public HTML, public JavaScript data, and public image availability only.
- No captcha, WAF, login, access-control, rate-limit, or ban bypass.
- Low concurrency, request gaps, retries, local caching, and source hashes.
- Raw and normalized output stays under `.local/beokayy-408/`.

## Commands

```powershell
node scripts/beokayy-408/crawl.mjs
node scripts/beokayy-408/parse.mjs
node scripts/beokayy-408/validate.mjs --online
node scripts/beokayy-408/download-assets.mjs --apply
node scripts/beokayy-408/import-db.mjs --apply
node scripts/beokayy-408/audit.mjs --require-db
```

Useful options:

```powershell
node scripts/beokayy-408/crawl.mjs --no-cache --concurrency=2 --gap=350
node scripts/beokayy-408/crawl.mjs --question-samples=0
node scripts/beokayy-408/validate.mjs
node scripts/beokayy-408/validate.mjs --online --image-concurrency=2
node scripts/beokayy-408/download-assets.mjs
node scripts/beokayy-408/download-assets.mjs --apply --concurrency=2 --gap=180
node scripts/beokayy-408/import-db.mjs
node scripts/beokayy-408/import-db.mjs --apply --database=Learn-Workbench
node scripts/beokayy-408/audit.mjs --skip-db
node scripts/beokayy-408/audit.mjs --require-db --database=Learn-Workbench
```

## Output

```text
.local/beokayy-408/
  raw/
    manifest.json
    objects/<sha256>.<extension>
  parsed/
    papers.json
    questions.json
    knowledge-index.json
    parse-summary.json
  validation/
    report.json
    image-checks.json
  asset-cache/
    content-images/...
  asset-download-report.json
  db-import-report.json
```

The normalized question shape keeps the original year, number, type, subject,
score, tags, body, answer, image references, video reference, and source URL.
Choice questions additionally receive parsed `stem`, `options`, and
`answerLetter` fields.

## Notes

- The crawler discovers the current data bundle URL from public HTML instead of
  hard-coding a hashed asset filename.
- `robots.txt` and `sitemap.xml` are recorded when available and recorded as
  missing when the server returns 404.
- The site's knowledge page is a topic-to-question index. It is not imported as
  lesson prose.
- `validate.mjs --online` checks image URL availability with HEAD and, when
  necessary, a one-byte range GET. It does not download full images.
- `download-assets.mjs` is dry-run by default. Pass `--apply` to cache the
  public question images under `.local/` and publish them to
  `apps/web/public/content-images/` so production CSP can serve them locally.
- `import-db.mjs` is dry-run by default. Pass `--apply` to upsert the parsed
  snapshot into the `exam_408_*` tables.
- `baseline.json` records the minimum accepted chapter, point, link, paper and
  question counts. Validation fails when a later snapshot regresses below it.
- `audit.mjs` joins the local snapshot, import model and database counts. It
  writes `.local/beokayy-408/audit/report.json` and is read-only with respect to
  PostgreSQL.
