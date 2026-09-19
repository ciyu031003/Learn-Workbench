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
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

function sha256OfFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

const args = parseArgs(process.argv.slice(2));
const apk = args.apk;
const versionName = args.version;
const versionCode = Number(args.code);
if (!apk || !versionName || !Number.isInteger(versionCode)) {
  console.error("用法：node scripts/build-ota-manifest.mjs --apk <apk> --version 1.10.0 --code 22 --notes <notes.txt> [--out <json>]");
  process.exit(1);
}

const base = (args.base ?? "https://learn.yuanabd.cn").replace(/\/+$/, "");
const info = await stat(apk);
const sha256 = await sha256OfFile(apk);

let releaseNotes = [];
if (args.notes) {
  const raw = await readFile(args.notes, "utf8");
  releaseNotes = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

const manifest = {
  versionName,
  versionCode,
  apkUrl: `${base}/download/learn-workbench-v${versionName}.apk`,
  sizeBytes: info.size,
  sha256,
  releaseNotes,
  publishedAt: new Date().toISOString(),
};

const json = JSON.stringify(manifest, null, 2) + "\n";
if (args.out) {
  await writeFile(args.out, json, "utf8");
  console.log(`[ota] 已写入 ${path.resolve(args.out)}`);
}
console.log(json);
