import { useTheme } from "@/theme";

/**
 * V15 视觉体系（对齐 prototype v12 · Nutrition / Training / Sleep deep-dive）。
 *
 * 为什么单独一套色板：这三页在 demo 里是「暖色编辑感」的独立世界，
 * 与全局冷调工作台（瓷白/深青）刻意区分；因此颜色不扩进 ThemeColors，
 * 避免所有页面被动继承。深色档跟随全局 dark 开关。
 */
export interface V15Palette {
  dark: boolean;
  canvas: string;
  canvasTop: string;
  ink: string;
  ink2: string;
  sub: string;
  faint: string;
  card: string;
  card2: string;
  line: string;
  lineStrong: string;
  track: string;
  orange: string;
  orangeStrong: string;
  orangeSoft: string;
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  lilac: string;
  lilacSoft: string;
  red: string;
  redSoft: string;
  /** 深色 hero 上的正文/弱化文字 */
  heroInk: string;
  heroSub: string;
  heroLine: string;
  shadow: string;
}

const LIGHT: V15Palette = {
  dark: false,
  canvas: "#F7F2EA",
  canvasTop: "#FBF7F1",
  ink: "#1A1713",
  ink2: "#423C34",
  sub: "#7A7369",
  faint: "#A69C90",
  card: "#FFFFFF",
  card2: "#FBF8F4",
  line: "rgba(26,23,19,0.085)",
  lineStrong: "rgba(26,23,19,0.15)",
  track: "rgba(26,23,19,0.075)",
  orange: "#F25C0A",
  orangeStrong: "#D14B00",
  orangeSoft: "#FFEADB",
  blue: "#2D7FF9",
  blueSoft: "#E8F0FF",
  green: "#2E9E63",
  greenSoft: "#E6F5EC",
  amber: "#EE9A1A",
  amberSoft: "#FFF2D9",
  lilac: "#6D74E8",
  lilacSoft: "#EDEEFE",
  red: "#DD5A4E",
  redSoft: "#FCEAE8",
  heroInk: "#F8F3EA",
  heroSub: "rgba(248,243,234,0.66)",
  heroLine: "rgba(255,255,255,0.12)",
  shadow: "#3A2918",
};

const DARK: V15Palette = {
  dark: true,
  canvas: "#141311",
  canvasTop: "#191714",
  ink: "#F5F0E9",
  ink2: "#D2C9BD",
  sub: "#A69C90",
  faint: "#7F766B",
  card: "#1C1B19",
  card2: "#22201D",
  line: "rgba(255,255,255,0.095)",
  lineStrong: "rgba(255,255,255,0.17)",
  track: "rgba(255,255,255,0.10)",
  orange: "#FF8A4C",
  orangeStrong: "#FFA273",
  orangeSoft: "rgba(242,92,10,0.16)",
  blue: "#6CA6FF",
  blueSoft: "rgba(45,127,249,0.15)",
  green: "#5ECB8D",
  greenSoft: "rgba(46,158,99,0.15)",
  amber: "#F6B84D",
  amberSoft: "rgba(238,154,26,0.15)",
  lilac: "#9FA5FF",
  lilacSoft: "rgba(109,116,232,0.16)",
  red: "#F0857A",
  redSoft: "rgba(221,90,78,0.16)",
  heroInk: "#F7F2FA",
  heroSub: "rgba(247,242,250,0.62)",
  heroLine: "rgba(255,255,255,0.12)",
  shadow: "#000000",
};

export function v15Palette(dark: boolean): V15Palette {
  return dark ? DARK : LIGHT;
}

export function useV15(): V15Palette {
  const { dark } = useTheme();
  return v15Palette(dark);
}

/** 卡片投影：暖色低透明度；深色档靠描边立层级，投影归零（Android elevation 会画矩形轮廓） */
export function v15CardShadow(p: V15Palette) {
  if (p.dark) {
    return { shadowColor: p.shadow, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 };
  }
  return { shadowColor: p.shadow, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 };
}

export function v15HeroShadow(p: V15Palette) {
  if (p.dark) return { shadowOpacity: 0, elevation: 0 };
  return { shadowColor: "#7A3A0C", shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 5 };
}
