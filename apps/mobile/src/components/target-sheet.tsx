/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { Field } from "@/components/field";
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  nutritionTargetRange,
  type ActivityLevel,
  type Sex,
} from "@learn-workbench/shared";
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
 * 目标设置面板（v3 M6 → v16 P3 迁移到 Sheet v3）
 *
 * 活动水平改为 ChipGroup 单选（标签保留原来的 ×系数信息）；身体数据仍是可选的输入框；
 * 保存改吸底 CTA。展示「怎么算出来的」（BMR × 系数）与三大营养素区间预览的口径不变。
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="每日目标"
      subtitle="按身体数据推算热量与三大营养素，也可以直接覆盖"
      icon="flame-outline"
      height="84%"
      footer={
        <SheetStickyCta
          label="保存目标"
          icon="checkmark"
          loading={saving}
          onPress={() => onSave(form)}
        />
      }
      footerHint="留空的项目按默认值处理；保存后当天的汇总会立即更新"
    >
      <SheetSection title="活动水平" hint="决定在基础代谢之上乘多少">
        <ChipGroup
          multiple={false}
          wrap
          options={ACTIVITY_LEVELS.map((lv) => ({
            key: lv,
            label: ACTIVITY_LABELS[lv] + " ×" + ACTIVITY_FACTORS[lv],
          }))}
          selected={[form.activityLevel ?? "light"]}
          onToggle={(k) => patch({ activityLevel: k as ActivityLevel })}
        />
      </SheetSection>

      <SheetSection title="身体数据" hint="选填；不填就用默认目标">
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
            <ChipGroup
              multiple={false}
              options={[
                { key: "male", label: "男" },
                { key: "female", label: "女" },
              ]}
              selected={form.sex ? [form.sex] : []}
              onToggle={(k) => patch({ sex: form.sex === k ? null : (k as Sex) })}
            />
          </View>
        </View>
      </SheetSection>

      <SheetSection title="热量目标" hint="留空 = 按身体数据自动算" last>
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
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 8 },
    col: { flex: 1, minWidth: 0 },
    label: { ...typography.caption, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
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
