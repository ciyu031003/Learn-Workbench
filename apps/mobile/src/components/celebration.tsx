import { useEffect , useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const COLORS = ["#2F74C0", "#F28C28", "#3DA35D", "#FFB25E", "#8D7BD8", "#2FB3A6", "#F26B5E"];

function Particle({ index, play }: { index: number; play: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const color = COLORS[index % COLORS.length];

  useEffect(() => {
    if (!play) {
      tx.value = 0;
      ty.value = 0;
      rotate.value = 0;
      opacity.value = 0;
      return;
    }
    const angle = (index / 36) * Math.PI * 2 + (index % 5) * 0.2;
    const dist = 90 + (index % 7) * 26;
    tx.value = Math.cos(angle) * dist;
    ty.value = Math.sin(angle) * dist;
    rotate.value = (index % 2 === 0 ? 1 : -1) * 360;
    opacity.value = withDelay((index % 8) * 16, withTiming(1, { duration: 240 }));
    opacity.value = withDelay(
      (index % 8) * 16 + 700,
      withTiming(0, { duration: 420 })
    );
  }, [index, play, opacity, rotate, tx, ty]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color, width: 7 + (index % 3) * 2, height: 5 + (index % 2) * 3 },
        style,
      ]}
    />
  );
}

export function Celebration({ play }: { play: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.center}>
        {Array.from({ length: 36 }).map((_, i) => (
          <Particle key={i} index={i} play={play} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  center: {
    position: "absolute",
    left: "50%",
    top: "42%",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
    borderRadius: 2,
  },
});
