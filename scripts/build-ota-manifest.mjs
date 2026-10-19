/**
 * 生成门户 OTA 清单 `mobile-update.json`（v11 起带 sizeBytes + sha256，供应用内升级校验）。
 *
 * 用法：
 *   node scripts/build-ota-manifest.mjs --apk .local/accept/learn-workbench-v1.10.0.apk \
 *        --version 1.10.0 --code 22 --notes .local/release-notes-v1.10.0.txt [--out <门户路径>]
 *   分 ABI 包（S3-7）：
 *   node scripts/build-ota-manifest.mjs --apk .local/accept/learn-workbench-v1.48.0-arm64-v8a.apk \
 *        --version 1.48.0 --code 81 --abi arm64-v8a --notes <notes.txt> [--out <json>]
 *
 * 说明：
 *  - `--notes` 一行一条（`#` 开头是注释）；
 *  - 不传 `--out` 只打印 JSON（用于预览/核对），传了就直接写文件；
 *  - sha256 用流式计算，67MB 包几百毫秒；
 *  - `--abi`：清单里的 apkUrl 会变成 learn-workbench-v<ver>-<abi>.apk 并附带 abi 字段。
 *    ⚠️ 当前应用内升级客户端只认一个 apkUrl、无法自选 ABI，所以 **mobile-update.json 仍应指向通用单包**
 *    （构建时用 -UniversalApk）；按 ABI 清单用于门户下载页或后续支持 ABI 自选的客户端。
 */
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildOtaManifest,
  readReleaseNotesFile,
  serializeOtaManifest,
  sha256OfFile,
} from "./lib/ota-manifest.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const apk = args.apk;
const versionName = args.version;
const versionCode = Number(args.code);
// S3-7：按 ABI 出清单（可选）。只做白名单校验，避免把任意字符串拼进下载文件名。
const abi = args.abi ? String(args.abi).trim() : "";
const ALLOWED_ABIS = ["arm64-v8a", "armeabi-v7a"];
if (abi && !ALLOWED_ABIS.includes(abi)) {
  console.error(
    "非法 --abi：" + abi + "（可选：" + ALLOWED_ABIS.join(" / ") + "；不给 = 通用单包）"
  );
  process.exit(1);
}
if (!apk || !versionName || !Number.isInteger(versionCode)) {
  console.error(
    "用法：node scripts/build-ota-manifest.mjs --apk <apk> --version 1.10.0 --code 22 [--abi arm64-v8a] --notes <notes.txt> [--out <json>]"
  );
  process.exit(1);
}
// 分 ABI 清单必须真的对着分 ABI 的包做，否则 apkUrl 会指向不存在的文件
if (abi && !apk.includes("-" + abi)) {
  console.error("--abi 与 --apk 文件名不匹配：期望文件名含 '-" + abi + "'，实际 " + path.basename(apk));
  process.exit(1);
}

const info = await stat(apk);
const sha256 = await sha256OfFile(apk);

const manifest = buildOtaManifest({
  versionName,
  versionCode,
  sizeBytes: info.size,
  sha256,
  base: args.base,
  abi: abi || undefined,
  releaseNotes: args.notes ? await readReleaseNotesFile(args.notes) : [],
});

const json = serializeOtaManifest(manifest);
if (args.out) {
  await writeFile(args.out, json, "utf8");
  console.log(`[ota] 已写入 ${path.resolve(args.out)}`);
}
console.log(json);
