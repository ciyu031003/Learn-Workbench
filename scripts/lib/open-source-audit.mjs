/**
 * Pure helpers for the Phase 3 open-source admission record.
 *
 * The audit is deliberately conservative: a permissive code license is not
 * enough to justify copying a whole application. Each candidate still needs
 * an explicit module boundary, dependency and maintenance decision.
 */

export const OPEN_SOURCE_DECISIONS = [
  "direct-reuse",
  "adapt-small-module",
  "reference-only",
  "do-not-copy",
];

export function parseGitHubRepoUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
}

export function licensePolicy(spdx) {
  const value = String(spdx ?? "").trim();
  if (/^(MIT|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|ISC)$/i.test(value)) {
    return {
      codeCopy: "allowed-with-notice",
      requiresNotice: true,
      reason: "permissive license; keep copyright, license and NOTICE obligations",
    };
  }
  if (/^(GPL|AGPL|LGPL)/i.test(value)) {
    return {
      codeCopy: "reference-only",
      requiresNotice: true,
      reason: "strong copyleft; copying into this application would expand distribution obligations",
    };
  }
  if (/^(NOASSERTION|UNKNOWN|NONE)$/i.test(value) || !value) {
    return {
      codeCopy: "blocked",
      requiresNotice: false,
      reason: "license is not sufficiently identified for code reuse",
    };
  }
  return {
    codeCopy: "review",
    requiresNotice: true,
    reason: "license is not in the pre-approved set; legal review required before copying",
  };
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateOpenSourceAudit(input) {
  const audit = input && typeof input === "object" ? input : {};
  const errors = [];
  const projects = Array.isArray(audit.projects) ? audit.projects : [];
  const keys = new Set();

  if (audit.version !== 1) errors.push("version: expected 1");
  if (!Array.isArray(audit.projects) || projects.length === 0) errors.push("projects: required");

  for (const [index, project] of projects.entries()) {
    const path = `projects[${index}]`;
    const key = String(project?.key ?? "").trim();
    if (!key) errors.push(`${path}.key: required`);
    else if (keys.has(key)) errors.push(`${path}.key: duplicate ${key}`);
    else keys.add(key);

    if (!isHttpsUrl(project?.url)) errors.push(`${path}.url: must be an https URL`);
    const parsed = parseGitHubRepoUrl(project?.url);
    if (!parsed) errors.push(`${path}.url: must be a GitHub repository URL`);

    const license = project?.license ?? {};
    if (!String(license.spdx ?? "").trim()) errors.push(`${path}.license.spdx: required`);
    if (!String(license.name ?? "").trim()) errors.push(`${path}.license.name: required`);
    if (!String(license.evidence ?? "").trim()) errors.push(`${path}.license.evidence: required`);
    if (!["verified", "review-required", "blocked"].includes(String(license.status))) {
      errors.push(`${path}.license.status: invalid`);
    }

    if (!String(project?.defaultBranch ?? "").trim()) errors.push(`${path}.defaultBranch: required`);
    if (!String(project?.activity?.pushedAt ?? "").trim()) errors.push(`${path}.activity.pushedAt: required`);
    if (typeof project?.activity?.archived !== "boolean") errors.push(`${path}.activity.archived: required`);

    if (!Array.isArray(project?.reusableModules) || project.reusableModules.length === 0) {
      errors.push(`${path}.reusableModules: at least one module or idea is required`);
    }
    if (!OPEN_SOURCE_DECISIONS.includes(project?.decision)) {
      errors.push(`${path}.decision: invalid`);
    }
    if (!String(project?.decisionReason ?? "").trim()) {
      errors.push(`${path}.decisionReason: required`);
    }

    const policy = licensePolicy(license.spdx);
    if (policy.codeCopy === "blocked" && project?.decision === "direct-reuse") {
      errors.push(`${path}.decision: cannot directly reuse with SPDX ${license.spdx}`);
    }
    if (policy.codeCopy === "reference-only" && project?.decision === "direct-reuse") {
      errors.push(`${path}.decision: strong-copyleft code cannot be marked direct-reuse`);
    }
  }

  return { ok: errors.length === 0, errors, projects: projects.length };
}

export function summarizeOpenSourceAudit(input) {
  const audit = input && typeof input === "object" ? input : {};
  const counts = Object.fromEntries(OPEN_SOURCE_DECISIONS.map((decision) => [decision, 0]));
  for (const project of Array.isArray(audit.projects) ? audit.projects : []) {
    if (project?.decision in counts) counts[project.decision] += 1;
  }
  return {
    projects: Array.isArray(audit.projects) ? audit.projects.length : 0,
    decisions: counts,
    blockedLicenses: (audit.projects ?? []).filter((project) =>
      ["blocked", "review-required"].includes(String(project?.license?.status))
    ).length,
  };
}
