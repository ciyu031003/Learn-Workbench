/**
 * 内容切源漂移门禁的纯逻辑（S7-4）。
 *
 * 背景：DB 作为内容唯一事实源后，仓库里的 `packages/content` 内容包可能落后于 DB
 * （或反过来 DB 落后于仓库）。本模块提供**可单测、无 IO** 的判定内核：
 *   - 仓库侧：learning 目录文件指纹（相对路径 + 文件 sha256 排序聚合）、包版本、git 内容版本；
 *   - DB 侧：把探测到的「内容版本 marker / 行数 / 最近导入时间」归一成可比较的形状；
 *   - 判定：FRESH / STALE / UNKNOWN（无法比较时绝不假装通过）。
 *
 * 约定（与 scripts/sync-content-model.mjs 对齐）：DB 的 content_version 语义是
 * 「上次同步时内容包所在 git 提交的 short sha（12 位）」；因此仓库侧优先用
 * `git log -1 --format=%h -- packages/content/src/learning` 取同语义版本，
 * 没有 git 时退化为指纹前 12 位（此时若 DB 存的是 git sha，只能判 UNKNOWN，不能瞎判 STALE）。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const FRESHNESS = Object.freeze({ FRESH: "FRESH", STALE: "STALE", UNKNOWN: "UNKNOWN" });
export const EXIT_CODES = Object.freeze({ FRESH: 0, STALE: 1, UNKNOWN: 2 });

export const DEFAULT_CONTENT_DIR = "packages/content/src/learning";
export const DEFAULT_PACKAGE_JSON = "packages/content/package.json";

/** 计入指纹的文件扩展名（内容包源码/JSON） */
const CONTENT_EXT = new Set([".ts", ".json"]);
/** 明确排除：测试文件、快照、类型声明 */
const EXCLUDE_RE = /(\.test\.|\.spec\.|__snapshots__|\.d\.ts$)/;

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * 递归列出计入指纹的内容文件（相对 root 的 posix 路径，按字典序排序）。
 * 排除 *.test.* / *.spec.* / __snapshots__ / *.d.ts（测试与类型不改变内容语义）。
 */
export function listContentFiles({ root, contentDir = DEFAULT_CONTENT_DIR } = {}) {
  if (!root) throw new Error("listContentFiles 需要 root");
  const base = path.resolve(root, contentDir);
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full);
        continue;
      }
      if (!CONTENT_EXT.has(path.extname(entry.name))) continue;
      if (EXCLUDE_RE.test(entry.name)) continue;
      const rel = toPosix(path.relative(root, full));
      out.push({ rel, abs: full });
    }
  };
  walk(base);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * 仓库内容指纹：对每个文件算 sha256，按「相对路径字典序」拼成
 * `<sha256>  <rel>` 行后再整体 sha256。文件顺序、目录遍历顺序都不影响结果。
 * 额外返回 short（前 12 位，无 git 时作为版本回退）与最新文件 mtime（用于漂移提示）。
 */
export function computeContentFingerprint({ root, contentDir = DEFAULT_CONTENT_DIR } = {}) {
  const entries = listContentFiles({ root, contentDir });
  let newestMtimeMs = 0;
  const lines = [];
  for (const entry of entries) {
    const bytes = fs.readFileSync(entry.abs);
    const stat = fs.statSync(entry.abs);
    newestMtimeMs = Math.max(newestMtimeMs, stat.mtimeMs);
    lines.push(sha256Hex(bytes) + "  " + entry.rel);
  }
  const fingerprint = sha256Hex(lines.join("\n"));
  return {
    fingerprint,
    short: fingerprint.slice(0, 12),
    fileCount: entries.length,
    newestMtimeMs,
    files: entries.map((e) => e.rel),
  };
}

/** 读取内容包 package.json 的 version（缺失/坏 JSON → null） */
export function readPackageVersion({ root, packageJson = DEFAULT_PACKAGE_JSON } = {}) {
  if (!root) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(root, packageJson), "utf8"));
    const version = typeof parsed?.version === "string" ? parsed.version.trim() : "";
    return version || null;
  } catch {
    return null;
  }
}

/**
 * 仓库内容包的「同步版本」：与 sync-content-model.mjs 完全同语义
 * （该目录最后一次 git 提交的 short sha 12 位 + 提交时间）。
 * @param {(cmd:string,args:string[],opts:object)=>string} gitExec 由 CLI 注入 execFileSync；测试可注入假实现
 */
export function readContentGitVersion({ root, contentDir = DEFAULT_CONTENT_DIR, gitExec } = {}) {
  if (!root || typeof gitExec !== "function") return null;
  try {
    const raw = String(
      gitExec(
        "git",
        ["log", "-1", "--format=%cI%n%h", "--", toPosix(contentDir)],
        { cwd: path.resolve(root), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      )
    ).trim();
    const [updatedAt, sha] = raw.split(/\r?\n/);
    if (!sha) return null;
    return { version: sha.trim().slice(0, 12), updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null, source: "git" };
  } catch {
    return null;
  }
}

/**
 * 解析仓库侧信息。版本优先级：git 内容版本 > 包版本 > 指纹前 12 位。
 * （git 内容版本与 DB marker 同语义，最可比；包版本用于人类可读展示。）
 */
export function resolveRepoInfo({ root, contentDir = DEFAULT_CONTENT_DIR, packageJson = DEFAULT_PACKAGE_JSON, gitExec } = {}) {
  const fingerprint = computeContentFingerprint({ root, contentDir });
  const packageVersion = readPackageVersion({ root, packageJson });
  const git = readContentGitVersion({ root, contentDir, gitExec });
  const version = git?.version ?? packageVersion ?? fingerprint.short;
  const versionSource = git ? "git" : packageVersion ? "package" : "fingerprint";
  const newestMtimeMs = fingerprint.newestMtimeMs;
  return {
    root,
    contentDir: toPosix(contentDir),
    version,
    versionSource,
    packageVersion,
    gitUpdatedAt: git?.updatedAt ?? null,
    fingerprint: fingerprint.fingerprint,
    fingerprintShort: fingerprint.short,
    fileCount: fingerprint.fileCount,
    newestMtimeMs,
    files: fingerprint.files,
  };
}

function asVersion(value) {
  const v = String(value ?? "").trim();
  return v && v !== "unknown" ? v : null;
}

function versionRowsToValues(rows) {
  const values = [];
  for (const row of rows ?? []) {
    const v = asVersion(row?.version);
    if (v && !values.includes(v)) values.push(v);
  }
  return values;
}

function markerFromReport(report) {
  if (!report || typeof report !== "object") return null;
  for (const key of ["contentVersion", "content_version", "version", "fingerprint"]) {
    const v = asVersion(report[key]);
    if (v) return v;
  }
  return null;
}

/**
 * 把 CLI 探测到的 DB 原始数据归一为 marker：
 * 优先级：content_meta（S7-4b 唯一落地点）> learning_tracks/learning_questions.content_version >
 *        content_topics.content_version > content_import_batch.commit_sha/report.contentVersion >
 *        app_meta 里的 content_version/fingerprint。
 */
export function pickDbMarkers(probe = {}) {
  const counts = probe.counts ?? {};
  const contentRowCount = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const sources = [];
  const versions = [];

  const add = (source, values) => {
    if (!values || values.length === 0) return;
    sources.push({ source, versions: values });
    for (const v of values) if (!versions.includes(v)) versions.push(v);
  };

  // 0) S7-4b：content_meta 是**最高优先级** marker（082 迁移 + 同步写入）。
  //    命中时只用它，避免 learning_*/content_topics 里的历史旧值造成「假 FRESH」。
  const metaRows = Array.isArray(probe.contentMeta) ? probe.contentMeta : [];
  const metaValue = (key) => {
    const row = metaRows.find((r) => String(r?.key ?? "") === key);
    return row ? asVersion(typeof row.value === "string" ? row.value : JSON.stringify(row.value ?? "")) : null;
  };
  const metaVersion = metaValue("content_version");
  const metaFingerprint = metaValue("content_fingerprint");
  if (metaVersion || metaFingerprint) {
    if (metaVersion) add("content_meta.content_version", [metaVersion]);
    if (metaFingerprint) add("content_meta.content_fingerprint", [metaFingerprint]);
  } else {
    add("learning.content_version", [
      ...versionRowsToValues(probe.versionRows?.learning_tracks),
      ...versionRowsToValues(probe.versionRows?.learning_questions),
    ]);
    add("content_topics.content_version", versionRowsToValues(probe.versionRows?.content_topics));
    for (const batch of probe.importBatches ?? []) {
      const values = [asVersion(batch?.commitSha), markerFromReport(batch?.report)].filter(Boolean);
      if (values.length) {
        add("content_import_batch", values);
        break; // 只取最近一条有 marker 的批次
      }
    }
    for (const row of probe.appMeta ?? []) {
      const key = String(row?.key ?? "");
      if (!/content/i.test(key) || !/(version|fingerprint|sha|hash)/i.test(key)) continue;
      const value = asVersion(typeof row.value === "string" ? row.value : JSON.stringify(row.value ?? ""));
      if (value) add("app_meta." + key, [value]);
    }
  }

  const version = versions[0] ?? null;
  const versionSource = version ? sources[0].source : null;
  const hints = [];
  if (probe.lastContentUpdatedAt && probe.repoNewestMtimeMs) {
    const dbAt = Date.parse(probe.lastContentUpdatedAt);
    if (Number.isFinite(dbAt) && probe.repoNewestMtimeMs > dbAt + 60_000) {
      hints.push("repo-newer-than-db");
    }
  }
  return {
    version,
    versionSource,
    versions,
    sources,
    contentRowCount,
    counts,
    lastContentUpdatedAt: probe.lastContentUpdatedAt ?? null,
    hints,
    tablesPresent: probe.tables ?? {},
    database: probe.database ?? null,
  };
}

/**
 * 判定 FRESH / STALE / UNKNOWN。
 * - FRESH：DB marker 与 repo version（或 repo 指纹 short/全长）一致；
 * - STALE：两边都有 marker、都同语义（至少一侧来自 git）但值不同 → 漂移；
 * - UNKNOWN：DB 不可用 / DB 无内容 / 缺 marker / 语义不可比 → 绝不假装通过。
 */
export function classifyFreshness({ repo, db, overrides = {} } = {}) {
  if (!repo || repo.fileCount === 0) {
    return {
      status: FRESHNESS.UNKNOWN,
      reason: "repo-empty",
      detail: "仓库内容目录没有可计入指纹的文件（检查 --root/--content-dir）",
      hints: [],
    };
  }
  if (!db) return { status: FRESHNESS.UNKNOWN, reason: "db-probe-missing", detail: "没有 DB 探测结果", hints: [] };
  if (db.connected === false) {
    return { status: FRESHNESS.UNKNOWN, reason: "db-unreachable", detail: db.error ?? "数据库连接失败", hints: [] };
  }

  const dbVersion = asVersion(overrides.dbVersion) ?? db.version;
  const dbVersionSource = asVersion(overrides.dbVersion) ? "override" : db.versionSource;
  const repoVersion = asVersion(overrides.repoVersion) ?? repo.version;
  const repoSource = asVersion(overrides.repoVersion) ? "override" : repo.versionSource;
  const hints = [...(db.hints ?? [])];

  if (db.contentRowCount === 0) {
    return { status: FRESHNESS.UNKNOWN, reason: "db-empty", detail: "DB 里没有内容行（新库/未导入），无漂移可判", hints };
  }
  if (!dbVersion) {
    return {
      status: FRESHNESS.UNKNOWN,
      reason: "db-marker-missing",
      detail:
        "DB 有内容但没有任何版本 marker（content_meta 未写入、learning_*.content_version 仍为 unknown、" +
        "content_import_batch 无记录、app_meta 无 content_version）。" +
        "082 迁移已建 content_meta：请跑一次 scripts/sync-content-model.mjs 写入 content_version/content_fingerprint（或在有旧版本列的库上等 082 回填）。",
      hints,
    };
  }
  if (!repoVersion) {
    return { status: FRESHNESS.UNKNOWN, reason: "repo-version-missing", detail: "无法确定仓库侧版本", hints };
  }

  const dbVersions = new Set([dbVersion, ...(db.versions ?? [])]);
  const repoMatches = [repoVersion, repo.fingerprint, repo.fingerprintShort, repo.short].filter(Boolean);
  if (repoMatches.some((v) => dbVersions.has(v))) {
    return {
      status: FRESHNESS.FRESH,
      reason: "version-match",
      detail: `仓库版本 ${repoVersion} 与 DB marker ${dbVersion} 一致`,
      hints,
    };
  }

  // 只有「仓库侧也是 git 同语义版本」或显式 override 时才敢判 STALE；
  // 无 git（package/指纹回退）与 DB git sha 之间语义不可比 → UNKNOWN（不误报）。
  const semanticallyComparable = repoSource === "git" || repoSource === "override" || dbVersionSource === "override";
  if (!semanticallyComparable) {
    return {
      status: FRESHNESS.UNKNOWN,
      reason: "version-incomparable",
      detail: `仓库版本 ${repoVersion}（${repoSource}）与 DB marker ${dbVersion}（${dbVersionSource}）语义不可比`,
      hints,
    };
  }

  return {
    status: FRESHNESS.STALE,
    reason: "version-mismatch",
    detail: `仓库版本 ${repoVersion}（${repoSource}）≠ DB marker ${dbVersion}（${dbVersionSource}）：内容包与 DB 已漂移，需重新同步`,
    hints,
  };
}

/** 机读单行：CONTENT_FRESHNESS=STATUS key=value ...（CI/告警正则抓这一行） */
export function formatMachineLine({ repo, db, result } = {}) {
  const parts = ["CONTENT_FRESHNESS=" + (result?.status ?? FRESHNESS.UNKNOWN)];
  const kv = {
    reason: result?.reason ?? "unknown",
    repo_version: repo?.version ?? "none",
    repo_source: repo?.versionSource ?? "none",
    repo_fingerprint: repo?.fingerprintShort ?? "none",
    repo_files: repo?.fileCount ?? 0,
    db_marker: db?.version ?? "none",
    db_marker_source: db?.versionSource ?? "none",
    db_rows: db?.contentRowCount ?? 0,
    db_last_content_at: db?.lastContentUpdatedAt ?? "none",
  };
  if (result?.hints?.length) kv.hints = result.hints.join(",");
  for (const [k, v] of Object.entries(kv)) parts.push(k + "=" + String(v).replace(/\s+/g, "_"));
  return parts.join(" ");
}

/** JSON 报告（--json） */
export function buildReport({ repo, db, result } = {}) {
  return {
    status: result?.status ?? FRESHNESS.UNKNOWN,
    reason: result?.reason ?? "unknown",
    detail: result?.detail ?? "",
    hints: result?.hints ?? [],
    machineLine: formatMachineLine({ repo, db, result }),
    repo: repo
      ? {
          contentDir: repo.contentDir,
          version: repo.version,
          versionSource: repo.versionSource,
          packageVersion: repo.packageVersion,
          fingerprint: repo.fingerprint,
          fileCount: repo.fileCount,
          gitUpdatedAt: repo.gitUpdatedAt,
        }
      : null,
    db: db
      ? {
          connected: db.connected !== false,
          database: db.database ?? null,
          marker: db.version ?? null,
          markerSource: db.versionSource ?? null,
          versions: db.versions ?? [],
          contentRowCount: db.contentRowCount ?? 0,
          counts: db.counts ?? {},
          lastContentUpdatedAt: db.lastContentUpdatedAt ?? null,
        }
      : null,
  };
}

/** 人类可读摘要（多行） */
export function formatHumanReport({ repo, db, result } = {}) {
  const lines = [];
  lines.push("[content-freshness] 内容切源漂移门禁（仓库 vs DB）");
  if (repo) {
    lines.push(
      "  仓库：" + repo.contentDir + " · 文件 " + repo.fileCount + " · 指纹 " + repo.fingerprintShort +
        " · 版本 " + repo.version + "（" + repo.versionSource + "）" +
        (repo.packageVersion ? " · package " + repo.packageVersion : "")
    );
  }
  if (db) {
    if (db.connected === false) lines.push("  DB：连接失败（" + (db.error ?? "unknown") + "）");
    else {
      lines.push(
        "  DB：" + (db.database ?? "?") + " · 内容行 " + (db.contentRowCount ?? 0) +
          " · marker " + (db.version ?? "none") + "（" + (db.versionSource ?? "none") + "）" +
          (db.lastContentUpdatedAt ? " · 最近内容时间 " + db.lastContentUpdatedAt : "")
      );
      const counts = db.counts ?? {};
      const countText = Object.entries(counts).filter(([, n]) => Number(n) > 0).map(([k, n]) => k + "=" + n).join(", ");
      if (countText) lines.push("  内容表行数：" + countText);
    }
  }
  lines.push("  判定：" + (result?.status ?? FRESHNESS.UNKNOWN) + "（" + (result?.reason ?? "unknown") + "）");
  if (result?.detail) lines.push("  说明：" + result.detail);
  if (result?.hints?.length) lines.push("  提示：" + result.hints.join(", "));
  lines.push("  " + formatMachineLine({ repo, db, result }));
  return lines.join("\n");
}

/** 解析 CLI 参数（纯函数） */
export function parseArgs(argv = []) {
  const out = {
    json: false,
    warn: false,
    allowUnknown: false,
    repoOnly: false,
    dbOnly: false,
    help: false,
    root: null,
    contentDir: null,
    packageJson: null,
    repoVersion: null,
    dbVersion: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw || !raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    const key = (eq >= 0 ? raw.slice(2, eq) : raw.slice(2)).trim();
    const inline = eq >= 0 ? raw.slice(eq + 1) : null;
    const next = argv[i + 1];
    const valueOf = () => {
      if (inline !== null) return inline;
      if (next && !next.startsWith("--")) {
        i++;
        return next;
      }
      return true;
    };
    switch (key) {
      case "json": out.json = true; break;
      case "warn": out.warn = true; break;
      case "allow-unknown": out.allowUnknown = true; break;
      case "repo-only": out.repoOnly = true; break;
      case "db-only": out.dbOnly = true; break;
      case "help": out.help = true; break;
      case "root": { const v = valueOf(); out.root = typeof v === "string" ? v : null; break; }
      case "content-dir": { const v = valueOf(); out.contentDir = typeof v === "string" ? v : null; break; }
      case "package-json": { const v = valueOf(); out.packageJson = typeof v === "string" ? v : null; break; }
      case "repo-version": { const v = valueOf(); out.repoVersion = typeof v === "string" ? v : null; break; }
      case "db-version": { const v = valueOf(); out.dbVersion = typeof v === "string" ? v : null; break; }
      default: break;
    }
  }
  return out;
}

/** 退出码：--warn 一律 0；--allow-unknown 把 UNKNOWN 降为 0；其余按状态 */
export function resolveExitCode(status, { warn = false, allowUnknown = false } = {}) {
  if (warn) return 0;
  if (status === FRESHNESS.FRESH) return 0;
  if (status === FRESHNESS.UNKNOWN && allowUnknown) return 0;
  return EXIT_CODES[status] ?? EXIT_CODES.UNKNOWN;
}
