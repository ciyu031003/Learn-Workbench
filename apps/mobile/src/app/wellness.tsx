import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeader } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { StatLine } from "@/components/stat";
import { ListGroup, ListRow } from "@/components/list-row";
import { GroupLabel } from "@/components/group-label";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { computeReadiness, WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useRefreshable } from "@/lib/use-refresh";
import { addHydration, fetchWeight, type WeightPointDto } from "@/lib/wellbeing-client";
import { haptics } from "@/lib/haptics";
import { getApiUrl } from "@/config";

interface DailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条，v3 M11 深化） */
    nutritionEntries?: { id: number; name: string; meal: "breakfast" | "lunch" | "dinner" | "snack"; kcal: number }[];
  };
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

/** v7 P2：hero 的四项分解（权重与 lib/readiness 一致），点一下直达对应模块 */
const BREAKDOWN: { key: "tasks" | "habits" | "workout" | "nutrition"; label: string; color: string; href: string }[] = [
  { key: "tasks", label: "任务", color: "#2F74C0", href: "/tasks" },
  { key: "habits", label: "习惯", color: "#8D7BD8", href: "/habits" },
  { key: "workout", label: "训练", color: "#E1781C", href: "/workout" },
  { key: "nutrition", label: "饮食", color: "#2FB3A6", href: "/nutrition" },
];

const DIET_COLOR = "#E1781C";
const WATER_COLOR = "#2FB3A6";
const WEIGHT_COLOR = "#8D7BD8";
const HABIT_COLOR = "#8D7BD8";
const RECORD_COLOR = "#3DA35D";
const CARD_COLOR = "#C79A3E";

function tintOf(color: string) {
  return { iconColor: color, iconBg: color + "22" };
}

/**
 * 健康 Hub（v7 P2 三层结构）：
 *  ① 今日状态 —— 进度弧 + 四项分解条 + 本周概览（训练/记录/均值）
 *  ② 今日动作 —— 饮食 / 饮水 / 训练 / 体重 四张可交互卡（都能就地记一笔）
 *  ③ 趋势与档案 —— 饮食趋势 / 训练记录 / 习惯 / 领域记录 的轻量入口
 */
export default function WellnessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<DailyOs | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightPoints, setWeightPoints] = useState<WeightPointDto[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [weekRows, setWeekRows] = useState<{ entryCount: number; kcal: number }[]>([]);

  const load = useCallback(async () => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [dailyRes, weightRes, workoutRes, summaryRes] = await Promise.all([
        fetch(getApiUrl() + "/api/daily", { headers }),
        fetchWeight(token, 30).catch(() => null),
        fetch(getApiUrl() + "/api/workouts?days=7", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/nutrition/summary?days=7", { headers }).catch(() => null),
      ]);
      if (dailyRes.ok) setData(await dailyRes.json());
      if (weightRes) setWeightPoints(weightRes.points);
      if (workoutRes && workoutRes.ok) {
        const d = await workoutRes.json();
        setWeekWorkouts(Array.isArray(d.workouts) ? d.workouts.length : 0);
      }
      if (summaryRes && summaryRes.ok) {
        const d = await summaryRes.json();
        const rows = Object.values((d.summary ?? {}) as Record<string, { entryCount?: number; kcal?: number }>);
        setWeekRows(rows.map((r) => ({ entryCount: Number(r?.entryCount ?? 0), kcal: Number(r?.kcal ?? 0) })));
      }
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

  // 今日状态分（readiness）：一个分数 + 一句结论 + 四项分解（v7 P2 加分解）
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

  const dietEntries = data?.fitness.nutritionEntries ?? [];
  const dietKcal = data?.fitness.nutritionKcal ?? 0;
  const dietTarget = data?.fitness.nutritionTargetKcal ?? 2000;
  const dietRemaining = data?.fitness.nutritionRemainingKcal ?? (data ? dietTarget - dietKcal : 0);
  const dietPct = dietTarget > 0 ? Math.min(100, Math.round((dietKcal / dietTarget) * 100)) : 0;

  const waterMl = data?.hydration?.totalMl ?? 0;
  const waterTarget = data?.hydration?.targetMl ?? 2000;
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, waterTarget)) * 100));

  const recordDays = weekRows.filter((r) => r.entryCount > 0).length;
  const avgKcal = recordDays > 0 ? Math.round(weekRows.reduce((sum, r) => sum + r.kcal, 0) / recordDays) : 0;

  const latestWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].weightKg : null;
  const weightDelta =
    latestWeight !== null && weightPoints.length > 1
      ? Math.round((latestWeight - weightPoints[0].weightKg) * 10) / 10
      : null;

  /** 就地补水（复用已有 hydration 后端），记完刷新 /api/daily */
  const quickWater = async (ml: number) => {
    haptics.light();
    try {
      await addHydration(token, ml);
      await load();
    } catch {
      // 离线：保持现状，返回健康页时 useFocusRefresh 会再拉一次
    }
  };

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

      {/* ① 今日状态：进度弧 + 四项分解 + 本周概览 */}
      {loading && !data ? (
        <SkeletonCard count={1} />
      ) : (
        <GlassSurface corner={radius.xl} style={styles.hero}>
          <View style={styles.heroTop}>
            <ProgressArc
              progress={readiness.score / 100}
              size={126}
              strokeWidth={11}
              value={readiness.score}
              label="今日状态"
              caption={readiness.weakest ? WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
            />
            <View style={styles.heroStats}>
              <StatLine label="本周训练" value={`${weekWorkouts} 次`} />
              <StatLine label="饮食记录" value={recordDays > 0 ? `${recordDays} 天 · 均 ${avgKcal}` : "本周未记录"} />
              <StatLine
                label="习惯完成"
                value={data && data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled} · ${habitPct}%` : "今天没有排期"}
              />
            </View>
          </View>

          <View style={styles.breakdown}>
            {BREAKDOWN.map((b) => {
              const pct = Math.round((readiness.parts[b.key] ?? 0) * 100);
              return (
                <PressableScale
                  key={b.key}
                  haptic
                  scaleTo={0.99}
                  style={styles.breakdownRow}
                  accessibilityLabel={`${b.label}完成度 ${pct}%`}
                  onPress={() => router.push(b.href as never)}
                >
                  <Text style={styles.breakdownLabel}>{b.label}</Text>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${Math.max(2, pct)}%`, backgroundColor: b.color }]} />
                  </View>
                  <Text style={styles.breakdownPct}>{pct}%</Text>
                </PressableScale>
              );
            })}
          </View>
        </GlassSurface>
      )}

      <GroupLabel>今日动作</GroupLabel>
      <View style={styles.actionGrid}>
        {/* 饮食：剩余额度 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="打开今日饮食"
          onPress={() => router.push("/nutrition" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="restaurant-outline" size={16} color={DIET_COLOR} />
            <Text style={styles.actionTitle}>饮食</Text>
          </View>
          <Text style={[styles.actionValue, dietRemaining < 0 && { color: colors.danger }]}>
            {dietRemaining}
            <Text style={styles.actionUnit}> kcal</Text>
          </Text>
          <Text style={styles.actionHint}>
            {dietRemaining < 0 ? `已超 ${Math.abs(dietRemaining)}` : "还能吃"} · 已吃 {dietKcal}/{dietTarget}
          </Text>
          <View style={styles.actionTrack}>
            <View style={[styles.actionFill, { width: `${dietPct}%`, backgroundColor: DIET_COLOR }]} />
          </View>
          {dietEntries.length > 0 ? (
            <Text style={styles.actionFoot} numberOfLines={1}>
              刚记：{dietEntries[dietEntries.length - 1].name} {dietEntries[dietEntries.length - 1].kcal} kcal
            </Text>
          ) : (
            <Text style={styles.actionFoot}>点这里记第一条 ›</Text>
          )}
        </PressableScale>

        {/* 饮水：液面条 + 一点即记 */}
        <View style={styles.actionCard}>
          <View style={styles.actionHead}>
            <ThemedIcon name="water-outline" size={16} color={WATER_COLOR} />
            <Text style={styles.actionTitle}>饮水</Text>
          </View>
          <Text style={styles.actionValue}>
            {waterMl}
            <Text style={styles.actionUnit}> / {waterTarget} ml</Text>
          </Text>
          <View style={styles.actionTrack}>
            <View style={[styles.actionFill, { width: `${waterPct}%`, backgroundColor: WATER_COLOR }]} />
          </View>
          <View style={styles.waterQuick}>
            {[200, 300, 500].map((ml) => (
              <PressableScale
                key={ml}
                haptic
                scaleTo={0.94}
                style={styles.waterChip}
                accessibilityLabel={`记录 ${ml} 毫升饮水`}
                onPress={() => void quickWater(ml)}
              >
                <Text style={styles.waterChipText}>+{ml}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* 训练 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="记录一次训练"
          onPress={() => router.push("/workout" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="barbell-outline" size={16} color={DIET_COLOR} />
            <Text style={styles.actionTitle}>训练</Text>
          </View>
          <Text style={styles.actionValue}>
            {data?.fitness.workoutMinutes ?? 0}
            <Text style={styles.actionUnit}> 分钟</Text>
          </Text>
          <Text style={styles.actionHint}>
            {data?.fitness.workoutName ? data.fitness.workoutName : "今天还没练"} · 本周 {weekWorkouts} 次
          </Text>
          <Text style={styles.actionFoot}>记录一次训练 ›</Text>
        </PressableScale>

        {/* 体重 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="查看体重趋势"
          onPress={() => router.push("/nutrition" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="body-outline" size={16} color={WEIGHT_COLOR} />
            <Text style={styles.actionTitle}>体重</Text>
          </View>
          <Text style={styles.actionValue}>
            {latestWeight !== null ? latestWeight : "--"}
            <Text style={styles.actionUnit}> kg</Text>
          </Text>
          <Text
            style={[
              styles.actionHint,
              weightDelta !== null && weightDelta !== 0 && { color: weightDelta > 0 ? colors.danger : colors.success },
            ]}
          >
            {weightDelta === null
              ? "还没有体重记录"
              : weightDelta === 0
                ? "近 30 天持平"
                : `近 30 天 ${weightDelta > 0 ? "+" : ""}${weightDelta} kg`}
          </Text>
          <Text style={styles.actionFoot}>{latestWeight === null ? "点这里记一次 ›" : "看趋势与目标 ›"}</Text>
        </PressableScale>
      </View>

      <GroupLabel>运动档案</GroupLabel>
      <ListGroup>
        <ListRow
          {...tintOf(CARD_COLOR)}
          icon="sparkles-outline"
          title="运动闪光卡"
          subtitle="战绩 · 装备 · 绝技，实时镭射卡面"
          showChevron
          last
          onPress={() => router.push("/sports-card" as never)}
        />
      </ListGroup>

      <GroupLabel>趋势与档案</GroupLabel>
      <ListGroup>
        <ListRow
          {...tintOf(WATER_COLOR)}
          icon="restaurant-outline"
          title="饮食趋势与目标"
          subtitle="7 天曲线 · 6 个月日历 · 热量目标 · 食物营养库"
          showChevron
          onPress={() => router.push("/nutrition" as never)}
        />
        <ListRow
          {...tintOf(DIET_COLOR)}
          icon="barbell-outline"
          title="训练记录"
          subtitle="动作库 · 组数次数 · 训练容量"
          showChevron
          onPress={() => router.push("/workout" as never)}
        />
        <ListRow
          {...tintOf(HABIT_COLOR)}
          icon="repeat-outline"
          title="习惯打卡"
          subtitle="连续天数 · 13 周热力图 · 时间段"
          showChevron
          onPress={() => router.push("/habits" as never)}
        />
        <ListRow
          {...tintOf(RECORD_COLOR)}
          icon="stats-chart-outline"
          title="领域记录"
          subtitle="跑量 · 体重 · 通用计量"
          showChevron
          last
          onPress={() => router.push("/trackers" as never)}
        />
      </ListGroup>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    /* ① 今日状态 */
    hero: { gap: spacing.md, paddingVertical: spacing.lg },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    heroStats: { flex: 1, minWidth: 0, gap: spacing.sm },
    breakdown: { gap: 8, paddingTop: 2 },
    breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    breakdownLabel: { width: 30, ...typography.micro, fontWeight: "700", color: colors.textMuted },
    breakdownTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    breakdownFill: { height: 6, borderRadius: 999 },
    breakdownPct: { width: 36, textAlign: "right", ...typography.micro, fontWeight: "700", color: colors.text, ...tabularNums },
    /* ② 今日动作 */
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    actionCard: {
      width: "47.5%",
      flexGrow: 1,
      minHeight: 124,
      gap: 6,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionTitle: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    actionValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    actionUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    actionHint: { ...typography.micro, fontWeight: "500", color: colors.textMuted, ...tabularNums },
    actionFoot: { marginTop: "auto", ...typography.micro, fontWeight: "700", color: colors.primary },
    actionTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    actionFill: { height: 5, borderRadius: 999 },
    waterQuick: { marginTop: 6, flexDirection: "row", gap: 6 },
    waterChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    waterChipText: { ...typography.micro, fontWeight: "800", color: colors.text, ...tabularNums },
  });
