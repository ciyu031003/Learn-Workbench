import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/**
 * 左右滑动切换题目（v1.50）：刷题卡片外层的横向手势包装。
 *
 * 口径与 `quiz-stack.tsx` 的横滑卡一致（阈值 + 速度双判），差异是这里**不移除卡片**，
 * 只负责翻题：右滑 → onPrev，左滑 → onNext；未过阈值/在边界外 → 橡皮筋弹回。
 *
 * 嵌套约定：卡片在纵向 ScrollView 里，`failOffsetY` 让竖向滚动优先；
 * `activeOffsetX` 保证点按选项（Pressable）不被误判成滑动。
 * worklet 纪律（见 CLAUDE.md「手势与 worklet」）：onEnd 里只碰 shared value 与
 * runOnJS，不引用外层普通函数。
 */
const ACTIVATE_X = 18;
const FAIL_Y = 14;
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 420;
/** 边界外的拖动阻尼：拖 100pt 只走 15pt */
const RUBBER = 0.15;

export function QuestionSwipe({
  canPrev,
  canNext,
  onPrev,
  onNext,
  children,
  style,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const dx = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onUpdate((event) => {
      const x = event.translationX;
      if ((x < 0 && !canNext) || (x > 0 && !canPrev)) {
        dx.value = x * RUBBER;
      } else {
        dx.value = x;
      }
    })
    .onEnd((event) => {
      const goNext = canNext && (event.translationX < -SWIPE_DISTANCE || event.velocityX < -SWIPE_VELOCITY);
      const goPrev = canPrev && (event.translationX > SWIPE_DISTANCE || event.velocityX > SWIPE_VELOCITY);
      if (goNext || goPrev) {
        dx.value = withTiming(goPrev ? 56 : -56, { duration: 130 }, () => {
          dx.value = 0;
          if (goPrev) runOnJS(onPrev)();
          else runOnJS(onNext)();
        });
      } else {
        dx.value = withTiming(0, { duration: 160 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
