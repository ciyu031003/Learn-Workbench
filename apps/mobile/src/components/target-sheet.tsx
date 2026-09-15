/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { SectionHeader } from "@/components/section-header";
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  nutritionTargetRange,
  type ActivityLevel,
  type Sex,
} from "@learn-workbench/shared";
import { haptics } from "@/lib/haptics";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export interface TargetProfileInput {
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  kcal: number | null;
}

/**
 * 目标设置面板（v3 M6）
 *
 * 活动水平借「吃一点」的分段控件；身体数据可选填（不填就用默认目标），
 * 并展示「怎么算出来的」（BMR × 系数）；三大营养素用区间预览（D3）。
 */
export function TargetSheet({
  visible,
  profile,
  note,
  computed,
  preview,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile: TargetProfileInput;
  /** 服务端给的换算说明（如 BMR 1480 × 1.375 ≈ 2035 kcal） */
  note?: string;
  computed?: boolean;
  /** 保存前的本地预览（由调用方用 shared 纯函数算好） */
  preview: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  saving?: boolean;
  onClose: () => void;
  onSave: (next: TargetProfileInput) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [form, setForm] = useState<TargetProfileInput>(profile);

  useEffect(() => {
    if (visible) setForm(profile);
  }, [profile, visible]);

  const patch = (part: Partial<TargetProfileInput>) => setForm((prev) => ({ ...prev, ...part }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="每日目标" height="82%">
      <SectionHeader title="活动水平" subtitle="决定在基础代谢之上乘多少" />
      <View style={styles.segRow}>
        {ACTIVITY_LEVELS.map((lv) => {
          const active = (form.activityLevel ?? "light") === lv;
          return (
            <Pressable
              key={lv}
              onPress={() => {
                haptics.soft();
                patch({ activityLevel: lv });
              }}
              style={[styles.segChip, active && styles.segChipActive]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{ACTIVITY_LABELS[lv]}</Text>
              <Text style={[styles.segFactor, active && styles.segTextActive]}>×{ACTIVITY_FACTORS[lv]}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="身体数据" subtitle="选填；不填就用默认目标" />
      <View style={styles.row}>
        <Field
          label="体重 kg"
          value={form.weightKg ? String(form.weightKg) : ""}
          onChangeText={(v) => patch({ weightKg: Number(v) || null })}
          keyboardType="numeric"
          placeholder="62"
          containerStyle={styles.col}
        />
        <Field
          label="身高 cm"
          value={form.heightCm ? String(form.heightCm) : ""}
          onChangeText={(v) => patch({ heightCm: Number(v) || null })}
          keyboardType="numeric"
          placeholder="170"
          containerStyle={styles.col}
        />
      </View>
      <View style={styles.row}>
        <Field
          label="出生年"
          value={form.birthYear ? String(form.birthYear) : ""}
          onChangeText={(v) => patch({ birthYear: Number(v) || null })}
          keyboardType="numeric"
          placeholder="1998"
          containerStyle={styles.col}
        />
        <View style={styles.col}>
          <Text style={styles.label}>性别</Text>
          <View style={styles.sexRow}>
            {(["male", "female"] as Sex[]).map((s) => {
              const active = form.sex === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    haptics.soft();
                    patch({ sex: active ? null : s });
                  }}
                  style={[styles.sexChip, active && styles.sexChipActive]}
                >
                  <Text style={[styles.sexText, active && styles.sexTextActive]}>{s === "male" ? "男" : "女"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <SectionHeader title="热量目标" subtitle="留空 = 按身体数据自动算" />
      <Field
        label="目标 kcal（可选覆盖）"
        value={form.kcal ? String(form.kcal) : ""}
        onChangeText={(v) => patch({ kcal: Number(v) || null })}
        keyboardType="numeric"
        placeholder="自动"
        hint={note ? note : undefined}
      />

      <View style={styles.preview}>
        <Text style={styles.previewTitle}>
          {computed ? "按身体数据推算" : "当前使用默认值"}
        </Text>
        <Text style={styles.previewLine}>
          热量 {preview.kcal} kcal · 蛋白 {nutritionTargetRange(preview.proteinG).min}–
          {nutritionTargetRange(preview.proteinG).max}g · 碳水 {nutritionTargetRange(preview.carbsG).min}–
          {nutritionTargetRange(preview.carbsG).max}g · 脂肪 {nutritionTargetRange(preview.fatG).min}–
          {nutritionTargetRange(preview.fatG).max}g
        </Text>
        <Text style={styles.previewHint}>三大营养素以区间展示（落在区间内即为达标）。</Text>
      </View>

      <Button label="保存目标" icon="checkmark" loading={saving} onPress={() => onSave(form)} />
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    segRow: { flexDirection: "row", gap: 8 },
    segChip: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    segFactor: { ...typography.micro, fontSize: 10, color: colors.textFaint },
    segTextActive: { color: "#ffffff" },
    row: { flexDirection: "row", gap: 8 },
    col: { flex: 1, minWidth: 0 },
    label: { ...typography.caption, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
    sexRow: { flexDirection: "row", gap: 8 },
    sexChip: {
      flex: 1,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sexChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    sexText: { ...typography.body, fontWeight: "600", color: colors.textMuted },
    sexTextActive: { color: colors.primary },
    preview: {
      gap: 4,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      marginTop: 4,
    },
    previewTitle: { ...typography.caption, fontWeight: "800", color: colors.text },
    previewLine: { ...typography.caption, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    previewHint: { ...typography.micro, fontWeight: "400", color: colors.textFaint },
  });
