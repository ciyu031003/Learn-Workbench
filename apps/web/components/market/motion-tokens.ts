export const MOTION = {
  fast: 180,
  base: 560,
  slow: 860,
  chartEnter: 720,
  chapterDelay: 60,
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  easeSharp: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const CHART_MOTION = {
  countUp: 680,
  bar: 760,
  arc: 820,
  scatter: 900,
  treemap: 860,
} as const;

export const VIEW_COLORS = {
  axis: "rgba(255,255,255,0.12)",
  axisStrong: "rgba(255,255,255,0.24)",
  grid: "rgba(255,255,255,0.055)",
  tooltip: "rgba(24,24,27,0.92)",
} as const;
