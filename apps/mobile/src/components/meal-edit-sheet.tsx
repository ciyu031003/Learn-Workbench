/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { PortionSlider } from "@/components/portion-slider";
import { SectionHeader } from "@/components/section-header";
import { ThemedIcon } from "@/components/themed-icon";
import { portionPreviewText, scaleNutrition } from "@/lib/portion";
import { haptics } from "@/lib/haptics";
import {
  mealKindLabels,
  type Food,
  type MealEntry,
  type MealKind,
} from "@learn-workbench/shared";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export interface MealUpdate {
  id: number;
  amount?: number;
  meal?: MealKind;
  name?: string;
  unit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];
/** 一份的默认范围（食物型条目用 0.5–3 份；手动条目按 50–500g 走克重） */
const PORTION_MIN = 0.5;
const PORTION_MAX = 3;

/**
 * 条目编辑面板（v3 M3/M4）
 *
 * - 食物型条目：只改份量 → 服务端按食物营养重算（客户端只做实时预览）
 * - 手动条目：可直接改热量与三大营养素
 * - 复用 PortionSlider（大圆钮 + 吸附 + 回弹）
 */
export function MealEditSheet({
  entry,
  food,
  visible,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  entry: MealEntry | null;
  /** 关联的常用食物（用于按份量实时预览） */
  food?: Food | null;
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (update: MealUpdate) => void;
  onDelete: (id: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [amount, setAmount] = useState(1);
  const [meal, setMeal] = useState<MealKind>("lunch");
  const [name, setName] = useState("");
  const [manual, setManual] = useState({ kcal: "", proteinG: "", carbsG: "", fatG: "" });

  useEffect(() => {
    if (!entry) return;
    setAmount(entry.amount > 0 ? entry.amount : 1);
    setMeal(entry.meal);
    setName(entry.name);
    setManual({
      kcal: String(Math.round(entry.kcal)),
      proteinG: String(Math.round(entry.proteinG * 10) / 10),
      carbsG: String(Math.round(entry.carbsG * 10) / 10),
      fatG: String(Math.round(entry.fatG * 10) / 10),
    });
  }, [entry]);

  // 所有 Hook 必须在早退之前（react-hooks/rules-of-hooks）
  const isFoodLinked = !!entry && entry.foodId !== null && !!food;
  const preview = useMemo(() => {
    if (isFoodLinked && food) return portionPreviewText(food, amount);
    return null;
  }, [amount, food, isFoodLinked]);

  if (!entry) return null;

  const save = () => {
    if (isFoodLinked) {
      // 只提交改动：分量 + 餐次 + 名称（营养由服务端按食物重算）
      onSave({ id: entry.id, amount, meal, name: name.trim() || entry.name });
      return;
    }
    onSave({
      id: entry.id,
      amount,
      meal,
      name: name.trim() || entry.name,
      kcal: Number(manual.kcal) || 0,
      proteinG: Number(manual.proteinG) || 0,
      carbsG: Number(manual.carbsG) || 0,
      fatG: Number(manual.fatG) || 0,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="修改记录" height="78%">
      <View style={styles.form}>
        <Text style={styles.label}>餐次</Text>
        <View style={styles.kindRow}>
          {MEALS.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                haptics.soft();
                setMeal(m);
              }}
              style={[styles.kindChip, meal === m && styles.kindChipActive]}
            >
              <Text style={[styles.kindChipText, meal === m && styles.kindChipTextActive]}>{mealKindLabels[m]}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="名称" value={name} onChangeText={setName} placeholder="食物名称" />

        <SectionHeader
          title="份量"
          subtitle={isFoodLinked ? `按「${food?.unit ?? "份"}」换算，实时预览热量` : "手动条目只影响显示份量"}
          style={styles.section}
        />
        <PortionSlider
          value={amount}
          onChange={setAmount}
          min={PORTION_MIN}
          max={PORTION_MAX}
          step={0.5}
          unitLabel={isFoodLinked ? (food?.unit ?? "份") : "份"}
          hint={preview ?? `${Math.round(entry.kcal)} kcal / 份`}
        />

        {!isFoodLinked ? (
          <>
            <SectionHeader title="营养" subtitle="手动条目可直接修正数值" style={styles.section} />
            <View style={styles.macroInputRow}>
              <Field
                label="热量 kcal"
                value={manual.kcal}
                onChangeText={(v) => setManual((s) => ({ ...s, kcal: v }))}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
              <Field
                label="蛋白 g"
                value={manual.proteinG}
                onChangeText={(v) => setManual((s) => ({ ...s, proteinG: v }))}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
            </View>
            <View style={styles.macroInputRow}>
              <Field
                label="碳水 g"
                value={manual.carbsG}
                onChangeText={(v) => setManual((s) => ({ ...s, carbsG: v }))}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
              <Field
                label="脂肪 g"
                value={manual.fatG}
                onChangeText={(v) => setManual((s) => ({ ...s, fatG: v }))}
                keyboardType="numeric"
                containerStyle={styles.macroInput}
              />
            </View>
          </>
        ) : (
          <Text style={styles.muted}>营养由常用食物的单位数值 × 份量自动重算，不需要手填。</Text>
        )}

        <Button label="保存修改" icon="checkmark" loading={saving} onPress={save} />
        <Pressable
          onPress={() => {
            haptics.warning();
            onDelete(entry.id);
          }}
          style={styles.deleteRow}
        >
          <ThemedIcon name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteText}>删除这条记录</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    form: { gap: 10, paddingTop: 6 },
    section: { marginTop: 6 },
    label: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: {
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    muted: { ...typography.micro, color: colors.textMuted },
    macroInputRow: { flexDirection: "row", gap: 8 },
    macroInput: { flex: 1, minWidth: 0 },
    deleteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
    },
    deleteText: { ...typography.callout, fontWeight: "700", color: colors.danger },
  });

export const MEAL_EDIT_PORTION_RANGE = { min: PORTION_MIN, max: PORTION_MAX } as const;
