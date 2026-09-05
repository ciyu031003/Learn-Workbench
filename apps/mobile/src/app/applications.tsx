/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState , useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";
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
  const token = useAppStore((s) => s.token);
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      <View style={styles.actions}>
        {STAGES.map((s) => (
          <Pressable key={s} onPress={() => setStage(item.id, s)} style={[styles.stageChip, item.stage === s && styles.stageChipActive]}>
            <Text style={item.stage === s ? styles.stageChipTextActive : styles.stageChipText}>{jobApplicationStageLabels[s]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => remove(item.id)} hitSlop={8} style={styles.removeBtn}>
        <ThemedIcon name="trash-outline" size={14} color="#dc2626" />
      </Pressable>
    </Card>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>我的求职</Text>
            <Text style={styles.headerSub}>共 {apps.length} 条 · 收藏 → Offer 全流程</Text>
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
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  header: { marginBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: colors.text },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  appCard: { padding: 14, gap: 10 },
  appTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  appMain: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  stageBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(79,70,229,0.12)" },
  stageText: { fontSize: 10, fontWeight: "800", color: "#4338ca" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stageChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(24,24,27,0.05)", borderWidth: 1, borderColor: "rgba(24,24,27,0.10)" },
  stageChipActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  stageChipText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  stageChipTextActive: { fontSize: 10, fontWeight: "800", color: "#ffffff" },
  removeBtn: { alignSelf: "flex-end" },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.textFaint, textAlign: "center" },
});
