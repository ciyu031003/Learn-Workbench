#!/usr/bin/env node
/**
 * Validate the Phase 3 open-source admission record and optionally re-check it
 * against the live GitHub API. No dependency is installed or cloned.
 *
 * Usage:
 *   node scripts/audit-open-sources.mjs
 *   node scripts/audit-open-sources.mjs --online --json
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  parseGitHubRepoUrl,
  summarizeOpenSourceAudit,
  validateOpenSourceAudit,
} from "./lib/open-source-audit.mjs";

const { values } = parseArgs({
  options: {
    file: { type: "string", default: "content-platform/open-source-audit.json" },
    online: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const file = path.resolve(String(values.file));
const audit = JSON.parse(await readFile(file, "utf8"));
const validation = validateOpenSourceAudit(audit);
const report = {
  ok: validation.ok,
  file,
  online: values.online === true,
  summary: summarizeOpenSourceAudit(audit),
  errors: [...validation.errors],
  checks: [],
};

if (values.online) {
  const headers = {
    "user-agent": "learn-workbench-open-source-audit",
    accept: "application/vnd.github+json",
  };
  for (const project of audit.projects ?? []) {
    const parsed = parseGitHubRepoUrl(project.url);
    const check = { key: project.key, ok: false, errors: [] };
    if (!parsed) {
      check.errors.push("invalid GitHub URL");
      report.checks.push(check);
      continue;
    }
    const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
    const licenseUrl = `${repoUrl}/license`;
    try {
      const repoResponse = await fetch(repoUrl, { headers });
      const repo = await repoResponse.json();
      const licenseResponse = await fetch(licenseUrl, { headers });
      const license = await licenseResponse.json();
      if (!repoResponse.ok) check.errors.push(`repository HTTP ${repoResponse.status}`);
      if (!licenseResponse.ok) check.errors.push(`license HTTP ${licenseResponse.status}`);
      if (repo.default_branch && repo.default_branch !== project.defaultBranch) {
        check.errors.push(`default branch changed: ${project.defaultBranch} -> ${repo.default_branch}`);
      }
      const spdx = license?.license?.spdx_id ?? null;
      if (spdx && spdx !== project.license.spdx) {
        check.errors.push(`license changed: ${project.license.spdx} -> ${spdx}`);
      }
      if (typeof repo.archived === "boolean" && repo.archived !== project.activity.archived) {
        check.errors.push(`archived changed: ${project.activity.archived} -> ${repo.archived}`);
      }
      check.ok = check.errors.length === 0;
      check.observed = {
        defaultBranch: repo.default_branch ?? null,
        spdx,
        pushedAt: repo.pushed_at ?? null,
        archived: repo.archived ?? null,
      };
    } catch (error) {
      check.errors.push(String(error instanceof Error ? error.message : error));
    }
    report.checks.push(check);
    if (!check.ok) report.ok = false;
  }
}

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `[open-source-audit] ${report.ok ? "passed" : "failed"} ` +
      `projects=${report.summary.projects} blocked=${report.summary.blockedLicenses} ` +
      `errors=${report.errors.length + report.checks.reduce((total, check) => total + check.errors.length, 0)}`,
  );
  for (const error of report.errors) console.error(`[open-source-audit][FAIL] ${error}`);
  for (const check of report.checks) {
    for (const error of check.errors) console.error(`[open-source-audit][ONLINE] ${check.key}: ${error}`);
  }
}

if (!report.ok) process.exitCode = 1;
