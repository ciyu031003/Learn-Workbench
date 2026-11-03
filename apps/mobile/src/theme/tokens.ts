import type { ViewStyle } from "react-native";

/**
 * 移动端视觉 Token（v2.0 · 冷调浅工作台 / 深色夜航）
 * 单一事实源：五个 Tab 与二级页的颜色、圆角、阴影、排版全部从这里取，禁止裸写色值。
 *
 * v2 设计基线（2026-11）：源自《成长App移动端原型 V3》——
 * 冷调浅蓝灰画布 + 白卡细描边 + 唯一主色天蓝 + 语义色；层级用色场与细边表达，
 * 阴影只做辅助。玻璃材质（Liquid Glass）只在「视觉锚点」与导航出现，见 components/surface.tsx。
 */
const lightColors = {
  // 画布：冷调浅蓝灰（非纯白），让白卡浮起来
  canvas: "#F6F8FC",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFFFF",
  surfaceMuted: "rgba(31,51,82,0.04)",
  // 文字四级：ink / 次级正文 / 弱化 / 极弱
  text: "#1E293B",
  textMuted: "#66758B",
  /** 次级正文灰：对白底与画布均满足 WCAG AA 正文 4.5（tokens.test.ts 锁定） */
  textSecondary: "#55657C",
  textFaint: "#9AA7B8",
  border: "#E9EEF5",
  borderStrong: "#D8E0EC",

  // 唯一主色：天蓝
  primary: "#4777E8",
  primaryStrong: "#315FC8",
  primarySoft: "#EDF3FF",

  // 语义色（橙=提醒/成就，不再是主色）
  accent: "#D9942D",
  accentStrong: "#B87818",
  accentSoft: "#FFF5E6",

  success: "#269B72",
  successSoft: "#E8F6F0",
  warning: "#D9942D",
  warningSoft: "#FFF5E6",
  danger: "#D85B64",
  dangerSoft: "#FFF0F1",

  // 领域点缀色（图表/标签）
  sun: "#F5A94B",
  coral: "#E8756A",
  teal: "#2FA79B",
  lavender: "#7E86E8",
  peach: "#F2A97E",

  scrim: "rgba(18,24,38,0.42)",

  // 玻璃材质（Android 走 BlurView 叠加层，iOS 走系统 GlassView）
  glassTint: "rgba(255,255,255,0.62)",
  glassBorder: "rgba(255,255,255,0.85)",
  glassHighlight: "rgba(255,255,255,0.9)",
  glassShade: "rgba(214,229,255,0.35)",

  // 专注沉浸暗色世界（全屏专注，不随主题切换）
  focusCanvas: "#0F2027",
  focusAccent: "#FFC46B",
  focusSurface: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.22)",

  chart: ["#4777E8", "#7E9CF2", "#B3C6F8", "#D9942D", "#269B72"],
};

/** 深色档：冷调深蓝黑（不用纯黑），玻璃用深色半透 + 顶部高光 */
const darkColors = {
  canvas: "#0F1420",
  surface: "#161C29",
  surfaceStrong: "#1D2534",
  surfaceMuted: "rgba(255,255,255,0.06)",
  text: "#E8EDF5",
  textMuted: "#8D9AAF",
  textSecondary: "#C2CBD9",
  textFaint: "#6B7788",
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.20)",

  primary: "#6E97F5",
  primaryStrong: "#8FADF8",
  primarySoft: "rgba(71,119,232,0.22)",

  accent: "#E5A94F",
  accentStrong: "#F2BC75",
  accentSoft: "rgba(217,148,45,0.18)",

  success: "#4CC08D",
  successSoft: "rgba(38,155,114,0.22)",
  warning: "#E8B54A",
  warningSoft: "rgba(217,148,45,0.20)",
  danger: "#E57F87",
  dangerSoft: "rgba(216,91,100,0.22)",

  sun: "#F5A94B",
  coral: "#E8756A",
  teal: "#2FA79B",
  lavender: "#8A92E8",
  peach: "#F2A97E",

  scrim: "rgba(0,0,0,0.55)",

  glassTint: "rgba(22,28,41,0.72)",
  glassBorder: "rgba(255,255,255,0.14)",
  glassHighlight: "rgba(255,255,255,0.18)",
  glassShade: "rgba(71,119,232,0.20)",

  focusCanvas: "#0F2027",
  focusAccent: "#FFC46B",
  focusSurface: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.22)",

  chart: ["#6E97F5", "#8FADF8", "#E5A94F", "#4CC08D", "#A9AFF0"],
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
  /** v2：卡片 / 控件 / 大面板（与原型 V3 对齐） */
  card: 19,
  control: 13,
  panel: 22,
} as const;

/**
 * 投影：v2 更轻（层级主要靠描边与色场差，投影只做辅助）。
 * 中性近黑低透明度；深色下投影几乎不可见，属正常表现。
 */
export const shadows: Record<"card" | "floating" | "brand" | "glass", ViewStyle> = {
  card: {
    shadowColor: "#23304E",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#23304E",
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  brand: {
    shadowColor: "#315FC8",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /** 玻璃锚点（专注卡 / 弹层）：更大更柔的蓝色投影 */
  glass: {
    shadowColor: "#4370B8",
    shadowOpacity: 0.12,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
};

/** 旧版时长表（micro/standard/pressScale/stagger）；新代码优先 lib/motion.ts 的 DURATION/SPRING */
export const motion = {
  micro: { duration: 160 },
  standard: { duration: 260 },
  pressScale: 0.97,
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
 * v2 新增：pageTitle / hero / section / meta / eyebrow / num（原型 V3 字阶）。
 * 既有键保持不变（大量页面在用），增量迁移到新键。
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "600" },

  // ---- v2 新增（原型 V3 字阶）----
  /** 页面主标题：27/800，负字距 */
  pageTitle: { fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6 },
  /** Hero 标题：21/800 */
  hero: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 },
  /** 区块标题：14/700 */
  section: { fontSize: 14, lineHeight: 20, fontWeight: "700", letterSpacing: -0.15 },
  /** 说明/元信息：12/400 */
  meta: { fontSize: 12, lineHeight: 17, fontWeight: "400" },
  /** eyebrow：9/800 大写字距（页头上方小标签） */
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 1.4 },
  /** 数字展示：20/800 等宽（配合 tabularNums） */
  num: { fontSize: 20, lineHeight: 24, fontWeight: "800", letterSpacing: -0.3 },
} as const;

export type TypographyToken = keyof typeof typography;

/** 数字类文本：等宽数字，保证统计/时长/百分比纵向对齐 */
export const tabularNums = { fontVariant: ["tabular-nums" as const] };
