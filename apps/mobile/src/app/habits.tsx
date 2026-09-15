import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  HABIT_TEMPLATES, HABIT_WEEKDAY_LABELS, computeHabitStats, isHabitDone, isScheduled, toDateKey,
  type Habit, type HabitLog,
} from "@learn-workbench/shared";

type HabitRow = Habit;

/** V3 习惯打卡（移动端）：今日 One-Tap + streak + 近 7 天条 */
export default function HabitsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✅");
  const [isBoolean, setIsBoolean] = useState(true);
  const [targetValue, setTargetValue] = useState("");

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/habits", { headers: headers() });
      const d = await r.json();
      if (r.ok) {
        setHabits(Array.isArray(d.habits) ? d.habits : []);
        setLogs(Array.isArray(d.logs) ? d.logs : []);
      }
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

  const { refreshing, onRefresh } = useRefreshable(load);

  const logMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) m.set(`${l.habitId}|${l.logDate.slice(0, 10)}`, Number(l.value));
    return m;
  }, [logs]);

  const last7 = useMemo(() => {
    const out: { key: string; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - i);
      out.push({ key: toDateKey(d), date: d });
    }
    return out;
  }, [today]);

  const toggle = async (h: HabitRow) => {
    const done = logMap.get(`${h.id}|${todayKey}`) !== undefined;
    setBusy(h.id);
    try {
      const r = done
        ? await fetch(`${getApiUrl()}/api/habits/logs?habitId=${h.id}&date=${todayKey}`, { method: "DELETE", headers: headers() })
        : await fetch(getApiUrl() + "/api/habits/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers() },
            body: JSON.stringify({ habitId: h.id, date: todayKey, value: 1 }),
          });
      if (r.ok) await load();
    } catch {
      Alert.alert("操作失败", "请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("请填写习惯名称");
      return;
    }
    setSaving(true);
    try {
      await fetch(getApiUrl() + "/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          name: name.trim(),
          icon,
          isBoolean,
          targetValue: isBoolean ? null : Number(targetValue) || null,
        }),
      });
      setSheetOpen(false);
      setName("");
      setIcon("✅");
      setIsBoolean(true);
      setTargetValue("");
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const scheduledToday = habits.filter((h) => isScheduled(h.schedule, today)).length;
  const doneToday = habits.filter((h) => {
    const v = logMap.get(`${h.id}|${todayKey}`);
    return v !== undefined && isHabitDone(h, v);
  }).length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }>
      <ScreenHeader title="习惯" subtitle={`今日 ${doneToday}/${scheduledToday} 已完成`} compact />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>新建习惯</Text>
      </PressableScale>

      {loading ? (
        <SkeletonList count={4} />
      ) : habits.length === 0 ? (
        <>
          <EmptyState icon="repeat-outline" title="还没有习惯" hint="从下方模板快速开始，或自定义一个" />
          <View style={styles.tplRow}>
            {HABIT_TEMPLATES.map((t) => (
              <Pressable
                key={t.name}
                style={styles.tplChip}
                onPress={() => {
                  setName(t.name);
                  setIcon(t.icon);
                  setIsBoolean(t.isBoolean);
                  setTargetValue(t.targetValue === null ? "" : String(t.targetValue));
                  setSheetOpen(true);
                }}
              >
                <Text style={styles.tplText}>{t.icon} {t.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        habits.map((h) => {
          const v = logMap.get(`${h.id}|${todayKey}`);
          const done = v !== undefined && isHabitDone(h, v);
          const st = computeHabitStats(h, logs, today);
          const scheduled = isScheduled(h.schedule, today);
          return (
            <Card key={h.id} style={[styles.item, !scheduled && { opacity: 0.6 }]}>
              <View style={styles.itemRow}>
                <Pressable
                  onPress={() => void toggle(h)}
                  disabled={busy === h.id}
                  style={[styles.check, done && { backgroundColor: h.color, borderColor: h.color }]}
                >
                  {busy === h.id ? (
                    <ActivityIndicator color={done ? "#fff" : colors.primary} />
                  ) : done ? (
                    <ThemedIcon name="checkmark" size={18} color="#fff" />
                  ) : (
                    <Text style={styles.checkIcon}>{h.icon ?? "○"}</Text>
                  )}
                </Pressable>

                <View style={styles.itemBody}>
                  <View style={styles.itemHeadRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{h.name}</Text>
                    {st.currentStreak > 0 ? <Text style={styles.streak}>🔥 {st.currentStreak}</Text> : null}
                    {!scheduled ? <Text style={styles.muted}>今日不排期</Text> : null}
                  </View>
                  <Text style={styles.muted}>近 7 天 {st.weekRate}% · 近 30 天 {st.monthRate}%</Text>
                  <View style={styles.strip}>
                    {last7.map((d) => {
                      const dv = logMap.get(`${h.id}|${d.key}`);
                      const dDone = dv !== undefined && isHabitDone(h, dv);
                      const dSched = isScheduled(h.schedule, d.date);
                      return (
                        <View
                          key={d.key}
                          style={[
                            styles.stripDot,
                            dDone ? { backgroundColor: h.color } : dSched ? styles.stripDotOff : styles.stripDotSkip,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            </Card>
          );
        })
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="新建习惯" height="62%">
        <View style={styles.form}>
          <Text style={styles.label}>图标</Text>
          <TextInput style={styles.input} value={icon} onChangeText={(t) => setIcon(t.slice(0, 2))} placeholder="✅" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>名称</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例如：饮水 / 早睡" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>类型</Text>
          <View style={styles.kindRow}>
            <Pressable onPress={() => setIsBoolean(true)} style={[styles.kindChip, isBoolean && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, isBoolean && styles.kindChipTextActive]}>打卡型</Text>
            </Pressable>
            <Pressable onPress={() => setIsBoolean(false)} style={[styles.kindChip, !isBoolean && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, !isBoolean && styles.kindChipTextActive]}>量化型</Text>
            </Pressable>
          </View>
          {!isBoolean ? (
            <>
              <Text style={styles.label}>目标值</Text>
              <TextInput style={styles.input} value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" placeholder="8" placeholderTextColor={colors.textFaint} />
            </>
          ) : null}
          <Pressable style={[styles.primaryBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={() => void submit()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存习惯</Text>}
          </Pressable>
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
    tplRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tplChip: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
    tplText: { fontSize: 12, color: colors.text },
    item: { gap: 8 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    check: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    checkIcon: { fontSize: 18 },
    itemBody: { flex: 1, minWidth: 0, gap: 2 },
    itemHeadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: { fontSize: 15, fontWeight: "800", color: colors.text, flexShrink: 1 },
    streak: { fontSize: 12, fontWeight: "800", color: colors.accentStrong },
    muted: { fontSize: 11, color: colors.textMuted },
    strip: { flexDirection: "row", gap: 4, marginTop: 4 },
    stripDot: { height: 5, width: 18, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    stripDotOff: { backgroundColor: colors.border },
    stripDotSkip: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
    form: { gap: 10, paddingTop: 6 },
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