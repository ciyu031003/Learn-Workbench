import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { StatLine } from "@/components/stat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { computeReadiness, WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useRefreshable } from "@/lib/use-refresh";
import { getApiUrl } from "@/config";

interface DailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
  };
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

type IoniconName = Parameters<typeof ThemedIcon>[0]["name"];

interface Entry {
  key: string;
  title: string;
  desc: string;
  icon: IoniconName;
  color: string;
  href: string;
}

const ENTRIES: Entry[] = [
  { key: "workout", title: "训练记录", desc: "动作 · 组数 · 重量", icon: "barbell-outline", color: "#e1781c", href: "/workout" },
  { key: "nutrition", title: "今日饮食", desc: "热量 · 蛋白 · 碳水 · 脂肪", icon: "restaurant-outline", color: "#2fb3a6", href: "/nutrition" },
  { key: "habits", title: "习惯打卡", desc: "连续打卡 · 热力图", icon: "repeat-outline", color: "#8d7bd8", href: "/habits" },
  { key: "trackers", title: "领域记录", desc: "跑量 · 体重 · 通用计量", icon: "stats-chart-outline", color: "#3da35d", href: "/trackers" },
];

/** 健康 Hub：把训练 / 饮食 / 习惯 / 计量收进一个 Tab，一步到达 */
export default function WellnessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<DailyOs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/daily", { headers });
      if (r.ok) setData(await r.json());
    } catch {
      // 离线保留上次数据
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  useFocusRefresh(load);
  const { refreshing, onRefresh } = useRefreshable(load);

  const habitPct =
    data && data.habits.scheduled > 0 ? Math.round((data.habits.done / data.habits.scheduled) * 100) : 0;

  // 今日状态分（readiness）：借 Orbix Pulse 的「先知道自己在哪一档」——
  // 健康页 hero 给一个分数 + 一句结论，而不是罗列三个孤立数字（D8/§1.5.3D）
  const readiness = useMemo(
    () =>
      computeReadiness({
        tasksTotal: data?.learning.tasksTotal ?? 0,
        tasksDone: data?.learning.tasksDone ?? 0,
        habitsScheduled: data?.habits.scheduled ?? 0,
        habitsDone: data?.habits.done ?? 0,
        workoutMinutes: data?.fitness.workoutMinutes ?? 0,
        nutritionKcal: data?.fitness.nutritionKcal ?? 0,
        nutritionTargetKcal: data?.fitness.nutritionTargetKcal ?? 0,
      }),
    [data]
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ScreenHeader title="健康" subtitle="训练 · 饮食 · 习惯，照顾好身体才有持续成长" compact />

      {/* ① 今日状态（readiness hero）：进度弧 + 一句话结论 + 三个关键值 */}
      {loading && !data ? (
        <SkeletonCard count={1} />
      ) : (
        <GlassSurface corner={radius.xl} style={styles.hero}>
          <ProgressArc
            progress={readiness.score / 100}
            size={126}
            strokeWidth={11}
            value={readiness.score}
            label="今日状态"
            caption={readiness.weakest ? WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
          />
          <View style={styles.heroStats}>
            <StatLine label="今日训练" value={`${data?.fitness.workoutMinutes ?? 0} 分`} />
            <StatLine label="今日摄入" value={`${data?.fitness.nutritionKcal ?? 0} kcal`} />
            <StatLine
              label="习惯完成"
              value={data && data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled} · ${habitPct}%` : "今天没有排期"}
            />
          </View>
        </GlassSurface>
      )}

      {/* ② 今日饮食摘要（v3 M11「一处看全」：剩余可吃 + 饮水，点开进饮食页） */}
      <PressableScale
        haptic
        scaleTo={0.98}
        onPress={() => router.push("/nutrition" as never)}
      >
        <Card style={styles.dietCard}>
          <View style={styles.dietRow}>
            <View style={styles.dietItem}>
              <Text style={styles.dietLabel}>还能吃</Text>
              <Text
                style={[
                  styles.dietValue,
                  (data?.fitness.nutritionRemainingKcal ??
                    (data ? data.fitness.nutritionTargetKcal - data.fitness.nutritionKcal : 0)) < 0 && {
                    color: colors.danger,
                  },
                ]}
              >
                {data?.fitness.nutritionRemainingKcal ??
                  (data ? data.fitness.nutritionTargetKcal - data.fitness.nutritionKcal : 0)}
                <Text style={styles.dietUnit}> kcal</Text>
              </Text>
              <Text style={styles.dietHint}>
                已吃 {data?.fitness.nutritionKcal ?? 0} / {data?.fitness.nutritionTargetKcal ?? 2000}
              </Text>
            </View>
            <View style={styles.dietDivider} />
            <View style={styles.dietItem}>
              <Text style={styles.dietLabel}>饮水</Text>
              <Text style={styles.dietValue}>
                {data?.hydration?.totalMl ?? 0}
                <Text style={styles.dietUnit}> / {data?.hydration?.targetMl ?? 2000} ml</Text>
              </Text>
              <View style={styles.waterTrack}>
                <View
                  style={[
                    styles.waterFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((data?.hydration?.totalMl ?? 0) / Math.max(1, data?.hydration?.targetMl ?? 2000)) * 100
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Card>
      </PressableScale>

      {/* 领域入口 */}
      <View style={styles.grid}>
        {ENTRIES.map((e) => (
          <PressableScale
            key={e.key}
            haptic
            style={styles.gridItem}
            onPress={() => router.push(e.href as never)}
          >
            <Card style={styles.entryCard}>
              <View style={[styles.iconChip, { backgroundColor: e.color + "22" }]}>
                <ThemedIcon name={e.icon} size={22} color={e.color} />
              </View>
              <View style={styles.entryText}>
                <Text style={styles.entryTitle}>{e.title}</Text>
                <Text style={styles.entryDesc} numberOfLines={2}>{e.desc}</Text>
              </View>
            </Card>
          </PressableScale>
        ))}
      </View>

      {/* 快速记录 */}
      <PressableScale haptic onPress={() => router.push("/workout" as never)}>
        <Card style={styles.quickRow}>
          <ThemedIcon name="add-circle-outline" size={20} color={colors.primary} />
          <View style={styles.quickBody}>
            <Text style={styles.quickTitle}>快速记录一次训练</Text>
            <Text style={styles.entryDesc}>填写动作与组次，自动汇总训练容量</Text>
          </View>
          <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
        </Card>
      </PressableScale>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.lg },
    heroStats: { flex: 1, minWidth: 0, gap: spacing.sm },
    dietCard: { gap: spacing.sm },
    dietRow: { flexDirection: "row", alignItems: "center" },
    dietItem: { flex: 1, gap: 2 },
    dietDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 12 },
    dietLabel: { ...typography.micro, color: colors.textMuted },
    dietValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    dietUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    dietHint: { ...typography.micro, fontWeight: "400", color: colors.textFaint, ...tabularNums },
    waterTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginTop: 4 },
    waterFill: { height: 5, borderRadius: 999, backgroundColor: colors.teal },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    gridItem: { width: "47.5%", flexGrow: 1 },
    entryCard: { gap: spacing.sm, minHeight: 104 },
    iconChip: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    entryText: { gap: 1 },
    entryTitle: { ...typography.headline, color: colors.text },
    entryDesc: { ...typography.micro, fontWeight: "500", color: colors.textMuted, lineHeight: 15 },
    quickRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    quickBody: { flex: 1, minWidth: 0 },
    quickTitle: { ...typography.headline, color: colors.text },
  });
