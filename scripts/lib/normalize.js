/**
 * 招花爬虫 · 归一化工具（P1：三套重复实现收敛为单份，Node 双引擎共用）
 * 覆盖：HTML 清洗 / 薪资解析 / 发布时间解析 / 去重 hash。
 * Python 版 fetch_jobs.py 已废弃（见其头部说明），不再对齐。
 */
import { createHash } from "node:crypto";

const num = (v) => (typeof v === "number" ? v : Number(v));

/** HTML 清洗：去 script/style/标签 + 常见实体还原 + 空白折叠 */
export function stripHtml(text) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** 薪资文本 → [min, max]（K/月）；支持 k 区间 / 万区间（月薪、年薪折算）/ 单值 / 面议 */
export function parseSalary(text) {
  if (!text) return [null, null];
  let t = String(text).replace(/K/g, "k");
  let m = t.match(/(\d+(?:\.\d+)?)\s*k\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*k/);
  if (m) return [num(m[1]), num(m[2])];
  const yearly = t.includes("年");
  m = t.match(/(\d+(?:\.\d+)?)\s*万\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*万/) || t.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*万/);
  if (m) {
    let a = num(m[1]) * 10, b = num(m[2]) * 10;
    if (yearly) { a = Math.round(a / 12); b = Math.round(b / 12); }
    return [a, b];
  }
  m = t.match(/(\d+(?:\.\d+)?)\s*万/);
  if (m) {
    let a = num(m[1]) * 10;
    if (yearly) a = Math.round(a / 12);
    return [a, a];
  }
  m = t.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)/);
  if (m && (!t.includes("/") || t.includes("天") || t.includes("日"))) return [num(m[1]), num(m[2])];
  m = t.match(/(\d+(?:\.\d+)?)\s*k/);
  if (m) return [num(m[1]), num(m[1])];
  return [null, null];
}

/** 发布时间归一化 → ISO 8601；兼容毫秒/秒时间戳、空格分隔日期；失败返回 null */
export function parsePublished(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  let s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const ms = Number(s) > 1e12 ? Number(s) : Number(s) * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** 去重 hash：字段全集（两版爬虫合并）；同字段组合产生相同 hash，用于跳过 UPDATE */
export function contentHash(p) {
  const raw = [
    p.source ?? "", p.source_job_id ?? "", p.title ?? "", p.company ?? "", p.city ?? "",
    p.district ?? "", p.salary_text ?? "", p.experience ?? "", p.education ?? "",
    JSON.stringify(p.tags ?? []), p.description ?? "", p.requirements ?? "",
    p.company_info ?? "", p.url ?? "", p.logo_url ?? "", p.category ?? "",
    p.channel ?? "", p.deadline_at ?? "", JSON.stringify(p.extra ?? {}),
  ].join("|");
  return createHash("md5").update(raw, "utf8").digest("hex");
}