import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { shadows, typography, type ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { Workout } from "@learn-workbench/shared/schemas";
import { TRAINING_LOAD_METRIC_META } from "@learn-workbench/shared/labels";
import { trainingLoadSeries, workoutVolume } from "@learn-workbench/shared/pure";

/** 柱状图横轴标签（训练负荷按「最近 7 天」聚合） */
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 训练记录列表（v1.47）。
 *
 * 记录 / 编辑表单已迁到全屏路由 `/workout-add`：动作明细 + 组次步进器 + 附加信息太长，
 * 旧实现是 86% 高的 BottomSheet，真机上要滚很久、键盘一弹只剩半屏。本页现在只负责
 * 列表、近 7 天负荷与删除；新建/编辑都 push 到独立页面（原生转场 + 侧滑返回）。
 *
 * 保存成功后由 /workout-add 调 router.back() 回到本页；本页在 focus 时用
 * useFocusRefresh(load) 重新拉取，所以列表会自动出现刚保存的那条。
 */
export default function WorkoutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {}),
    [token]
  );
  const totals = useMemo(() => workoutVolume(workouts.flatMap((w) => w.items)), [workouts]);
  /**
   * 近 7 天训练负荷。
   *
   * 口径由 trainingLoadSeries 自动选择：容量(kg) → 次数 → 组数 → 训练次数。
   * 此前只用「组 × 次 × kg」，而**自重动作的 weightKg 是 null**（俯卧撑/引体/跑步机…），
   * 容量恒为 0 → 柱状图只剩几个 3px 灰条、总容量显示 0，用户看到的就是"没有数据"。
   * 现在只要记录了训练就一定有可见的柱子，并明确标出当前用的是哪个口径。
   */
  const weekLoad = useMemo(() => trainingLoadSeries(workouts, 7), [workouts]);
  const weekMeta = TRAINING_LOAD_METRIC_META[weekLoad.metric];
  const weekBars = weekLoad.days;
  const weekTotals = weekLoad.total;
  const weekTotalValue = useMemo(
    () => weekLoad.days.reduce((sum, day) => sum + day.value, 0),
    [weekLoad]
  );

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
  }, [headers]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /**
   * 从 /workout-add 保存返回时刷新列表（旧实现保存后自己 await load()，
   * 现在动作在另一个页面完成，只能在 focus 时重新拉）。
   */
  useFocusRefresh(load);

  /** v18：统一走 usePullRefresh（本页有吸顶紧凑栏 → stickyHeader: true），偏移与配色由 hook 集中计算 */
  const { control } = usePullRefresh(load, { stickyHeader: true });
  /** v17-D：减弱动态时不做入场错峰与 Layout 转场 */
  const reduced = useReducedMotion();

  /* ---------- 入口 ---------- */

  /** 新建：全屏路由，表单在 /workout-add 里（不再开 BottomSheet） */
  const openCreate = () => {
    router.push("/workout-add" as never);
  };

  /** 编辑：带 id 进同一个全屏页，由它拉取明细回填 */
  const openEdit = (w: Workout) => {
    router.push({ pathname: "/workout-add", params: { id: String(w.id) } } as never);
  };

  const removeWorkout = (w: Workout) => {
    Alert.alert("删除训练记录", "确定删除「" + w.name + "」（" + w.exercisedOn + "）吗？删除后不可恢复。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const r = await fetch(getApiUrl() + "/api/workouts/" + w.id, { method: "DELETE", headers: headers() });
            if (!r.ok) throw new Error("删除失败");
            await load();
          } catch (e) {
            Alert.alert("删除失败", e instanceof Error ? e.message : "请稍后重试");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="训练记录" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}
      >
        <ScreenHeaderLargeTitle
          title="训练记录"
          subtitle={"近 60 天 " + workouts.length + " 次 · 总容量 " + totals.volumeKg + " kg"}
        />

        {/* 视觉高约 38，补足 44pt 触控下限（滚动容器的边缘留 3pt 热区是安全的） */}
        <PressableScale style={styles.addBtn} hitSlop={{ top: 3, bottom: 3 }} haptic onPress={openCreate}>
          <ThemedIcon name="add" size={17} color={colors.primary} />
          <Text style={styles.addBtnText}>记录训练</Text>
        </PressableScale>

        <View style={styles.insightCard}>
          <View style={styles.insightHead}>
            <View>
              <Text style={styles.insightTitle}>近 7 天训练负荷</Text>
              <Text style={styles.insightHint}>
                {weekLoad.total.sessions > 0
                  ? "柱高按每日" + weekMeta.title + "计算（" + weekMeta.unit + "）"
                  : "记录一次训练后开始生成趋势"}
              </Text>
            </View>
            <View style={styles.insightBadge}>
              <Text style={styles.insightBadgeValue}>{weekLoad.total.sets}</Text>
              <Text style={styles.insightBadgeUnit}>组</Text>
            </View>
          </View>
          <View style={styles.barRow}>
            {weekBars.map((day) => (
              <View key={day.key} style={styles.barCell}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        // day.height 已含"当天有训练但无可量化负荷"的最小柱高，
                        // 不会再出现 4% 那种肉眼看不见的小灰条
                        height: `${day.height}%`,
                        backgroundColor: day.sessions > 0 ? colors.primary : colors.surfaceMuted,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{WEEKDAY_LABELS[day.weekday]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.insightStats}>
            <View style={styles.insightStat}>
              <Text style={styles.insightStatValue}>{weekLoad.total.sessions}</Text>
              <Text style={styles.insightStatLabel}>训练次数</Text>
            </View>
            <View style={styles.insightDivider} />
            <View style={styles.insightStat}>
              <Text style={styles.insightStatValue}>{weekTotals.reps}</Text>
              <Text style={styles.insightStatLabel}>总次数</Text>
            </View>
            <View style={styles.insightDivider} />
            <View style={styles.insightStat}>
              <Text style={styles.insightStatValue}>{weekTotalValue}</Text>
              <Text style={styles.insightStatLabel}>{weekMeta.title}（{weekMeta.unit}）</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <SkeletonList count={4} />
        ) : workouts.length === 0 ? (
          <EmptyState icon="barbell-outline" title="还没有训练记录" hint="从动作库里选动作、填组次，自动汇总训练容量" />
        ) : (
          workouts.map((w, index) => {
            const v = workoutVolume(w.items);
            return (
              /* v17-D：列表入场错峰（每屏封顶 12 项，滚动复现不做；减弱动态下不参与） */
              <Animated.View
                key={w.id}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(index))}
                layout={reduced ? undefined : LinearTransition}
              >
                <Card style={styles.item}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{w.name}</Text>
                    <Text style={styles.muted}>{w.exercisedOn}</Text>
                    <View style={styles.itemActions}>
                      <Pressable
                        hitSlop={8}
                        style={styles.iconBtn}
                        onPress={() => openEdit(w)}
                        accessibilityLabel={"编辑 " + w.name}
                      >
                        <ThemedIcon name="create-outline" size={15} color={colors.textMuted} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        style={styles.iconBtn}
                        onPress={() => removeWorkout(w)}
                        accessibilityLabel={"删除 " + w.name}
                      >
                        <ThemedIcon name="trash-outline" size={15} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                  {w.items.map((it, i) => (
                    <View key={it.id ?? i} style={styles.entryRow}>
                      <Text style={styles.entryName} numberOfLines={1}>{it.exerciseLabel}</Text>
                      <Text style={styles.muted}>
                        {it.sets} × {it.reps}{it.weightKg !== null ? " · " + it.weightKg + "kg" : ""}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.volume}>
                    {v.sets} 组 · {v.reps} 次{v.volumeKg > 0 ? " · " + v.volumeKg + " kg" : ""}
                  </Text>
                </Card>
              </Animated.View>
            );
          })
        )}
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /**
     * 真机过渡修复（v1.31）：推入页必须自己铺**不透明**底色。
     * 栈的 contentStyle 是 transparent（为了露出全局 DailyBackground），因此每个被推入的页面
     * 都要自己兜底背景；此前这里只有 flex:1 —— 推入动画期间整页透明，上一屏（健康首页）会透出来，
     * 再叠加本页训练卡的 entering 错峰入场（首帧卡片不可见），就出现了
     * 「两页重合约 200ms、随后又自己好了」的现象。与同类推入页 sports-card 的约定保持一致。
     */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    addBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: colors.primary, fontSize: typography.callout.fontSize, fontWeight: "800" },
    insightCard: {
      gap: 14,
      padding: 15,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    insightHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    insightTitle: { fontSize: typography.headline.fontSize, fontWeight: "800", color: colors.text },
    insightHint: { marginTop: 3, fontSize: typography.caption.fontSize, color: colors.textMuted },
    insightBadge: {
      minWidth: 52,
      height: 46,
      paddingHorizontal: 10,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    insightBadgeValue: {
      fontSize: typography.headline.fontSize,
      fontWeight: "900",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    insightBadgeUnit: { ...typography.micro, fontWeight: "700", color: colors.primaryStrong },
    barRow: { height: 94, flexDirection: "row", alignItems: "flex-end", gap: 7 },
    barCell: { flex: 1, alignItems: "center", gap: 6 },
    barTrack: {
      width: "100%",
      height: 68,
      justifyContent: "flex-end",
      overflow: "hidden",
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
    },
    barFill: { width: "100%", minHeight: 3, borderRadius: 8 },
    barLabel: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    insightStats: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    insightStat: { flex: 1, alignItems: "center", gap: 2 },
    insightStatValue: {
      fontSize: typography.headline.fontSize,
      fontWeight: "900",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    insightStatLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    insightDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
    item: { gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      flexShrink: 1,
    },
    itemActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    muted: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    entryName: { fontSize: typography.callout.fontSize, color: colors.text, flexShrink: 1 },
    volume: { fontSize: typography.caption.fontSize, fontWeight: "700", color: colors.primary },
  });
