import type { ViewStyle } from "react-native";

/**
 * 移动端视觉 Token（v3.0 · 瓷白冷调浅工作台 / 深色夜航）
 * 单一事实源：五个 Tab 与二级页的颜色、圆角、阴影、排版全部从这里取，禁止裸写色值。
 *
 * v3 设计基线（2026-11）：对齐《Learn-Workbench 移动端界面优化提案》可运行原型——
 * 瓷白偏冷画布 + 白卡细描边 + 唯一主色晴空蓝 + 阳光橘只标「今天」，
 * 层级用色场与细边表达，阴影只做辅助。玻璃材质只在「视觉锚点」与导航出现，见 components/surface.tsx。
 */
const lightColors = {
  // 画布：瓷白偏冷（非纯白），让白卡浮起来
  canvas: "#F1F4F5",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFFFF",
  surfaceMuted: "rgba(15,25,29,0.04)",
  // 文字四级：ink / 次级正文 / 弱化 / 极弱
  text: "#0F191D",
  // 审查修复：#78888F 对白卡仅 3.67（< WCAG AA 4.5），#64767D 对白卡 4.74/对画布 4.29，色相同源只压暗一档
  textMuted: "#64767D",
  /** 次级正文灰：对白底与画布均满足 WCAG AA 正文 4.5（tokens.test.ts 锁定） */
  textSecondary: "#3F5058",
  textFaint: "#93A2A8",
  border: "rgba(15,25,29,0.085)",
  borderStrong: "rgba(15,25,29,0.14)",

  // 唯一主色：晴空蓝
  primary: "#2F74C0",
  primaryStrong: "#1B4F87",
  primarySoft: "#E3EFF9",

  // 语义色：阳光橘只给「此刻 / 今天」一个角色
  accent: "#E1781C",
  accentStrong: "#B85C12",
  accentSoft: "#FBEFE1",

  success: "#3DA35D",
  successSoft: "#E7F3EB",
  warning: "#D99000",
  warningSoft: "#FBEFE1",
  danger: "#C04545",
  dangerSoft: "#F7E9E9",

  // 领域点缀色（图表/标签）
  sun: "#F3C495",
  coral: "#E8756A",
  teal: "#2FA79B",
  lavender: "#7E86E8",
  peach: "#F2A97E",

  scrim: "rgba(15,25,29,0.42)",

  // 玻璃材质（Android 走 BlurView 叠加层，iOS 走系统 GlassView）
  // 透明度整体提高（更"实"），层级靠描边 + 高光 + 投影，避免"过于透明"。
  glassTint: "rgba(255,255,255,0.64)",
  glassBorder: "rgba(255,255,255,0.92)",
  glassHighlight: "rgba(255,255,255,0.95)",
  glassShade: "rgba(155,196,232,0.30)",

  // 专注沉浸暗色世界（全屏专注，不随主题切换）
  focusCanvas: "#08131B",
  focusAccent: "#F3C495",
  focusSurface: "rgba(255,255,255,0.10)",
  focusBorder: "rgba(255,255,255,0.20)",

  chart: ["#2F74C0", "#5B93D6", "#8BB7E8", "#E1781C", "#3DA35D"],
};

/** 深色档：冷调深青黑（不用纯黑），玻璃用深色半透 + 顶部高光 */
const darkColors = {
  canvas: "#0B1216",
  surface: "#121A1F",
  surfaceStrong: "#172026",
  surfaceMuted: "rgba(255,255,255,0.05)",
  text: "#E6ECEE",
  textMuted: "#8A989E",
  textSecondary: "#B7C3C8",
  textFaint: "#66747B",
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.18)",

  primary: "#5B93D6",
  primaryStrong: "#8BB7E8",
  primarySoft: "rgba(47,116,192,0.22)",

  accent: "#F0A05C",
  accentStrong: "#F3C495",
  accentSoft: "rgba(225,120,28,0.18)",

  success: "#5FBF7D",
  successSoft: "rgba(61,163,93,0.20)",
  warning: "#E0A94A",
  warningSoft: "rgba(217,144,0,0.20)",
  danger: "#E07A7A",
  dangerSoft: "rgba(192,69,69,0.20)",

  sun: "#F3C495",
  coral: "#E8756A",
  teal: "#2FA79B",
  lavender: "#8A92E8",
  peach: "#F2A97E",

  scrim: "rgba(0,0,0,0.55)",

  glassTint: "rgba(18,26,30,0.82)",
  glassBorder: "rgba(255,255,255,0.16)",
  glassHighlight: "rgba(255,255,255,0.20)",
  glassShade: "rgba(91,147,214,0.18)",

  focusCanvas: "#08131B",
  focusAccent: "#F3C495",
  focusSurface: "rgba(255,255,255,0.10)",
  focusBorder: "rgba(255,255,255,0.20)",

  chart: ["#5B93D6", "#8BB7E8", "#B8D3EC", "#F0A05C", "#5FBF7D"],
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  /** v3：机壳 / 卡片 / 控件 / 胶囊四角色（与优化提案对齐） */
  shell: 30,
  card: 18,
  control: 12,
  panel: 22,
} as const;

/**
 * 投影：v3 更轻（层级主要靠描边与色场差，投影只做辅助）。
 * 中性近黑低透明度；深色下投影几乎不可见，属正常表现。
 */
export const shadows: Record<"card" | "floating" | "brand" | "glass", ViewStyle> = {
  card: {
    shadowColor: "#0F2530",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#0F2530",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  brand: {
    shadowColor: "#1B4F87",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /**
   * 玻璃锚点（专注卡 / 弹层）：更大更柔的蓝绿色投影。
   * **elevation 必须为 0**：Android 上 elevation 对「半透明/透明底 + 圆角」的 View 会按不透明矩形
   * 画轮廓，真机表现为卡片底部/四周出现白块（v2.0.1 反馈的"白色矩形"根因之一）。
   */
  glass: {
    shadowColor: "#1B4F87",
    shadowOpacity: 0.14,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 14 },
    elevation: 0,
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
 * v3 字阶对齐提案：27 页面主标题 / 16 区块 / 15.5 正文 / 11 元信息。
 * 既有键保持不变（大量页面在用），增量迁移到新键。
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  body: { fontSize: 15.5, lineHeight: 23, fontWeight: "400" },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: "600" },

  // ---- v3 字阶（提案对齐）----
  /** 页面主标题：27/800，负字距 */
  pageTitle: { fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6 },
  /** Hero 标题：21/800 */
  hero: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 },
  /** 区块标题：16/700 */
  section: { fontSize: 16, lineHeight: 22, fontWeight: "700", letterSpacing: -0.15 },
  /** 说明/元信息：11/400 */
  meta: { fontSize: 11, lineHeight: 16, fontWeight: "400" },
  /** eyebrow：9/800 大写字距（页头上方小标签） */
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 1.4 },
  /** 数字展示：20/800 等宽（配合 tabularNums） */
  num: { fontSize: 20, lineHeight: 24, fontWeight: "800", letterSpacing: -0.3 },
} as const;

export type TypographyToken = keyof typeof typography;

/** 数字类文本：等宽数字，保证统计/时长/百分比纵向对齐 */
export const tabularNums = { fontVariant: ["tabular-nums" as const] };
