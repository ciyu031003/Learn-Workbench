import { test } from "node:test";
import assert from "node:assert/strict";

import {
  licensePolicy,
  parseGitHubRepoUrl,
  summarizeOpenSourceAudit,
  validateOpenSourceAudit,
} from "./open-source-audit.mjs";

function project(overrides = {}) {
  return {
    key: "candidate",
    url: "https://github.com/example/candidate",
    defaultBranch: "main",
    license: {
      spdx: "MIT",
      name: "MIT License",
      status: "verified",
      evidence: "GitHub License API",
    },
    activity: { pushedAt: "2026-10-01T00:00:00Z", archived: false },
    reusableModules: ["content import validation"],
    decision: "adapt-small-module",
    decisionReason: "The pure validator fits the existing package boundary.",
    ...overrides,
  };
}

test("parseGitHubRepoUrl accepts only GitHub repository URLs", () => {
  assert.deepEqual(parseGitHubRepoUrl("https://github.com/owner/repo"), { owner: "owner", repo: "repo" });
  assert.equal(parseGitHubRepoUrl("https://example.com/owner/repo"), null);
  assert.equal(parseGitHubRepoUrl("http://github.com/owner/repo"), null);
});

test("licensePolicy distinguishes permissive, copyleft and unidentified licenses", () => {
  assert.equal(licensePolicy("MIT").codeCopy, "allowed-with-notice");
  assert.equal(licensePolicy("Apache-2.0").codeCopy, "allowed-with-notice");
  assert.equal(licensePolicy("GPL-3.0").codeCopy, "reference-only");
  assert.equal(licensePolicy("NOASSERTION").codeCopy, "blocked");
});

test("audit validation rejects missing evidence and unsafe reuse decisions", () => {
  const audit = {
    version: 1,
    projects: [
      project({ license: { spdx: "NOASSERTION", name: "Other", status: "blocked", evidence: "" } }),
      project({ key: "moodle", url: "https://github.com/moodle/moodle", license: { spdx: "GPL-3.0", name: "GPL", status: "verified", evidence: "COPYING.txt" }, decision: "direct-reuse" }),
    ],
  };
  const result = validateOpenSourceAudit(audit);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("license.evidence")));
  assert.ok(result.errors.some((error) => error.includes("strong-copyleft")));
});

test("audit summary counts decisions and blocked licenses", () => {
  const audit = {
    version: 1,
    projects: [
      project(),
      project({ key: "blocked", license: { spdx: "NOASSERTION", name: "Other", status: "blocked", evidence: "LICENSE" }, decision: "reference-only" }),
    ],
  };
  assert.deepEqual(summarizeOpenSourceAudit(audit), {
    projects: 2,
    decisions: { "direct-reuse": 0, "adapt-small-module": 1, "reference-only": 1, "do-not-copy": 0 },
    blockedLicenses: 1,
  });
});
