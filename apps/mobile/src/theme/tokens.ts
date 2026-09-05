import type { ViewStyle } from "react-native";

/**
 * 苦旅移动端视觉 Token（浅色阳光 Sunny Clay · 深色夜航 Night Voyage）
 * 单一事实源：首页/学习/招花/我的统一走这里，专注全屏保留暗色沉浸。
 *
 * 暗色说明：组件内请通过 useTheme() 取当前色板；
 * `colors` 常量仅为浅色档快照，供模块级默认值与兼容旧引用，不随主题切换。
 */
const lightColors = {
  canvas: "#FDF8EF",
  surface: "#FFFBEA",
  surfaceStrong: "#FFFFFF",
  text: "#3A342C",
  textMuted: "#7A7367",
  textFaint: "#A0998A",
  border: "rgba(120,90,45,0.16)",
  borderStrong: "rgba(120,90,45,0.30)",

  primary: "#2F74C0",
  primaryStrong: "#255FA8",
  primarySoft: "#E8F3FD",

  accent: "#F28C28",
  accentStrong: "#D97411",
  accentSoft: "#FDECD8",

  success: "#3DA35D",
  successSoft: "#E7F6EC",
  warning: "#D99000",
  warningSoft: "#FCF3DF",
  danger: "#C04545",
  dangerSoft: "#FBEBEB",

  sun: "#FFB25E",
  coral: "#F26B5E",
  teal: "#2FB3A6",
  lavender: "#8D7BD8",
  peach: "#FFB77A",

  scrim: "rgba(30,24,12,0.36)",

  // 专注沉浸暗色世界（不随主题切换）
  focusCanvas: "#0F2027",
  focusAccent: "#FFB25E",
  focusSurface: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.22)",

  chart: ["#2F74C0", "#5B93D6", "#8BB7E8", "#F28C28", "#5DAE74"],
};

/** 苦旅 · 夜航：暖炭底 + 提亮主色，避免纯黑的生硬 */
const darkColors = {
  canvas: "#171209",
  surface: "#221B10",
  surfaceStrong: "#2B2316",
  text: "#F2EBDD",
  textMuted: "#B0A794",
  textFaint: "#7E7666",
  border: "rgba(242,235,221,0.14)",
  borderStrong: "rgba(242,235,221,0.30)",

  primary: "#6FA8E0",
  primaryStrong: "#8FC0F0",
  primarySoft: "rgba(47,116,192,0.24)",

  accent: "#F5A054",
  accentStrong: "#FFB25E",
  accentSoft: "rgba(242,140,40,0.20)",

  success: "#5BBE7D",
  successSoft: "rgba(61,163,93,0.22)",
  warning: "#E8B54A",
  warningSoft: "rgba(217,144,0,0.22)",
  danger: "#E06A6A",
  dangerSoft: "rgba(192,69,69,0.26)",

  sun: "#FFB25E",
  coral: "#F26B5E",
  teal: "#2FB3A6",
  lavender: "#8D7BD8",
  peach: "#FFB77A",

  scrim: "rgba(0,0,0,0.55)",

  focusCanvas: "#0F2027",
  focusAccent: "#FFB25E",
  focusSurface: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.22)",

  chart: ["#6FA8E0", "#8BB7E8", "#F5A054", "#5BBE7D", "#B3A3EC"],
};

export type ThemeMode = "system" | "light" | "dark";
export type ThemeColors = typeof lightColors;

export const palettes: Record<"light" | "dark", ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** 浅色档快照：仅供模块级默认值/兼容旧引用；组件内一律 useTheme() */
export const colors: ThemeColors = lightColors;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const shadows: Record<"card" | "floating", ViewStyle> = {
  card: {
    shadowColor: "#B8823F",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#E1781C",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
};

export const motion = {
  micro: { duration: 160 },
  standard: { duration: 260 },
  pressScale: 0.96,
  stagger: 40,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;
