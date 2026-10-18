#!/usr/bin/env node
/**
 * P0-2 基线采集：把「当前事实」落成可对比的 JSON（不含任何密钥）。
 *
 * 用法：
 *   node scripts/capture-baseline.mjs                      # → docs/baseline-YYYY-MM-DD.json
 *   node scripts/capture-baseline.mjs --out .local/b.json  # 指定输出
 *   node scripts/capture-baseline.mjs --prod .local/prod.json   # 合并生产事实（手工/SSH 采集）
 *
 * 设计原则：只读、零依赖、可重复；不访问网络、不写数据库。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync, createReadStream } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (!filter || filter(p, name)) out.push({ path: p, size: st.size });
  }
  return out;
}

async function sha256(file) {
  return await new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

function countFiles(dir, suffix, exclude = /node_modules|\.next|coverage|dist/) {
  return walk(dir, (p) => p.endsWith(suffix) && !exclude.test(p)).length;
}

const today = new Date().toISOString().slice(0, 10);
const outPath = arg("--out", path.join("docs", `baseline-${today}.json`));

const rootPkg = readJson("package.json") ?? {};
const webPkg = readJson("apps/web/package.json") ?? {};
const mobilePkg = readJson("apps/mobile/package.json") ?? {};
const appJson = readJson("apps/mobile/app.json") ?? {};
const gradle = (() => {
  // android/ 不进 git，但本地构建机上存在；能读就读，读不到返回 null（不报错）。
  try {
    const g = readFileSync(path.join(ROOT, "apps/mobile/android/app/build.gradle"), "utf8");
    const name = /versionName\s+"([^"]+)"/.exec(g)?.[1] ?? null;
    const code = Number(/versionCode\s+(\d+)/.exec(g)?.[1] ?? NaN);
    return { versionName: name, versionCode: Number.isFinite(code) ? code : null };
  } catch {
    return null;
  }
})();

const migrations = existsSync(path.join(ROOT, "db/migrations"))
  ? readdirSync(path.join(ROOT, "db/migrations")).filter((f) => f.endsWith(".sql")).sort()
  : [];

const schemaTables = (() => {
  try {
    const sql = readFileSync(path.join(ROOT, "db/schema.sql"), "utf8");
    return (sql.match(/CREATE TABLE IF NOT EXISTS/gi) ?? []).length;
  } catch {
    return null;
  }
})();

const publicBytes = walk(path.join(ROOT, "apps/web/public"), null).reduce((a, f) => a + f.size, 0);

const nextChunks = (() => {
  const dir = path.join(ROOT, "apps/web/.next/static");
  if (!existsSync(dir)) return null;
  const files = walk(dir, (p) => p.endsWith(".js")).map((f) => ({
    name: path.basename(f.path),
    bytes: f.size,
  }));
  files.sort((a, b) => b.bytes - a.bytes);
  return { totalFiles: files.length, top5: files.slice(0, 5) };
})();

const contentFiles = (() => {
  const dir = path.join(ROOT, "packages/content/src");
  if (!existsSync(dir)) return null;
  const files = walk(dir, (p) => p.endsWith(".ts") || p.endsWith(".tsx")).map((f) => ({
    path: path.relative(ROOT, f.path).replace(/\\/g, "/"),
    bytes: f.size,
    lines: readFileSync(f.path, "utf8").split("\n").length,
  }));
  files.sort((a, b) => b.lines - a.lines);
  return { fileCount: files.length, top5ByLines: files.slice(0, 5) };
})();

const apkCandidates = [
  "apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
  "apps/mobile/dist",
].filter((p) => existsSync(path.join(ROOT, p)));

let apk = null;
const apkPath = path.join(ROOT, apkCandidates[0] ?? "");
if (apkCandidates[0] && apkCandidates[0].endsWith(".apk") && existsSync(apkPath)) {
  apk = { path: apkCandidates[0], bytes: statSync(apkPath).size, sha256: await sha256(apkPath) };
}

const dirty = git(["status", "--porcelain"]).split("\n").filter(Boolean);

const baseline = {
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/capture-baseline.mjs",
  git: {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    head: git(["rev-parse", "--short", "HEAD"]),
    headSubject: git(["log", "-1", "--format=%s"]),
    describe: git(["describe", "--tags", "--always"]),
    dirtyFiles: dirty.length,
  },
  versions: {
    root: rootPkg.version ?? null,
    web: webPkg.version ?? null,
    mobile: mobilePkg.version ?? null,
    androidVersionCode: appJson?.expo?.android?.versionCode ?? gradle?.versionCode ?? null,
    androidVersionName: gradle?.versionName ?? appJson?.expo?.version ?? null,
    latestTag: (git(["tag", "--sort=-v:refname"]).split("\n")[0] || null),
  },
  db: {
    migrationsCount: migrations.length,
    lastMigration: migrations.at(-1) ?? null,
    schemaCreateTableStatements: schemaTables,
  },
  counts: {
    webRoutes: countFiles(path.join(ROOT, "apps/web/app/api"), "route.ts"),
    webRouteTests: countFiles(path.join(ROOT, "apps/web/app/api"), "route.test.ts"),
    webPages: countFiles(path.join(ROOT, "apps/web/app"), "page.tsx"),
    webTestFiles: countFiles(path.join(ROOT, "apps/web"), ".test.ts") + countFiles(path.join(ROOT, "apps/web"), ".test.tsx"),
    mobileTestFiles: countFiles(path.join(ROOT, "apps/mobile/src"), ".test.ts"),
    e2eSpecs: countFiles(path.join(ROOT, "e2e"), ".spec.ts"),
  },
  sizes: {
    publicBytes,
    nextChunks,
    content: contentFiles,
    apk,
  },
  gates: {},
  production: null,
};

const gatesArg = arg("--gates", null);
if (gatesArg && existsSync(path.join(ROOT, gatesArg))) {
  baseline.gates = JSON.parse(readFileSync(path.join(ROOT, gatesArg), "utf8"));
}

const prodArg = arg("--prod", null);
if (prodArg && existsSync(path.join(ROOT, prodArg))) {
  baseline.production = JSON.parse(readFileSync(path.join(ROOT, prodArg), "utf8"));
}

mkdirSync(path.dirname(path.join(ROOT, outPath)), { recursive: true });
writeFileSync(path.join(ROOT, outPath), JSON.stringify(baseline, null, 2) + "\n", "utf8");
console.log(`[baseline] wrote ${outPath}`);
console.log(JSON.stringify({ git: baseline.git, versions: baseline.versions, db: baseline.db, counts: baseline.counts }, null, 2));
