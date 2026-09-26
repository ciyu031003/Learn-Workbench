import type { ViewStyle } from "react-native";

/**
 * 苦旅移动端视觉 Token（浅色阳光 Sunny Clay · 深色夜航 Night Voyage）
 * 单一事实源：首页/学习/招花/我的统一走这里，专注全屏保留暗色沉浸。
 *
 * 暗色说明：组件内请通过 useTheme() 取当前色板；
 * `colors` 常量仅为浅色档快照，供模块级默认值与兼容旧引用，不随主题切换。
 */
const lightColors = {
  // v17-A（D1 改良版）：转"暖中性"——保留一丝暖意，不再大面积奶油黄
  canvas: "#F7F5F2",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFFFF",
  surfaceMuted: "rgba(24,24,27,0.04)",
  // iOS 灰阶（label / secondaryLabel / tertiaryLabel）
  text: "#1C1C1E",
  textMuted: "#8E8E93",
  /**
   * v18：次级正文灰（对 #F7F5F2 约 6.9:1、对白底约 7.5:1，满足 WCAG AA 正文 4.5）。
   * 此前灰阶只有 textMuted（浅色对白底约 3.0）与 text（约 15.6）两档、中间为空，
   * 导致「次要正文」要么对比度不达标、要么被迫用 text 而丢掉层级。
   */
  textSecondary: "#5A5A5F",
  textFaint: "#AEAEB2",
  // iOS separator：中性 hairline，替掉原先的棕描边
  border: "rgba(60,60,67,0.10)",
  borderStrong: "rgba(60,60,67,0.22)",

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
  // v17-A：**不用纯黑 #000**（纯黑会让投影彻底失效、且与 #1C1C1E 卡片对比过强）
  canvas: "#111113",
  surface: "#1C1C1E",
  surfaceStrong: "#2C2C2E",
  surfaceMuted: "rgba(235,235,245,0.08)",
  text: "#F2F2F7",
  textMuted: "#A8A8AD",
  textSecondary: "#C0C0C6",
  textFaint: "#7C7C82",
  border: "rgba(235,235,245,0.14)",
  borderStrong: "rgba(235,235,245,0.28)",

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

/**
 * v17-A：投影全部中性化（原先 card 用棕橙 #B8823F、floating 用橙 #E1781C —— 这是"土"的三大来源之一）。
 * iOS 的投影是近黑、低透明度、大模糊半径；层级主要靠底色差表达，投影只做辅助。
 * 注意：深色模式下投影几乎不可见，这是 iOS 的正常表现 —— 深色的层级请靠 surface / surfaceStrong 的底色差。
 */
export const shadows: Record<"card" | "floating", ViewStyle> = {
  card: {
    shadowColor: "#1C2430",
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#1C2430",
    shadowOpacity: 0.1,
    shadowRadius: 28,
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

/**
 * 排版体系（唯一事实源）
 * 背景：此前 25 屏各自硬编码 fontSize/fontWeight，是「观感不一致」的主因。
 * 用法：StyleSheet 内展开 `...typography.body`；数字类文本叠加 `tabularNums`。
 * 说明：不锁死行高以外的布局高度，避免系统字体放大时被截断（配合 allowFontScaling）。
 */
export const typography = {
  // v17-A（R7）：对齐 iOS 语义。中文正文 16pt 是可读性拐点；中文标题 600 比 700 秀气。
  // lineHeight 按 1.19~1.5 取值，并保证在系统字号放大 130% 时单行仍能容纳（见 lib/text-scale.ts）。
  display: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
} as const;

export type TypographyToken = keyof typeof typography;

/** 数字类文本：等宽数字，保证统计/时长/百分比纵向对齐 */
export const tabularNums = { fontVariant: ["tabular-nums" as const] };
