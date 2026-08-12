/** 跨端设计 tokens：Web(Tailwind) 与 React Native 共用同一套视觉语言。 */

export const colors = {
  background: "#f7f7f8",
  foreground: "#18181b",
  card: "#ffffff",
  cardGlass: "rgba(255,255,255,0.78)",
  muted: "#f1f1f3",
  mutedForeground: "#71717a",
  border: "rgba(24,24,27,0.08)",
  primary: "#4f46e5",        // 靛蓝
  primaryForeground: "#ffffff",
  accent: "#0ea5e9",         // 青
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  overlay: "rgba(10,10,14,0.35)",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 20, xl: 28, xxl: 40 } as const;

export const fontFamily = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
} as const;

export const tokens = { colors, radius, spacing, fontSize, fontFamily } as const;
export type Tokens = typeof tokens;
