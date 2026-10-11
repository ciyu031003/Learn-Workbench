#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ORIGIN,
  SUBJECTS,
  asPositiveInt,
  extensionForContentType,
  mapLimit,
  parseArgs,
  resolveOutDir,
  sha1,
  sha256,
  sleep,
  sourceUrl,
  writeJson,
} from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const RAW_DIR = path.join(OUT_DIR, "raw");
const OBJECT_DIR = path.join(RAW_DIR, "objects");
const MANIFEST_FILE = path.join(RAW_DIR, "manifest.json");

const POLICY = {
  concurrency: asPositiveInt(args.concurrency, 2, 3),
  gapMs: asPositiveInt(args.gap, 350, 3000),
  timeoutMs: asPositiveInt(args.timeout, 20_000, 60_000),
  retries: asPositiveInt(args.retries, 2, 4),
};

const USE_CACHE = !args["no-cache"];
const QUESTION_SAMPLES_PER_YEAR = asPositiveInt(args["question-samples"], 1, 3);
const USER_AGENT =
  "learn-workbench-408-research/1.0 (personal study snapshot; no automated bypass)";

async function main() {
  await mkdir(OBJECT_DIR, { recursive: true });

  const cached = USE_CACHE ? await readCachedManifest() : null;
  const state = {
    requests: 0,
    retried: 0,
    cacheHits: 0,
    failures: [],
    entries: new Map(),
  };

  if (cached) {
    for (const entry of cached.entries ?? []) {
      state.entries.set(entry.url, entry);
    }
  }

  const home = await fetchSnapshot(sourceUrl("/"), {
    kind: "home",
    state,
    accept404: false,
  });

  const robots = await fetchSnapshot(sourceUrl("/robots.txt"), {
    kind: "robots",
    state,
    accept404: true,
  });

  const sitemap = await fetchSnapshot(sourceUrl("/sitemap.xml"), {
    kind: "sitemap",
    state,
    accept404: true,
  });

  const homeText = await entryText(home);
  const years = extractYears(homeText);
  if (years.length === 0) {
    throw new Error("No paper years were discovered from the public home page.");
  }

  const knowledgeTargets = SUBJECTS.map((subject) => ({
    ...subject,
    url: sourceUrl(`/knowledge?subject=${encodeURIComponent(subject.key)}`),
  }));

  const knowledgeEntries = await mapLimit(
    knowledgeTargets,
    POLICY.concurrency,
    async (target) => {
      const entry = await fetchSnapshot(target.url, {
        kind: "knowledge",
        state,
        accept404: false,
      });
      await sleep(POLICY.gapMs);
      return { ...target, entry };
    },
  );

  const paperTargets = years.map((year) => ({
    year,
    url: sourceUrl(`/paper/${year}`),
  }));

  const paperEntries = await mapLimit(
    paperTargets,
    POLICY.concurrency,
    async (target) => {
      const entry = await fetchSnapshot(target.url, {
        kind: "paper",
        state,
        accept404: false,
      });
      await sleep(POLICY.gapMs);
      return { ...target, entry };
    },
  );

  const htmlEntries = [home, ...knowledgeEntries.map((item) => item.entry), ...paperEntries.map((item) => item.entry)];
  const htmlTexts = await Promise.all(htmlEntries.map((entry) => entryText(entry)));
  const allHtml = htmlTexts.join("\n");
  const assetUrls = extractAssetUrls(allHtml);
  const bundle = await discoverDataBundle(assetUrls, state);

  const sampleTargets = [];
  for (const year of years.slice(0, QUESTION_SAMPLES_PER_YEAR > 0 ? years.length : 0)) {
    for (let index = 1; index <= QUESTION_SAMPLES_PER_YEAR; index++) {
      const number = String(index).padStart(2, "0");
      sampleTargets.push({
        year,
        questionId: `${year}-${number}`,
        url: sourceUrl(`/question/${year}-${number}`),
      });
    }
  }

  const questionSamples = await mapLimit(
    sampleTargets,
    POLICY.concurrency,
    async (target) => {
      const entry = await fetchSnapshot(target.url, {
        kind: "question-sample",
        state,
        accept404: false,
      });
      await sleep(POLICY.gapMs);
      return { ...target, entry };
    },
  );

  const entries = [...state.entries.values()].sort((left, right) =>
    left.url.localeCompare(right.url),
  );

  const manifest = {
    version: 1,
    origin: ORIGIN,
    capturedAt: new Date().toISOString(),
    cacheUsed: Boolean(cached),
    policy: POLICY,
    discovery: {
      years,
      subjects: knowledgeEntries.map((item) => ({
        key: item.key,
        short: item.short,
        label: item.label,
        url: item.url,
      })),
      bundleUrl: bundle?.url ?? null,
      questionSamples: questionSamples.map((item) => ({
        questionId: item.questionId,
        url: item.url,
      })),
    },
    summary: {
      requests: state.requests,
      retried: state.retried,
      cacheHits: state.cacheHits,
      entries: entries.length,
      failures: state.failures.length,
    },
    entries,
    failures: state.failures,
  };

  await writeJson(MANIFEST_FILE, manifest);

  console.log(
    [
      "[beokayy-408] crawl complete",
      `years=${years.length}`,
      `knowledge=${knowledgeEntries.length}`,
      `papers=${paperEntries.length}`,
      `bundle=${bundle ? "found" : "missing"}`,
      `samples=${questionSamples.length}`,
      `requests=${state.requests}`,
      `cacheHits=${state.cacheHits}`,
      `failures=${state.failures.length}`,
    ].join(" "),
  );

  if (!bundle) {
    throw new Error("The public data bundle containing availableYears was not found.");
  }

  if (state.failures.length > 0) {
    process.exitCode = 1;
  }
}

async function readCachedManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function fetchSnapshot(url, options) {
  const { kind, state, accept404 } = options;
  const existing = state.entries.get(url);
  if (USE_CACHE && existing?.file) {
    try {
      await readFile(existing.file);
      state.cacheHits++;
      return existing;
    } catch {
      state.entries.delete(url);
    }
  }

  let lastError = null;
  const tries = POLICY.retries + 1;

  for (let attempt = 1; attempt <= tries; attempt++) {
    state.requests++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POLICY.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "zh-CN,zh;q=0.9",
          accept: "text/html,application/javascript,text/javascript,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      const body = Buffer.from(await response.arrayBuffer());
      if (!response.ok && !(accept404 && response.status === 404)) {
        throw new Error(`HTTP ${response.status} ${url}`);
      }

      const digest = sha256(body);
      const extension = extensionForContentType(response.headers.get("content-type"));
      const relativeFile = path.join("raw", "objects", `${digest}${extension}`);
      const file = path.join(OUT_DIR, relativeFile);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);

      const entry = {
        kind,
        url,
        finalUrl: response.url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        bytes: body.byteLength,
        sha256: digest,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        fetchedAt: new Date().toISOString(),
        file,
      };
      state.entries.set(url, entry);
      return entry;
    } catch (error) {
      const aborted =
        error?.name === "AbortError" || error?.cause?.name === "AbortError";
      lastError = aborted
        ? new Error(`Timeout after ${POLICY.timeoutMs}ms: ${url}`)
        : error;
      if (attempt < tries) {
        state.retried++;
        await sleep(400 * 2 ** (attempt - 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const message = String(lastError?.message ?? lastError);
  state.failures.push({ url, kind, error: message });
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function entryText(entry) {
  const body = await readFile(entry.file);
  return body.toString("utf8");
}

function extractYears(html) {
  const years = new Set();
  for (const match of html.matchAll(/\/paper\/(20\d{2})/g)) {
    years.add(Number(match[1]));
  }
  return [...years].filter((year) => Number.isInteger(year)).sort((a, b) => a - b);
}

function extractAssetUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.js/g)) {
    urls.add(new URL(match[0], ORIGIN).toString());
  }
  return [...urls].sort();
}

async function discoverDataBundle(assetUrls, state) {
  const preferred = assetUrls.find((url) => /choiceOptions-/i.test(url));
  const ordered = preferred
    ? [preferred, ...assetUrls.filter((url) => url !== preferred)]
    : assetUrls;

  for (const assetUrl of ordered) {
    const existing = state.entries.get(assetUrl);
    if (existing) {
      const text = await entryText(existing);
      if (text.includes("availableYears") && text.includes("papers:[{year:")) {
        return existing;
      }
      continue;
    }

    const entry = await fetchSnapshot(assetUrl, {
      kind: "data-bundle-candidate",
      state,
      accept404: true,
    });
    await sleep(POLICY.gapMs);

    if (entry.status !== 200) continue;
    const text = await entryText(entry);
    if (text.includes("availableYears") && text.includes("papers:[{year:")) {
      entry.kind = "data-bundle";
      return entry;
    }
  }

  return null;
}

await main();
