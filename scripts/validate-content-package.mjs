#!/usr/bin/env node
/**
 * Validate one unified content package and, when requested, emit the generic
 * content-import items without touching PostgreSQL.
 *
 * Usage:
 *   node scripts/validate-content-package.mjs --file <package.json>
 *   node scripts/validate-content-package.mjs --file <package.json> --strict --json
 *   node scripts/validate-content-package.mjs --file <package.json> --emit-import-items .local/items.json
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { validateContentPackage } from "./lib/content-package.mjs";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    json: { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    "emit-import-items": { type: "string" },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/validate-content-package.mjs --file <package.json>",
      "  node scripts/validate-content-package.mjs --file <package.json> --strict --json",
      "  node scripts/validate-content-package.mjs --file <package.json> --emit-import-items <out.json>",
    ].join("\n"),
  );
}

if (values.help) {
  usage();
  process.exit(0);
}

const file = String(values.file ?? "").trim();
if (!file) {
  usage();
  throw new Error("--file is required");
}

const absoluteFile = path.resolve(file);
const raw = JSON.parse(await readFile(absoluteFile, "utf8"));
const result = validateContentPackage(raw, { strict: values.strict === true });
const report = {
  ok: result.ok,
  file: absoluteFile,
  fingerprint: result.fingerprint,
  publishable: result.publishable,
  stats: result.stats,
  errors: result.errors,
  warnings: result.warnings,
  importItems: values["emit-import-items"] ? result.importItems : undefined,
};

if (values["emit-import-items"]) {
  const output = path.resolve(values["emit-import-items"]);
  await writeFile(output, `${JSON.stringify(result.importItems, null, 2)}\n`, "utf8");
  report.importItemsFile = output;
}

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `[content-package] ${result.ok ? "passed" : "failed"} ` +
      `chapters=${result.stats.chapters} points=${result.stats.points} ` +
      `questions=${result.stats.questions} links=${result.stats.links} ` +
      `errors=${result.errors.length} warnings=${result.warnings.length}`,
  );
  for (const warning of result.warnings) console.warn(`[content-package][WARN] ${warning}`);
  for (const error of result.errors) console.error(`[content-package][FAIL] ${error}`);
  if (report.importItemsFile) console.log(`[content-package] import items written: ${report.importItemsFile}`);
}

if (!result.ok) process.exitCode = 1;
