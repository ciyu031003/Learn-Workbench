import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { Skeleton } from "@/components/skeleton";
import { PressableScale } from "@/components/pressable-scale";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { StatLine } from "@/components/stat";
import { FoodSticker } from "@/components/food-sticker";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import { mealKindLabels } from "@learn-workbench/shared";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { getApiUrl } from "@/config";

export interface DailyOs {
  date: string;
  greeting: string;
  progress: number;
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number; items: { id: number; title: string; done: boolean }[] };
  career: { targetRole: string | null; highMatchJobs: number; pendingApplications: number; expiringCertificates: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条，v3 M11） */
    nutritionEntries?: { id: number; name: string; meal: "breakfast" | "lunch" | "dinner" | "snack"; kcal: number; createdAt?: string }[];
  };
  /** v3 M11：今日饮水（后端复用 hydration_logs） */
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

interface Block {
  key: string;
  icon: Parameters<typeof ThemedIcon>[0]["name"];
  label: string;
  detail: string;
  href: string;
  badge?: number;
}

/**
 * 「我的一天」聚合块（可嵌入首页）：
 * 完成度进度 + 四域入口 + 饮食/提醒。数据来自只读 `GET /api/daily`。
 * 作为首页顶部区块使用，因此不重复渲染问候语（由首页标题承担）。
 */
export function DailyOsSummary({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<DailyOs | null>(null);
  /**
   * 三态：loading（首屏骨架）/ ok / error（显式失败 + 重试）。
   * 旧版在失败/为空时直接 `return null`，首页整块（含习惯入口）会**静默消失** —— 这就是
   * "上午还在、下午打开就没了" 的根因（v12 P0-1）。
   */
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/daily", { headers });
      if (r.ok) {
        setData(await r.json());
        setStatus("ok");
      } else {
        setStatus("error");
      }
    } catch {
      // 离线：保留上一次数据，但标记失败，页面给出「重试」
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // 回到首页时刷新（打卡/记录后立即反映）
  useFocusRefresh(load);

  const go = useCallback(
    (href: string) => {
      if (onNavigate) onNavigate(href);
      else router.push(href as never);
    },
    [onNavigate]
  );

  const blocks: Block[] = useMemo(() => {
    if (!data) return [];
    // v4 P2：「学习」「运动」已并入首页的「一键开始」大按钮（点一下直接进入计时），
    // 这里只保留"需要跳页面看明细"的两个领域，避免同一入口出现两次、也让首屏少两格高度。
    return [
      {
        key: "career",
        icon: "briefcase-outline",
        label: "职业",
        detail: `高匹配 ${data.career.highMatchJobs} · 在途 ${data.career.pendingApplications}`,
        href: "/career",
        badge: data.career.expiringCertificates,
      },
      {
        key: "habits",
        icon: "repeat-outline",
        label: "习惯",
        detail: data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled} 已完成` : "今天没有排期",
        href: "/habits",
        badge: Math.max(0, data.habits.scheduled - data.habits.done),
      },
    ];
  }, [data]);

  // 首屏：给骨架而不是空（旧版这里是 `return null`）
  if (!data && status === "loading") {
    return (
      <View style={styles.wrap}>
        {/* v13 U1：首屏骨架用 hero 形状，和真实 hero（进度弧 + 指标）体量接近，减少跳动 */}
        <Skeleton variant="hero" />
      </View>
    );
  }

  // 加载失败且没有任何可展示的数据：占位 + 重试，绝不让整块消失
  if (!data) {
    return (
      <View style={styles.wrap}>
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <ThemedIcon name="cloud-offline-outline" size={20} color={colors.danger} />
            <Text style={styles.errorTitle}>今天的数据没加载出来</Text>
          </View>
          <Text style={styles.muted}>点下面重试；如果一直失败，多半是网络或登录状态的问题。</Text>
          <PressableScale haptic scaleTo={0.97} style={styles.retryBtn} onPress={() => { setStatus("loading"); void load(); }}>
            <ThemedIcon name="refresh" size={16} color={colors.canvas} />
            <Text style={styles.retryText}>重试</Text>
          </PressableScale>
        </Card>
      </View>
    );
  }

  const entries = data.fitness.nutritionEntries ?? [];
  const pct = Math.max(0, Math.min(100, data.progress));
  // Orbix：「鼓励而非警示」——结论按完成度给正向引导，不做责备式文案
  const verdict =
    pct >= 80
      ? "今天状态很好，保持这个节奏"
      : pct >= 50
        ? "已经过半，再推一把就收工"
        : pct > 0
          ? "慢慢来，今天已经开始"
          : "从一件小事开始，今天就算赢";

  return (
    <View style={styles.wrap}>
      {status === "error" ? (
        <PressableScale haptic scaleTo={0.98} style={styles.staleBar} onPress={() => void load()}>
          <ThemedIcon name="cloud-offline-outline" size={15} color={colors.danger} />
          <Text style={styles.staleText}>这次没刷新成功，显示的是上次数据 · 点这里重试</Text>
        </PressableScale>
      ) : null}

      {/* ① 今日完成度 hero：进度弧（替代横条）+ 关键指标（每屏唯一 hero，玻璃只做层级） */}
      <GlassSurface corner={radius.xl} style={styles.hero}>
        <ProgressArc
          progress={pct / 100}
          size={126}
          strokeWidth={11}
          value={`${pct}%`}
          label="今日完成"
          caption={verdict}
        />
        <View style={styles.heroStats}>
          <StatLine label="专注" value={`${data.learning.focusMinutes} 分`} />
          <StatLine label="任务" value={`${data.learning.tasksDone}/${data.learning.tasksTotal}`} />
          <StatLine label="习惯" value={`${data.habits.done}/${data.habits.scheduled}`} />
          {/* v3 M11：饮食以「剩余可吃」呈现（与饮食页口径一致） */}
          <StatLine
            label="还能吃"
            value={`${data.fitness.nutritionRemainingKcal ?? data.fitness.nutritionTargetKcal - data.fitness.nutritionKcal} kcal`}
            valueColor={
              (data.fitness.nutritionRemainingKcal ?? data.fitness.nutritionTargetKcal - data.fitness.nutritionKcal) < 0
                ? colors.danger
                : undefined
            }
          />
          {data.hydration ? (
            <StatLine label="饮水" value={`${data.hydration.totalMl}/${data.hydration.targetMl} ml`} />
          ) : null}
        </View>
      </GlassSurface>

      {/* ② 四域入口（2×2） */}
      <View style={styles.grid}>
        {blocks.map((b) => (
          <PressableScale key={b.key} haptic style={styles.gridItem} onPress={() => go(b.href)}>
            <Card style={styles.block}>
              <View style={styles.blockHead}>
                <ThemedIcon name={b.icon} size={18} color={colors.primary} />
                {b.badge && b.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{b.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.blockLabel}>{b.label}</Text>
              <Text style={styles.muted} numberOfLines={2}>{b.detail}</Text>
            </Card>
          </PressableScale>
        ))}
      </View>

      {/* 今日饮食明细（v3 M11：直接看到吃了什么，点进饮食页看全部） */}
      <PressableScale haptic onPress={() => go("/nutrition")}>
        <Card style={styles.dietCard}>
          <View style={styles.dietHead}>
            <ThemedIcon name="restaurant-outline" size={18} color={colors.primary} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>今日饮食</Text>
              <Text style={styles.muted}>
                {data.fitness.nutritionKcal} / {data.fitness.nutritionTargetKcal} kcal
                {entries.length > 0 ? ` · ${entries.length} 条` : ""}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </View>

          {entries.length === 0 ? (
            <Text style={styles.muted}>还没有记录，去记一条吧</Text>
          ) : (
            <View style={styles.dietList}>
              {entries.slice(0, 3).map((e) => (
                <View key={e.id} style={styles.dietRow}>
                  <FoodSticker name={e.name} size={28} />
                  <Text style={styles.dietName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.dietMeal}>{mealKindLabels[e.meal] ?? ""}</Text>
                  <Text style={styles.dietKcal}>{e.kcal} kcal</Text>
                </View>
              ))}
              {entries.length > 3 ? (
                <Text style={styles.muted}>还有 {entries.length - 3} 条 · 查看全部</Text>
              ) : null}
            </View>
          )}
        </Card>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    // 失败态：显式占位 + 重试（不再 return null 让整块消失）
    errorCard: { gap: spacing.sm, borderColor: colors.danger, borderWidth: 1 },
    errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    errorTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    retryBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.danger,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 2,
    },
    retryText: { ...typography.micro, fontWeight: "800", color: colors.canvas },
    staleBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    staleText: { flex: 1, ...typography.micro, fontWeight: "600", color: colors.danger },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingVertical: spacing.lg,
    },
    heroStats: { flex: 1, minWidth: 0, gap: spacing.sm },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    gridItem: { width: "47.5%", flexGrow: 1 },
    block: { gap: 2, minHeight: 92 },
    blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: radius.pill, backgroundColor: colors.accentStrong, alignItems: "center", justifyContent: "center" },
    badgeText: { color: "#fff", ...typography.micro, fontSize: 10 },
    blockLabel: { ...typography.callout, fontWeight: "800", color: colors.text, marginTop: 2 },
    muted: { ...typography.micro, fontWeight: "500", color: colors.textMuted, lineHeight: 15 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { ...typography.callout, fontWeight: "800", color: colors.text },
    dietCard: { gap: spacing.sm },
    dietHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    dietList: { gap: 6 },
    dietRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dietName: { flex: 1, minWidth: 0, ...typography.callout, fontWeight: "600", color: colors.text },
    dietMeal: { ...typography.micro, fontWeight: "500", color: colors.textFaint },
    dietKcal: { ...typography.micro, fontWeight: "700", color: colors.accentStrong, ...tabularNums },
  });
