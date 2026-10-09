import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  mealKindLabels,
  type MealKind,
} from "@learn-workbench/shared";
import {
  recipeTagLabels,
  recipesForMeal,
  type Recipe,
} from "@learn-workbench/content";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { radius, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

export function RecipeShelf({ initialMeal = "lunch" }: { initialMeal?: MealKind }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [meal, setMeal] = useState<MealKind>(initialMeal);
  const [active, setActive] = useState<Recipe | null>(null);
  const recipes = useMemo(() => recipesForMeal(meal, 6), [meal]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>精选食谱</Text>
          <Text style={styles.subtitle}>单人份估算 · 点卡片看配料和步骤</Text>
        </View>
        <ThemedIcon name="restaurant-outline" size={18} color={colors.primary} />
      </View>

      <View style={styles.chips}>
        {MEALS.map((item) => {
          const selected = meal === item;
          return (
            <Pressable
              key={item}
              onPress={() => setMeal(item)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{mealKindLabels[item]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        nestedScrollEnabled
      >
        {recipes.map((recipe) => (
          <PressableScale
            key={recipe.id}
            scaleTo={0.97}
            onPress={() => setActive(recipe)}
            accessibilityRole="button"
            accessibilityLabel={`查看食谱：${recipe.name}`}
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={2}>{recipe.name}</Text>
              <View style={styles.kcalPill}>
                <Text style={styles.kcalText}>{recipe.kcal} kcal</Text>
              </View>
            </View>
            <Text style={styles.summary} numberOfLines={2}>{recipe.summary}</Text>
            <View style={styles.macros}>
              <Text style={styles.macro}>蛋白 {recipe.proteinG}g</Text>
              <Text style={styles.macro}>碳水 {recipe.carbsG}g</Text>
              <Text style={styles.macro}>脂肪 {recipe.fatG}g</Text>
            </View>
            <View style={styles.cardFoot}>
              <View style={styles.time}>
                <ThemedIcon name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.timeText}>{recipe.prepMinutes + recipe.cookMinutes} 分钟</Text>
              </View>
              <View style={styles.tags}>
                {recipe.tags.slice(0, 2).map((tag) => (
                  <Text key={tag} style={styles.tag}>{recipeTagLabels[tag]}</Text>
                ))}
              </View>
            </View>
          </PressableScale>
        ))}
      </ScrollView>

      <BottomSheet
        visible={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name ?? "食谱详情"}
        subtitle="营养为单人份估算"
        height="78%"
      >
        {active ? (
          <View style={styles.detail}>
            <Text style={styles.detailSummary}>{active.summary}</Text>

            <View style={styles.statGrid}>
              {[
                { label: "热量", value: `${active.kcal} kcal` },
                { label: "蛋白", value: `${active.proteinG} g` },
                { label: "碳水", value: `${active.carbsG} g` },
                { label: "脂肪", value: `${active.fatG} g` },
              ].map((item) => (
                <View key={item.label} style={styles.stat}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>配料</Text>
              {active.ingredients.map((ingredient) => (
                <View key={ingredient.name} style={styles.ingredient}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>做法</Text>
              {active.steps.map((step, index) => (
                <View key={step} style={styles.step}>
                  <View style={styles.stepIndex}><Text style={styles.stepIndexText}>{index + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {active.tip ? (
              <View style={styles.tip}>
                <ThemedIcon name="bulb-outline" size={15} color={colors.primary} />
                <Text style={styles.tipText}>{active.tip}</Text>
              </View>
            ) : null}

            <View style={styles.detailTags}>
              {active.tags.map((tag) => (
                <Text key={tag} style={styles.detailTag}>{recipeTagLabels[tag]}</Text>
              ))}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headText: { gap: 1 },
    title: { ...typography.headline, fontWeight: "800", color: colors.text },
    subtitle: { ...typography.caption, color: colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: { borderColor: colors.primary + "88", backgroundColor: colors.primarySoft },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    chipTextActive: { color: colors.primary, fontWeight: "800" },
    row: { gap: 10, paddingRight: 4 },
    card: {
      width: 248,
      minHeight: 176,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      gap: 8,
    },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    cardTitle: { flex: 1, ...typography.headline, fontWeight: "800", color: colors.text, lineHeight: 20 },
    kcalPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    kcalText: { ...typography.micro, fontWeight: "800", color: colors.primary },
    summary: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
    macros: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    macro: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    cardFoot: { marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    time: { flexDirection: "row", alignItems: "center", gap: 3 },
    timeText: { ...typography.micro, color: colors.textMuted },
    tags: { flexDirection: "row", gap: 4 },
    tag: {
      ...typography.micro,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      color: colors.textMuted,
    },
    detail: { gap: 16, paddingBottom: 8 },
    detailSummary: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
    statGrid: { flexDirection: "row", gap: 8 },
    stat: {
      flex: 1,
      padding: 10,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    },
    statLabel: { ...typography.micro, color: colors.textMuted },
    statValue: { ...typography.caption, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
    section: { gap: 8 },
    sectionTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    ingredient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    ingredientName: { ...typography.caption, color: colors.text },
    ingredientAmount: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
    step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    stepIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    stepIndexText: { ...typography.micro, fontWeight: "800", color: colors.primary },
    stepText: { flex: 1, ...typography.body, color: colors.text, lineHeight: 21 },
    tip: {
      flexDirection: "row",
      gap: 8,
      padding: 12,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    tipText: { flex: 1, ...typography.caption, color: colors.textMuted, lineHeight: 18 },
    detailTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    detailTag: {
      ...typography.micro,
      fontWeight: "700",
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
  });
