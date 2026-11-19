import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView } from "expo-blur";

/**
 * Android 真玻璃的前提：expo-blur 在 Android 上必须给 BlurView 传一个可截图的
 * 目标视图（blurTarget），否则会退化成 `none`（就是之前 logcat 里反复刷的
 * "blurTarget prop has not been configured"）。
 *
 * 这里用 BlurTargetView 包住整棵壳层，并通过 Context 把 ref 交给下面的
 * BlurView（底部悬浮栏 / 玻璃卡）。iOS 走不上这条分支（iOS 直接系统玻璃）。
 */
const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const ref = useRef<View | null>(null);

  if (Platform.OS === "android") {
    return (
      <BlurTargetContext.Provider value={ref}>
        <BlurTargetView ref={ref} style={styles.fill} collapsable={false}>
          {children}
        </BlurTargetView>
      </BlurTargetContext.Provider>
    );
  }

  return (
    <BlurTargetContext.Provider value={null}>
      <View style={styles.fill}>{children}</View>
    </BlurTargetContext.Provider>
  );
}

/** BlurView 的 blurTarget：非 Android / 未挂 provider 时为 null（BlurView 会退化，不报错） */
export function useBlurTarget(): RefObject<View | null> | null {
  return useContext(BlurTargetContext);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
