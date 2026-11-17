import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 学习工具 2×2（P2 · 「当前学习 / 学习工具 / 学习成果」三层结构中的第二层）。
 *
 * 为什么不再用一行三行式的 ListRow 堆叠：原来「复习卡 + 3 行列表」共 7 个等权入口，
 * 用户看不出"下一个该干什么"。网格只保留 4 个工具，每个都带一个**真实数字**
 * （到期 X / 共 N 题 / 错题 N / N 章），数字本身承担优先级。
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

export function LearnToolsGrid({ items }: { items: LearnToolItem[] }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const tone =
          item.tone === "primary" ? colors.primary : item.tone === "accent" ? colors.accent : colors.textSecondary;
        const soft =
          item.tone === "primary" ? colors.primarySoft : item.tone === "accent" ? colors.accentSoft : colors.surfaceMuted;
        return (
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
              <View style={[styles.iconWrap, { backgroundColor: soft }]}>
                <ThemedIcon name={item.icon} size={16} color={tone} />
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
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
