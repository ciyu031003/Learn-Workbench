import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useRefreshable } from "@/lib/use-refresh";
import { getApiUrl } from "@/config";

interface DailyOs {
  fitness: { workoutName: string | null; workoutMinutes: number; nutritionKcal: number; nutritionTargetKcal: number };
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ScreenHeader title="健康" subtitle="训练 · 饮食 · 习惯，照顾好身体才有持续成长" compact />

      {/* 今日状态 */}
      {loading && !data ? (
        <SkeletonCard count={1} />
      ) : (
        <Card variant="hero" style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{data?.fitness.workoutMinutes ?? 0}</Text>
              <Text style={styles.heroUnit}>分钟</Text>
              <Text style={styles.heroLabel}>今日训练</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{data?.fitness.nutritionKcal ?? 0}</Text>
              <Text style={styles.heroUnit}>kcal</Text>
              <Text style={styles.heroLabel}>今日摄入</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={styles.heroNum}>{habitPct}%</Text>
              <Text style={styles.heroUnit}>习惯</Text>
              <Text style={styles.heroLabel}>
                {data ? `${data.habits.done}/${data.habits.scheduled}` : "0/0"}
              </Text>
            </View>
          </View>
        </Card>
      )}

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
    content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
    hero: { paddingVertical: spacing.lg },
    heroRow: { flexDirection: "row", alignItems: "center" },
    heroItem: { flex: 1, alignItems: "center", gap: 1 },
    heroDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.border },
    heroNum: { ...typography.title2, color: colors.text, ...tabularNums },
    heroUnit: { ...typography.micro, color: colors.textMuted },
    heroLabel: { ...typography.micro, color: colors.textFaint, marginTop: 2 },
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
