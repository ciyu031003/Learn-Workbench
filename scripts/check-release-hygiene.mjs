#!/usr/bin/env node
/**
 * 发布卫生闸门（v1.34.0，2026-10-07 评审后新增）。
 *
 * 起因：v1.32.0 → v1.33.0 四个**已上线**版本的源码，在本地工作区躺了整整一周没进 git
 * （HEAD 停在 v1.31.0/50），而同一时间线上还有一次"新会话不知道从哪开始"的困惑。
 * 这类问题的成本远高于它想省下的几秒钟，所以固化成一条可执行的检查：
 *
 *   node scripts/check-release-hygiene.mjs
 *
 * FAIL（退出码 1）：
 *   1. ota.ts 的 APP_VERSION_NAME / APP_VERSION_CODE 与 app.json / build.gradle 不一致；
 *   2. 当前版本号 **大于最新 git tag**，但工作区有未提交改动  → 说明"已发版但没提交"；
 *   3. 当前版本号大于最新 tag，但有提交没推到 origin/main  → 说明"提交没落地到远端"。
 * WARN（不失败）：
 *   4. 版本号等于最新 tag 但工作区脏（发布后跟进改动，正常）；
 *   5. 有未推送提交（未发版时也值得提醒）。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const fail = [];
const warn = [];
const info = [];

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function parseSemver(text) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if ((a?.[i] ?? 0) !== (b?.[i] ?? 0)) return (a?.[i] ?? 0) - (b?.[i] ?? 0);
  }
  return 0;
}

// ---------- 1. 版本号单一事实源核对 ----------
const otaSrc = readFileSync(path.join(ROOT, "apps/mobile/src/lib/ota.ts"), "utf8");
const otaName = /APP_VERSION_NAME\s*=\s*"([^"]+)"/.exec(otaSrc)?.[1] ?? "";
const otaCode = Number(/APP_VERSION_CODE\s*=\s*(\d+)/.exec(otaSrc)?.[1] ?? NaN);
const appJson = JSON.parse(readFileSync(path.join(ROOT, "apps/mobile/app.json"), "utf8"));
const appName = appJson?.expo?.version ?? "";
info.push("ota.ts: " + otaName + " / " + otaCode + " | app.json: " + appName);
if (otaName !== appName) fail.push("版本号漂移：ota.ts=" + otaName + " 与 app.json=" + appName + " 不一致");
if (!Number.isFinite(otaCode)) fail.push("ota.ts 的 APP_VERSION_CODE 解析失败");

const gradlePath = path.join(ROOT, "apps/mobile/android/app/build.gradle");
if (existsSync(gradlePath)) {
  const g = readFileSync(gradlePath, "utf8");
  const gName = /versionName\s+"([^"]+)"/.exec(g)?.[1] ?? "";
  const gCode = Number(/versionCode\s+(\d+)/.exec(g)?.[1] ?? NaN);
  info.push("build.gradle: " + (gName || "(解析不到)") + " / " + (Number.isFinite(gCode) ? gCode : "(解析不到)"));
  // v1.35.0：文件存在却解析不到 = 被改坏，必须硬失败（旧实现静默跳过，检查形同虚设）
  if (!gName) fail.push("build.gradle 里解析不到 versionName（文件被改坏？android/ 不进 git，prebuild 后需重新注入版本号）");
  if (!Number.isFinite(gCode)) fail.push("build.gradle 里解析不到 versionCode（文件被改坏？）");
  if (gName && gName !== otaName) fail.push("版本号漂移：build.gradle=" + gName + " 与 ota.ts=" + otaName + " 不一致");
  if (Number.isFinite(gCode) && Number.isFinite(otaCode) && gCode !== otaCode) {
    fail.push("versionCode 漂移：build.gradle=" + gCode + " 与 ota.ts=" + otaCode + " 不一致");
  }
}

// ---------- 2. 最新 tag / 工作区 / 远端 ----------
const tags = git(["tag", "--list", "v*"])
  .split("\n")
  .map((t) => t.trim())
  .filter(Boolean)
  .map((t) => ({ tag: t, v: parseSemver(t.replace(/^v/, "")) }))
  .filter((t) => t.v);
tags.sort((a, b) => cmp(a.v, b.v));
const latest = tags[tags.length - 1] ?? null;
info.push("最新 tag: " + (latest ? latest.tag : "(无)"));

const dirty = git(["status", "--porcelain"]).split("\n").filter(Boolean);
const ahead = git(["rev-list", "--count", "origin/main..HEAD"]);
const behind = git(["rev-list", "--count", "HEAD..origin/main"]);
info.push("工作区: " + (dirty.length ? dirty.length + " 处未提交" : "干净") + " | origin/main: ahead " + (ahead || "?") + " / behind " + (behind || "?"));

const current = parseSemver(otaName);
const newerThanTag = current && latest ? cmp(current, latest.v) > 0 : false;

if (newerThanTag && dirty.length > 0) {
  fail.push(
    "已发版但没提交：ota.ts 版本 " + otaName + " > 最新 tag " + latest.tag + "，而工作区还有 " +
      dirty.length + " 处未提交改动（参考事故：v1.32.0–v1.33.0 四个线上版本躺了一周）"
  );
}
if (newerThanTag && Number(ahead) > 0) {
  fail.push("已发版但没推到远端：有 " + ahead + " 个提交未 push（origin/main 落后）");
}
if (!newerThanTag && dirty.length > 0) {
  warn.push("工作区有 " + dirty.length + " 处未提交改动（版本号 == 最新 tag，属发布后跟进，记得提交）");
}
if (Number(ahead) > 0 && !newerThanTag) warn.push("有 " + ahead + " 个提交未 push");
if (Number(behind) > 0) warn.push("origin/main 领先本地 " + behind + " 个提交，先 fetch/rebase 再推送");

// ---------- 输出 ----------
for (const line of info) console.log("[hygiene] " + line);
for (const line of warn) console.log("[hygiene][WARN] " + line);
for (const line of fail) console.log("[hygiene][FAIL] " + line);
if (fail.length > 0) {
  console.log("[hygiene] 发布卫生检查未通过（" + fail.length + " 项）");
  process.exit(1);
}
console.log("[hygiene] 通过：版本号一致、发布版已进 git、远端不落后");
