import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";

interface DailyOs {
  date: string;
  greeting: string;
  progress: number;
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number; items: { id: number; title: string; done: boolean }[] };
  career: { targetRole: string | null; highMatchJobs: number; pendingApplications: number; expiringCertificates: number };
  fitness: { workoutName: string | null; workoutMinutes: number; nutritionKcal: number; nutritionTargetKcal: number };
  habits: { scheduled: number; done: number };
}

/** V3 Daily OS（移动端）：我的一天聚合视图 */
export default function TodayScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<DailyOs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/daily", { headers });
      if (r.ok) setData(await r.json());
    } catch {
      // 离线保持空态
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const blocks = data
    ? [
        { key: "learning", icon: "book-outline" as const, label: "学习", detail: data.learning.tasksTotal > 0 ? `${data.learning.tasksDone}/${data.learning.tasksTotal} 任务 · 专注 ${data.learning.focusMinutes} 分` : `专注 ${data.learning.focusMinutes} 分`, href: "/tasks" },
        { key: "career", icon: "briefcase-outline" as const, label: "职业", detail: `高匹配 ${data.career.highMatchJobs} · 在途投递 ${data.career.pendingApplications}`, href: "/radar" },
        { key: "fitness", icon: "barbell-outline" as const, label: "运动", detail: data.fitness.workoutName ? `${data.fitness.workoutName} · ${data.fitness.workoutMinutes} 分` : "今天还没有训练", href: "/workout" },
        { key: "habits", icon: "repeat-outline" as const, label: "习惯", detail: data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled} 已完成` : "今天没有排期", href: "/habits" },
      ]
    : [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : !data ? (
        <Card><Text style={styles.empty}>暂时无法加载「我的一天」</Text></Card>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.greeting}>{data.greeting}</Text>
            <Text style={styles.date}>今天 · {data.date}</Text>
          </View>

          <Card>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>今日完成</Text>
              <Text style={styles.progressValue}>{data.progress}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, data.progress)}%` }]} />
            </View>
            <Text style={styles.hint}>学习 40% · 习惯 30% · 运动 15% · 饮食 15%</Text>
          </Card>

          {blocks.map((b) => (
            <PressableScale key={b.key} haptic onPress={() => router.push(b.href as never)}>
              <Card style={styles.block}>
                <ThemedIcon name={b.icon} size={20} color={colors.primary} />
                <View style={styles.blockBody}>
                  <Text style={styles.blockLabel}>{b.label}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{b.detail}</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
              </Card>
            </PressableScale>
          ))}

          <Card style={styles.block}>
            <ThemedIcon name="restaurant-outline" size={20} color={colors.primary} />
            <View style={styles.blockBody}>
              <Text style={styles.blockLabel}>饮食</Text>
              <Text style={styles.muted}>{data.fitness.nutritionKcal} / {data.fitness.nutritionTargetKcal} kcal</Text>
            </View>
            <PressableScale onPress={() => router.push("/nutrition" as never)}>
              <Text style={styles.link}>记录</Text>
            </PressableScale>
          </Card>

          {data.learning.items.length > 0 ? (
            <Card style={styles.taskCard}>
              <Text style={styles.blockLabel}>今日任务</Text>
              {data.learning.items.map((t) => (
                <View key={t.id} style={styles.taskRow}>
                  <ThemedIcon name={t.done ? "checkmark-circle" : "ellipse-outline"} size={16} color={t.done ? colors.primary : colors.textFaint} />
                  <Text style={[styles.taskText, t.done && styles.taskDone]} numberOfLines={1}>{t.title}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    hero: { gap: 2, marginBottom: 2 },
    greeting: { fontSize: 26, fontWeight: "800", color: colors.text },
    date: { fontSize: 13, color: colors.textMuted },
    progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    progressLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
    progressValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
    track: { height: 10, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginTop: 8 },
    fill: { height: 10, borderRadius: 999, backgroundColor: colors.primary },
    hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
    block: { flexDirection: "row", alignItems: "center", gap: 12 },
    blockBody: { flex: 1, minWidth: 0 },
    blockLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
    muted: { fontSize: 12, color: colors.textMuted },
    link: { fontSize: 12, fontWeight: "700", color: colors.primary },
    taskCard: { gap: 8 },
    taskRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    taskText: { fontSize: 13, color: colors.text, flexShrink: 1 },
    taskDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  });