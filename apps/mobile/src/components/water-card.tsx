import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import { AnimatedNumber } from "@/components/animated-number";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const PRESETS = [200, 300, 500] as const;

/** 玻璃杯（液面 = 进度；纯 SVG，零新增依赖） */
function WaterGlass({ ratio, size = 72 }: { ratio: number; size?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  const w = size;
  const h = size * 1.25;
  const inset = 6;
  const level = h - inset - (h - inset * 2) * clamped;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="lwbWater" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.teal} />
          <Stop offset="1" stopColor="#57C7B2" />
        </LinearGradient>
        <ClipPath id="lwbWaterClip">
          <Path
            d={`M ${inset} ${inset + 4} Q ${w / 2} ${inset + 14} ${w - inset} ${inset + 4}
                L ${w - inset - 6} ${h - 4} Q ${w / 2} ${h} ${inset + 6} ${h - 4} Z`}
          />
        </ClipPath>
      </Defs>
      {/* 杯身 */}
      <Path
        d={`M ${inset} ${inset + 4} Q ${w / 2} ${inset + 14} ${w - inset} ${inset + 4}
            L ${w - inset - 6} ${h - 4} Q ${w / 2} ${h} ${inset + 6} ${h - 4} Z`}
        fill="none"
        stroke={colors.borderStrong}
        strokeWidth={2}
      />
      {/* 液面 */}
      <Rect x={0} y={level} width={w} height={h} fill="url(#lwbWater)" clipPath="url(#lwbWaterClip)" opacity={0.85} />
      {/* 刻度 */}
      {[0.33, 0.66].map((r) => (
        <Path
          key={r}
          d={`M ${w - inset - 2} ${h - 6 - (h - inset * 2) * r} L ${w - inset - 12} ${h - 6 - (h - inset * 2) * r}`}
          stroke={colors.border}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

/**
 * 饮水卡（v3 M7）
 *
 * 复用已有后端（`/api/wellbeing/hydration` + hydration_logs/goals）：快捷按钮一点即记，
 * 不做输入框；撤销最近一条；液面用 SVG 矩形 + 渐变（零依赖，不用 Lottie）。
 */
export function WaterCard({
  totalMl,
  targetMl,
  lastLogId,
  busy = false,
  onAdd,
  onUndo,
  style,
}: {
  totalMl: number;
  targetMl: number;
  lastLogId?: number | null;
  busy?: boolean;
  onAdd: (amountMl: number) => void;
  onUndo: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratio = targetMl > 0 ? totalMl / targetMl : 0;
  const done = ratio >= 1;
  const remain = Math.max(0, targetMl - totalMl);

  return (
    <View style={[styles.card, style]}>
      <WaterGlass ratio={ratio} />
      <View style={styles.body}>
        <View style={styles.valueRow}>
          <AnimatedNumber
            value={totalMl}
            style={[styles.value, done && { color: colors.success }]}
            accessibilityLabel={`已喝 ${totalMl} 毫升`}
          />
          <Text style={styles.unit}>/ {targetMl} ml</Text>
        </View>
        <Text style={styles.hint}>
          {done ? "今天的水够了 👍" : `还差 ${remain} ml`}
        </Text>
        <View style={styles.actions}>
          {PRESETS.map((p) => (
            <PressableScale
              key={p}
              haptic
              disabled={busy}
              scaleTo={0.94}
              onPress={() => onAdd(p)}
              style={styles.preset}
            >
              <Text style={styles.presetText}>+{p}</Text>
            </PressableScale>
          ))}
          <Pressable
            hitSlop={8}
            disabled={!lastLogId || busy}
            onPress={() => {
              haptics.warning();
              onUndo();
            }}
            style={[styles.undo, !lastLogId && styles.undoOff]}
            accessibilityLabel="撤销最近一次饮水"
          >
            <ThemedIcon name="arrow-undo-outline" size={16} color={lastLogId ? colors.textMuted : colors.textFaint} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    body: { flex: 1, minWidth: 0, gap: 4 },
    valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
    value: { ...typography.title1, fontWeight: "800", color: colors.teal, ...tabularNums },
    unit: { ...typography.micro, color: colors.textMuted, marginBottom: 3, ...tabularNums },
    hint: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    actions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    preset: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(47,179,166,0.12)",
    },
    presetText: { ...typography.caption, fontWeight: "800", color: colors.teal },
    undo: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      marginLeft: "auto",
    },
    undoOff: { opacity: 0.5 },
  });
