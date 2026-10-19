import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  FRESHNESS,
  buildReport,
  classifyFreshness,
  computeContentFingerprint,
  formatHumanReport,
  formatMachineLine,
  listContentFiles,
  parseArgs,
  pickDbMarkers,
  readContentGitVersion,
  readPackageVersion,
  resolveExitCode,
  resolveRepoInfo,
} from "./content-freshness.mjs";

/** 造一个临时内容目录：root/packages/content/src/learning + root/packages/content/package.json */
function makeRepo({ version = "0.2.0", files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-freshness-"));
  const dir = path.join(root, "packages", "content", "src", "learning");
  fs.mkdirSync(dir, { recursive: true });
  const defaults = {
    "algorithms.ts": "export const algorithms = [{ slug: 'a' }];\n",
    "java/model.ts": "export const java = 1;\n",
    "tracks.json": JSON.stringify({ tracks: ["a", "b"] }),
  };
  for (const [rel, content] of Object.entries({ ...defaults, ...files })) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.writeFileSync(
    path.join(root, "packages", "content", "package.json"),
    JSON.stringify({ name: "@learn-workbench/content", version }, null, 2)
  );
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("listContentFiles：只收 ts/json，排除 test/d.ts，按相对路径排序", () => {
  const root = makeRepo({ files: { "skip.test.ts": "x", "types.d.ts": "x", "notes.md": "x" } });
  try {
    const files = listContentFiles({ root });
    assert.deepEqual(files.map((f) => f.rel), [
      "packages/content/src/learning/algorithms.ts",
      "packages/content/src/learning/java/model.ts",
      "packages/content/src/learning/tracks.json",
    ]);
  } finally {
    cleanup(root);
  }
});

test("computeContentFingerprint：稳定、响应内容变化、与文件创建顺序无关", () => {
  const a = makeRepo();
  const b = makeRepo();
  try {
    const fa = computeContentFingerprint({ root: a });
    const fb = computeContentFingerprint({ root: b });
    assert.equal(fa.fingerprint, fb.fingerprint);
    assert.equal(fa.short.length, 12);
    assert.equal(fa.fileCount, 3);

    fs.writeFileSync(path.join(b, "packages/content/src/learning/algorithms.ts"), "changed\n");
    const fb2 = computeContentFingerprint({ root: b });
    assert.notEqual(fa.fingerprint, fb2.fingerprint);
  } finally {
    cleanup(a);
    cleanup(b);
  }
});

test("readPackageVersion：正常读取 / 坏 JSON 返回 null", () => {
  const root = makeRepo({ version: "9.9.9" });
  try {
    assert.equal(readPackageVersion({ root }), "9.9.9");
    fs.writeFileSync(path.join(root, "packages/content/package.json"), "{not json");
    assert.equal(readPackageVersion({ root }), null);
  } finally {
    cleanup(root);
  }
});

test("readContentGitVersion：注入 git 输出解析为 12 位版本；失败返回 null", () => {
  const root = makeRepo();
  try {
    const ok = readContentGitVersion({
      root,
      gitExec: () => "2026-10-19T12:00:00+08:00\nabcdef123456\n",
    });
    assert.equal(ok.version, "abcdef123456");
    assert.equal(ok.source, "git");
    assert.equal(readContentGitVersion({ root, gitExec: () => { throw new Error("no git"); } }), null);
  } finally {
    cleanup(root);
  }
});

test("resolveRepoInfo：版本优先级 git > package > 指纹前 12 位", () => {
  const root = makeRepo({ version: "1.2.3" });
  try {
    const withGit = resolveRepoInfo({ root, gitExec: () => "2026-10-19T12:00:00+08:00\n1234567890ab\n" });
    assert.equal(withGit.version, "1234567890ab");
    assert.equal(withGit.versionSource, "git");
    assert.equal(withGit.packageVersion, "1.2.3");

    const noGit = resolveRepoInfo({ root });
    assert.equal(noGit.version, "1.2.3");
    assert.equal(noGit.versionSource, "package");

    const bare = resolveRepoInfo({ root, packageJson: "packages/content/missing.json" });
    assert.equal(bare.version, bare.fingerprintShort);
    assert.equal(bare.versionSource, "fingerprint");
  } finally {
    cleanup(root);
  }
});

test("pickDbMarkers：learning.content_version 优先，忽略 unknown，聚合多种来源", () => {
  const markers = pickDbMarkers({
    counts: { learning_questions: 10, content_topics: 3 },
    versionRows: {
      learning_tracks: [{ version: "abcdef123456", count: 5 }],
      learning_questions: [{ version: "abcdef123456", count: 10 }, { version: "unknown", count: 2 }],
      content_topics: [{ version: "fedcba654321", count: 3 }],
    },
    importBatches: [{ commitSha: "aaabbbcccddd", report: { contentVersion: "aaabbbcccddd" } }],
    appMeta: [{ key: "content_version", value: "zzz" }],
  });
  assert.equal(markers.version, "abcdef123456");
  assert.equal(markers.versionSource, "learning.content_version");
  assert.ok(markers.versions.includes("fedcba654321"));
  assert.ok(markers.versions.includes("aaabbbcccddd"));
  assert.equal(markers.contentRowCount, 13);
});

test("pickDbMarkers：没有 marker 时为 null；空库 contentRowCount=0", () => {
  const empty = pickDbMarkers({ counts: {} });
  assert.equal(empty.version, null);
  assert.equal(empty.contentRowCount, 0);

  const noMarker = pickDbMarkers({ counts: { content_topics: 5 }, versionRows: { content_topics: [{ version: "unknown", count: 5 }] } });
  assert.equal(noMarker.version, null);
  assert.equal(noMarker.contentRowCount, 5);
});

test("pickDbMarkers：repo 文件比 DB 最近内容新 → hints 带 repo-newer-than-db", () => {
  const markers = pickDbMarkers({
    counts: { content_topics: 5 },
    versionRows: { content_topics: [{ version: "abcdef123456", count: 5 }] },
    lastContentUpdatedAt: "2026-10-01T00:00:00.000Z",
    repoNewestMtimeMs: Date.parse("2026-10-19T00:00:00.000Z"),
  });
  assert.deepEqual(markers.hints, ["repo-newer-than-db"]);
});

test("pickDbMarkers：content_meta 最高优先级（覆盖 learning/content_topics 旧 marker）", () => {
  const markers = pickDbMarkers({
    counts: { learning_questions: 5 },
    contentMeta: [
      { key: "content_version", value: "abcdef123456" },
      { key: "content_fingerprint", value: "f".repeat(64) },
    ],
    versionRows: {
      learning_questions: [{ version: "999999999999", count: 5 }],
      content_topics: [{ version: "888888888888", count: 2 }],
    },
  });
  assert.equal(markers.version, "abcdef123456");
  assert.equal(markers.versionSource, "content_meta.content_version");
  // 有 content_meta 时不再混入低优先级来源（避免假 FRESH）
  assert.deepEqual(markers.versions, ["abcdef123456", "f".repeat(64)]);
  assert.ok(!markers.versions.includes("999999999999"));
});

test("content_meta 命中：版本一致 → FRESH；只有 fingerprint → 指纹命中 FRESH", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const byVersion = pickDbMarkers({ counts: { learning_questions: 1 }, contentMeta: [{ key: "content_version", value: "abcdef123456" }] });
  assert.equal(classifyFreshness({ repo, db: byVersion }).status, FRESHNESS.FRESH);

  const byFingerprint = pickDbMarkers({ counts: { learning_questions: 1 }, contentMeta: [{ key: "content_fingerprint", value: "f".repeat(64) }] });
  assert.equal(classifyFreshness({ repo, db: byFingerprint }).status, FRESHNESS.FRESH);
});

test("content_meta 优先级严格：meta 与 repo 不同，即使 learning 旧值与 repo 相同也判 STALE", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const db = pickDbMarkers({
    counts: { learning_questions: 5 },
    contentMeta: [{ key: "content_version", value: "111111111111" }],
    versionRows: { learning_questions: [{ version: "abcdef123456", count: 5 }] },
  });
  assert.equal(classifyFreshness({ repo, db }).status, FRESHNESS.STALE);
});

test("content_meta 值为 unknown/空时忽略，回落到 learning 版本", () => {
  const markers = pickDbMarkers({
    counts: { learning_questions: 3 },
    contentMeta: [{ key: "content_version", value: "unknown" }, { key: "content_fingerprint", value: "" }],
    versionRows: { learning_questions: [{ version: "abcdef123456", count: 3 }] },
  });
  assert.equal(markers.version, "abcdef123456");
  assert.equal(markers.versionSource, "learning.content_version");
});

test("classifyFreshness：版本一致 → FRESH", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const db = pickDbMarkers({ counts: { learning_questions: 3 }, versionRows: { learning_questions: [{ version: "abcdef123456", count: 3 }] } });
  const result = classifyFreshness({ repo, db });
  assert.equal(result.status, FRESHNESS.FRESH);
  assert.equal(result.reason, "version-match");
});

test("classifyFreshness：指纹命中（DB 存的是指纹）也算 FRESH", () => {
  const repo = { version: "0.2.0", versionSource: "package", fingerprint: "a".repeat(64), fingerprintShort: "aaaaaaaaaaaa", fileCount: 3 };
  const db = pickDbMarkers({ counts: { content_topics: 2 }, versionRows: { content_topics: [{ version: "aaaaaaaaaaaa", count: 2 }] } });
  assert.equal(classifyFreshness({ repo, db }).status, FRESHNESS.FRESH);
});

test("classifyFreshness：git 同语义但版本不同 → STALE", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const db = pickDbMarkers({ counts: { learning_questions: 3 }, versionRows: { learning_questions: [{ version: "111111111111", count: 3 }] } });
  const result = classifyFreshness({ repo, db });
  assert.equal(result.status, FRESHNESS.STALE);
  assert.equal(result.reason, "version-mismatch");
  assert.match(result.detail, /漂移/);
});

test("classifyFreshness：DB 不可达 / 空库 / 缺 marker → UNKNOWN（绝不假装通过）", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  assert.equal(classifyFreshness({ repo, db: { connected: false, error: "ECONNREFUSED" } }).status, FRESHNESS.UNKNOWN);
  assert.equal(classifyFreshness({ repo, db: { connected: false, error: "e" } }).reason, "db-unreachable");
  assert.equal(
    classifyFreshness({ repo, db: pickDbMarkers({ counts: {} }) }).reason,
    "db-empty"
  );
  assert.equal(
    classifyFreshness({ repo, db: pickDbMarkers({ counts: { content_topics: 5 } }) }).reason,
    "db-marker-missing"
  );
  assert.equal(classifyFreshness({ repo: null, db: null }).status, FRESHNESS.UNKNOWN);
});

test("classifyFreshness：语义不可比 → UNKNOWN（不误报 STALE）", () => {
  // 非版本 token
  const repo = { version: "0.2.0", versionSource: "package", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const db = pickDbMarkers({ counts: { content_topics: 2 }, versionRows: { content_topics: [{ version: "release-2026-10", count: 2 }] } });
  assert.equal(classifyFreshness({ repo, db }).status, FRESHNESS.UNKNOWN);
  assert.equal(classifyFreshness({ repo, db }).reason, "version-incomparable");

  // 仓库侧没有 git（退化为 package 版本），DB 是 git sha：语义不可比，不能误判 STALE
  const dbGit = pickDbMarkers({ counts: { learning_questions: 3 }, versionRows: { learning_questions: [{ version: "111111111111", count: 3 }] } });
  assert.equal(classifyFreshness({ repo, db: dbGit }).status, FRESHNESS.UNKNOWN);
  assert.equal(classifyFreshness({ repo, db: dbGit }).reason, "version-incomparable");
});

test("classifyFreshness：调试 overrides 可演示 FRESH/STALE", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3 };
  const db = pickDbMarkers({ counts: { content_topics: 2 }, versionRows: { content_topics: [{ version: "unknown", count: 2 }] } });
  assert.equal(classifyFreshness({ repo, db, overrides: { dbVersion: "abcdef123456" } }).status, FRESHNESS.FRESH);
  assert.equal(classifyFreshness({ repo, db, overrides: { repoVersion: "abcdef123456", dbVersion: "000000000000" } }).status, FRESHNESS.STALE);
});

test("formatMachineLine / buildReport / formatHumanReport：机读行与 JSON 含关键字段", () => {
  const repo = { version: "abcdef123456", versionSource: "git", fingerprint: "f".repeat(64), fingerprintShort: "ffffffffffff", fileCount: 3, contentDir: "packages/content/src/learning" };
  const db = { connected: true, version: "111111111111", versionSource: "content_topics.content_version", contentRowCount: 9, counts: { content_topics: 9 }, lastContentUpdatedAt: null, hints: [] };
  const result = { status: FRESHNESS.STALE, reason: "version-mismatch", detail: "d", hints: [] };

  const line = formatMachineLine({ repo, db, result });
  assert.match(line, /^CONTENT_FRESHNESS=STALE /);
  assert.match(line, /reason=version-mismatch/);
  assert.match(line, /repo_version=abcdef123456/);
  assert.match(line, /db_marker=111111111111/);
  assert.match(line, /db_rows=9/);

  const report = buildReport({ repo, db, result });
  assert.equal(report.status, "STALE");
  assert.equal(report.machineLine, line);
  assert.equal(report.repo.fileCount, 3);
  assert.equal(report.db.contentRowCount, 9);

  assert.match(formatHumanReport({ repo, db, result }), /判定：STALE/);
});

test("parseArgs：标志/值/等号形式", () => {
  const args = parseArgs([
    "--json", "--warn", "--allow-unknown", "--repo-only", "--db-only", "--help",
    "--root", "/tmp/x", "--content-dir=src/learning", "--package-json", "p.json",
    "--repo-version", "aaa", "--db-version=bbb",
  ]);
  assert.deepEqual(args, {
    json: true,
    warn: true,
    allowUnknown: true,
    repoOnly: true,
    dbOnly: true,
    help: true,
    root: "/tmp/x",
    contentDir: "src/learning",
    packageJson: "p.json",
    repoVersion: "aaa",
    dbVersion: "bbb",
  });
});

test("resolveExitCode：FRESH=0 / STALE=1 / UNKNOWN=2，--warn 与 --allow-unknown 放宽", () => {
  assert.equal(resolveExitCode(FRESHNESS.FRESH), 0);
  assert.equal(resolveExitCode(FRESHNESS.STALE), 1);
  assert.equal(resolveExitCode(FRESHNESS.UNKNOWN), 2);
  assert.equal(resolveExitCode(FRESHNESS.STALE, { warn: true }), 0);
  assert.equal(resolveExitCode(FRESHNESS.UNKNOWN, { allowUnknown: true }), 0);
  assert.equal(resolveExitCode(FRESHNESS.UNKNOWN, { warn: true, allowUnknown: true }), 0);
});
