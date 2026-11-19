import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 学习工具（P2 · 「当前学习 / 学习工具 / 学习成果」三层结构中的第二层）。
 *
 * v2.7 收敛：原来 2×2 四格里「待复习」和「错题练习」**跳的是同一个路由**
 * （/quiz/review），拆成两张卡让同一个动作占了两个入口。现在合成一张
 * **通栏主卡**（到期数当主数值，错题数与正确率进副文案），下面只留 2 张
 * 等权卡（技术题库 / 408 专区），入口从 4 个降到 3 个、主次更明确。
 */
export interface LearnToolItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** 主数值（如「12」「86 题」「—」）；没有数据时用「—」而不是 0 */
  value: string;
  title: string;
  hint: string;
  /** 主色只给「今天该做的那一个」，其余走中性 */
  tone?: "primary" | "accent" | "neutral";
  onPress: () => void;
  accessibilityLabel: string;
}

export function LearnToolsGrid({
  featured,
  items,
}: {
  featured?: LearnToolItem;
  items: LearnToolItem[];
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const toneOf = (item: LearnToolItem) =>
    item.tone === "primary" ? colors.primary : item.tone === "accent" ? colors.accent : colors.textSecondary;
  const softOf = (item: LearnToolItem) =>
    item.tone === "primary" ? colors.primarySoft : item.tone === "accent" ? colors.accentSoft : colors.surfaceMuted;

  return (
    <View style={styles.wrap}>
      {featured ? (
        <PressableScale
          haptic
          scaleTo={0.99}
          hitSlop={4}
          onPress={featured.onPress}
          accessibilityRole="button"
          accessibilityLabel={featured.accessibilityLabel}
        >
          <Surface tier="surface" style={styles.featured}>
            <View style={[styles.featuredIcon, { backgroundColor: softOf(featured) }]}>
              <ThemedIcon name={featured.icon} size={18} color={toneOf(featured)} />
            </View>
            <View style={styles.featuredBody}>
              <Text style={styles.featuredTitle} numberOfLines={1}>
                {featured.title}
              </Text>
              <Text style={styles.featuredHint} numberOfLines={1}>
                {featured.hint}
              </Text>
            </View>
            <Text style={styles.featuredValue} numberOfLines={1}>
              {featured.value}
            </Text>
            <ThemedIcon name="chevron-forward" size={15} color={colors.textMeta} />
          </Surface>
        </PressableScale>
      ) : null}

      <View style={styles.grid}>
        {items.map((item) => (
          <PressableScale
            key={item.key}
            haptic
            scaleTo={0.98}
            hitSlop={4}
            onPress={item.onPress}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={item.accessibilityLabel}
          >
            <Surface tier="surface" style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: softOf(item) }]}>
                <ThemedIcon name={item.icon} size={16} color={toneOf(item)} />
              </View>
              <Text style={styles.value} numberOfLines={1}>
                {item.value}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.hint} numberOfLines={2}>
                {item.hint}
              </Text>
            </Surface>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    featured: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md + 1,
      paddingHorizontal: spacing.lg,
      minHeight: 64,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    featuredIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    featuredBody: { flex: 1, minWidth: 0, gap: 2 },
    featuredTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    featuredHint: { ...typography.meta, color: colors.textMuted },
    featuredValue: { ...typography.num, color: colors.text, ...tabularNums },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    cell: { width: "48%", flexGrow: 1 },
    card: {
      padding: spacing.lg,
      gap: 4,
      minHeight: 128,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    value: { ...typography.hero, color: colors.text, ...tabularNums },
    title: { ...typography.callout, color: colors.text, fontWeight: "600" },
    hint: { ...typography.meta, color: colors.textMuted },
  });
