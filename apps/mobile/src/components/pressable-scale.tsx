/* eslint-disable react-hooks/immutability */
import { type ReactNode, useCallback } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
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
  ...rest
}: PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo ?? motion.pressScale, { damping: 20, stiffness: 320 });
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 280 });
  }, [scale]);

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
      {children}
    </AnimatedPressable>
  );
}

export { PressableScale };
