/**
 * 算法动图 SVG 危险片段检查（评审 2026-10-31 P2）。
 *
 * 背景：algorithm-animation.tsx 用 dangerouslySetInnerHTML 内联 DB 里的 SVG；唯一信任链是
 * 「内容自产」，而防线此前只有 packages/content 静态测试里的一个离线正则，且漏掉
 * SMIL 事件属性（onbegin/onend/onrepeat）、foreignObject、<use>/<image> 外部引用与
 * data:text/html。现在把检查落到两个运行时路径（纵深防御，不再单点）：
 *  - 写库（learning-content-sync）：内容包导入时拒绝，坏数据进不了 DB；
 *  - 读库（learning-repo.loadAlgorithmAnimations）：拦截门禁启用前已入库的行。
 */

const DANGEROUS_SVG_RE = new RegExp(
  [
    // 脚本/嵌入/样式注入类标签（foreignObject 可包 HTML，一并拦截）
    "<\\s*(script|iframe|object|embed|style|link|meta|foreignObject)\\b",
    // 任意 on* 事件属性：覆盖 onclick/onerror/onload 及 SMIL 的 onbegin/onend/onrepeat
    "\\bon[a-z]+\\s*=",
    "\\bjavascript\\s*:",
    "\\bdata\\s*:\\s*text\\s*/\\s*html",
    // <use>/<image> 的 href/xlink:href 只允许同文档片段（# 开头），禁外部文件与自定义协议
    "<\\s*(use|image)\\b[^>]*\\b(xlink:)?href\\s*=\\s*([\"'])\\s*(?!#)",
  ].join("|"),
  "i"
);

/** 命中危险片段返回 true（导出仅供测试断言正则本身） */
export function isDangerousSvg(svg: string): boolean {
  return DANGEROUS_SVG_RE.test(svg);
}

/**
 * 校验一帧数组的所有 svg 是否安全；不安全时抛错（写库路径 fail-closed）。
 * frames 形如 { caption, svg }[]；非数组/缺 svg 字段的行跳过（由上游 schema 兜底）。
 */
export function assertAnimationFramesSafe(frames: unknown, owner: string): void {
  if (!Array.isArray(frames)) return;
  for (const [index, frame] of frames.entries()) {
    const svg = (frame as { svg?: unknown } | null)?.svg;
    if (typeof svg === "string" && DANGEROUS_SVG_RE.test(svg)) {
      throw new Error(`动图含危险片段，拒绝入库：${owner}#${index}`);
    }
  }
}
