/**
 * 底部弹窗高度计算（P12）：把「按内容自适应」的几何决策抽成纯函数，便于单测与复用。
 *
 * 背景：BottomSheet 过去高度完全由 `height` 比例（默认 50%）决定 →
 * 内容只有两三个 chip 的弹窗也留一大片空白，而小内容还得在弹窗内上滑。
 * 现在 `height` 退化为**上限**：先量内容自然高度，能装下就长到刚好，
 * 装不下才封顶并在内部滚动。
 *
 * 约定：
 * - contentHeight 是**已含 chrome 的自然高度**（手柄 + 标题 + 分段 + 内容 + 吸底 CTA + 安全区留白），
 *   由调用方（组件）把多次 onLayout / onContentSizeChange 的结果加总后传进来；
 * - usableScreen 用「屏幕高 − 状态栏 − 底部安全区」（对键盘 resize 免疫，见组件注释）；
 * - keyboardHeight 只在计算上限时扣减（弹层顶边不钻进键盘），不影响内容自然高度；
 * - 所有输入都做了脏值兜底：NaN / 负数 / 0 / 极端比例都不会算出负高度或超过屏幕。
 */

/** 可用高度下限：极矮窗口（分屏/小屏 + 键盘）也至少留出可点的头部空间 */
export const SHEET_MIN_USABLE_HEIGHT = 160;
/** 比例兜底：未传 / 脏值时按旧的 50% 处理 */
export const SHEET_FALLBACK_RATIO = 0.5;
/** 比例硬上限：任何弹层都不该顶到状态栏（0.94 与组件的 full 档一致） */
export const SHEET_HARD_MAX_RATIO = 0.94;
/** 判定「需要内部滚动」的容差（亚像素/取整抖动不算溢出） */
const SCROLL_EPSILON = 0.5;

export interface ResolveSheetHeightInput {
  /** 内容自然高度（已含 chrome 与安全区留白）；未测量时传 0 */
  contentHeight: number;
  /** 可用屏幕高度（屏幕高 − 状态栏 − 底部安全区） */
  usableScreen: number;
  /** `height` 参数换算出的比例上限（0.12–0.98），默认 0.5 */
  maxRatio?: number;
  /** 弹层最小高度（内容极少时的下限，如 120） */
  minHeight?: number;
  /** 键盘高度：只压缩上限，不改变内容高度 */
  keyboardHeight?: number;
  /** 比例硬上限，默认 0.94 */
  hardMaxRatio?: number;
  /** 可用高度下限，默认 160 */
  minUsableHeight?: number;
}

export interface ResolvedSheetHeight {
  /** 弹层应取的高度（px） */
  height: number;
  /** 本次计算的上限（px）；height === cap 且内容更高时需要内部滚动 */
  cap: number;
  /** 内容超出上限 → 内部 ScrollView 才允许滚动 */
  scrollable: boolean;
}

function finiteOr(value: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 计算底部弹窗高度。
 *
 * 公式：
 *   available = max(minUsableHeight, usableScreen − keyboardHeight)
 *   cap       = min(available, usableScreen × maxRatio, usableScreen × hardMaxRatio)
 *   height    = min(cap, max(contentHeight, min(minHeight, cap)))
 *   scrollable = contentHeight > height + 0.5
 */
export function resolveSheetHeight(input: ResolveSheetHeightInput): ResolvedSheetHeight {
  const usableRaw = finiteOr(input.usableScreen, 0);
  const usable = usableRaw > 0 ? usableRaw : 0;
  const contentHeight = Math.max(0, finiteOr(input.contentHeight, 0));
  const maxRatio = clamp(finiteOr(input.maxRatio ?? SHEET_FALLBACK_RATIO, SHEET_FALLBACK_RATIO), 0.12, 0.98);
  const hardMaxRatio = clamp(finiteOr(input.hardMaxRatio ?? SHEET_HARD_MAX_RATIO, SHEET_HARD_MAX_RATIO), 0.12, 0.98);
  const minUsableHeight = Math.max(0, finiteOr(input.minUsableHeight ?? SHEET_MIN_USABLE_HEIGHT, SHEET_MIN_USABLE_HEIGHT));
  const minHeight = Math.max(0, finiteOr(input.minHeight ?? 0, 0));
  // 键盘高度先夹到屏幕内：脏值（负数/超出屏高）不会把上限算成负数
  const keyboardHeight = clamp(finiteOr(input.keyboardHeight ?? 0, 0), 0, usable);

  // 屏幕尺寸拿不到（测试环境/异常）：退化成最小高度，绝不返回负值
  if (usable === 0) {
    return {
      height: minHeight,
      cap: 0,
      scrollable: contentHeight > minHeight + SCROLL_EPSILON,
    };
  }

  const available = Math.max(Math.min(minUsableHeight, usable), usable - keyboardHeight);
  const cap = Math.max(0, Math.min(available, usable * maxRatio, usable * hardMaxRatio));
  const floor = Math.min(minHeight, cap);
  const height = Math.min(cap, Math.max(contentHeight, floor));
  return {
    height,
    cap,
    scrollable: contentHeight > height + SCROLL_EPSILON,
  };
}
