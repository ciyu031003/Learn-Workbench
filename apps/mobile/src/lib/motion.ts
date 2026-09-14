import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motion } from "@/theme/tokens";

/**
 * 动效词汇表（唯一事实源）
 *
 * 原则（见 docs/APP端设计与打包方案.md §5.4）：
 * - 进入/切换：淡入 + 8pt 上移，180ms
 * - 弹层：弹簧（damping 18 / stiffness 220）
 * - 按压：scale 0.96（PressableScale 已有）
 * - 全部动效尊重系统「减弱动态效果」：开启时降级为无动画状态切换
 */
export const ANIM = {
  /** 进入：透明度 + 轻微上移 */
  enter: { from: { opacity: 0, translateY: 8 }, duration: motion.micro.duration },
  /** 退出 */
  exit: { to: { opacity: 0, translateY: 4 }, duration: motion.micro.duration },
  /** 弹层弹簧 */
  sheetSpring: { damping: 18, stiffness: 220 },
  /** 强调脉冲（呼吸灯） */
  pulse: { min: 0.55, max: 1, duration: motion.standard.duration },
  /** 列表逐项入场间隔 */
  stagger: motion.stagger,
  pressScale: motion.pressScale,
} as const;

/**
 * 系统是否开启「减弱动态效果」。
 * 订阅 reduceMotionChanged，系统开关切换后已挂载的组件会立即跟随。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(Boolean(v));
      })
      .catch(() => {
        // 平台不支持时按未开启处理
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduced(Boolean(v)));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

/** 需要动画时长时的便捷读取：减弱动态效果下返回 0 */
export function useMotionDuration(duration: number): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : duration;
}
