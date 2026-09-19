import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { mealKindLabels, type MealKind } from "@learn-workbench/shared";
import { radius, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 餐次卡组 + 周视图（v11 P2，参考图 4 的彩色卡片语言）：
 *  - 每餐一张语义色小卡：本餐 kcal + 条目数 + 右下角「大加号」一点即记；
 *  - 下方 7 天 kcal 迷你柱，当天高亮。
 */
const MEAL_COLORS: Record<MealKind, string> = {
  breakfast: "#F2994A",
  lunch: "#2F74C0",
  dinner: "#8D7BD8",
  snack: "#3DA35D",
};

export interface MealCardData {
  meal: MealKind;
  kcal: number;
  count: number;
}

export function MealCardGrid({
  cards,
  week,
  onAdd,
}: {
  cards: MealCardData[];
  week: { key: string; label: string; kcal: number; active?: boolean }[];
  onAdd: (meal: MealKind) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxKcal = Math.max(1, ...week.map((d) => d.kcal));

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {cards.map((card) => {
          const color = MEAL_COLORS[card.meal];
          return (
            <View key={card.meal} style={[styles.card, { backgroundColor: color + "1A", borderColor: color + "55" }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color }]}>{mealKindLabels[card.meal]}</Text>
                <Text style={styles.cardCount}>{card.count} 条</Text>
              </View>
              <Text style={styles.cardKcal}>
                {card.kcal}
                <Text style={styles.cardUnit}> kcal</Text>
              </Text>
              <Pressable
                onPress={() => onAdd(card.meal)}
                style={[styles.addBtn, { backgroundColor: color }]}
                accessibilityLabel={"添加" + mealKindLabels[card.meal]}
              >
                <ThemedIcon name="add" size={20} color="#ffffff" />
              </Pressable>
            </View>
          );
        })}
      </View>

      {week.length > 0 ? (
        <View style={styles.weekCard}>
          <View style={styles.weekHead}>
            <Text style={styles.weekTitle}>近 7 天热量</Text>
            <Text style={styles.weekHint}>点日期条可切天</Text>
          </View>
          <View style={styles.weekRow}>
            {week.map((day) => (
              <View key={day.key} style={styles.weekCell}>
                <View style={styles.weekTrack}>
                  <View
                    style={[
                      styles.weekFill,
                      {
                        height: `${Math.max(4, Math.round((day.kcal / maxKcal) * 100))}%`,
                        backgroundColor: day.active ? colors.primary : colors.primary + "66",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.weekLabel, day.active && styles.weekLabelActive]}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: {
      width: "48%",
      flexGrow: 1,
      gap: 4,
      padding: 12,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
    },
    cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: { ...typography.micro, fontWeight: "800" },
    cardCount: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    cardKcal: { ...typography.title2, fontWeight: "800", color: colors.text },
    cardUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    addBtn: {
      position: "absolute",
      right: 10,
      bottom: 10,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    weekCard: {
      gap: 8,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    weekTitle: { ...typography.micro, fontWeight: "700", color: colors.text },
    weekHint: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    weekRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 64 },
    weekCell: { flex: 1, alignItems: "center", gap: 4 },
    weekTrack: {
      flex: 1,
      width: "70%",
      justifyContent: "flex-end",
      borderRadius: 6,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    weekFill: { width: "100%", borderRadius: 6 },
    weekLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    weekLabelActive: { color: colors.primary, fontWeight: "800" },
  });
