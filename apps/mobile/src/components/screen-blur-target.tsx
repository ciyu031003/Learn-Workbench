import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type View, type ViewStyle } from "react-native";
import { BlurTargetView } from "expo-blur";
import { useIsFocused } from "expo-router";
import { registerBlurTarget } from "@/lib/blur-target-registry";

/**
 * 一级 Tab 屏幕的离屏截图目标。
 *
 * 只包**屏幕内容**；悬浮底栏在 Tabs 里与它是兄弟节点，blurTarget 指向这里，
 * 所以真正模糊的是页面，而不是「玻璃自己拍自己」。
 * 聚焦时把 ref 注册给底栏；切 Tab 时新屏会覆盖，底栏下一帧拿到新目标。
 */
export function ScreenBlurTarget({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View | null>(null);
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) registerBlurTarget(ref);
  }, [focused]);
  return (
    <BlurTargetView ref={ref} style={style ?? styles.fill} collapsable={false}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
