/** 跨端设计 tokens：Web(Tailwind) 与 React Native 共用同一套视觉语言。 */

/** 色彩：Background / Surface / Glass / Primary / Secondary / Success / Warning / Danger / Text / Muted */
export const colors = {
  background: "#f8f9fb",
  surface: "#ffffff",
  glass: "rgba(255,255,255,0.78)",
  text: "#18181b",
  muted: "#f1f1f3",
  mutedForeground: "#71717a",
  border: "rgba(24,24,27,0.08)",
  primary: "#4f46e5",        // 靛蓝
  primaryForeground: "#ffffff",
  secondary: "#eef2ff",      // 靛蓝浅底（次级强调）
  accent: "#0ea5e9",         // 青
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  overlay: "rgba(10,10,14,0.35)",
} as const;

/** 圆角：sm(8) md(12) lg(16) xl(20) 2xl(28) */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, "2xl": 28, full: 9999 } as const;

/** 阴影：shadow-sm / md / lg / glass-shadow */
export const shadows = {
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 12px rgba(0,0,0,0.08)",
  lg: "0 12px 32px rgba(0,0,0,0.12)",
  glass: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 32px rgba(0,0,0,0.08)",
} as const;

/** 间距：4 8 12 16 24 32 48 64 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48, "4xl": 64 } as const;

/** 字号：xs sm base lg xl 2xl 3xl 4xl */
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 } as const;

export const fontFamily = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
} as const;

/** 图表序列色板：primary → accent 冷调梯度（多系列数据按序取用） */
export const chartSeries = ["#4f46e5", "#6366f1", "#818cf8", "#0ea5e9", "#38bdf8"] as const;

export const tokens = { colors, radius, shadows, spacing, fontSize, fontFamily } as const;
export type Tokens = typeof tokens;

/**
 * 浅色油画系列（v1.2）：
 * 暖米白画布底 + 纸感卡片 + 莫兰迪低饱和语义色。
 * 仅作为新增色板暴露，不替换现有 tokens，便于灰度与回退。
 * 语义色已按 WCAG AA：「正文/按钮文字 ≥ 4.5:1」校准（见 docs/ui-redesign-proposal.md §11.3）。
 */
export const oilPainting = {
  canvas: "#f6f2ea",
  surface: "#fffdf7",
  text: "#3a3630",
  textMuted: "#6f6a63",
  border: "rgba(90,80,60,0.14)",
  primary: "#46617a",
  accent: "#a5662e",
  success: "#5f7d59",
  warning: "#8f6a2a",
  danger: "#a0524a",
  chartSeries: ["#5f7d9c", "#7d9bb8", "#a3b8cc", "#c98a4b", "#8a9a5b"],
} as const;
