const TOP_BAR_GAP = 8;
const FOOTER_GAP = 12;
const FOOTER_MIN_PADDING = 24;

export function quizTopBarPaddingTop(insetTop: number): number {
  return Math.max(0, insetTop) + TOP_BAR_GAP;
}

export function quizFooterPaddingBottom(insetBottom: number): number {
  return Math.max(FOOTER_MIN_PADDING, Math.max(0, insetBottom) + FOOTER_GAP);
}
