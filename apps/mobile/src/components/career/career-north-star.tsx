import { useId, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { PressableScale } from "@/components/pressable-scale";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";

import type { ThemeColors } from "@/theme/tokens";
import type { CareerDirection } from "./career-model";

/**
 * ① 目标方向（对齐 demo v12 .north-card）。
 *
 * 白卡 + 右上角极淡的暖色光晕（不是整块渐变）：顶部是 TARGET DIRECTION 小标 +
 * 画像状态 tag，中间左侧大号匹配度、右侧技能 / 薪资 / 城市三条细进度，底部深色通栏 CTA。
 * 与 demo 的差别只有数据口径：没有画像时匹配度显示「—」，绝不估算。
 */
export function CareerNorthStar({ direction }: { direction: CareerDirection }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rawId = useId();
  const glowId = useMemo(() => "careerGlow" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  const fitLabel = direction.fitScore === null ? "—" : String(direction.fitScore);

  return (
    <View style={styles.card}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={glowId} cx="0.9" cy="0.08" r="0.62">
            <Stop offset="0" stopColor={colors.accentSoft} stopOpacity={0.95} />
            <Stop offset="0.55" stopColor={colors.accentSoft} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.accentSoft} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + glowId + ")"} />
      </Svg>

      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>TARGET DIRECTION</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{direction.hasTarget ? "画像已设置" : "尚未设置画像"}</Text>
        </View>
      </View>

      <View style={styles.fitRow}>
        <View style={styles.fitBlock}>
          <Text style={styles.fitValue}>{fitLabel}</Text>
          <Text style={styles.fitLabel}>方向匹配度</Text>
        </View>
        <View style={styles.bars}>
          {direction.bars.map((bar) => {
            const width: `${number}%` = `${Math.round(Math.max(0, Math.min(1, bar.ratio)) * 100)}%`;
            const tone =
              bar.key === "salary" ? styles.barPrimary : bar.key === "city" ? styles.barTeal : styles.barAccent;
            return (
              <View
                key={bar.key}
                style={styles.barRow}
                accessible
                accessibilityLabel={bar.label + " " + bar.valueLabel}
              >
                <Text style={styles.barLabel}>{bar.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, tone, { width }]} />
                </View>
                <Text style={styles.barValue} numberOfLines={1}>
                  {bar.valueLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.99}
        onPress={() => router.push("/domain-manager" as never)}
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel={direction.hasTarget ? "调整目标方向并重新扫描" : "设置目标方向并开始扫描"}
      >
        <Text style={styles.ctaText} numberOfLines={1}>
          {direction.hasTarget ? "调整目标方向 · 重新扫描" : "设置目标方向 · 开始扫描"}
        </Text>
        <Icon name="chevron" size={13} weight="bold" color="#FFFFFF" />
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: spacing.xs,
      borderRadius: radius.panel,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 2,
      paddingBottom: spacing.md,
      overflow: "hidden",
      ...shadows.card,
    },
    headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    eyebrow: { ...typography.eyebrow, fontWeight: "800", letterSpacing: 1.6, color: colors.accentStrong, flex: 1 },
    tag: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
    tagText: { ...typography.micro, fontWeight: "800", color: colors.accentStrong },
    fitRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
    fitBlock: { width: 74, alignItems: "flex-start" },
    fitValue: { ...typography.numXl, fontWeight: "800", color: colors.text, ...tabularNums },
    fitLabel: { ...typography.micro, color: colors.textMuted, marginTop: 1 },
    bars: { flex: 1, minWidth: 0, gap: 9 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    barLabel: { ...typography.micro, color: colors.textMuted, width: 46 },
    barTrack: { flex: 1, minWidth: 0, height: 5, borderRadius: 999, backgroundColor: colors.chartTrack, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 999 },
    barAccent: { backgroundColor: colors.accent },
    barPrimary: { backgroundColor: colors.primary },
    barTeal: { backgroundColor: colors.teal },
    barValue: { ...typography.micro, color: colors.textSecondary, width: 36, textAlign: "right" },
    hint: { ...typography.meta, color: colors.textMuted, marginTop: spacing.sm },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.control,
      backgroundColor: colors.text,
    },
    ctaText: { ...typography.callout, fontWeight: "700", color: colors.surface },
  });