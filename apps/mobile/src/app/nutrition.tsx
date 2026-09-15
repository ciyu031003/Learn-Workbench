import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { DEFAULT_NUTRITION_TARGETS, mealKindLabels, sumNutrition, type Food, type MealEntry, type MealKind } from "@learn-workbench/shared";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** V3 今日饮食（移动端）：营养汇总 + 条目 + 常用食物快速添加 */
export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meal, setMeal] = useState<MealKind>("lunch");
  const [picked, setPicked] = useState<Food | null>(null);
  const [amount, setAmount] = useState("1");
  const [saving, setSaving] = useState(false);
  // 手动录入（Bug 7a：不想从常用食物里选也能记一条）
  const [manual, setManual] = useState({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
  const [saveAsCommon, setSaveAsCommon] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");

  const date = todayKey();
  const totals = useMemo(() => sumNutrition(entries), [entries]);
  const target = DEFAULT_NUTRITION_TARGETS;

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/nutrition?date=${date}`, { headers: headers() });
      const d = await r.json();
      if (r.ok) setEntries(Array.isArray(d.entries) ? d.entries : []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const { refreshing, onRefresh } = useRefreshable(load);

  useEffect(() => {
    if (!sheetOpen) return;
    void (async () => {
      try {
        const r = await fetch(getApiUrl() + "/api/nutrition/foods", { headers: headers() });
        const d = await r.json();
        if (r.ok) setFoods(Array.isArray(d.foods) ? d.foods : []);
      } catch {
        // 忽略
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  /** 从常用食物添加（按所选食物单位营养 × 数量换算，服务端计算） */
  const addPicked = async () => {
    if (!picked) {
      Alert.alert("请选择食物");
      return;
    }
    setSaving(true);
    try {
      await fetch(getApiUrl() + "/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ date, meal, name: picked.name, foodId: picked.id, amount: Number(amount) || 1 }),
      });
      closeSheet();
      await load();
    } catch (e) {
      Alert.alert("添加失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  /** 手动录入一条（名称为必填，营养可只填热量） */
  const addManual = async () => {
    const name = manual.name.trim();
    if (!name) {
      Alert.alert("请填写食物名称");
      return;
    }
    setSaving(true);
    try {
      const body = {
        date,
        meal,
        name,
        unit: manual.unit.trim() || "份",
        amount: 1,
        kcal: Number(manual.kcal) || 0,
        proteinG: Number(manual.proteinG) || 0,
        carbsG: Number(manual.carbsG) || 0,
        fatG: Number(manual.fatG) || 0,
      };
      const r = await fetch(getApiUrl() + "/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "添加失败");
      }
      if (saveAsCommon) {
        // 存为常用食物（登录用户私有，同名 upsert）
        const fr = await fetch(getApiUrl() + "/api/nutrition/foods", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            name,
            unit: body.unit,
            kcal: body.kcal,
            proteinG: body.proteinG,
            carbsG: body.carbsG,
            fatG: body.fatG,
          }),
        });
        if (!fr.ok) {
          const d = await fr.json().catch(() => ({}));
          Alert.alert("已记录，但保存常用食物失败", d.error ?? "请登录后再保存常用食物");
        }
      }
      closeSheet();
      await load();
    } catch (e) {
      Alert.alert("添加失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setPicked(null);
    setAmount("1");
    setManual({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
    setSaveAsCommon(false);
    setFoodQuery("");
  };

  const visibleFoods = foods.filter(
    (f) => !foodQuery.trim() || f.name.toLowerCase().includes(foodQuery.trim().toLowerCase())
  );

  const remove = async (id: number) => {
    try {
      await fetch(`${getApiUrl()}/api/nutrition?id=${id}`, { method: "DELETE", headers: headers() });
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch {
      Alert.alert("删除失败");
    }
  };

  const bars = [
    { label: "热量", value: totals.kcal, max: target.kcal, unit: "kcal", color: colors.primary },
    { label: "蛋白质", value: totals.proteinG, max: target.proteinG, unit: "g", color: "#16a34a" },
    { label: "碳水", value: totals.carbsG, max: target.carbsG, unit: "g", color: "#f59e0b" },
    { label: "脂肪", value: totals.fatG, max: target.fatG, unit: "g", color: "#dc2626" },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }>
      <ScreenHeader title="今日饮食" subtitle={`${totals.kcal} / ${target.kcal} kcal`} compact />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>添加饮食</Text>
      </PressableScale>

      <Card>
        <View style={styles.macroGrid}>
          {bars.map((b) => {
            const pct = b.max > 0 ? Math.min(100, Math.round((b.value / b.max) * 100)) : 0;
            return (
              <View key={b.label} style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(b.value)}</Text>
                <Text style={styles.macroUnit}>/ {b.max}{b.unit}</Text>
                <View style={styles.macroTrack}>
                  <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: b.color }]} />
                </View>
                <Text style={styles.macroLabel}>{b.label}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {loading ? (
        <SkeletonList count={4} />
      ) : entries.length === 0 ? (
        <EmptyState icon="restaurant-outline" title="今天还没有记录" hint="从常用食物挑一个，或手动填写营养" />
      ) : (
        MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m);
          if (list.length === 0) return null;
          return (
            <Card key={m} style={styles.mealCard}>
              <Text style={styles.mealTitle}>{mealKindLabels[m]} · {sumNutrition(list).kcal} kcal</Text>
              {list.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryBody}>
                    <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.muted}>{e.amount} {e.unit} · {e.kcal} kcal · P{e.proteinG} C{e.carbsG} F{e.fatG}</Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => void remove(e.id)}>
                    <ThemedIcon name="trash-outline" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))}
            </Card>
          );
        })
      )}

      <BottomSheet visible={sheetOpen} onClose={closeSheet} title="添加饮食" height="82%">
        <View style={styles.form}>
          <Text style={styles.label}>餐次</Text>
          <View style={styles.kindRow}>
            {MEALS.map((m) => (
              <Pressable key={m} onPress={() => setMeal(m)} style={[styles.kindChip, meal === m && styles.kindChipActive]}>
                <Text style={[styles.kindChipText, meal === m && styles.kindChipTextActive]}>{mealKindLabels[m]}</Text>
              </Pressable>
            ))}
          </View>

          {/* ① 常用食物（可搜索） */}
          <SectionHeader title="常用食物" subtitle="选一个再填数量，营养自动换算" style={styles.sheetSection} />
          <Field
            value={foodQuery}
            onChangeText={setFoodQuery}
            placeholder="搜索常用食物"
            returnKeyType="search"
            autoCapitalize="none"
          />
          <View style={styles.kindRow}>
            {visibleFoods.map((f) => (
              <Pressable key={f.id} onPress={() => setPicked(f)} style={[styles.kindChip, picked?.id === f.id && styles.kindChipActive]}>
                <Text style={[styles.kindChipText, picked?.id === f.id && styles.kindChipTextActive]}>
                  {f.name} · {f.kcal}kcal
                </Text>
              </Pressable>
            ))}
            {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试下方手动添加</Text> : null}
          </View>
          {picked ? (
            <>
              <Field
                label={`数量（${picked.unit}）`}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="1"
                hint={`≈ ${Math.round(picked.kcal * (Number(amount) || 1))} kcal`}
              />
              <Button label="添加到今天" icon="add" loading={saving} onPress={() => void addPicked()} />
            </>
          ) : null}

          {/* ② 手动添加（不选常用食物也能记） */}
          <SectionHeader title="手动添加" subtitle="只填名称与热量也能记一条" style={styles.sheetSection} />
          <Field label="名称" value={manual.name} onChangeText={(v) => setManual((s) => ({ ...s, name: v }))} placeholder="例如：食堂番茄鸡蛋面" />
          <View style={styles.macroInputRow}>
            <Field
              label="单位"
              value={manual.unit}
              onChangeText={(v) => setManual((s) => ({ ...s, unit: v }))}
              placeholder="份"
              containerStyle={styles.macroInput}
            />
            <Field
              label="热量 kcal"
              value={manual.kcal}
              onChangeText={(v) => setManual((s) => ({ ...s, kcal: v }))}
              keyboardType="numeric"
              placeholder="520"
              containerStyle={styles.macroInput}
            />
          </View>
          <View style={styles.macroInputRow}>
            <Field
              label="蛋白 g"
              value={manual.proteinG}
              onChangeText={(v) => setManual((s) => ({ ...s, proteinG: v }))}
              keyboardType="numeric"
              placeholder="选填"
              containerStyle={styles.macroInput}
            />
            <Field
              label="碳水 g"
              value={manual.carbsG}
              onChangeText={(v) => setManual((s) => ({ ...s, carbsG: v }))}
              keyboardType="numeric"
              placeholder="选填"
              containerStyle={styles.macroInput}
            />
            <Field
              label="脂肪 g"
              value={manual.fatG}
              onChangeText={(v) => setManual((s) => ({ ...s, fatG: v }))}
              keyboardType="numeric"
              placeholder="选填"
              containerStyle={styles.macroInput}
            />
          </View>
          <Pressable style={styles.switchRow} onPress={() => setSaveAsCommon((v) => !v)}>
            <Switch value={saveAsCommon} onValueChange={setSaveAsCommon} trackColor={{ true: colors.primary }} />
            <Text style={styles.switchLabel}>存入常用食物（下次可直接选）</Text>
          </Pressable>
          <Button label="手动添加到今天" icon="create-outline" variant="secondary" loading={saving} onPress={() => void addManual()} />
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    macroGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    macroItem: { flex: 1, alignItems: "center", gap: 2 },
    macroValue: { fontSize: 16, fontWeight: "800", color: colors.text },
    macroUnit: { fontSize: 10, color: colors.textMuted },
    macroTrack: { width: "100%", height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginTop: 3 },
    macroFill: { height: 5, borderRadius: 999 },
    macroLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    mealCard: { gap: 8 },
    mealTitle: { fontSize: 13, fontWeight: "800", color: colors.primary },
    entryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    entryBody: { flex: 1, minWidth: 0 },
    entryName: { fontSize: 14, fontWeight: "700", color: colors.text },
    muted: { fontSize: 11, color: colors.textMuted },
    form: { gap: 10, paddingTop: 6 },
    sheetSection: { marginTop: 6 },
    macroInputRow: { flexDirection: "row", gap: 8 },
    macroInput: { flex: 1, minWidth: 0 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    switchLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });