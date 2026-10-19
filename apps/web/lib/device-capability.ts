/**
 * 设备能力判定（S3-6）：决定是否把 three.js 3D 组件降级为静态 CSS/SVG。
 *
 * 设计要点：
 *  1. **纯函数 + 显式输入**：`shouldDegrade3d` 不读全局，便于单测与将来换成服务端 UA 判定。
 *  2. **只降级、不误伤**：字段缺失一律按"正常设备"处理（老浏览器没有 deviceMemory/connection）。
 *  3. **省流优先**：`saveData` 为 true 时直接降级（用户主动要求省流量，3D 属可省资源）。
 */

export interface DeviceHints {
  /** navigator.hardwareConcurrency，逻辑核心数 */
  hardwareConcurrency?: number;
  /** navigator.deviceMemory，GB（Chrome 专有，非标准） */
  deviceMemory?: number;
  /** navigator.connection.saveData，省流量模式 */
  saveData?: boolean;
}

/** ≤4 核视为低端（近 3 年中端机也常是 8 核，4 核多是老设备/低端机） */
export const LOW_END_MAX_CORES = 4;
/** ≤2GB 内存视为低端 */
export const LOW_END_MAX_MEMORY_GB = 2;

/**
 * 是否应把 3D 组件降级为静态回退。
 * - 省流量模式：降级
 * - 核心数 ≤ 4：降级
 * - 内存 ≤ 2GB：降级
 * 其余（含字段缺失）返回 false，保持 3D。
 */
export function shouldDegrade3d(hints: DeviceHints = {}): boolean {
  if (hints.saveData === true) return true;
  const cores = hints.hardwareConcurrency;
  if (typeof cores === "number" && Number.isFinite(cores) && cores > 0 && cores <= LOW_END_MAX_CORES) return true;
  const memory = hints.deviceMemory;
  if (typeof memory === "number" && Number.isFinite(memory) && memory > 0 && memory <= LOW_END_MAX_MEMORY_GB) return true;
  return false;
}

interface NavigatorLike {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** 从 navigator（或测试替身）读取能力提示；SSR / 无 navigator 时返回空对象 */
export function readDeviceHints(source?: NavigatorLike): DeviceHints {
  if (!source) return {};
  const hints: DeviceHints = {};
  if (typeof source.hardwareConcurrency === "number") hints.hardwareConcurrency = source.hardwareConcurrency;
  if (typeof source.deviceMemory === "number") hints.deviceMemory = source.deviceMemory;
  if (typeof source.connection?.saveData === "boolean") hints.saveData = source.connection.saveData;
  return hints;
}

/** 浏览器环境读取（SSR 安全） */
export function readNavigatorHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  return readDeviceHints(navigator as unknown as NavigatorLike);
}
