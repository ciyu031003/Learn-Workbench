import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/energy";
import { energyArt } from "@/lib/energy-art";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { SPRING, useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { radius, shadows, typography, type ThemeColors } from "@/theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * v2.6.11 今日状态：5 档精力改用同一套 3D 表情（本地素材）。
 *
 * 交互口径：
 * - 未选中：轻微缩小 + 降透明度，五枚并排时仍能一眼看出「当前这一档」；
 * - 选中：放大、彩色描边 + 同色光晕 + 角标勾选，文案同步加粗变色（不只靠颜色区分）；
 * - 点击：先压一下再回弹，并触发一次扩散光环 —— 「点哪哪应」，不是静默更新；
 * - 系统「减弱动态」或低端机：所有装饰动画归零，只保留状态切换。
 *
 * 数据与 API 不变：value 1-5，onSelect 仍只回传档位数字。
 */
export function MoodPicker({
  value,
  onSelect,
  busy = false,
}: {
  value: number | null;
  onSelect: (level: number) => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const motionActive = isMotionActive(reduced);
  const active = value === null ? null : ENERGY_LEVELS.find((e) => e.level === value) ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>今天的状态</Text>
        <Text style={styles.hint}>{busy ? "记录中…" : active ? "已记录 · " + active.label : "点一下即可记录"}</Text>
      </View>
      <View style={styles.row}>
        {ENERGY_LEVELS.map((item) => (
          <EnergyOption
            key={item.level}
            item={item}
            selected={value === item.level}
            busy={busy}
            motionActive={motionActive}
            styles={styles}
            colors={colors}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

function EnergyOption({
  item,
  selected,
  busy,
  motionActive,
  styles,
  colors,
  onSelect,
}: {
  item: EnergyLevel;
  selected: boolean;
  busy: boolean;
  motionActive: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  onSelect: (level: number) => void;
}) {
  const press = useSharedValue(1);
  const glow = useSharedValue(selected ? 1 : 0);
  const burst = useSharedValue(1);
  const wasSelected = useRef(selected);

  useEffect(() => {
    glow.value = motionActive ? withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) }) : selected ? 1 : 0;
    if (selected && !wasSelected.current && motionActive) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    }
    wasSelected.current = selected;
  }, [selected, glow, burst, motionActive]);

  const artStyle = useAnimatedStyle(() => ({
    opacity: 0.62 + glow.value * 0.38,
    transform: [{ scale: press.value * (0.9 + glow.value * 0.12) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: (1 - burst.value) * 0.55,
    transform: [{ scale: 0.72 + burst.value * 0.55 }],
  }));

  const art = energyArt(item.level);

  return (
    <AnimatedPressable
      onPress={() => {
        if (busy) return;
        haptics.light();
        onSelect(item.level);
      }}
      onPressIn={() => {
        if (busy || !motionActive) return;
        press.value = withTiming(0.88, { duration: 90 });
      }}
      onPressOut={() => {
        if (!motionActive) return;
        press.value = withSequence(
          withTiming(0.94, { duration: 70 }),
          withSpring(1, SPRING.snappy),
        );
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: busy }}
      accessibilityLabel={"精力 " + item.level + "，" + item.label}
      accessibilityHint={busy ? "正在记录" : "轻点记录今天的状态"}
      style={styles.option}
      hitSlop={2}
    >
      <View style={styles.stage}>
        {selected ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                { backgroundColor: item.color + "24", borderColor: item.color + "55" },
                haloStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.burst, { borderColor: item.color }, burstStyle]}
            />
          </>
        ) : null}
        <Animated.View
          style={[
            styles.artWrap,
            selected && { borderColor: item.color, backgroundColor: colors.surfaceStrong },
            artStyle,
          ]}
        >
          {art ? (
            <Image
              source={art}
              style={styles.art}
              contentFit="contain"
              transition={140}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <ThemedIcon name={item.icon as never} size={22} color={item.color} />
          )}
        </Animated.View>
        {selected ? (
          <View style={[styles.tick, { backgroundColor: item.color }]}>
            <ThemedIcon name="checkmark" size={9} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.label, selected && { color: item.color, fontWeight: "800" }]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 16,
      gap: 12,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    hint: { ...typography.caption, fontWeight: "600", color: colors.textMuted, flexShrink: 1, textAlign: "right" },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 2 },
    option: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 2 },
    stage: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
    halo: {
      position: "absolute",
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
    },
    burst: {
      position: "absolute",
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
    },
    artWrap: {
      width: 46,
      height: 46,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    art: { width: 43, height: 43 },
    tick: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.surfaceStrong,
    },
    label: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
  });
