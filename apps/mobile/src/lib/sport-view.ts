import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { SPORT_CATALOG, type ExerciseType } from "@learn-workbench/shared";

/**
 * 移动端运动视图层：与 packages/shared SPORT_CATALOG（31 项）对齐。
 * 图标（Android Ionicons / iOS SF Symbols 走 themed-icon 映射）、大类配色、选中动画词汇表。
 * 动画词汇表与 Web 端 sport-animated-icon 的 keyframes 分组保持同一套语义。
 */
export type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type SportAnimPreset =
  | "ball-bounce" // 球类：弹跳 + 旋转
  | "racket-sway" // 球拍类：左右晃动
  | "stroll" // 散步类：缓慢摇摆
  | "run-bounce" // 跑步类：快速颠簸
  | "ride" // 骑行：水平颠簸
  | "swim" // 游泳：波浪起伏
  | "rope" // 跳绳：节拍快跳
  | "strength" // 力量：垂直一起一落
  | "tremble" // 平板支撑：高频微颤
  | "breath" // 瑜伽/拉伸：呼吸式缓胀缩
  | "climb" // 爬楼梯：阶梯上跳
  | "pop"; // 兜底：轻弹一下

/** Android Ionicons 指派（iOS 端由 SF Symbols 映射表处理） */
export const SPORT_ICONS: Record<string, IoniconName> = {
  basketball: "basketball",
  badminton: "tennisball",
  volleyball: "baseball",
  "table-tennis": "tennisball",
  soccer: "football",
  tennis: "tennisball",
  baseball: "baseball",
  run: "fitness",
  walk: "footsteps",
  "brisk-walk": "footsteps",
  cycling: "bicycle",
  "rope-jumping": "infinite",
  swimming: "water",
  dancing: "musical-notes",
  hiking: "trail-sign",
  frisbee: "disc",
  treadmill: "speedometer",
  boxing: "hand-left",
  "sit-ups": "body",
  squats: "body",
  "push-ups": "fitness",
  plank: "hourglass",
  dumbbells: "barbell",
  "pull-ups": "accessibility",
  crunches: "body",
  stretching: "accessibility",
  yoga: "flower",
  baduanjin: "leaf",
  "tai-chi": "sparkles",
  stairs: "trending-up",
  housework: "home",
};

export const SPORT_TYPE_COLORS: Record<ExerciseType, { c1: string; c2: string }> = {
  BALL: { c1: "#F28C28", c2: "#FFB37A" },
  AEROBIC: { c1: "#4F8CD6", c2: "#7FB4E8" },
  STRENGTH: { c1: "#8D7BD8", c2: "#B39AD9" },
  STRETCH: { c1: "#3DA35D", c2: "#6FC288" },
  MOVE: { c1: "#D99000", c2: "#E8B45A" },
  OTHER: { c1: "#64748B", c2: "#94A3B8" },
};

/** 项目 → 动画预设（与 Web 端动画词汇表同源分组） */
export const SPORT_ANIMS: Record<string, SportAnimPreset> = {
  basketball: "ball-bounce",
  soccer: "ball-bounce",
  tennis: "ball-bounce",
  baseball: "ball-bounce",
  volleyball: "ball-bounce",
  "table-tennis": "ball-bounce",
  badminton: "racket-sway",
  frisbee: "racket-sway",
  walk: "stroll",
  "brisk-walk": "stroll",
  hiking: "stroll",
  housework: "stroll",
  run: "run-bounce",
  treadmill: "run-bounce",
  boxing: "run-bounce",
  cycling: "ride",
  swimming: "swim",
  "rope-jumping": "rope",
  "sit-ups": "strength",
  squats: "strength",
  "push-ups": "strength",
  crunches: "strength",
  dumbbells: "strength",
  "pull-ups": "strength",
  plank: "tremble",
  stretching: "breath",
  yoga: "breath",
  baduanjin: "breath",
  "tai-chi": "breath",
  stairs: "climb",
};

export function sportAnimOf(sportKey: string): SportAnimPreset {
  return SPORT_ANIMS[sportKey] ?? "pop";
}

/** 图标：先按注册表 key，再用名称反查（同步下来的远端记录可能缺 key） */
export function sportIconOf(sportKey: string | undefined, name?: string): IoniconName {
  if (sportKey && SPORT_ICONS[sportKey]) return SPORT_ICONS[sportKey];
  const item = SPORT_CATALOG.find((s) => s.name === name);
  if (item && SPORT_ICONS[item.key]) return SPORT_ICONS[item.key];
  return "body";
}

export function sportColorsOf(type: ExerciseType): { c1: string; c2: string } {
  return SPORT_TYPE_COLORS[type] ?? SPORT_TYPE_COLORS.OTHER;
}
