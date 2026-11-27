import { useMemo } from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { withAlpha } from "@/lib/chart-math";

import { makeStyles } from "./learn-styles";

/** 工具卡色调：只做识别色，语义由工具本身决定 */
export type LearnToolTone = "primary" | "success" | "accent" | "lavender" | "teal";

export interface LearnToolItem {
  key: string;
  icon: IconName;
  title: string;
  /** 主数字（对齐 V12 的大字号 value），没有真实数据时用「—」 */
  value: string;
  /** 数字后的单位，例如「题 / 章 / %」 */
  unit?: string;
  /** 一行真实状态，不写解释性长文案 */
  meta: string;
  tone: LearnToolTone;
  /** 0~1；有进度语义的卡才传，底部会出现 3pt 细条 */
  progress?: number;
  onPress: () => void;
  accessibilityLabel: string;
}

/** 六张工具卡固定（复习 / 题库 / 408 / 统计 / 阶段路线 / 材料阅读），用元组固定个数，避免渲染里再判空 */
export type LearnToolTuple = [
  LearnToolItem,
  LearnToolItem,
  LearnToolItem,
  LearnToolItem,
  LearnToolItem,
  LearnToolItem,
];

function toneOf(colors: ThemeColors, tone: LearnToolTone): { fg: string; wash: string } {
  const fg =
    tone === "success"
      ? colors.success
      : tone === "accent"
        ? colors.accent
        : tone === "lavender"
          ? colors.lavender
          : tone === "teal"
            ? colors.teal
            : colors.primary;
  return { fg, wash: withAlpha(fg, 0.085) };
}

/**
 * 单张工具卡（对齐 V12 .tool-card）：
 * 全卡统一材质 = surface + 色调 wash 铺满整卡，内部不再出现白色小矩形。
 */
function ToolCardBody({ item }: { item: LearnToolItem }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = toneOf(colors, item.tone);
  const progress = item.progress === undefined ? null : Math.max(0, Math.min(1, item.progress));
  return (
    <>
      <View pointerEvents="none" style={[styles.toolWash, { backgroundColor: tone.wash }]} />
      <View style={styles.toolIcon}>
        <Icon name={item.icon} size={20} weight="duotone" color={tone.fg} />
      </View>
      <View style={styles.toolValueRow}>
        <Text style={styles.toolValue} numberOfLines={1}>
          {item.value}
        </Text>
        {item.unit ? <Text style={styles.toolUnit}>{item.unit}</Text> : null}
      </View>
      <Text style={styles.toolTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.toolMeta} numberOfLines={2}>
        {item.meta}
      </Text>
      {progress === null ? null : (
        <View style={styles.toolTrack}>
          <View style={[styles.toolFill, { width: `${Math.round(progress * 100)}%` as `${number}%`, backgroundColor: tone.fg }]} />
        </View>
      )}
    </>
  );
}

/**
 * ⑤ 学习工具（对齐 demo .tool-grid）：2×3 竖式大卡，每张 = 图标 + 大数字 + 标题 + 一行状态。
 *
 * 六张卡是固定产品集合，所以这里逐张写出（不用 map）：每张都显式带 hitSlop，
 * 门禁的触控热区统计才能逐张覆盖到；文案与跳转全部由 LearnToolsSection 传入。
 */
export function LearnToolsGrid({ items }: { items: LearnToolTuple }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [review, bank, exam408, stats, roadmap, reading] = items;

  return (
    <View style={styles.toolsGrid}>
      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={review.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={review.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={review} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={bank.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={bank.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={bank} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={exam408.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={exam408.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={exam408} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={stats.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={stats.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={stats} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={roadmap.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={roadmap.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={roadmap} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.975}
        onPress={reading.onPress}
        style={styles.toolCell}
        accessibilityRole="button"
        accessibilityLabel={reading.accessibilityLabel}
      >
        <View style={styles.toolCard}>
          <ToolCardBody item={reading} />
        </View>
      </PressableScale>
    </View>
  );
}
