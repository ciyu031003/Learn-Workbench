import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

/**
 * 服务端 TeX → SVG（v1.55 / P7）。
 *
 * 为什么需要：App 端没有 KaTeX/数学字体，公式只能显示等宽 LaTeX 源码；把 TeX 在服务端
 * 渲染成自包含 SVG，App 用 react-native-svg 的 SvgXml 直接画出来，排版与 Web 基本一致，
 * 且不会把 mathjax（约 3MB）打进客户端或 App 包。
 *
 * 关键取舍：
 * - liteAdaptor + SVG 输出、fontCache: "none"：不产出 <defs>/<use>，每个公式内联 path。
 *   react-native-svg 对 use+xlink:href 的支持不完整，内联最稳（体积约 5KB/公式，可接受）。
 * - 去掉 width/height/style 等 HTML 属性：RN 不认 ex 单位，尺寸由调用方按 viewBox 换算。
 * - 失败一律返回 null（App 回退等宽文本），不抛错、不把 merror 的红色错误图交给客户端。
 * - 进程内 LRU 缓存同一 TeX 的 SVG（同一篇文章里重复公式极多）。
 */

/** 单条公式的 TeX 长度上限（防止超长输入把服务端拖死） */
export const MAX_TEX_LENGTH = 2000;
/** 一次响应最多渲染的公式数（超出部分只保留 tex，前端回退文本） */
export const MAX_MATH_PER_PAYLOAD = 160;
const CACHE_LIMIT = 800;

/**
 * 危险宏黑名单：会读写外部资源或注入 HTML 属性的命令。
 * 纯排版命令（text/mathrm 等）必须放行，所以只能按命令名精确否决。
 */
const FORBIDDEN_MACRO =
  /\\(?:input|include|includegraphics|href|url|require|class|cssId|style|def|edef|gdef|xdef|newcommand|renewcommand|providecommand|let|csname|endcsname|unicode|bbox|label|tag|htmlClass|htmlStyle|htmlId)\b/i;
const FORBIDDEN_HTML = /<\s*\/?\s*(?:script|iframe|object|embed|style|link|meta)\b|javascript:/i;

type MathJaxDocument = { convert: (tex: string, options: { display: boolean }) => unknown };
type LiteAdaptor = { innerHTML: (node: unknown) => string };

let cachedDocument: MathJaxDocument | null = null;
let adaptorRef: LiteAdaptor | null = null;
let initFailed = false;

function getDocument(): MathJaxDocument | null {
  if (cachedDocument) return cachedDocument;
  if (initFailed) return null;
  try {
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const texInput = new TeX({ packages: AllPackages });
    const svgOutput = new SVG({ fontCache: "none" });
    const document = mathjax.document("", { InputJax: texInput, OutputJax: svgOutput }) as unknown as MathJaxDocument;
    adaptorRef = adaptor as unknown as LiteAdaptor;
    cachedDocument = document;
    return document;
  } catch {
    initFailed = true;
    return null;
  }
}

/** LRU：Map 保持插入序，命中时重插到尾部，超限删最早 */
const svgCache = new Map<string, string | null>();

function cacheGet(key: string): string | null | undefined {
  if (!svgCache.has(key)) return undefined;
  const value = svgCache.get(key);
  svgCache.delete(key);
  svgCache.set(key, value ?? null);
  return value;
}

function cacheSet(key: string, value: string | null): void {
  if (svgCache.size >= CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value;
    if (oldest !== undefined) svgCache.delete(oldest);
  }
  svgCache.set(key, value);
}

/** 测试用：清空渲染缓存与单例（避免用例之间互相影响） */
export function __resetTexSvgCache(): void {
  svgCache.clear();
  cachedDocument = null;
  adaptorRef = null;
  initFailed = false;
}

/**
 * 把 TeX 渲染成自包含 SVG 字符串；失败（非法 TeX、超长、危险宏、初始化失败）返回 null。
 *
 * 返回的字符串以 svg 根节点开头，只保留 viewBox 与内部 g，去掉了 style/width/height/role/
 * focusable 这些 RN 用不上的属性。
 */
export function texToSvg(tex: string, displayMode = false): string | null {
  const source = String(tex ?? "").trim();
  if (!source || source.length > MAX_TEX_LENGTH) return null;
  if (FORBIDDEN_MACRO.test(source) || FORBIDDEN_HTML.test(source)) return null;

  const cacheKey = (displayMode ? "D" : "I") + "::" + source;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const document = getDocument();
  const adaptor = adaptorRef;
  if (!document || !adaptor) {
    cacheSet(cacheKey, null);
    return null;
  }

  let rendered: string;
  try {
    const node = document.convert(source, { display: displayMode });
    rendered = adaptor.innerHTML(node);
  } catch {
    cacheSet(cacheKey, null);
    return null;
  }

  // MathJax 的 TeX 错误会渲染成 merror / 红色文本而不是抛异常：两者都视为失败
  if (!rendered.includes("<svg") || rendered.includes("data-mjx-error") || rendered.includes('fill="red"')) {
    cacheSet(cacheKey, null);
    return null;
  }

  const normalized = normalizeSvgRoot(rendered);
  cacheSet(cacheKey, normalized);
  return normalized;
}

/** 去掉 RN 不认的属性，只保留 xmlns 与 viewBox（尺寸由调用方按 viewBox 换算） */
export function normalizeSvgRoot(svg: string): string {
  const openTag = /^<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const viewBox = /viewBox="([^"]+)"/i.exec(openTag)?.[1] ?? "0 0 1000 1000";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + svg.slice(openTag.length);
}

/** 解析 viewBox 的宽高（逻辑单位，1 = 1/1000 em）；解析失败给兜底 */
export function readSvgViewBox(svg: string): { width: number; height: number } {
  const match = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i.exec(String(svg ?? ""));
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  if (!(width > 0) || !(height > 0)) return { width: 1000, height: 500 };
  return { width, height };
}

/* ------------------------------------------------------------------ */
/* 行内公式切段（App 原样渲染 segments）                                */
/* ------------------------------------------------------------------ */

export type MathSegment =
  | { type: "text"; text: string }
  | { type: "math"; tex: string; svg: string | null };

const INLINE_MATH = /(?<!\$)\$(?!\$)([^$\s][^$\n]{0,298}?[^$\s]|[^$\s])\$(?!\$)/g;

/** 去掉 $ 定界符的纯文本（摘要 / fallback 用） */
export function stripMathDelimiters(text: string): string {
  return String(text ?? "").replace(INLINE_MATH, "$1");
}

/**
 * 把一行文本切成 text / math 段。只认 $...$（cs408 正文的行内公式统一用它）；
 * 空公式不切；没有公式时返回单个 text 段。
 */
export function splitMathSegments(
  text: string,
  render: MathRenderer = texToSvg,
): MathSegment[] {
  const source = String(text ?? "");
  if (!source) return [];
  const segments: MathSegment[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE_MATH)) {
    const index = match.index ?? 0;
    const tex = (match[1] ?? "").trim();
    if (!tex) continue;
    if (index > last) segments.push({ type: "text", text: source.slice(last, index) });
    segments.push({ type: "math", tex, svg: render(tex, false) });
    last = index + match[0].length;
  }
  if (last < source.length) segments.push({ type: "text", text: source.slice(last) });
  return segments.length > 0 ? segments : [{ type: "text", text: source }];
}

/* ------------------------------------------------------------------ */
/* StudyBlock 富化（?format=svg 模式用）                                */
/* ------------------------------------------------------------------ */

export type MathRenderer = (tex: string, display: boolean) => string | null;

type BlockRecord = Record<string, unknown>;

function isRecord(value: unknown): value is BlockRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 给 blocks 追加公式渲染结果：
 * - { type: "math", tex } → 追加 svg（display 模式）；
 * - paragraph / list / table / quote → 追加 segments（text/math 段），供 App 原样渲染。
 *
 * 纯函数、不改入参；渲染失败时 svg 为 null（前端回退等宽文本）。
 * 原有字段一律保留（Web 端仍按原字段用 KaTeX 渲染，默认格式不受影响）。
 */
export function addMathToBlocks(blocks: unknown, render: MathRenderer = texToSvg): unknown[] {
  if (!Array.isArray(blocks)) return [];
  let budget = MAX_MATH_PER_PAYLOAD;
  const renderOnce = (tex: string, display: boolean): string | null => {
    if (budget <= 0) return null;
    budget -= 1;
    return render(tex, display);
  };

  return blocks.map((raw): unknown => {
    if (!isRecord(raw)) return raw;
    const type = asString(raw.type);
    if (type === "math") {
      const tex = asString(raw.tex);
      return { ...raw, svg: tex ? renderOnce(tex, true) : null };
    }
    if (type === "paragraph" || type === "quote") {
      const lines = Array.isArray(raw.lines) ? raw.lines.filter((line): line is string => typeof line === "string") : [];
      const text = lines.join(" ");
      return { ...raw, segments: text ? splitMathSegments(text, renderOnce) : [] };
    }
    if (type === "list") {
      const items = Array.isArray(raw.items) ? raw.items : [];
      return {
        ...raw,
        items: items.map((item) => {
          if (!isRecord(item)) return item;
          const text = asString(item.text);
          return { ...item, segments: text ? splitMathSegments(text, renderOnce) : [] };
        }),
      };
    }
    if (type === "table") {
      const header = Array.isArray(raw.header) ? raw.header : [];
      const rows = Array.isArray(raw.rows) ? raw.rows : [];
      return {
        ...raw,
        headerSegments: header.map((cell) => splitMathSegments(asString(cell), renderOnce)),
        rowSegments: rows.map((row) =>
          Array.isArray(row) ? row.map((cell) => splitMathSegments(asString(cell), renderOnce)) : [],
        ),
      };
    }
    return raw;
  });
}
