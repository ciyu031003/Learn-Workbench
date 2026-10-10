/**
 * 生成门户 OTA 清单 `mobile-update.json`（v11 起带 sizeBytes + sha256，供应用内升级校验）。
 *
 * 用法：
 *   node scripts/build-ota-manifest.mjs --apk .local/accept/learn-workbench-v1.10.0.apk \
 *        --version 1.10.0 --code 22 --notes .local/release-notes-v1.10.0.txt [--out <门户路径>]
 *
 * 说明：
 *  - `--notes` 一行一条（`#` 开头是注释）；
 *  - 不传 `--out` 只打印 JSON（用于预览/核对），传了就直接写文件；
 *  - sha256 用流式计算，67MB 包几百毫秒。
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
if (!apk || !versionName || !Number.isInteger(versionCode)) {
  console.error("用法：node scripts/build-ota-manifest.mjs --apk <apk> --version 1.10.0 --code 22 --notes <notes.txt> [--out <json>]");
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
  releaseNotes: args.notes ? await readReleaseNotesFile(args.notes) : [],
});

const json = serializeOtaManifest(manifest);
if (args.out) {
  await writeFile(args.out, json, "utf8");
  console.log(`[ota] 已写入 ${path.resolve(args.out)}`);
}
console.log(json);
