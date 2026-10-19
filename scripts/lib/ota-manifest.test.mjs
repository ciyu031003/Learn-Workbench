import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  apkFileName,
  apkUrlFor,
  buildOtaManifest,
  canonicalOtaManifestJson,
  generateOtaKeyPair,
  parseReleaseNotes,
  publicKeyBase64UrlFromPrivate,
  serializeOtaManifest,
  sha256OfFile,
  signOtaManifest,
  validateOtaManifest,
  verifyOtaManifestSignature,
} from "./ota-manifest.mjs";

const sha = "a".repeat(64);
const APK_URL = "https://learn.yuanabd.cn/download/learn-workbench-v1.2.0.apk";

const baseManifest = (overrides = {}) => ({
  versionName: "1.2.0",
  versionCode: 8,
  apkUrl: APK_URL,
  sizeBytes: 700,
  sha256: sha,
  releaseNotes: ["新增市场分析工作台", "展示 App 备案信息"],
  publishedAt: "2026-09-11T00:00:00.000Z",
  rolloutPercent: 100,
  minSupportedVersionCode: 0,
  ...overrides,
});

test("parseReleaseNotes：一行一条，忽略空行与 # 注释，去首尾空格", () => {
  assert.deepEqual(parseReleaseNotes("# 注释\n\n  第一条  \n第二条\n   \n"), ["第一条", "第二条"]);
  assert.deepEqual(parseReleaseNotes(""), []);
});

test("canonical 签名对象与客户端 fixture 完全一致（字段顺序固定）", () => {
  // 这份期望字符串在 apps/mobile/src/lib/ota.test.ts 里逐字节相同
  assert.equal(
    canonicalOtaManifestJson(baseManifest()),
    '{"versionName":"1.2.0","versionCode":8,"apkUrl":"' +
      APK_URL +
      '","sizeBytes":700,"sha256":"' +
      sha +
      '","releaseNotes":["新增市场分析工作台","展示 App 备案信息"],"publishedAt":"2026-09-11T00:00:00.000Z","rolloutPercent":100,"minSupportedVersionCode":0}'
  );
  // signature / 未知字段不入签名；abi 有值才入
  const withExtra = baseManifest({ signature: "x", unknown: 1, abi: "arm64-v8a" });
  assert.match(canonicalOtaManifestJson(withExtra), /"abi":"arm64-v8a"/);
  assert.doesNotMatch(canonicalOtaManifestJson(withExtra), /signature|unknown/);
});

test("apkUrlFor 与文件名口径固定（门户 / nginx /download/ 路径）", () => {
  assert.equal(apkFileName("1.42.0"), "learn-workbench-v1.42.0.apk");
  assert.equal(apkUrlFor("1.42.0"), "https://learn.yuanabd.cn/download/learn-workbench-v1.42.0.apk");
  assert.equal(apkUrlFor("1.42.0", "https://example.test/"), "https://example.test/download/learn-workbench-v1.42.0.apk");
});

test("S3-7 ABI 拆分：apkFileName/apkUrlFor 支持按 ABI 命名", () => {
  assert.equal(apkFileName("1.48.0", "arm64-v8a"), "learn-workbench-v1.48.0-arm64-v8a.apk");
  assert.equal(apkFileName("1.48.0", "armeabi-v7a"), "learn-workbench-v1.48.0-armeabi-v7a.apk");
  assert.equal(
    apkUrlFor("1.48.0", "https://example.test/", "arm64-v8a"),
    "https://example.test/download/learn-workbench-v1.48.0-arm64-v8a.apk"
  );
});

test("S6-7 签名：node:crypto 签名 → 同一公钥验签；篡改/换钥都失败", () => {
  const { publicKeyBase64Url, privateKeyPem } = generateOtaKeyPair();
  const signed = signOtaManifest(baseManifest(), privateKeyPem);
  assert.equal(typeof signed.signature, "string");
  assert.equal(Buffer.from(signed.signature, "base64url").length, 64);
  assert.equal(verifyOtaManifestSignature(signed, publicKeyBase64Url), true);

  assert.equal(verifyOtaManifestSignature({ ...signed, versionCode: 9 }, publicKeyBase64Url), false);
  assert.equal(verifyOtaManifestSignature({ ...signed, releaseNotes: ["篡改"] }, publicKeyBase64Url), false);
  assert.equal(verifyOtaManifestSignature({ ...signed, signature: undefined }, publicKeyBase64Url), false);
  assert.equal(verifyOtaManifestSignature({ ...signed, signature: "AAAA" }, publicKeyBase64Url), false);

  const other = generateOtaKeyPair();
  assert.equal(verifyOtaManifestSignature(signed, other.publicKeyBase64Url), false);
  // 从私钥推导的公钥必须与生成时返回的一致（轮换时用它写 ota-public-key.ts）
  assert.equal(publicKeyBase64UrlFromPrivate(privateKeyPem), publicKeyBase64Url);
});

test("S6-7 validate：未签名/验签不符/灰度越界/最低版本非法都要拦下", () => {
  const { publicKeyBase64Url, privateKeyPem } = generateOtaKeyPair();
  const unsigned = baseManifest();
  assert.ok(validateOtaManifest(unsigned, { requireSignature: true }).some((p) => p.includes("缺少 signature")));

  const signed = signOtaManifest(unsigned, privateKeyPem);
  assert.deepEqual(
    validateOtaManifest(signed, { apkSizeBytes: 700, apkSha256: sha, publicKeyBase64Url, requireSignature: true }),
    []
  );

  const badRange = signOtaManifest(baseManifest({ rolloutPercent: 101, minSupportedVersionCode: -1 }), privateKeyPem);
  const problems = validateOtaManifest(badRange, { publicKeyBase64Url, requireSignature: true });
  assert.match(problems.join("\n"), /rolloutPercent 非法/);
  assert.match(problems.join("\n"), /minSupportedVersionCode 非法/);

  const wrongKey = generateOtaKeyPair().publicKeyBase64Url;
  const mismatch = validateOtaManifest(signed, { publicKeyBase64Url: wrongKey, requireSignature: true });
  assert.match(mismatch.join("\n"), /验签失败/);
});

test("S3-7 ABI 清单：带 abi 字段，且不破坏通用单包键集", () => {
  const abiManifest = buildOtaManifest({
    versionName: "1.48.0",
    versionCode: 81,
    sizeBytes: 100,
    sha256: sha,
    releaseNotes: ["a"],
    abi: "arm64-v8a",
    publishedAt: "2026-10-19T00:00:00.000Z",
  });
  assert.equal(abiManifest.abi, "arm64-v8a");
  assert.match(abiManifest.apkUrl, /-arm64-v8a\.apk$/);
  const universal = buildOtaManifest({ versionName: "1.48.0", versionCode: 81, sizeBytes: 100, sha256: sha, releaseNotes: ["a"] });
  assert.equal("abi" in universal, false);
});

test("buildOtaManifest：字段齐全（含 S6-7 灰度/最低版本），publishedAt 可显式指定", () => {
  const m = buildOtaManifest({
    versionName: "1.42.0",
    versionCode: 64,
    sizeBytes: 74313195,
    sha256: sha,
    releaseNotes: ["a"],
    rolloutPercent: 10,
    minSupportedVersionCode: 60,
    publishedAt: "2026-10-10T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(m), [
    "versionName",
    "versionCode",
    "apkUrl",
    "sizeBytes",
    "sha256",
    "releaseNotes",
    "publishedAt",
    "rolloutPercent",
    "minSupportedVersionCode",
  ]);
  assert.equal(m.rolloutPercent, 10);
  assert.equal(m.minSupportedVersionCode, 60);
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

test("validateOtaManifest：空说明 / 非法 code / 非 https / 缺灰度字段都拦下", () => {
  const bad = {
    versionName: "1.42",
    versionCode: 0,
    apkUrl: "http://x/a.apk",
    sizeBytes: -1,
    sha256: "zz",
    releaseNotes: [],
  };
  const problems = validateOtaManifest(bad);
  assert.equal(problems.length, 8);
  assert.match(problems.join("\n"), /versionName 非法/);
  assert.match(problems.join("\n"), /rolloutPercent 非法/);
  assert.match(problems.join("\n"), /minSupportedVersionCode 非法/);
  assert.match(problems.join("\n"), /releaseNotes 为空/);
});

test("sha256OfFile 与 node:crypto 一致（真实文件）", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "ota-"));
  const file = path.join(dir, "a.apk");
  await writeFile(file, "hello apk");
  const expected = createHash("sha256").update("hello apk").digest("hex");
  assert.equal(await sha256OfFile(file), expected);
});
