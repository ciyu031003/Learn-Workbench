import assert from "node:assert/strict";
import test from "node:test";
import {
  apkFileName,
  apkUrlFor,
  buildOtaManifest,
  parseReleaseNotes,
  serializeOtaManifest,
  validateOtaManifest,
} from "./ota-manifest.mjs";

const sha = "a".repeat(64);

test("parseReleaseNotes：一行一条，忽略空行与 # 注释，去首尾空格", () => {
  assert.deepEqual(parseReleaseNotes("# 注释\n\n  第一条  \n第二条\n   \n"), ["第一条", "第二条"]);
  assert.deepEqual(parseReleaseNotes(""), []);
});

test("apkUrlFor 与文件名口径固定（门户 / nginx /download/ 路径）", () => {
  assert.equal(apkFileName("1.42.0"), "learn-workbench-v1.42.0.apk");
  assert.equal(apkUrlFor("1.42.0"), "https://learn.yuanabd.cn/download/learn-workbench-v1.42.0.apk");
  assert.equal(apkUrlFor("1.42.0", "https://example.test/"), "https://example.test/download/learn-workbench-v1.42.0.apk");
});

test("buildOtaManifest：字段齐全，publishedAt 可显式指定", () => {
  const m = buildOtaManifest({
    versionName: "1.42.0",
    versionCode: 64,
    sizeBytes: 74313195,
    sha256: sha,
    releaseNotes: ["a"],
    publishedAt: "2026-10-10T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(m), ["versionName", "versionCode", "apkUrl", "sizeBytes", "sha256", "releaseNotes", "publishedAt"]);
  assert.equal(m.versionCode, 64);
  assert.equal(m.publishedAt, "2026-10-10T00:00:00.000Z");
  assert.match(serializeOtaManifest(m), /"versionCode": 64/);
});

test("validateOtaManifest：清单与 APK 不一致必须报错（这是完整性门槛）", () => {
  const m = buildOtaManifest({ versionName: "1.42.0", versionCode: 64, sizeBytes: 100, sha256: sha, releaseNotes: ["a"] });
  assert.deepEqual(validateOtaManifest(m, { apkSizeBytes: 100, apkSha256: sha }), []);

  const mismatched = validateOtaManifest(m, { apkSizeBytes: 999, apkSha256: "b".repeat(64) });
  assert.equal(mismatched.length, 2);
  assert.match(mismatched.join("\n"), /sizeBytes 与 APK 不一致/);
  assert.match(mismatched.join("\n"), /sha256 与 APK 不一致/);
});

test("validateOtaManifest：空说明 / 非法 code / 非 https 都拦下", () => {
  const bad = { versionName: "1.42", versionCode: 0, apkUrl: "http://x/a.apk", sizeBytes: -1, sha256: "zz", releaseNotes: [] };
  const problems = validateOtaManifest(bad);
  assert.equal(problems.length, 6);
  assert.match(problems.join("\n"), /versionName 非法/);
  assert.match(problems.join("\n"), /releaseNotes 为空/);
});
