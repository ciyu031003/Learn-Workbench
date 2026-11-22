import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";

/** 骨架屏 -> 真实内容的过渡（成长页 / 数据看板共用）。 */
export const GROWTH_REVEAL_OFFSET = 6;

export function GrowthReveal({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={style}
      entering={
        reduced
          ? undefined
          : FadeInDown.withInitialValues({ opacity: 0, translateY: GROWTH_REVEAL_OFFSET })
              .duration(DURATION.base)
              .delay(staggerDelay(index))
      }
    >
      {children}
    </Animated.View>
  );
}
