"use client";

import { useMemo } from "react";
import { SportSvgIcon } from "@/components/sport/sport-svg-icon";

/**
 * 运动项目动态图标：静态 SVG + CSS 关键帧。
 * 选中（active）时按项目播放专属动画；未选中静止；hover 轻微动一下。
 * 全部动画仅 transform/opacity，prefers-reduced-motion 下静止（见 globals.css）。
 */
export function SportAnimatedIcon({
  itemKey,
  size = 40,
  active = false,
  className,
}: {
  itemKey: string;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const animClass = useMemo(() => (active ? `sport-anim-${animGroup(itemKey)}` : ""), [active, itemKey]);
  return (
    <span className={`sport-icon-wrap ${className ?? ""}`}>
      <SportSvgIcon itemKey={itemKey} size={size} className={`sport-anim-base ${animClass}`} />
    </span>
  );
}

/** 项目 → 动画组（共享同一组 keyframes 的项目归一组） */
function animGroup(key: string): string {
  switch (key) {
    case "basketball":
      return "bounce-squash";
    case "badminton":
      return "sway";
    case "volleyball":
    case "table-tennis":
      return "toss";
    case "soccer":
    case "tennis":
    case "baseball":
      return "roll";
    case "run":
    case "brisk-walk":
    case "frisbee":
      return "run-bounce";
    case "walk":
      return "sway-slow";
    case "cycling":
      return "vibrate-h";
    case "rope-jumping":
      return "hop";
    case "swimming":
      return "wave";
    case "dancing":
      return "groove";
    case "hiking":
      return "step-up";
    case "treadmill":
      return "run-bounce";
    case "boxing":
      return "punch";
    case "sit-ups":
    case "crunches":
      return "situp";
    case "squats":
      return "squat";
    case "push-ups":
      return "pushup";
    case "plank":
      return "tremble";
    case "dumbbells":
      return "lift";
    case "pull-ups":
      return "pullup";
    case "stretching":
      return "breathe";
    case "yoga":
      return "breathe-slow";
    case "baduanjin":
      return "taiji";
    case "tai-chi":
      return "taiji-slow";
    case "stairs":
      return "step-up";
    case "housework":
      return "sway";
    default:
      return "breathe";
  }
}
