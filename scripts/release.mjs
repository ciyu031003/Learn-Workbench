#!/usr/bin/env node
/**
 * 一键发布（组一 · 阶段 4）。
 *
 * 背景：此前一轮发布的动作散在十几条手工命令里（改版本号 → 构建 APK → 算摘要 →
 * 生成 OTA 清单 → 改门户 download.html → 生成二维码 → scp → sudo cp → 三层回读），
 * 每一步都要"记得"改哪个数字、用哪个缓存键。看板里已经记过这类事故
 * （二维码扫到上一版、清单 sizeBytes 与 APK 不一致、门户残留旧版本号）。
 * 这个脚本把整条链路收成一条命令，并把每一步的**自检**写死在里面。
 *
 * 用法：
 *   node scripts/release.mjs --version 1.42.0 --code 64 --notes .local/release-notes-v1.42.0.txt
 *   # 追加：上传服务器 + 门户 + 三层回读
 *   node scripts/release.mjs --version 1.42.0 --code 64 --notes ... --publish
 *
 * 常用开关：
 *   --skip-build        复用已有 APK（默认从 .local/accept 找）
 *   --apk <path>        指定 APK
 *   --skip-portal       不写门户仓库（只出 APK + OTA 清单）
 *   --portal-dir <dir>  门户仓库路径（默认 ../YuanAbd-Web）
 *   --host <ssh 目标>   服务器（默认 ubuntu@106.55.2.197）
 *   --size-warn-mb <n>  体积告警阈值，默认 90（**只告警不阻断**，见下）
 *   --check-only        只做版本一致性与产物核对，不写文件、不构建、不上传
 *   --dry-run           构建与改写都跳过，只打印将要做什么
 *   --skip-ci-check     越过 CI 绿灯前置（红灯/未运行时放行；需在看板说明原因）
 *   --require-ci-green  gh 不可用时也阻断（离线环境的强口径）
 *
 * 体积口径（本轮调整）：安装包不再以 70MB 为硬阈值。体积超过 `--size-warn-mb`
 * 时只打印 WARN 并把数字记进发布小结；只有"清单与 APK 不一致"这类**完整性**问题才阻断。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOtaManifest,
  readReleaseNotesFile,
  serializeOtaManifest,
  sha256OfFile,
  signOtaManifest,
  validateOtaManifest,
  verifyOtaManifestSignature,
} from "./lib/ota-manifest.mjs";
import { decodeQrPng, renderQrPng } from "./lib/qr-png.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_HOST = "ubuntu@106.55.2.197";
const DEFAULT_SIZE_WARN_MB = 90;

/** 上一版线上清单的 minSupportedVersionCode（强制升级门槛的策略连续性，v1.51.0 教训：漏传退到 0） */
async function fetchLastLiveMinSupported() {
  try {
    const { execFileSync } = await import("node:child_process");
    const raw = execFileSync("curl", ["-sS", "-m", "20", "https://learn.yuanabd.cn/mobile-update.json"], {
      encoding: "utf8",
    });
    const value = Number(JSON.parse(raw).minSupportedVersionCode);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- 参数与输出
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const warnings = [];
const steps = [];
/** 只读模式（--check-only / --dry-run）下**绝不写任何文件**：门户与 .local 都必须保持原样 */
const readOnly = Boolean(args["check-only"]) || Boolean(args["dry-run"]);

const log = (msg) => console.log(msg);
const step = (msg) => {
  steps.push(msg);
  log("\n=== " + msg + " ===");
};
const warn = (msg) => {
  warnings.push(msg);
  log("[warn] " + msg);
};
function fail(msg) {
  console.error("\n[release] 失败：" + msg);
  process.exit(1);
}

function sh(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", ...opts });
  if (res.status !== 0) fail(`${cmd} ${cmdArgs.join(" ")} 退出码 ${res.status}`);
}

// ---------------------------------------------------------------- 版本一致性
async function readCurrentVersion() {
  const otaSrc = await readFile(path.join(ROOT, "apps/mobile/src/lib/ota.ts"), "utf8");
  const name = /APP_VERSION_NAME\s*=\s*"([^"]+)"/.exec(otaSrc)?.[1];
  const code = Number(/APP_VERSION_CODE\s*=\s*(\d+)/.exec(otaSrc)?.[1]);
  const appJson = JSON.parse(await readFile(path.join(ROOT, "apps/mobile/app.json"), "utf8"));
  const pkg = JSON.parse(await readFile(path.join(ROOT, "apps/mobile/package.json"), "utf8"));
  const gradle = await readFile(path.join(ROOT, "apps/mobile/android/app/build.gradle"), "utf8");
  return {
    ota: { name, code },
    appJson: appJson.expo?.version,
    packageJson: pkg.version,
    gradleName: /versionName\s+"([^"]+)"/.exec(gradle)?.[1],
    gradleCode: Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]),
  };
}

let version = args.version ? String(args.version) : null;
let code = args.code ? Number(args.code) : null;
if (!args["check-only"]) {
  if (!version || !Number.isInteger(code)) fail("必须提供 --version x.y.z 与 --code <整数>");
}

step("1/6 版本一致性（单一事实源：ota.ts / app.json / package.json / build.gradle）");
const current = await readCurrentVersion();
log(JSON.stringify(current));
// check-only：没给版本号就按工作区当前版本核对，方便发版前先看一眼产物
if (args["check-only"] && !version) {
  version = current.ota.name ?? null;
  code = current.ota.code ?? null;
}
if (version) {
  const mismatch = [];
  if (current.ota.name !== version) mismatch.push(`ota.ts=${current.ota.name}`);
  if (current.ota.code !== code) mismatch.push(`ota.ts code=${current.ota.code}`);
  if (current.appJson !== version) mismatch.push(`app.json=${current.appJson}`);
  if (current.packageJson !== version) mismatch.push(`package.json=${current.packageJson}`);
  if (current.gradleName !== version) mismatch.push(`build.gradle=${current.gradleName}`);
  if (current.gradleCode !== code) mismatch.push(`build.gradle code=${current.gradleCode}`);
  if (mismatch.length) {
    fail(
      `工作区的版本号与 --version ${version} / --code ${code} 不一致（${mismatch.join(", ")}）。\n` +
        "       先同步版本号（参考 scripts/build-android-release.ps1 的同步逻辑）再发布。"
    );
  }
}

// ---------------------------------------------------------------- CI 绿灯前置（评审 2026-10-31 流程规矩）
// 背景：v1.50.0 是在依赖门禁与 motion 门禁红灯期间发的版。发布前必须确认该 commit 的 CI 绿：
//  - gh CLI 可用：查 main 上该 commit 的 CI run 结论，红/运行中 → 阻断（--skip-ci-check 越过，需在看板说明）；
//  - gh 不可用（离线环境）：打印人工确认提醒并继续；--require-ci-green 时改为阻断。
step("1.5/6 CI 绿灯检查（当前 commit 的 main CI 运行）");
{
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const gh = spawnSync(
    "gh",
    ["run", "list", "--branch", "main", "--limit", "20", "--json", "headSha,status,conclusion,name"],
    { encoding: "utf8" }
  );
  if (gh.error || gh.status !== 0) {
    const why = gh.error ? String(gh.error.message ?? gh.error) : String(gh.stderr ?? `gh 退出码 ${gh.status}`).slice(0, 200);
    const msg =
      `无法自动确认 CI 状态（gh 不可用：${why}）。\n` +
      "       请人工确认 https://github.com/ciyu031003/Learn-Workbench/actions 该 commit 为绿后继续。";
    if (args["require-ci-green"]) fail(msg);
    warn(msg + "（加 --require-ci-green 可让此提醒变为阻断）");
  } else {
    let runs = [];
    try {
      runs = JSON.parse(gh.stdout || "[]");
    } catch {
      fail("gh run list 输出无法解析，请手动确认 CI 状态");
    }
    const run = runs.find((r) => r.headSha === headSha && r.name === "CI");
    if (!run) {
      const msg = `当前 commit ${headSha.slice(0, 8)} 尚无 CI 运行记录（push 后等 CI 出结果再发布）。`;
      if (args["skip-ci-check"]) warn(msg + "（--skip-ci-check 已越过）");
      else fail(msg);
    } else if (run.status !== "completed") {
      const msg = `CI 仍在运行（${run.status}），等它出结果再发布。`;
      if (args["skip-ci-check"]) warn(msg + "（--skip-ci-check 已越过）");
      else fail(msg);
    } else if (run.conclusion !== "success") {
      const msg = `CI 结论为 ${run.conclusion}——红灯期间禁止发版（v1.50.0 教训）。`;
      if (args["skip-ci-check"]) warn(msg + "（--skip-ci-check 已越过）");
      else fail(msg);
    } else {
      log("CI 绿灯 ✔");
    }
  }
}

// ---------------------------------------------------------------- APK
const apkPath = args.apk ? path.resolve(String(args.apk)) : version ? path.join(ROOT, ".local/accept", `learn-workbench-v${version}.apk`) : null;

if (!args["check-only"] && !args["dry-run"] && !args["skip-build"]) {
  step("2/6 构建 APK（scripts/build-android-release.ps1）");
  const ps = process.platform === "win32" ? "powershell.exe" : "pwsh";
  sh(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/build-android-release.ps1", "-VersionName", String(version), "-VersionCode", String(code)]);
} else {
  step("2/6 构建 APK（已跳过）");
}

if (!apkPath || !existsSync(apkPath)) {
  if (args["check-only"] || args["dry-run"]) {
    log("[info] 未找到 APK（check-only / dry-run 下允许），后续产物步骤跳过");
    process.exit(0);
  }
  fail(`找不到 APK：${apkPath}（用 --apk 指定，或去掉 --skip-build 重新构建）`);
}

step("3/6 产物摘要与体积口径");
const apkStat = await stat(apkPath);
const apkSha = await sha256OfFile(apkPath);
const apkMd5 = createHash("md5").update(await readFile(apkPath)).digest("hex");
log(`APK       ${apkPath}`);
log(`字节      ${apkStat.size}（${(apkStat.size / 1024 / 1024).toFixed(1)} MB）`);
log(`MD5       ${apkMd5}`);
log(`SHA256    ${apkSha}`);
const sizeWarnMb = Number(args["size-warn-mb"] ?? DEFAULT_SIZE_WARN_MB);
if (apkStat.size > sizeWarnMb * 1024 * 1024) {
  warn(`体积 ${(apkStat.size / 1024 / 1024).toFixed(1)} MB 超过告警阈值 ${sizeWarnMb} MB（**不阻断**，按新口径只记录）`);
}

// ---------------------------------------------------------------- OTA 清单
const localDir = path.join(ROOT, ".local");
await mkdir(localDir, { recursive: true });

step("4/6 生成 OTA 清单");
// 说明文件优先用 --notes，否则自动找 .local/release-notes-v<版本>.txt（发布习惯的固定位置）
const autoNotes = version ? path.join(localDir, `release-notes-v${version}.txt`) : null;
const notesFile = args.notes ? path.resolve(String(args.notes)) : autoNotes && existsSync(autoNotes) ? autoNotes : null;
const releaseNotes = notesFile ? await readReleaseNotesFile(notesFile) : [];
if (!notesFile) warn("未提供 --notes，也没有找到 .local/release-notes-v<版本>.txt：本次升级说明为空");
let manifest = buildOtaManifest({
  versionName: version,
  versionCode: code,
  sizeBytes: apkStat.size,
  sha256: apkSha,
  releaseNotes,
  // 强制升级门槛：默认沿用上一版线上清单的 minSupportedVersionCode（策略连续），
  // 可用 --min-supported-code 覆盖。漏掉会退到 0（不强制），老设备只收普通升级提示。
  minSupportedVersionCode: args["min-supported-code"]
    ? Number(args["min-supported-code"])
    : await fetchLastLiveMinSupported(),
});
// S6-7：客户端对清单验签 fail-closed（无 signature 直接拒绝提示更新）。
// 签名私钥解析顺序：env OTA_SIGNING_KEY_PEM > OTA_SIGNING_KEY_PATH > 发布机默认 .local/ota-signing-key.pem。
// 拿不到私钥时 fail-closed 阻断发布（发出未签名清单 = 所有已安装用户收不到更新，v1.49 之前踩过）。
const signingKeyPem =
  (process.env.OTA_SIGNING_KEY_PEM && process.env.OTA_SIGNING_KEY_PEM.includes("BEGIN")
    ? process.env.OTA_SIGNING_KEY_PEM
    : undefined) ??
  (process.env.OTA_SIGNING_KEY_PATH
    ? await import("node:fs/promises").then((m) => m.readFile(process.env.OTA_SIGNING_KEY_PATH, "utf8"))
    : undefined) ??
  (existsSync(path.join(localDir, "ota-signing-key.pem"))
    ? await import("node:fs/promises").then((m) => m.readFile(path.join(localDir, "ota-signing-key.pem"), "utf8"))
    : undefined);
if (!signingKeyPem) {
  fail(
    "缺少 OTA 签名私钥：设置 OTA_SIGNING_KEY_PEM / OTA_SIGNING_KEY_PATH，或把 PKCS#8 PEM 放到 .local/ota-signing-key.pem。" +
      "未签名清单会被客户端拒绝（fail-closed），不允许发布。"
  );
}
manifest = signOtaManifest(manifest, signingKeyPem);
log("OTA 清单已用内置公钥对应的私钥签名 ✔");
const manifestProblems = validateOtaManifest(manifest, {
  apkSizeBytes: apkStat.size,
  apkSha256: apkSha,
  requireSignature: true,
  // 与 apps/mobile/src/lib/ota-public-key.ts 的内置公钥一致性自检（错私钥当场拦下）
  publicKeyBase64Url: "0l-hdEqgHGotMZNGY5XRc7ZAJmiQEgLn3yri90ROmm0",
});
if (manifestProblems.length) {
  if (args["check-only"]) {
    for (const p of manifestProblems) warn("清单自检：" + p);
  } else {
    fail("OTA 清单自检未通过：\n  - " + manifestProblems.join("\n  - "));
  }
}
log(serializeOtaManifest(manifest));

const otaOut = path.join(localDir, `tmp-ota-v${String(version).replace(/\./g, "")}.json`);
if (!readOnly) {
  await writeFile(otaOut, serializeOtaManifest(manifest), "utf8");
  log(`已写入 ${path.relative(ROOT, otaOut)}`);
}

// ---------------------------------------------------------------- 门户
const portalDir = args["portal-dir"] ? path.resolve(String(args["portal-dir"])) : path.resolve(ROOT, "../YuanAbd-Web");
const skipPortal = Boolean(args["skip-portal"]) || !existsSync(path.join(portalDir, "demo/download.html"));

step("5/6 门户（download.html / mobile-update.json / 二维码）");
if (skipPortal) {
  if (args["portal-dir"]) fail(`门户目录不可用：${portalDir}`);
  log("[info] 未发现门户仓库，已跳过（可用 --portal-dir 指定）");
} else {
  const htmlPath = path.join(portalDir, "demo/download.html");
  const otaPath = path.join(portalDir, "demo/mobile-update.json");
  const qrPath = path.join(portalDir, "demo/img/learn-download-qr.png");

  const htmlBefore = await readFile(htmlPath, "utf8");
  const previousVersion = /learn-workbench-v(\d+\.\d+\.\d+)\.apk/.exec(htmlBefore)?.[1] ?? null;
  const keyMatch = /learn-download-qr\.png\?v=([0-9a-z]+)/.exec(htmlBefore);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let qrKey = today + "a";
  if (keyMatch) {
    const prev = keyMatch[1];
    qrKey = prev.startsWith(today) ? today + String.fromCharCode(prev.charCodeAt(prev.length - 1) + 1) : today + "a";
  }

  const alreadyCurrent = previousVersion === String(version);
  let htmlAfter = htmlBefore;
  if (previousVersion && !alreadyCurrent) htmlAfter = htmlAfter.replaceAll(previousVersion, String(version));
  htmlAfter = keyMatch ? htmlAfter.replaceAll(keyMatch[0], `learn-download-qr.png?v=${qrKey}`) : htmlAfter;

  if (htmlAfter.includes(`learn-workbench-v${version}.apk`) === false) {
    fail(`门户 download.html 改写失败：没有出现 v${version} 的下载地址`);
  }
  const residual =
    previousVersion && !alreadyCurrent
      ? (htmlAfter.match(new RegExp(`v${previousVersion.replace(/\./g, "\\.")}`, "g")) ?? []).length
      : 0;
  if (residual > 0) fail(`门户 download.html 仍残留旧版本 v${previousVersion} 共 ${residual} 处`);
  if (alreadyCurrent) log(`门户已经是 v${version}（幂等重发）：只刷新二维码缓存键 → ${qrKey}`);

  const qrPng = renderQrPng(manifest.apkUrl);
  const decodedFromNewQr = decodeQrPng(qrPng);
  if (decodedFromNewQr !== manifest.apkUrl) fail(`新生成的二维码解码不一致：${decodedFromNewQr}`);

  if (readOnly) {
    log(`[${args["check-only"] ? "check-only" : "dry-run"}] 将把门户从 v${previousVersion ?? "?"} 改到 v${version}，二维码缓存键 → ${qrKey}（未写入）`);
  } else {
    await writeFile(htmlPath, htmlAfter, "utf8");
    await writeFile(otaPath, serializeOtaManifest(manifest), "utf8");
    await writeFile(qrPath, qrPng);
    log(`门户已更新：v${previousVersion ?? "?"} → v${version}；二维码缓存键 ${qrKey}`);
    log(`download.html 中新版本出现 ${(htmlAfter.match(new RegExp(`v${version.replace(/\./g, "\\.")}`, "g")) ?? []).length} 处`);
  }
}

// ---------------------------------------------------------------- 发布
step("6/6 发布到服务器 + 公网回读");
if (!args.publish) {
  log("[info] 未传 --publish：本地产物与门户已就绪，未上传。");
} else if (readOnly) {
  log("[read-only] 跳过上传（--check-only / --dry-run 永不发布）。");
} else {
  const host = String(args.host ?? DEFAULT_HOST);
  const tmp = `/tmp/lwb${String(version).replace(/\./g, "")}`;
  const remote = [
    "set -euo pipefail",
    `RELEASES=/data/learn-workbench/releases`,
    `LANDING=/data/learn-workbench/landing`,
    `echo "--- COSFS 写探测（发布门禁）---"`,
    `df -h / | awk 'NR==1||NR==2'`,
    `dd if=/dev/zero of=/data/learn-workbench/.write-probe bs=1M count=80 2>/dev/null`,
    `sync`,
    `test "$(stat -c%s /data/learn-workbench/.write-probe)" -eq 83886080`,
    `rm -f /data/learn-workbench/.write-probe`,
    `sudo mkdir -p "$RELEASES" "$LANDING/img"`,
    `test "$(sha256sum ${tmp}.apk | cut -d' ' -f1)" = "${apkSha}"`,
    `sudo cp ${tmp}.apk "$RELEASES/learn-workbench-v${version}.apk"`,
    `sudo cp ${tmp}-download.html "$LANDING/download.html"`,
    `sudo cp ${tmp}-mobile-update.json "$LANDING/mobile-update.json"`,
    `sudo cp ${tmp}-qr.png "$LANDING/img/learn-download-qr.png"`,
    `rm -f ${tmp}.apk ${tmp}-download.html ${tmp}-mobile-update.json ${tmp}-qr.png`,
    `sync`,
    `sha256sum "$RELEASES/learn-workbench-v${version}.apk" "$LANDING/mobile-update.json" "$LANDING/img/learn-download-qr.png"`,
  ].join("\n");

  const staging = [
    { src: apkPath, dst: `${tmp}.apk` },
    { src: path.join(portalDir, "demo/download.html"), dst: `${tmp}-download.html` },
    { src: path.join(portalDir, "demo/mobile-update.json"), dst: `${tmp}-mobile-update.json` },
    { src: path.join(portalDir, "demo/img/learn-download-qr.png"), dst: `${tmp}-qr.png` },
  ];
  if (skipPortal) fail("--publish 需要门户文件（download.html / mobile-update.json / 二维码），但门户被跳过了");

  log("上传产物 …");
  for (const s of staging) {
    sh("scp", ["-o", "BatchMode=yes", s.src, `${host}:${s.dst}`]);
  }
  const remoteScript = path.join(localDir, `publish-v${String(version).replace(/\./g, "")}.sh`);
  await writeFile(remoteScript, remote + "\n", "utf8");
  const sshRes = spawnSync("ssh", ["-o", "BatchMode=yes", host, "bash -s"], {
    input: remote + "\n",
    cwd: ROOT,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (sshRes.status !== 0) fail(`远端发布脚本退出码 ${sshRes.status}`);
  log(`已发布（远端脚本留档：${path.relative(ROOT, remoteScript)}）`);

  log("公网回读 …");
  const headOut = execFileSync("curl", ["-sSI", "-m", "60", manifest.apkUrl], { encoding: "utf8" });
  const status = /HTTP\/[\d.]+ (\d+)/.exec(headOut)?.[1];
  const length = /content-length:\s*(\d+)/i.exec(headOut)?.[1];
  const ranges = /accept-ranges:\s*(\S+)/i.exec(headOut)?.[1];
  log(`APK ${status} / Content-Length ${length} / Accept-Ranges ${ranges}`);
  if (status !== "200") fail(`公网 APK 返回 ${status}`);
  if (Number(length) !== manifest.sizeBytes) fail(`公网 Content-Length ${length} 与清单 ${manifest.sizeBytes} 不一致`);

  const liveManifest = JSON.parse(execFileSync("curl", ["-sS", "-m", "60", "https://learn.yuanabd.cn/mobile-update.json"], { encoding: "utf8" }));
  if (liveManifest.versionName !== manifest.versionName || liveManifest.versionCode !== manifest.versionCode) {
    fail(`线上 mobile-update.json 是 ${liveManifest.versionName}/${liveManifest.versionCode}，期望 ${manifest.versionName}/${manifest.versionCode}`);
  }
  log(`线上 OTA：${liveManifest.versionName}/${liveManifest.versionCode}，${liveManifest.releaseNotes.length} 条说明`);
}

// ---------------------------------------------------------------- 小结
log("\n=== 发布小结 ===");
for (const s of steps) log("  · " + s);
if (warnings.length) {
  log("  告警：");
  for (const w of warnings) log("    - " + w);
}
if (version) {
  log("\n后续（必须人工完成）：");
  log("  1. 提交并推送代码，打 tag：" + `git tag -a v${version} -m "v${version}" && git push origin main v${version}`);
  log("  2. 门户仓库提交（download.html / mobile-update.json / 二维码）并推送");
  log("  3. 更新本地 docs/改动记录与任务看板.md 的发布取证表（仅本地，不入 Git）");
}
