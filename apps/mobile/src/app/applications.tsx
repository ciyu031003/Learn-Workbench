/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState , useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeader } from "@/components/screen-header";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetListRow, SheetSection, SheetStickyCta } from "@/components/sheet";
import {
  jobApplicationStageLabels,
  jobApplicationStageSchema,
  type JobApplication,
  type JobApplicationStage,
} from "@learn-workbench/shared";

const STAGES: JobApplicationStage[] = [
  "favorite", "ready", "applied", "online_test", "interview1", "interview2", "offer", "hired", "closed",
];

export default function ApplicationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** v16：阶段选择收进弹层（原来 9 个胶囊挤在卡片里），id=null 表示关闭 */
  const [stageSheetFor, setStageSheetFor] = useState<number | null>(null);
  const editing = stageSheetFor === null ? null : apps.find((a) => a.id === stageSheetFor) ?? null;

  const api = (path: string, opts: RequestInit = {}) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(getApiUrl() + path, { ...opts, headers });
  };

  const load = useCallback(async () => {
    try {
      const r = await api("/api/jobs/applications");
      if (r.ok) setApps((await r.json()).applications ?? []);
    } catch {
      // 离线保持
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  // 从招花收藏后回到本页要立刻看到新条目（旧实现只在挂载时拉一次）
  useFocusRefresh(load);

  const setStage = async (id: number, stage: JobApplicationStage) => {
    const r = await api("/api/jobs/applications/" + id, { method: "PUT", body: JSON.stringify({ stage }) });
    if (r.ok) await load();
  };

  const remove = async (id: number) => {
    await api("/api/jobs/applications/" + id, { method: "DELETE" });
    await load();
  };

  const groups = STAGES.map((s) => ({ stage: s, items: apps.filter((a) => a.stage === s) })).filter((g) => g.items.length > 0);

  const renderItem = ({ item }: { item: JobApplication }) => (
    <Card style={styles.appCard}>
      <View style={styles.appTop}>
        <View style={styles.appMain}>
          <Text style={styles.title} numberOfLines={1}>{item.jobTitle}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.jobCompany || "未知公司"} · {item.jobCity || "全国"}{item.jobSalary ? " · " + item.jobSalary : ""}
          </Text>
        </View>
        <View style={styles.stageBadge}>
          <Text style={styles.stageText}>{jobApplicationStageLabels[item.stage]}</Text>
        </View>
      </View>
      <Pressable onPress={() => setStageSheetFor(item.id)} style={styles.stageRow} accessibilityRole="button">
        <Text style={styles.stageRowLabel}>更新阶段</Text>
        <Text style={styles.stageRowValue}>{jobApplicationStageLabels[item.stage]}</Text>
        <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
      </Pressable>
    </Card>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: tabBarSpace }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title="我的求职" subtitle={`共 ${apps.length} 条 · 收藏 → Offer 全流程`} compact />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyBox}><ActivityIndicator color="#10b981" /></View>
          ) : (
            <View style={styles.emptyBox}>
              <ThemedIcon name="briefcase-outline" size={34} color="#10b981" />
              <Text style={styles.emptyText}>还没有求职记录，去招花页加入吧</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* v16：阶段选择改「单选列表 + 吸底危险 CTA」，卡片上只留一行摘要 */}
      <BottomSheet
        visible={stageSheetFor !== null}
        onClose={() => setStageSheetFor(null)}
        title="更新求职阶段"
        subtitle={editing ? `${editing.jobTitle}${editing.jobCompany ? " · " + editing.jobCompany : ""}` : undefined}
        icon="briefcase-outline"
        height="78%"
        footer={
          <SheetStickyCta
            label="移出我的求职"
            icon="trash-outline"
            danger
            onPress={() => {
              if (!editing) return;
              void remove(editing.id);
              setStageSheetFor(null);
            }}
          />
        }
        footerHint="移出后，若这条仍停在「收藏」阶段，收藏也会一并取消"
      >
        <SheetSection title="当前阶段" hint="点一下直接切到该阶段" last>
          {STAGES.map((s, i) => (
            <SheetListRow
              key={s}
              mode="radio"
              title={jobApplicationStageLabels[s]}
              selected={editing?.stage === s}
              last={i === STAGES.length - 1}
              onPress={() => {
                if (!editing) return;
                void setStage(editing.id, s);
                setStageSheetFor(null);
              }}
            />
          ))}
        </SheetSection>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 10 },
  header: { marginBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: colors.text },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  appCard: { padding: 14, gap: 10 },
  appTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  appMain: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  stageBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.primarySoft },
  stageText: { fontSize: 10, fontWeight: "800", color: colors.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stageChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong },
  stageChipActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  stageChipText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  stageChipTextActive: { fontSize: 10, fontWeight: "800", color: "#ffffff" },
  removeBtn: { alignSelf: "flex-end" },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  stageRowLabel: { flex: 1, ...typography.caption, fontWeight: "700", color: colors.textMuted },
  stageRowValue: { ...typography.caption, fontWeight: "800", color: colors.text },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.textFaint, textAlign: "center" },
});
