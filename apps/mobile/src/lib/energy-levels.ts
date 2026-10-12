/**
 * 精力状态档位（纯常量，零依赖 → 可被 vitest 直接加载）。
 *
 * ⚠️ 移动端 vitest 没有 RN preset（看板踩坑 48）：凡是 import 了 `@/config`
 * （→ expo-constants → react-native）的模块都不能被测试文件直接引用，
 * 所以这里把"纯数据 + 纯函数"单独放一个文件，网络请求留在 `lib/energy.ts`。
 */
export interface EnergyLevel {
  level: number;
  /**
   * @deprecated v1.44.2 去 emoji：改用 `icon`。
   * 保留字段是因为它可能已经写进服务端记录（历史数据），删掉会破坏类型兼容。
   */
  emoji: string;
  /** 渲染用开源图标名（Ionicons） */
  icon: string;
  label: string;
  color: string;
}

export const ENERGY_LEVELS: EnergyLevel[] = [
  { level: 1, emoji: "😪", icon: "sad-outline", label: "耗尽", color: "#E15A5A" },
  { level: 2, emoji: "🙁", icon: "remove-circle-outline", label: "疲惫", color: "#E1781C" },
  { level: 3, emoji: "🙂", icon: "ellipse-outline", label: "一般", color: "#C79A3E" },
  { level: 4, emoji: "😄", icon: "happy-outline", label: "不错", color: "#3DA35D" },
  { level: 5, emoji: "🤩", icon: "sparkles", label: "满格", color: "#2FB3A6" },
];

export function energyLevelOf(level: number | null | undefined): EnergyLevel | null {
  if (level === null || level === undefined) return null;
  return ENERGY_LEVELS.find((e) => e.level === level) ?? null;
}

export function isValidEnergyLevel(level: unknown): level is number {
  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 5;
}
