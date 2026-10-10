/**
 * 外部来源解析的纯逻辑（组二 · 阶段 10）。
 *
 * 与 `apps/web/lib/content/import-plan.mjs` 的分工：那边管"外部键/指纹/冲突/五桶"，
 * 这边管"文档怎么读成候选条目"（标题、摘要、映射、范围、上限）。
 * 两者都是纯函数，CLI（`scripts/crawl_content_source.mjs`）只负责 IO：git、读盘、发 HTTP。
 */
import fs from "node:fs";
import path from "node:path";

import { fingerprintOf, inScope, normalizeExternalKey } from "../../apps/web/lib/content/import-plan.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", ".github", "vendor"]);
const DOC_EXT = new Set([".md", ".mdx"]);

/**
 * 允许克隆的宿主（组三 · H3 安全纵深）。
 * 内容来源已登记在这几个宿主上；收紧白名单是为了挡住
 * `file://` / `ext::` / 内网地址 这类**git 传输层**攻击面
 * （`git clone` 支持 ext 传输，诱饵 URL 可以直接转成命令执行）。
 */
const ALLOWED_REPO_HOSTS = new Set([
  "github.com",
  "codeload.github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
]);

/** 只允许 https + 白名单宿主 + 不带内嵌凭据的来源 URL。 */
export function assertSafeRepoUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new Error(`来源 URL 不合法：${rawUrl}`);
  }
  if (url.protocol !== "https:") throw new Error(`来源 URL 只允许 https，收到 ${url.protocol}`);
  if (url.username || url.password) throw new Error("来源 URL 不允许内嵌用户名/密码");
  if (!ALLOWED_REPO_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`来源宿主不在白名单：${url.hostname}`);
  }
  return url.toString();
}

/**
 * git ref 形状校验。
 * 不校验的话 `--ref=--upload-pack=/tmp/evil.sh` 会被 git 当成选项（execFileSync 不做 shell 转义也一样中招）。
 */
export function assertSafeGitRef(rawRef) {
  const ref = String(rawRef ?? "").trim();
  if (!/^[0-9A-Za-z._/-]{1,100}$/.test(ref)) throw new Error(`git ref 含非法字符：${ref}`);
  if (
    ref.startsWith("-") ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.endsWith("/") ||
    ref.endsWith(".lock")
  ) {
    throw new Error(`git ref 形状不合法：${ref}`);
  }
  return ref;
}

/** 仓库相对路径：拒绝绝对路径、`..` 穿越、反斜杠与 NUL（读盘前的最后一道闸）。 */
export function assertSafeRelativePath(rawRel) {
  const rel = String(rawRel ?? "");
  if (!rel) throw new Error("相对路径不能为空");
  if (rel.includes("\0") || rel.includes("\\")) throw new Error(`相对路径含非法字符：${rel}`);
  if (path.posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) throw new Error(`相对路径不允许绝对路径：${rel}`);
  const normalized = path.posix.normalize(rel);
  if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    throw new Error(`相对路径越出仓库根：${rel}`);
  }
  return rel;
}

/** 递归收集文档文件，返回仓库相对路径（正斜杠、已排序、稳定）。 */
export function walkDocs(dir, out = [], base = dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkDocs(path.join(dir, entry.name), out, base);
      continue;
    }
    if (!DOC_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    out.push(path.relative(base, path.join(dir, entry.name)).replace(/\\/g, "/"));
  }
  return out.sort();
}

/** 极简 markdown 解析：第一个 ATX 标题当标题，其后第一段非空正文当前置摘要。 */
export function parseMarkdown(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let title = "";
  let summary = "";
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!title) {
      const heading = /^#{1,3}\s+(.+?)\s*$/.exec(line);
      if (heading) title = heading[1].replace(/[*_`]/g, "").trim();
      continue;
    }
    const plain = line.replace(/^>\s?/, "").replace(/[*_`]/g, "").trim();
    if (!plain || plain.startsWith("#") || plain.startsWith("|") || plain.startsWith("```")) continue;
    if (/^[-*+]\s/.test(plain) || /^\d+\.\s/.test(plain)) continue;
    summary = plain;
    break;
  }
  return title ? { title, summary: summary.slice(0, 500) } : null;
}

/** 读映射文件；不存在时返回 missing=true（调用方据此提示"全部记为 unmapped"）。 */
export function loadMappingFile(mapPath) {
  if (!fs.existsSync(mapPath)) return { entries: {}, missing: true };
  const raw = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  return { entries: raw?.entries ?? {}, missing: false };
}

/**
 * 候选文件 → 导入条目（纯函数；`readText` 注入以便单测不碰真实仓库）。
 *
 * 映射缺失的文件**照样产出条目**，只是带 `unmapped: true`：
 * 服务端会把它记成 skip(unmapped) 明细，形成"还有哪些外部章节没归类"的工作清单。
 */
export function buildImportItems({ docs, readText, mapping = {}, scope = [], limit = 0, license = "" }) {
  const items = [];
  let parsed = 0;
  for (const rel of docs) {
    if (limit > 0 && items.length >= limit) break;
    if (!inScope(rel, scope)) continue;
    const text = readText(rel);
    const head = parseMarkdown(text);
    if (!head) continue;
    parsed += 1;

    const base = {
      kind: "knowledge-point",
      externalKey: normalizeExternalKey(rel, head.title),
      title: head.title,
      path: rel,
      payload: {
        sourcePath: rel,
        title: head.title,
        summary: head.summary,
        bytes: String(text).length,
        license,
        fingerprint: fingerprintOf({ rel, title: head.title, body: text }),
      },
    };

    const entry = mapping[rel];
    if (!entry) {
      items.push({ ...base, targetKey: "", unmapped: true });
      continue;
    }
    const trackSlug = String(entry.trackSlug ?? "").trim();
    const stageKey = String(entry.stageKey ?? "").trim();
    const topicKey = String(entry.topicKey ?? "").trim();
    items.push({
      ...base,
      targetKey: String(entry.targetKey ?? `${trackSlug}/${stageKey}/${topicKey}`),
      payload: {
        ...base.payload,
        trackSlug,
        stageKey,
        topicKey,
        title: String(entry.title ?? head.title),
        summary: String(entry.summary ?? head.summary),
        difficulty: entry.difficulty,
        tags: entry.tags,
        estimatedMinutes: entry.estimatedMinutes,
        qualityLevel: entry.qualityLevel,
      },
    });
  }
  return { items, parsed };
}
