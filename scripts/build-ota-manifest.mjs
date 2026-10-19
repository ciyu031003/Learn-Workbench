/**
 * 生成门户 OTA 清单 `mobile-update.json`（v11 起带 sizeBytes + sha256；S6-7 起带 Ed25519 签名/灰度/最低支持版本）。
 *
 * 用法：
 *   node scripts/build-ota-manifest.mjs --apk .local/accept/learn-workbench-v1.48.0.apk \
 *        --version 1.48.0 --code 81 --notes .local/release-notes-v1.48.0.txt \
 *        --key .local/ota-signing-key.pem [--out <门户路径>] [--rollout 10] [--min-supported-code 81]
 *   分 ABI 包（S3-7）：
 *   node scripts/build-ota-manifest.mjs --apk ...-v1.48.0-arm64-v8a.apk \
 *        --version 1.48.0 --code 81 --abi arm64-v8a --key <pem> [--out <json>]
 *
 * 干跑（不写文件；没给 --apk 时用 apps/mobile/app.json 的版本 + 占位数值）：
 *   node scripts/build-ota-manifest.mjs --dry-run
 *
 * ---- 签名密钥（S6-7）----
 * 私钥**绝不入库**：放发布机 .local/ota-signing-key.pem（.local/ 已 gitignore），
 * CI 用 Secret OTA_SIGNING_KEY_PEM（PEM 原文）或 OTA_SIGNING_KEY_PATH（路径）。
 * 首次生成 / 轮换：
 *   node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log('PUBLIC(raw32 base64url):',publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64url'));require('fs').writeFileSync('.local/ota-signing-key.pem',privateKey.export({type:'pkcs8',format:'pem'}))"
 * 把输出的 PUBLIC 写进 apps/mobile/src/lib/ota-public-key.ts（轮换时旧公钥进 PREVIOUS_PUBLIC_KEYS_BASE64URL 过渡）。
 *
 * 说明：
 *  - `--notes` 一行一条（`#` 开头是注释）；
 *  - 不传 `--out` 只打印 JSON（用于预览/核对），传了就直接写文件；
 *  - `--rollout` 0-100（默认 100 全量）；`--min-supported-code` 低于此 versionCode 强制升级；
 *  - sha256 用流式计算，67MB 包几百毫秒；
 *  - `--abi`：清单里的 apkUrl 会变成 learn-workbench-v<ver>-<abi>.apk 并附带 abi 字段。
 *    ⚠️ 应用内升级客户端只认一个 apkUrl、无法自选 ABI，所以 **mobile-update.json 仍应指向通用单包**
 *    （构建时用 -UniversalApk）；按 ABI 清单用于门户下载页或后续支持 ABI 自选的客户端。
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOtaManifest,
  publicKeyBase64UrlFromPrivate,
  readReleaseNotesFile,
  serializeOtaManifest,
  sha256OfFile,
  signOtaManifest,
  validateOtaManifest,
} from "./lib/ota-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_ABIS = ["arm64-v8a", "armeabi-v7a"];
const PLACEHOLDER_SHA256 = "0".repeat(64);

const USAGE = `用法：
  node scripts/build-ota-manifest.mjs --apk <apk> --version <x.y.z> --code <n> --key <private.pem>
       [--notes <notes.txt>] [--out <json>] [--abi arm64-v8a|armeabi-v7a]
       [--rollout 0-100] [--min-supported-code <n>] [--dry-run] [--help]

参数：
  --apk                  APK 路径（--dry-run 可省略）
  --version              versionName（如 1.48.0）
  --code                 versionCode（整数）
  --key                  Ed25519 私钥 PEM 路径（或 env OTA_SIGNING_KEY_PATH / OTA_SIGNING_KEY_PEM）
  --notes                release notes 文件（# 开头为注释）
  --out                  输出 mobile-update.json 路径（不给只打印）
  --abi                  分 ABI 包标记（apk 文件名必须包含 -<abi>）
  --rollout              灰度比例 0-100，默认 100
  --min-supported-code   低于此 versionCode 的客户端强制升级，默认 0（不强制）
  --dry-run              不写文件；缺参数用 app.json + 占位数值，打印清单与自检结果
  --help                 打印本帮助并退出

密钥（S6-7）：
  生成：node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log('PUBLIC:',publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64url'));require('fs').writeFileSync('.local/ota-signing-key.pem',privateKey.export({type:'pkcs8',format:'pem'}))"
  公钥写入 apps/mobile/src/lib/ota-public-key.ts；私钥只放发布机 .local/ 或 CI Secret，绝不入库。
  轮换：新公钥先随 App 发版（客户端同时信任新旧），再切私钥；下个版本再移除旧公钥。
`;

function parseArgs(argv) {
  const flags = new Set(["--help", "--dry-run"]);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    if (flags.has(arg)) {
      out[arg.slice(2)] = true;
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq > 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function readSigningKey(args) {
  const inline = process.env.OTA_SIGNING_KEY_PEM;
  if (inline && inline.includes("BEGIN")) return inline;
  const keyPath = args.key || process.env.OTA_SIGNING_KEY_PATH;
  if (keyPath) return readFile(keyPath, "utf8");
  return null;
}

async function defaultVersionFromAppJson() {
  let version = "0.0.0";
  let code = 0;
  try {
    const raw = await readFile(path.join(ROOT, "apps/mobile/app.json"), "utf8");
    const expo = JSON.parse(raw).expo ?? {};
    version = String(expo.version ?? version);
    code = Number(expo.android?.versionCode ?? 0);
  } catch {
    // app.json 不可读：继续用 ota.ts 兜底
  }
  // app.json 里不一定有 android.versionCode（本项目版本号事实源是 build.gradle/ota.ts），再读 ota.ts
  if (!Number.isInteger(code) || code <= 0) {
    try {
      const otaSource = await readFile(path.join(ROOT, "apps/mobile/src/lib/ota.ts"), "utf8");
      const match = otaSource.match(/APP_VERSION_CODE\s*=\s*(\d+)/);
      if (match) code = Number(match[1]);
    } catch {
      // 保持 0
    }
  }
  return { version, code };
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const dryRun = Boolean(args["dry-run"]);
const abi = args.abi ? String(args.abi).trim() : "";
if (abi && !ALLOWED_ABIS.includes(abi)) {
  console.error("非法 --abi：" + abi + "（可选：" + ALLOWED_ABIS.join(" / ") + "；不给 = 通用单包）");
  process.exit(1);
}

const appJsonDefaults = dryRun ? await defaultVersionFromAppJson() : null;
const versionName = args.version ?? appJsonDefaults?.version;
const versionCode = Number(args.code ?? appJsonDefaults?.code);
const rolloutPercent = args.rollout === undefined ? 100 : Number(args.rollout);
const minSupportedVersionCode = args["min-supported-code"] === undefined ? 0 : Number(args["min-supported-code"]);
const apk = args.apk;

if (!dryRun && (!apk || !versionName || !Number.isInteger(versionCode))) {
  console.error("缺少参数。\n\n" + USAGE);
  process.exit(1);
}
if (abi && apk && !apk.includes("-" + abi)) {
  console.error("--abi 与 --apk 文件名不匹配：期望文件名含 '-" + abi + "'，实际 " + path.basename(apk));
  process.exit(1);
}

let sizeBytes = 1;
let sha256 = PLACEHOLDER_SHA256;
if (apk) {
  const info = await stat(apk);
  sizeBytes = info.size;
  sha256 = await sha256OfFile(apk);
}

const releaseNotes = args.notes
  ? await readReleaseNotesFile(args.notes)
  : dryRun
    ? ["dry-run 占位说明"]
    : [];

const unsigned = buildOtaManifest({
  versionName: versionName ?? "0.0.0",
  versionCode: Number.isInteger(versionCode) ? versionCode : 0,
  sizeBytes,
  sha256,
  base: args.base,
  abi: abi || undefined,
  releaseNotes,
  rolloutPercent,
  minSupportedVersionCode,
});

const privateKeyPem = await readSigningKey(args);
let manifest = unsigned;
let publicKeyBase64Url = null;
if (privateKeyPem) {
  publicKeyBase64Url = publicKeyBase64UrlFromPrivate(privateKeyPem);
  manifest = signOtaManifest(unsigned, privateKeyPem);
} else if (!dryRun) {
  console.error(
    "缺少签名私钥：传 --key <private.pem>，或设置 env OTA_SIGNING_KEY_PATH / OTA_SIGNING_KEY_PEM。\n" +
      "（S6-7 起客户端对未签名清单会拒绝提示更新；没有私钥无法发布。）\n\n" +
      USAGE
  );
  process.exit(1);
} else {
  console.warn("[ota][WARN] --dry-run 未提供私钥：输出未签名清单（仅用于预览，不能发布）");
}

const problems = validateOtaManifest(manifest, {
  // dry-run 且没有 APK 时数值是占位，跳过与 APK 的一致性对比
  apkSizeBytes: apk ? sizeBytes : undefined,
  apkSha256: apk ? sha256 : undefined,
  publicKeyBase64Url: publicKeyBase64Url ?? undefined,
  requireSignature: Boolean(privateKeyPem),
});
if (problems.length > 0) {
  console.error("[ota][FAIL] 清单自检未通过：");
  for (const problem of problems) console.error("  - " + problem);
  if (!dryRun) process.exit(1);
}

const json = serializeOtaManifest(manifest);
if (args.out && !dryRun) {
  await writeFile(args.out, json, "utf8");
  console.log(`[ota] 已写入 ${path.resolve(args.out)}`);
}
if (publicKeyBase64Url) {
  console.log("[ota] 验签公钥（raw32 base64url，应与 ota-public-key.ts 一致）：" + publicKeyBase64Url);
}
if (dryRun) console.log("[ota] dry-run：未写文件");
console.log(json);
