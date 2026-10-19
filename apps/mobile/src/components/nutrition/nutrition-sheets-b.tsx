import { Alert, Pressable, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { MealEditSheet } from "@/components/meal-edit-sheet";
import { TargetSheet } from "@/components/target-sheet";
import { haptics } from "@/lib/haptics";
import { type ThemeColors } from "@/theme/tokens";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { NutritionStyles } from "./nutrition-styles";

export function NutritionSheetsB({
  model,
  styles,
  colors,
}: {
  model: NutritionModel;
  styles: NutritionStyles;
  colors: ThemeColors;
}) {
  const { loading, foods, saving, editing, setEditing, profile, targetOpen, setTargetOpen, wellnessBusy, weightOpen, setWeightOpen, weightDraft, setWeightDraft, target, remove, saveEdit, onAddWeight, onSaveTarget } = model;
  return (
    <>
      <MealEditSheet
        entry={editing}
        food={foods.find((f) => f.id === (editing?.foodId ?? -1)) ?? null}
        visible={!!editing}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={(u) => void saveEdit(u)}
        onDelete={(id) => {
          setEditing(null);
          void remove(id);
        }}
      />

      {/* 体重记录（Android 没有 Alert.prompt，用自研弹层） */}
      <BottomSheet visible={weightOpen} onClose={() => setWeightOpen(false)} title="记录体重" height="52%">
        <View style={styles.form}>
          <Text style={styles.label}>今日体重</Text>
          <View style={styles.weightRow}>
            <Pressable
              style={styles.weightStep}
              hitSlop={8}
              accessibilityLabel="减少 0.1kg"
              onPress={() => {
                haptics.light();
                setWeightDraft((v) => (Math.round((Number(v) - 0.1) * 10) / 10).toFixed(1));
              }}
            >
              <ThemedIcon name="remove" size={18} color={colors.primary} />
            </Pressable>
            <Field
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="numeric"
              placeholder="62.4"
              containerStyle={styles.weightField}
            />
            <Pressable
              style={styles.weightStep}
              hitSlop={8}
              accessibilityLabel="增加 0.1kg"
              onPress={() => {
                haptics.light();
                setWeightDraft((v) => (Math.round((Number(v) + 0.1) * 10) / 10).toFixed(1));
              }}
            >
              <ThemedIcon name="add" size={18} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.muted}>同一天重复记录会覆盖；写入后同步为卡路里估算用的体重。</Text>
          <Button
            label="保存体重"
            icon="checkmark"
            loading={wellnessBusy}
            onPress={() => {
              const n = Number(weightDraft);
              if (!Number.isFinite(n) || n <= 0) {
                Alert.alert("请输入有效体重");
                return;
              }
              setWeightOpen(false);
              void onAddWeight(n);
            }}
          />
        </View>
      </BottomSheet>

      <TargetSheet
        visible={targetOpen}
        profile={{
          weightKg: profile?.weightKg ?? null,
          heightCm: profile?.heightCm ?? null,
          birthYear: profile?.birthYear ?? null,
          sex: profile?.sex ?? null,
          activityLevel: profile?.activityLevel ?? null,
          kcal: null,
        }}
        note={target.note}
        computed={target.computed}
        preview={{ kcal: target.kcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG }}
        saving={saving}
        onClose={() => setTargetOpen(false)}
        onSave={(next) => void onSaveTarget(next)}
      />
    </>
  );
}
