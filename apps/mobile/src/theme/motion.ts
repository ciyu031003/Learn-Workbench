import { Easing } from "react-native-reanimated";

/**
 * v13 · 移动端动效 token（唯一事实源）
 *
 * 与 Web `apps/web/app/globals.css` 的 `--motion-*` / `--ease-*` 一一对应，
 * 保证两端"同一动作同一节奏"。旧的 `theme/tokens.ts#motion`（micro/standard）保持不动，
 * 供既有组件继续使用；新组件请用本文件的 `motion.fast/base/slow`。
 *
 * 技法参考: uiverse.io/JkHuger/itchy-turtle-45 (MIT) —— 过冲缓动 cubic-bezier(.8,.5,.2,1.4)
 * 降级：`MOTION_ENABLED = false`（低端机）或系统「减弱动态效果」开启时，所有装饰动画时长归零。
 */

/**
 * 动画总开关。
 * 类型标成 boolean（而不是字面量 true）是为了让 `if (!MOTION_ENABLED)` 成为真实的运行期分支：
 * 低端机降级时把这里改 false 即可，不需要逐处删动画。
 */
export const MOTION_ENABLED: boolean = true;

/** 时长（ms）：150 微反馈 / 240 常规 / 400 扫光与描边绘制 */
export const motion = { fast: 150, base: 240, slow: 400 } as const;

export type MotionToken = keyof typeof motion;

/** 常用时长常量（避免调用方到处写 `motion.slow` 的别名） */
export const MOTION_FAST: number = motion.fast;
export const MOTION_BASE: number = motion.base;
export const MOTION_SLOW: number = motion.slow;

/** 标准缓动控制点，等价 Web `--ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1)` */
export const EASE_STANDARD_POINTS = [0.22, 0.61, 0.36, 1] as const;
/** 过冲缓动控制点，等价 Web `--ease-overshoot: cubic-bezier(0.8, 0.5, 0.2, 1.4)` */
export const EASE_OVERSHOOT_POINTS = [0.8, 0.5, 0.2, 1.4] as const;

/** 标准缓动（Reanimated 版；由 worklet 化的 Easing.bezier 生成，可安全传进 withTiming） */
export const easingStandard = Easing.bezier(
  EASE_STANDARD_POINTS[0],
  EASE_STANDARD_POINTS[1],
  EASE_STANDARD_POINTS[2],
  EASE_STANDARD_POINTS[3]
);

/** 过冲缓动：日/夜开关、按压回弹这类"回弹一下"的动作 */
export const easingOvershoot = Easing.bezier(
  EASE_OVERSHOOT_POINTS[0],
  EASE_OVERSHOOT_POINTS[1],
  EASE_OVERSHOOT_POINTS[2],
  EASE_OVERSHOOT_POINTS[3]
);

/**
 * 是否允许播放装饰动画：总开关关闭、或系统「减弱动态效果」开启，都返回 false。
 * 纯函数（不依赖 hook），便于单测；组件里请用 `isMotionActive(useReducedMotion())`。
 */
/* ============================================================================
 * 用户级动效开关（v1.62 P2-2 · 设置页「动效」）
 *
 * 与 MOTION_ENABLED 的关系：MOTION_ENABLED 是**编译期/设备级**总开关（低端机降级），
 * 这里再叠一层**运行期用户开关**（持久化在 app-store 的 motionEnabled，启动时由 _layout 应用）。
 * 之所以用模块变量而不是 React context：全 App 有 40+ 处直接调 isMotionActive(reduced)，
 * 走 context 就要改每个组件签名；模块变量 + 订阅表可以让既有调用点零改动地生效。
 * ==========================================================================*/

/** 用户是否允许动效（默认 true；false = 等同系统「减弱动态」） */
let userMotionEnabled = true;
const motionUserListeners = new Set<() => void>();

export function getMotionUserEnabled(): boolean {
  return userMotionEnabled;
}

/** 设置用户级开关（幂等；变化时通知订阅者，已挂载的组件/钩子会立即跟随） */
export function setMotionUserEnabled(enabled: boolean): void {
  const next = enabled !== false;
  if (next === userMotionEnabled) return;
  userMotionEnabled = next;
  for (const listener of [...motionUserListeners]) {
    try {
      listener();
    } catch {
      // 单个订阅者异常不影响其它订阅者（动效开关不能把页面搞崩）
    }
  }
}

export function subscribeMotionUserEnabled(listener: () => void): () => void {
  motionUserListeners.add(listener);
  return () => {
    motionUserListeners.delete(listener);
  };
}

/**
 * 运行期最终是否允许装饰动效：设备级总开关 && 用户开关。
 * 纯函数（两个入参都可注入，单测不依赖模块状态）。
 */
export function isMotionEnabled(
  enabled: boolean = MOTION_ENABLED,
  userEnabled: boolean = userMotionEnabled
): boolean {
  return enabled !== false && userEnabled !== false;
}

/**
 * 是否允许播放装饰动效。
 *
 * 三个否决源都生效：调用方入参（设备级总开关，如 MOTION_ENABLED）、**用户级开关**（设置页
 * 「动效」，全局否决，不能被显式入参绕过 —— 否则每日背景/骨架屏这类显式传
 * isMotionActive(reduced, MOTION_ENABLED) 的组件会漏网）、系统「减弱动态」。
 */
export function isMotionActive(reduceMotion: boolean, enabled: boolean = true): boolean {
  return isMotionEnabled(enabled, userMotionEnabled) && reduceMotion !== true;
}

/** 动画时长解析：不允许动画时恒为 0（Reanimated 收到 0 即"瞬间到终态"，不产生逐帧开销） */
export function motionDuration(ms: number, reduceMotion: boolean, enabled: boolean = true): number {
  if (!isMotionActive(reduceMotion, enabled)) return 0;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** 按 token 取时长：`motionTokenDuration("slow", reduced)` → 400 或 0 */
export function motionTokenDuration(
  token: MotionToken,
  reduceMotion: boolean,
  enabled: boolean = true
): number {
  return motionDuration(motion[token], reduceMotion, enabled);
}
