import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motion as legacyMotion } from "@/theme/tokens";
import { motion as motionTokens } from "@/theme/motion";

/**
 * 动效词汇表（组件侧入口）
 *
 * ## 与 theme/motion.ts 的关系（重要）
 * 时长与缓动的**唯一事实源是 `src/theme/motion.ts`**（v13）：
 *   fast 150 / base 240 / slow 400，且与 Web `apps/web/app/globals.css` 的 `--motion-*` 一一对应，
 *   由 `theme/motion.test.ts` 锁死。
 * 本文件因此**不再自己定义一套时长**（v17 方案里"180–220 / 250–300 / 350–400"的写法会破坏
 * Web 两端同节奏的既有约定，并让上面的测试变红），只做两件事：
 *   1) 把 durations / easing 原样再导出，让组件不必记两个模块路径；
 *   2) 补上项目里**确实缺失**的那一块 —— 弹簧（SPRING）。
 *
 * ## 弹簧的量纲陷阱（务必先读再改）
 * iOS / Framer Motion 说的 "damping 0.86" 是**阻尼比（ratio，0–1）**；
 * 而 Reanimated 的 `withSpring({ damping })` 收的是**阻尼系数（与 stiffness/mass 同量纲）**，
 * 直接把 0.86 传给 Reanimated 会得到几乎不衰减的弹簧（乱弹）。
 * 换算：`damping = ratio × 2 × sqrt(stiffness × mass)`（临界阻尼 = 2√(km)）。
 * 本文件的 `SPRING` 已按 **ratio ≈ 0.86** 预先算好，改值请用 `dampingForRatio()` 反推。
 *
 * 降级：`MOTION_ENABLED = false`（低端机）或系统「减弱动态效果」开启时，装饰动画时长归零。
 * 组件里请用 `useReducedMotion()` + `isMotionActive()`（后者来自 theme/motion）。
 */

/** 时长 token（再导出，等价 theme/motion.ts 的 `motion`） */
export const DURATION = motionTokens;

export { MOTION_ENABLED, easingOvershoot, easingStandard } from "@/theme/motion";
export type { MotionToken } from "@/theme/motion";

/**
 * 阻尼比 → Reanimated damping。
 * 例：ratio 0.86 / stiffness 220 / mass 1 → 0.86 × 2 × √220 ≈ 25.5
 */
export function dampingForRatio(ratio: number, stiffness: number, mass = 1): number {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const k = Number.isFinite(stiffness) && stiffness > 0 ? stiffness : 220;
  const m = Number.isFinite(mass) && mass > 0 ? mass : 1;
  return Math.round(r * 2 * Math.sqrt(k * m) * 10) / 10;
}

/**
 * 弹簧参数表（全部按 ratio ≈ 0.86 预置：有回弹但不"甩"，接近 iOS 默认手感）
 * - sheet  ：弹层上滑（原 ANIM.sheetSpring 的 18 其实是欠阻尼，会晃两下，这里收敛到 iOS 观感）
 * - snappy ：按压回弹、勾选
 * - gentle ：大面板 / 拖拽释放
 * - press  ：按钮抬起
 */
export const SPRING = {
  sheet: { damping: dampingForRatio(0.86, 220), stiffness: 220 },
  snappy: { damping: dampingForRatio(0.86, 320), stiffness: 320 },
  gentle: { damping: dampingForRatio(0.86, 160), stiffness: 160 },
  press: { damping: dampingForRatio(0.9, 300), stiffness: 300 },
} as const;

/**
 * 旧词汇表（保留导出名与形状，供既有引用继续工作）。
 * 注意：当前仓库内 `ANIM` 暂无消费点（v17 方案 §7 记录 `ANIM.stagger` 0 使用），
 * 这里只做"值对齐到 theme/motion"，不改结构。
 */
export const ANIM = {
  /** 进入：透明度 + 轻微上移 */
  enter: { from: { opacity: 0, translateY: 8 }, duration: DURATION.fast },
  /** 退出 */
  exit: { to: { opacity: 0, translateY: 4 }, duration: DURATION.fast },
  /** 弹层弹簧（见 SPRING.sheet；damping 已按 ratio 0.86 换算） */
  sheetSpring: SPRING.sheet,
  /** 强调脉冲（呼吸灯） */
  pulse: { min: 0.55, max: 1, duration: DURATION.base },
  /** 列表逐项入场间隔（沿用 tokens 的既有值，其他流在消费） */
  stagger: legacyMotion.stagger,
  pressScale: legacyMotion.pressScale,
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
