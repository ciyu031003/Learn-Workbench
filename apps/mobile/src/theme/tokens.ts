import type { ViewStyle } from "react-native";

/**
 * 苦旅移动端视觉 Token（浅色阳光 · Sunny Clay）
 * 单一事实源：首页/学习/招花/我的统一走这里，专注全屏保留暗色沉浸。
 */
export const colors = {
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

  // 专注沉浸暗色世界
  focusCanvas: "#0F2027",
  focusAccent: "#FFB25E",
  focusSurface: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.22)",

  chart: ["#2F74C0", "#5B93D6", "#8BB7E8", "#F28C28", "#5DAE74"],
} as const;

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
