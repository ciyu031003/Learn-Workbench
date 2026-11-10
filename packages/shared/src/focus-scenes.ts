/**
 * 专注场景目录（Web / Mobile 共用）。
 *
 * 图片已随各端打包（Web: public/scenes，Mobile: assets/images/scenes）；
 * imageUrl 仅保留为外部兜底，正常渲染不应依赖 CDN。
 * 不把截图本身当素材（含他人 UI 与文字），只保留场景语义与构图方向。
 */
export interface FocusScene {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  gradient: string;
  accent: string;
  soundscape: string;
}

export const FOCUS_SCENES: FocusScene[] = [
  {
    id: "window",
    name: "清晨窗边",
    tagline: "晨光 · 植物 · 安静书桌",
    imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#d9b48f 0%,#6d7f72 55%,#24313a 100%)",
    accent: "#F3C495",
    soundscape: "晨间鸟鸣与键盘声",
  },
  {
    id: "rain-cafe",
    name: "雨天咖啡店",
    tagline: "暖灯 · 咖啡 · 低声环境",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#3b2f2a 0%,#7b5b46 55%,#1b1b1d 100%)",
    accent: "#E8B07A",
    soundscape: "雨声与咖啡馆环境",
  },
  {
    id: "library",
    name: "深夜图书馆",
    tagline: "书架 · 台灯 · 低干扰",
    imageUrl: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#2d2118 0%,#6b4f33 55%,#120f0d 100%)",
    accent: "#D8A96A",
    soundscape: "纸页声与室内白噪音",
  },
  {
    id: "seaside",
    name: "海边书房",
    tagline: "海风 · 蓝光 · 开阔视野",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#8ec5d6 0%,#3b7f9e 55%,#163247 100%)",
    accent: "#A9D8E8",
    soundscape: "海浪与微风",
  },
  {
    id: "snow",
    name: "雪山清晨",
    tagline: "安静 · 冷空气 · 远山",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#b8c7d9 0%,#6f8298 55%,#28323f 100%)",
    accent: "#DCE8F5",
    soundscape: "高山风声与清晨空气",
  },
  {
    id: "campfire",
    name: "湖边篝火",
    tagline: "火光 · 夜色 · 慢节奏",
    imageUrl: "https://images.unsplash.com/photo-1475483768296-6163e08872a1?auto=format&fit=crop&w=1600&q=80",
    gradient: "linear-gradient(135deg,#2a1a12 0%,#8a4b2a 55%,#0d1117 100%)",
    accent: "#F0A05C",
    soundscape: "篝火噼啪与湖水",
  },
];

export const DEFAULT_FOCUS_SCENE_ID = "snow";

export function getFocusScene(id: string | null | undefined): FocusScene {
  return FOCUS_SCENES.find((scene) => scene.id === id) ?? FOCUS_SCENES[FOCUS_SCENES.length - 1];
}
