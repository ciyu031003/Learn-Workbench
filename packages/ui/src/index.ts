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
  primary: "#2f74c0",        // 晴空蓝
  primaryForeground: "#ffffff",
  secondary: "#eaf4fd",      // 晴空浅底（次级强调）
  accent: "#e1781c",         // 阳光橘
  success: "#3da35d",
  warning: "#d99000",
  danger: "#c04545",
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

/** 图表序列色板：晴空蓝 → 浅蓝 → 阳光橘 → 新芽绿（多系列数据按序取用） */
export const chartSeries = ["#2f74c0", "#5b93d6", "#8bb7e8", "#e1781c", "#8fbf5f"] as const;

export const tokens = { colors, radius, shadows, spacing, fontSize, fontFamily } as const;
export type Tokens = typeof tokens;

/**
 * 青春阳光系列（v1.3）：
 * 暖柔象牙白画布 + 晴空蓝主色 + 阳光橘强调。
 * 与 apps/web/app/globals.css @theme 保持单一事实源，替换旧的 indigo/cyan 图表残留。
 */
export const oilPainting = {
  canvas: "#fdf8ef",
  surface: "#fffefa",
  text: "#3a3630",
  textMuted: "#6f6a63",
  border: "rgba(120,90,45,0.16)",
  primary: "#2f74c0",
  primaryStrong: "#2563b0",
  accent: "#e1781c",
  accentStrong: "#b85c12",
  success: "#3da35d",
  successStrong: "#2c7d47",
  warning: "#d99000",
  warningStrong: "#a86900",
  danger: "#c04545",
  dangerStrong: "#9c2f2f",
  chartSeries: ["#2f74c0", "#5b93d6", "#8bb7e8", "#e1781c", "#8fbf5f"],
} as const;

/** v1.3 对外别名：保留 oilPainting，同时提供语义名 sunny。 */
export const sunny = oilPainting;
