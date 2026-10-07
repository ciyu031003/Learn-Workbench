import { mkdir, readFile, readdir, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 客户端诊断包存储（v1.32.0，招花闪退排障）。
 *
 * 与简历文件同一条约定（见 lib/resume-files.ts）：
 *  - 落 **私密目录**（`<UPLOAD_DIR 同级的 private>/`），compose 把它挂成 /app/public/private
 *    → 宿主机是 /data/learn-workbench/private（COS 桶）；**nginx 不直出**，只能经 API 校验后读；
 *  - 路径带 userId 分目录，天然按用户隔离（数据隔离铁律）；
 *  - 不做任何转换，原样落盘（诊断包就是文本 JSON）。
 *
 * 注意：**存了不等于有人看**。日志是给人排障用的，读法（ssh 直取）写在看板 v1.32.0 段。
 */
export const DIAGNOSTIC_MAX_BYTES = 512 * 1024;

export function diagnosticsRootDir(): string {
  if (process.env.DIAGNOSTICS_DIR) return process.env.DIAGNOSTICS_DIR;
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
  return path.join(path.dirname(uploadDir), "private", "diagnostics");
}

/** 归属目录名：userId / anonId / 兜底串，只允许安全字符（防穿越） */
export function isSafeDiagnosticOwner(owner: string): boolean {
  return /^[0-9a-zA-Z_-]{1,64}$/.test(String(owner ?? ""));
}

export function diagnosticRelPath(owner: string, id: string): string {
  return path.posix.join(owner, id + ".json");
}

export function diagnosticsAbsPath(rel: string): string {
  return path.join(diagnosticsRootDir(), rel);
}

/** 相对路径安全校验（读侧也用它，别只在写侧校验） */
export function isSafeDiagnosticPath(rel: string): boolean {
  if (!rel || rel.includes("..") || rel.startsWith("/") || rel.includes("\\")) return false;
  return /^[0-9a-zA-Z_-]{1,64}\/[0-9a-zA-Z-]{8,64}\.json$/.test(rel);
}

export type BodyCheck =
  | { ok: true; bytes: number; owner?: undefined; error?: undefined; status?: undefined }
  | { ok: false; error: string; status: number };

/**
 * 校验上报正文：必须是能解析的 JSON，且不超过上限。
 * 先看字节数再看 JSON —— 免得一个 10MB 的垃圾把 JSON.parse 卡住。
 */
export function validateDiagnosticBody(text: string): BodyCheck {
  const raw = typeof text === "string" ? text : "";
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes === 0) return { ok: false, error: "空请求体", status: 400 };
  if (bytes > DIAGNOSTIC_MAX_BYTES) {
    return { ok: false, error: "诊断包太大了（上限 " + Math.round(DIAGNOSTIC_MAX_BYTES / 1024) + "KB）", status: 413 };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "诊断包必须是 JSON 对象", status: 400 };
    }
  } catch {
    return { ok: false, error: "诊断包不是合法 JSON", status: 400 };
  }
  return { ok: true, bytes };
}

export async function saveDiagnosticReport(rel: string, body: string): Promise<void> {
  const abs = diagnosticsAbsPath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body, "utf8");
}

// ---------------------------------------------------------------- 服务端兜底脱敏（2026-10-07 评审）

/**
 * 服务端兜底脱敏：客户端已经脱敏过，但**不能只信客户端** ——
 * 老版本 App 或将来客户端漏一条规则，未脱敏内容就会直接落盘。
 * 规则与 apps/mobile/src/lib/crash-report.ts 保持一致（量词都带上界，避免 ReDoS）。
 */
const SERVER_REDACT_RULES: [RegExp, string][] = [
  [/(bearer)\s+[A-Za-z0-9._~+/-]{8,}=*/gi, "$1 <redacted>"],
  [/((?:authorization|cookie|set-cookie|x-cron-secret|token|secret|password|passwd|pwd|apikey|api_key)\s*[:=]\s*)[^\s,;"']+/gi, "$1<redacted>"],
  [/[A-Za-z0-9_-]{32,}/g, "<redacted-token>"],
  [/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+/g, "<email>"],
  [/(^|[^0-9])1[3-9][0-9]{9}([^0-9]|$)/g, "$1<phone>$2"],
];

export function redactDiagnosticsText(text: string): string {
  let out = String(text ?? "");
  for (const [re, to] of SERVER_REDACT_RULES) out = out.replace(re, to);
  return out;
}

// ---------------------------------------------------------------- 保留策略（2026-10-07 评审）

/**
 * 清理超过 maxAgeDays 天的诊断包（由 maintenance cron 每日调用）。
 * 诊断包只在"排障窗口"里有价值，长期堆在 COS 上既占空间也是隐私负担。
 * 只删 .json、只删归属目录下的文件；顺带清掉清空后的归属目录。
 */
export async function pruneDiagnosticReports(maxAgeDays = 30): Promise<{ files: number; dirs: number }> {
  const root = diagnosticsRootDir();
  const cutoff = Date.now() - Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
  const result = { files: 0, dirs: 0 };
  let owners: string[] = [];
  try {
    owners = (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return result; // 目录还不存在（没人上传过）
  }
  for (const owner of owners) {
    if (!isSafeDiagnosticOwner(owner)) continue;
    const dir = path.join(root, owner);
    let names: string[] = [];
    try {
      names = (await readdir(dir, { withFileTypes: true }))
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name);
    } catch {
      continue;
    }
    let alive = 0;
    for (const name of names) {
      const abs = path.join(dir, name);
      try {
        const info = await stat(abs);
        if (info.mtimeMs < cutoff) {
          await unlink(abs);
          result.files += 1;
        } else alive += 1;
      } catch {
        alive += 1; // stat/unlink 失败就别删，留给下一次
      }
    }
    if (alive === 0 && names.length > 0) {
      try {
        await rmdir(dir);
        result.dirs += 1;
      } catch {
        // 忽略
      }
    }
  }
  return result;
}

/**
 * 诊断包总览（v1.34.0，2026-10-07 评审）：给 maintenance cron 一个"崩溃率"信号。
 *
 * 为什么要它：v1.32.0–v1.32.2 连续三版都在"修闪退"，期间只能靠用户主动反馈才知道没修好；
 * 诊断包本来就带 app.version，把最近 24h 的上报数按版本聚合一下，异常当天就能看出来。
 * 只读 + 有解析上限（默认最多 50 个文件），任何失败都不抛。
 */
export async function summarizeDiagnosticReports(maxParse = 50): Promise<{
  total: number;
  last24h: number;
  byVersion: Record<string, number>;
}> {
  const out = { total: 0, last24h: 0, byVersion: {} as Record<string, number> };
  const root = diagnosticsRootDir();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent: { abs: string; mtimeMs: number }[] = [];
  let owners: string[] = [];
  try {
    owners = (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return out;
  }
  for (const owner of owners) {
    if (!isSafeDiagnosticOwner(owner)) continue;
    const dir = path.join(root, owner);
    let names: string[] = [];
    try {
      names = (await readdir(dir, { withFileTypes: true }))
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const name of names) {
      const abs = path.join(dir, name);
      out.total += 1;
      try {
        const info = await stat(abs);
        if (info.mtimeMs >= dayAgo) {
          out.last24h += 1;
          recent.push({ abs, mtimeMs: info.mtimeMs });
        }
      } catch {
        continue;
      }
    }
  }
  recent.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const item of recent.slice(0, maxParse)) {
    try {
      const parsed = JSON.parse(await readFile(item.abs, "utf8")) as { app?: { version?: string } };
      const version = String(parsed?.app?.version ?? "unknown");
      out.byVersion[version] = (out.byVersion[version] ?? 0) + 1;
    } catch {
      // 坏 JSON：忽略
    }
  }
  return out;
}

