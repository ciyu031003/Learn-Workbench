import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import type { View as RNView } from "react-native";

/**
 * Android 玻璃的截图目标（2.8.0 起被紧急停用，原因见下）。
 *
 * ## 为什么停用（2.8.2，原生闪退根因）
 * expo-blur 在 Android 用 eightbitlab BlurView：它会把 `blurTarget` 指向的视图
 * **整棵子树画进一块离屏 canvas** 再模糊。我们的壳层里同时存在多个 BlurView
 * （悬浮底栏、玻璃卡、折叠页头、专注计时），而它们全都在这棵子树里面 ——
 * 于是「画目标 → 画到玻璃卡 → 玻璃卡又去画目标」形成**递归**。
 *
 * 2.8.0 的崩溃日志（服务器 /api/diagnostics 落盘，2026-11-22 09:31）是：
 *   SIGSEGV / SEGV_ACCERR — stack pointer is not in a rw map; likely due to stack overflow
 *   thread = pool-5-thread-1
 *   栈：#345..#511 全是 libhwui 的
 *     RenderNode::prepareTreeImpl ↔ SkiaDisplayList::prepareListAndChildren
 * 即 hwui 在画显示器列表时递归到栈溢出。这正是「玻璃视图把自己当成背景」的典型形态。
 *
 * ## 现在的行为
 * 挂一个纯 View 容器并向下给 `null`：expo-blur 在 Android 收到空 target 会把
 * blur 降级为 NONE（透明），由 Surface 的 glassTint / 底栏染色层提供「磨砂实底」，
 * 视觉是半透明实底而不是真模糊 —— 用可接受的观感换掉原生崩溃。
 * iOS 不受影响：iOS 26 走系统 GlassView，其余走系统原生模糊，不需要 blurTarget。
 *
 * ## 正确做法（后续，需真机验证）
 * 按 expo-blur 文档把 BlurTargetView 只包**内容层**，让所有 BlurView 成为它的
 * **兄弟节点**（悬浮底栏要从 Tabs 的 tabBar 里提出来，或给每个 tab 屏单独包一层
 * target 并由底栏读取当前屏 ref）。在真机验证「进/出页面、开合弹层、滚动」四条
 * 路径不崩之后再恢复真玻璃。
 */
const BlurTargetContext = createContext<RefObject<RNView | null> | null>(null);

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const ref = useRef<RNView | null>(null);
  // 保留 ref 供未来 sibling 结构使用；当前不下发，避免 Android 再次进入递归截图
  return (
    <BlurTargetContext.Provider value={null}>
      <View ref={ref} style={styles.fill} collapsable={false}>
        {children}
      </View>
    </BlurTargetContext.Provider>
  );
}

/** BlurView 的 blurTarget：当前恒为 null（Android 玻璃停用以规避原生栈溢出） */
export function useBlurTarget(): RefObject<RNView | null> | null {
  return useContext(BlurTargetContext);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
