/* eslint-disable react-hooks/immutability */
import { type ReactNode, useCallback } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PressableScale({
  children,
  style,
  scaleTo = motion.pressScale,
  haptic = false,
  disabled,
  onPress,
  pressedStyle,
  ...rest
}: PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  /**
   * v17 R6：按下时叠加的样式（iOS 列表行是"整行变色"而不是"整行缩放"）。
   * 用共享值驱动一层绝对定位的叠加层 —— 零重渲染，只在传了才渲染。
   */
  pressedStyle?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressedOpacity = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo ?? motion.pressScale, { damping: 20, stiffness: 320 });
    pressed.value = withTiming(1, { duration: 90 });
  }, [scale, scaleTo, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 280 });
    pressed.value = withTiming(0, { duration: 180 });
  }, [scale, pressed]);

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      if (haptic && !disabled) {
        haptics.light();
      }
      onPress?.(e);
    },
    [disabled, haptic, onPress]
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {/* 叠加层放在 children **之前**：RN 按文档顺序绘制，这样它是"行底色"而不是盖住文字的膜 */}
      {pressedStyle ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pressedStyle, pressedOpacity]} />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

export { PressableScale };
