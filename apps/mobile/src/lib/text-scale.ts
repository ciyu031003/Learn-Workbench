/**
 * v17-A（A6）：字号可缩放（Dynamic Type）基线与"固定高容器"安全校验。
 *
 * ## 背景
 * iOS 用户会在系统里把字号调大（最大可到 200%+）。此前 415+ 处硬编码 fontSize，
 * 且不少容器的 height 是写死的 —— 字号一放大就会**截断/重叠**。
 *
 * ## 本文件的策略（组件请照此取值）
 * - 正文/阅读类文本：跟随系统、**不设上限**（可读性优先），用 `TEXT_SCALE_POLICY.body`。
 * - 紧凑 UI（Tab 标签、徽标、图表刻度、胶囊按钮）：允许放大但**封顶 1.3**，
 *   避免固定高容器被撑破，用 `TEXT_SCALE_POLICY.chrome`。
 * - 任何"高度写死"的文本容器，都应能通过 `fitsAtMaxScale()` 的校验（见单测）。
 *
 * 零依赖（不引 react-native），可被 vitest 直接加载。
 */

/** 紧凑 UI 的字号放大上限（130%） */
export const MAX_UI_SCALE = 1.3;

/** 组件默认下发的文本缩放策略：展开到 Text/TextInput 的 props 上即可 */
export const TEXT_SCALE_POLICY = {
  /** 正文/阅读类：跟随系统，不封顶 */
  body: { allowFontScaling: true },
  /** 紧凑 UI：封顶 130% */
  chrome: { allowFontScaling: true, maxFontSizeMultiplier: MAX_UI_SCALE },
} as const;

/**
 * 放大后的行高上界：固定高容器必须 ≥ 它 × 行数，否则会被截断。
 * 非法入参一律按 0 处理（宁可校验失败，也不要给出"看起来安全"的假结果）。
 */
export function scaledLineHeight(lineHeight: number, multiplier: number = MAX_UI_SCALE): number {
  const lh = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 0;
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : MAX_UI_SCALE;
  return Math.ceil(lh * m);
}

/**
 * 固定高容器在最大字号下是否仍装得下。
 * 刻意**不留容差**：`scaledLineHeight` 已经用 Math.ceil 向上取整吸收了舍入误差，
 * 再加容差会把"刚好差 1pt 就截断"的边界误判为安全（这类边界正是要抓的）。
 */
export function fitsAtMaxScale(
  boxHeight: number,
  lineHeight: number,
  lines = 1,
  multiplier: number = MAX_UI_SCALE
): boolean {
  const box = Number.isFinite(boxHeight) ? boxHeight : 0;
  const n = Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 1;
  return box >= scaledLineHeight(lineHeight, multiplier) * n;
}

/** 给"内容高度自适应"的容器用：最大字号下建议的最小高度 */
export function minTouchboxHeight(lineHeight: number, lines = 1, multiplier: number = MAX_UI_SCALE): number {
  const n = Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 1;
  return scaledLineHeight(lineHeight, multiplier) * n;
}
