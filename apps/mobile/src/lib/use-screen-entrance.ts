import { useMemo } from "react";
import { FadeInDown } from "react-native-reanimated";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";

type EntranceBuilder = ReturnType<typeof FadeInDown.duration>;

/**
 * v19-M1 · 屏幕首屏入场的统一出口。
 *
 * 背景：v17-D 落地后 today/career 等页各自手写
 *   `entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}`
 * 三元式在页面间复制了十几遍，learn/wellness/settings 三个 hub 则漏接（Tab 切换硬切）。
 * 本 hook 把「减弱动态降级 + token 时长 + stagger 步长」收敛到一处：
 *
 *   const entrance = useScreenEntrance();
 *   <Animated.View entering={entrance(0)}>…</Animated.View>
 *
 * 纪律不变（lib/stagger.ts）：只在**首帧**入场做，滚动复现不做；Tab scene 常驻不销毁，
 * 切回同一 Tab 不会重放 —— 这正是想要的"切 Tab 即时、首进有过渡"。
 */
export function useScreenEntrance(): (index: number) => EntranceBuilder | undefined {
  const reduced = useReducedMotion();
  return useMemo(
    () =>
      (index: number) =>
        reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(index)),
    [reduced]
  );
}
