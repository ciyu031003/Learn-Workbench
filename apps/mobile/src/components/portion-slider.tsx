/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { portionPercent, snapPortion } from "@/lib/portion";
import { haptics } from "@/lib/haptics";
import { shadows, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const KNOB = 28;
const TRACK = 8;

/**
 * 份量滑杆（v3 M4）——借「吃一点」的「食用比例 + 大圆钮」：
 * 拖大圆钮调整份量，松手吸附到 step、回弹；两侧 ± 提供精确操作与无障碍入口。
 * 零新增依赖（RNGH + Reanimated）。
 */
export function PortionSlider({
  value,
  onChange,
  min = 0.5,
  max = 3,
  step = 0.5,
  unitLabel = "份",
  hint,
  style,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
  /** 下方实时换算文案（如 ≈ 156 kcal · P12.6 C0.6 F5.3） */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const span = Math.max(1, max - min);
  const toPx = useCallback((v: number) => ((v - min) / span) * width, [min, span, width]);

  const pos = useSharedValue(0);
  const startPos = useSharedValue(0);
  const knob = useSharedValue(1);

  useEffect(() => {
    if (width <= 0 || dragging) return;
    pos.value = withTiming(toPx(value), { duration: 160 });
  }, [dragging, pos, toPx, value, width]);

  /**
   * 松手结算：**在 JS 线程**做吸附 + 回弹 + 回调（UI 线程只读一次 pos.value 再 runOnJS）。
   * v1.4.2 真机崩溃根因：原来在 onEnd worklet 里直接调 snapPortion()（普通函数）→
   * UI 线程同步调用非 worklet 函数会抛错并闪退（见看板踩坑 79）。
   */
  const settleFromPos = useCallback(
    (px: number) => {
      const raw = min + (width > 0 ? px / width : 0) * span;
      const next = snapPortion(raw, min, max, step);
      pos.value = withSpring(((next - min) / span) * width, { damping: 18, stiffness: 240 });
      knob.value = withSpring(1, { damping: 18, stiffness: 240 });
      setDragging(false);
      onChange(next);
      haptics.light();
    },
    [knob, max, min, onChange, pos, span, step, width]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startPos.value = pos.value;
          knob.value = withSpring(1.12, { damping: 18, stiffness: 260 });
          runOnJS(setDragging)(true);
        })
        .onUpdate((e) => {
          pos.value = Math.min(width, Math.max(0, startPos.value + e.translationX));
        })
        .onEnd(() => {
          // worklet 里只做一件事：把当前位置交给 JS 线程结算（绝不在 UI 线程调普通函数）
          runOnJS(settleFromPos)(pos.value);
        }),
    [knob, pos, settleFromPos, startPos, width]
  );

  const fillStyle = useAnimatedStyle(() => ({ width: pos.value }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }, { scale: knob.value }],
  }));

  const bump = (delta: number) => {
    const next = snapPortion(value + delta, min, max, step);
    if (next === value) return;
    haptics.light();
    onChange(next);
  };

  const pct = portionPercent(value, min, max);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text style={styles.value}>
          {value} {unitLabel}
        </Text>
        <Text style={styles.pct}>{pct}%</Text>
      </View>

      <View style={styles.row}>
        <Pressable
          hitSlop={8}
          accessibilityLabel={`减少${unitLabel}`}
          onPress={() => bump(-step)}
          style={styles.stepBtn}
        >
          <ThemedIcon name="remove" size={16} color={colors.primary} />
        </Pressable>

        <View
          style={styles.trackWrap}
          onLayout={(e) => setWidth(Math.max(0, Math.round(e.nativeEvent.layout.width) - KNOB))}
        >
          <GestureDetector gesture={pan}>
            <Animated.View
              style={styles.hitArea}
              accessibilityRole="adjustable"
              accessibilityValue={{ min, max, now: value, text: `${value} ${unitLabel}` }}
            >
              <View style={styles.track}>
                <Animated.View style={[styles.fill, fillStyle]} />
              </View>
              <Animated.View style={[styles.knob, knobStyle]} />
            </Animated.View>
          </GestureDetector>
        </View>

        <Pressable
          hitSlop={8}
          accessibilityLabel={`增加${unitLabel}`}
          onPress={() => bump(step)}
          style={styles.stepBtn}
        >
          <ThemedIcon name="add" size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.foot}>
        <Text style={styles.bound}>
          {min} {unitLabel}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <Text style={styles.bound}>
          {max} {unitLabel}
        </Text>
      </View>
    </View>
  );
}

/** 供测试/复用：吸附逻辑已抽到 `@/lib/portion`（组件文件不可被 vitest 直接导入） */

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    value: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    pct: { ...typography.caption, fontWeight: "700", color: colors.accentStrong, ...tabularNums },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    trackWrap: { flex: 1, minWidth: 0, justifyContent: "center" },
    hitArea: { height: 44, justifyContent: "center" },
    track: {
      height: TRACK,
      borderRadius: TRACK / 2,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    fill: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.accent },
    knob: {
      position: "absolute",
      left: 0,
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: colors.surfaceStrong,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    bound: { ...typography.micro, fontSize: 10, color: colors.textFaint },
    hint: { flex: 1, textAlign: "center", ...typography.micro, fontWeight: "600", color: colors.textMuted },
  });
