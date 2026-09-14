import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { workoutVolume, type Workout } from "@learn-workbench/shared";

interface DraftItem {
  exerciseLabel: string;
  sets: string;
  reps: string;
  weightKg: string;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** V3 训练记录（移动端）：轻量动作记录（动作/组/次/重量） */
export default function WorkoutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("训练");
  const [items, setItems] = useState<DraftItem[]>([{ exerciseLabel: "", sets: "4", reps: "8", weightKg: "" }]);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});
  const totals = useMemo(() => workoutVolume(workouts.flatMap((w) => w.items)), [workouts]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/workouts?days=60", { headers: headers() });
      const d = await r.json();
      if (r.ok) setWorkouts(Array.isArray(d.workouts) ? d.workouts : []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    const cleaned = items
      .map((it) => ({
        exerciseLabel: it.exerciseLabel.trim(),
        sets: Number(it.sets) || 0,
        reps: Number(it.reps) || 0,
        weightKg: it.weightKg.trim() === "" ? null : Number(it.weightKg),
      }))
      .filter((it) => it.exerciseLabel);
    if (cleaned.length === 0) {
      Alert.alert("至少填写一个动作");
      return;
    }
    setSaving(true);
    try {
      await fetch(getApiUrl() + "/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ name, exercisedOn: todayKey(), items: cleaned }),
      });
      setSheetOpen(false);
      setName("训练");
      setItems([{ exerciseLabel: "", sets: "4", reps: "8", weightKg: "" }]);
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="训练记录" subtitle={`近 60 天 ${workouts.length} 次 · 总容量 ${totals.volumeKg} kg`} compact />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>记录训练</Text>
      </PressableScale>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : workouts.length === 0 ? (
        <Card><Text style={styles.empty}>还没有训练记录</Text></Card>
      ) : (
        workouts.map((w) => {
          const v = workoutVolume(w.items);
          return (
            <Card key={w.id} style={styles.item}>
              <View style={styles.itemHead}>
                <Text style={styles.itemTitle}>{w.name}</Text>
                <Text style={styles.muted}>{w.exercisedOn}</Text>
              </View>
              {w.items.map((it, i) => (
                <View key={it.id ?? i} style={styles.entryRow}>
                  <Text style={styles.entryName} numberOfLines={1}>{it.exerciseLabel}</Text>
                  <Text style={styles.muted}>
                    {it.sets} × {it.reps}{it.weightKg !== null ? ` · ${it.weightKg}kg` : ""}
                  </Text>
                </View>
              ))}
              <Text style={styles.volume}>{v.sets} 组 · {v.reps} 次{v.volumeKg > 0 ? ` · ${v.volumeKg} kg` : ""}</Text>
            </Card>
          );
        })
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="记录训练" height="70%">
        <View style={styles.form}>
          <Text style={styles.label}>训练名称</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="胸 + 三头" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>动作明细</Text>
          {items.map((it, i) => (
            <View key={i} style={styles.itemRowInput}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={it.exerciseLabel}
                onChangeText={(t) => setItems((s) => s.map((x, j) => (j === i ? { ...x, exerciseLabel: t } : x)))}
                placeholder="动作"
                placeholderTextColor={colors.textFaint}
              />
              <TextInput
                style={[styles.input, styles.small]}
                value={it.sets}
                onChangeText={(t) => setItems((s) => s.map((x, j) => (j === i ? { ...x, sets: t } : x)))}
                keyboardType="numeric"
                placeholder="组"
                placeholderTextColor={colors.textFaint}
              />
              <TextInput
                style={[styles.input, styles.small]}
                value={it.reps}
                onChangeText={(t) => setItems((s) => s.map((x, j) => (j === i ? { ...x, reps: t } : x)))}
                keyboardType="numeric"
                placeholder="次"
                placeholderTextColor={colors.textFaint}
              />
              <TextInput
                style={[styles.input, styles.small]}
                value={it.weightKg}
                onChangeText={(t) => setItems((s) => s.map((x, j) => (j === i ? { ...x, weightKg: t } : x)))}
                keyboardType="numeric"
                placeholder="kg"
                placeholderTextColor={colors.textFaint}
              />
            </View>
          ))}
          <Pressable
            style={styles.ghostBtn}
            onPress={() => setItems((s) => [...s, { exerciseLabel: "", sets: "4", reps: "8", weightKg: "" }])}
          >
            <Text style={styles.ghostBtnText}>+ 添加动作</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={() => void save()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存训练</Text>}
          </Pressable>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    item: { gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    itemTitle: { fontSize: 15, fontWeight: "800", color: colors.text, flexShrink: 1 },
    muted: { fontSize: 11, color: colors.textMuted },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    entryName: { fontSize: 13, color: colors.text, flexShrink: 1 },
    volume: { fontSize: 11, fontWeight: "700", color: colors.primary },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    flex: { flex: 1 },
    small: { width: 56, textAlign: "center" },
    itemRowInput: { flexDirection: "row", gap: 6, alignItems: "center" },
    ghostBtn: { borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: colors.surfaceMuted },
    ghostBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });