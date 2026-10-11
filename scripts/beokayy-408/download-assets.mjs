#!/usr/bin/env node

import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ORIGIN,
  REPO_ROOT,
  asBoolean,
  asPositiveInt,
  extensionForContentType,
  mapLimit,
  parseArgs,
  readJson,
  resolveOutDir,
  sleep,
  sourceUrl,
  writeJson,
} from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const APPLY = asBoolean(args.apply, false);
const CONCURRENCY = asPositiveInt(args.concurrency, 2, 4);
const GAP_MS = asPositiveInt(args.gap, 180, 3000);
const PUBLIC_ROOT = path.join(REPO_ROOT, "apps", "web", "public");
const CACHE_ROOT = path.join(OUT_DIR, "asset-cache");
const REPORT_FILE = path.join(OUT_DIR, "asset-download-report.json");

async function main() {
  const questionsFile = await readJson(
    path.join(OUT_DIR, "parsed", "questions.json"),
  );
  const questions = questionsFile.questions ?? [];
  const refs = collectImageRefs(questions);

  const startedAt = new Date().toISOString();
  const results = [];
  if (APPLY) {
    await Promise.all([
      mkdir(PUBLIC_ROOT, { recursive: true }),
      mkdir(CACHE_ROOT, { recursive: true }),
    ]);
    await mapLimit(refs, CONCURRENCY, async (ref, index) => {
      if (index > 0) await sleep(GAP_MS);
      results.push(await downloadAsset(ref));
    });
  }

  const report = {
    version: 1,
    mode: APPLY ? "apply" : "dry-run",
    startedAt,
    finishedAt: new Date().toISOString(),
    source: ORIGIN,
    publicRoot: path.relative(REPO_ROOT, PUBLIC_ROOT),
    total: refs.length,
    downloaded: results.filter((item) => item.status === "downloaded").length,
    cached: results.filter((item) => item.status === "cached").length,
    failed: results.filter((item) => item.status === "failed"),
    assets: results,
  };
  await writeJson(REPORT_FILE, report);

  console.log(
    [
      `[beokayy-408] assets ${APPLY ? "applied" : "dry-run"}`,
      `total=${refs.length}`,
      `downloaded=${report.downloaded}`,
      `cached=${report.cached}`,
      `failed=${report.failed.length}`,
    ].join(" "),
  );

  if (report.failed.length > 0) process.exitCode = 1;
}

function collectImageRefs(questions) {
  const refs = new Set();
  for (const question of questions) {
    for (const ref of [...(question.imageRefs ?? []), ...(question.answerImageRefs ?? [])]) {
      if (typeof ref === "string" && ref.startsWith("/")) refs.add(ref);
    }
  }
  return [...refs].sort();
}

async function downloadAsset(ref) {
  const relative = ref.replace(/^\/+/, "");
  const cacheFile = path.join(CACHE_ROOT, relative);
  const publicFile = path.resolve(PUBLIC_ROOT, relative);
  const publicRoot = path.resolve(PUBLIC_ROOT);
  if (!publicFile.startsWith(publicRoot + path.sep)) {
    return { ref, status: "failed", error: "target escapes public root" };
  }

  await mkdir(path.dirname(cacheFile), { recursive: true });
  await mkdir(path.dirname(publicFile), { recursive: true });

  if (await exists(cacheFile)) {
    if (APPLY) await writeFile(publicFile, await readFile(cacheFile));
    return { ref, status: "cached", bytes: (await stat(cacheFile)).size };
  }

  const url = sourceUrl(ref);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Learn-Workbench/1.0 personal-study-import",
          Referer: `${ORIGIN}/`,
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`unexpected content-type ${contentType || "unknown"}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error("empty response");
      const expectedExtension = extensionForContentType(contentType);
      if (expectedExtension && !cacheFile.toLowerCase().endsWith(expectedExtension)) {
        return {
          ref,
          status: "failed",
          error: `extension mismatch: expected ${expectedExtension}, got ${path.extname(cacheFile)}`,
        };
      }
      await writeFile(cacheFile, bytes);
      await writeFile(publicFile, bytes);
      return { ref, status: "downloaded", bytes: bytes.length, contentType };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 3) await sleep(300 * attempt);
    }
  }
  return { ref, status: "failed", error: lastError };
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

await main();
