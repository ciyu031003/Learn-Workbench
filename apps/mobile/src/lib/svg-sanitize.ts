/**
 * SvgXml 原生安全清洗（P13 · 崩溃修复）。
 *
 * 线上根因（App 1.59.0 / 2026-11-02 19:34）：
 *   FATAL IllegalArgumentException: No enum constant com.facebook.react.uimanager.PointerEvents.ALL
 *   at com.horcrux.svg.RenderableViewManager$RectViewManager.setPointerEvents
 * cs408 插图的 SVG 里有 819 个文件、共 18346 处 `pointer-events="all"`。react-native-svg 会把它
 * 映射成 RN 的 pointerEvents prop，而 RN 原生枚举只支持 none / box-none / box-only / auto，
 * "all" 直接触发原生 FATAL（JS 层 ErrorBoundary 也拦不住）。
 *
 * 因此所有来自外部内容的 SVG 在交给 SvgXml 之前必须过一遍本函数：
 * - 删除 pointer-events / pointerEvents 属性（含无引号值）；
 * - 删除 style="…" 里的 pointer-events 声明（保留其余声明）；
 * - 顺手移除 <script>/<foreignObject>（SvgXml 不支持且属于不可信内容）；
 * - **marker 的 orient="auto-start-reverse" → "auto"**（v2.0.1 线上闪退：react-native-svg 的
 *   MarkerView 只认 "auto" 或数字，其它值直接 Double.parseDouble 抛 NumberFormatException，
 *   而 cs408 插图里的箭头 marker 常用 SVG2 的 auto-start-reverse）；
 * - 其余内容（xlink:href、data-*、渐变、clipPath…）原样保留，正常 SVG 不受影响。
 *
 * 结果按源串缓存，避免同一张图在列表/滚动重渲染时重复做正则替换。
 */

const CACHE_LIMIT = 256;
const cache = new Map<string, string>();

const POINTER_EVENT_ATTR = /(\s)pointer-events\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+)/gi;
const POINTER_EVENT_CAMEL_ATTR = /(\s)pointerEvents\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+)/g;
const POINTER_EVENT_STYLE = /^\s*pointer-events\s*:/i;
const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi;
/** SVG2 marker 的 orient 取值；react-native-svg 只支持 "auto" 或数字 */
const MARKER_ORIENT = /(\s)orient\s*=\s*("|')\s*auto-start-reverse\s*\2/gi;
const FOREIGN_OBJECT = /<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi;

function cleanStyle(css: string, quote: '"' | "'", leadingSpace: string): string {
  const kept = css
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0)
    .filter((declaration) => !POINTER_EVENT_STYLE.test(declaration));
  if (kept.length === 0) return "";
  return `${leadingSpace}style=${quote}${kept.join("; ")}${quote}`;
}

/** 纯函数：把外部 SVG 清洗成 SvgXml 可安全渲染的字符串；空/非字符串返回 "" */
export function sanitizeSvgForNative(xml: string): string {
  if (typeof xml !== "string" || xml.length === 0) return "";
  const cached = cache.get(xml);
  if (cached !== undefined) return cached;

  let sanitized = xml;
  sanitized = sanitized.replace(POINTER_EVENT_ATTR, "");
  sanitized = sanitized.replace(POINTER_EVENT_CAMEL_ATTR, "");
  sanitized = sanitized.replace(/(\s)style\s*=\s*"([^"]*)"/gi, (_match, space: string, css: string) => cleanStyle(css, '"', space));
  sanitized = sanitized.replace(/(\s)style\s*=\s*'([^']*)'/gi, (_match, space: string, css: string) => cleanStyle(css, "'", space));
  sanitized = sanitized.replace(MARKER_ORIENT, "$1orient=$2auto$2");
  sanitized = sanitized.replace(SCRIPT, "");
  sanitized = sanitized.replace(FOREIGN_OBJECT, "");

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(xml, sanitized);
  return sanitized;
}

/** 清空缓存（单测用；生产不需要） */
export function clearSvgSanitizeCache(): void {
  cache.clear();
}

/** 当前缓存条数（单测用） */
export function svgSanitizeCacheSize(): number {
  return cache.size;
}