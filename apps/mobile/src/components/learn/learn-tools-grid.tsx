import { useMemo } from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import { withAlpha } from "@/lib/chart-math";
import type { ThemeColors } from "@/theme/tokens";

import { makeStyles } from "./learn-styles";

/** 工具卡色调：只做识别色，语义由工具本身决定 */
export type LearnToolTone = "primary" | "success" | "accent" | "lavender" | "teal";

export interface LearnToolItem {
  key: string;
  icon: IconName;
  title: string;
  /** 数字小字：真实数据（到期数 / 题数 / 章数 / 正确率），没数据时写「—」或说明 */
  meta: string;
  tone: LearnToolTone;
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

function toneOf(colors: ThemeColors, tone: LearnToolTone): { fg: string; bg: string } {
  switch (tone) {
    case "success":
      return { fg: colors.success, bg: colors.successSoft };
    case "accent":
      return { fg: colors.accent, bg: colors.accentSoft };
    case "lavender":
      return { fg: colors.lavender, bg: withAlpha(colors.lavender, 0.14) };
    case "teal":
      return { fg: colors.teal, bg: withAlpha(colors.teal, 0.14) };
    default:
      return { fg: colors.primary, bg: colors.primarySoft };
  }
}

/** 卡片内容（34px 圆角底片 + duotone 图标 + 标题 + 数字小字） */
function ToolCardBody({ item }: { item: LearnToolItem }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = toneOf(colors, item.tone);
  return (
    <>
      <View style={[styles.toolIcon, { backgroundColor: tone.bg }]}>
        <Icon name={item.icon} size={18} weight="duotone" color={tone.fg} />
      </View>
      <View style={styles.toolBody}>
        <Text style={styles.toolTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.toolMeta} numberOfLines={1}>
          {item.meta}
        </Text>
      </View>
    </>
  );
}

/**
 * ⑤ 学习工具（对齐 demo .ltools）：2×3 紧凑行式卡，每张 = 圆角底片图标 + 标题 + 数字小字。
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
        scaleTo={0.97}
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
        scaleTo={0.97}
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
        scaleTo={0.97}
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
        scaleTo={0.97}
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
        scaleTo={0.97}
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
        scaleTo={0.97}
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
