import type { RefObject } from "react";
import type { View } from "react-native";

/**
 * Android 真液态玻璃的「当前屏截图目标」注册表。
 *
 * expo-blur 的 BlurTargetView 会把目标视图整棵子树画进离屏 canvas；
 * 如果 BlurView 本身也在目标子树里，就会递归截图 → hwui 栈溢出（2.8.0 事故）。
 * 因此只允许**与目标同级的浮层**（悬浮底栏）读取这个 ref，
 * 屏幕内部的玻璃卡仍走「染色 + 高光」降级。
 */
let current: RefObject<View | null> | null = null;
const listeners = new Set<() => void>();

export function registerBlurTarget(ref: RefObject<View | null>) {
  if (current === ref) return;
  current = ref;
  listeners.forEach((listener) => listener());
}

export function getBlurTarget(): RefObject<View | null> | null {
  return current;
}

export function subscribeBlurTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
