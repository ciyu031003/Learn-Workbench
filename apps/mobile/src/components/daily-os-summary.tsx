import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { getApiUrl } from "@/config";

export interface DailyOs {
  date: string;
  greeting: string;
  progress: number;
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number; items: { id: number; title: string; done: boolean }[] };
  career: { targetRole: string | null; highMatchJobs: number; pendingApplications: number; expiringCertificates: number };
  fitness: { workoutName: string | null; workoutMinutes: number; nutritionKcal: number; nutritionTargetKcal: number };
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

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/daily", { headers });
      if (r.ok) setData(await r.json());
    } catch {
      // 离线：保留上一次数据，不阻塞首页
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
    return [
      {
        key: "learning",
        icon: "book-outline",
        label: "学习",
        detail:
          data.learning.tasksTotal > 0
            ? `${data.learning.tasksDone}/${data.learning.tasksTotal} 任务 · 专注 ${data.learning.focusMinutes} 分`
            : `专注 ${data.learning.focusMinutes} 分`,
        href: "/tasks",
      },
      {
        key: "career",
        icon: "briefcase-outline",
        label: "职业",
        detail: `高匹配 ${data.career.highMatchJobs} · 在途 ${data.career.pendingApplications}`,
        href: "/career",
        badge: data.career.expiringCertificates,
      },
      {
        key: "fitness",
        icon: "barbell-outline",
        label: "运动",
        detail: data.fitness.workoutName ? `${data.fitness.workoutName} · ${data.fitness.workoutMinutes} 分` : "今天还没有训练",
        href: "/wellness",
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

  // 首次加载尚无数据时不占位（首页其余卡片已在渲染，避免骨架闪烁）
  if (!data) return null;

  const pct = Math.max(0, Math.min(100, data.progress));

  return (
    <View style={styles.wrap}>
      {/* 今日完成度 */}
      <Card style={styles.progressCard}>
        <View style={styles.progressHead}>
          <View style={styles.progressTitleWrap}>
            <Text style={styles.progressLabel}>今日完成</Text>
            <Text style={styles.progressHint}>学习 · 习惯 · 运动 · 饮食</Text>
          </View>
          <Text style={styles.progressValue}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </Card>

      {/* 四域入口（2×2） */}
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

      {/* 饮食进度（一行） */}
      <PressableScale haptic onPress={() => go("/nutrition")}>
        <Card style={styles.row}>
          <ThemedIcon name="restaurant-outline" size={18} color={colors.primary} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>今日饮食</Text>
            <Text style={styles.muted}>
              {data.fitness.nutritionKcal} / {data.fitness.nutritionTargetKcal} kcal
            </Text>
          </View>
          <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
        </Card>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    progressCard: { gap: spacing.sm },
    progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    progressTitleWrap: { gap: 1 },
    progressLabel: { ...typography.headline, color: colors.text },
    progressHint: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    progressValue: { ...typography.title2, color: colors.primary, ...tabularNums },
    track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
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
  });
