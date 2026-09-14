import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";

interface RadarJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  education: string;
  salaryText: string;
  url: string;
  overall: number;
  matchedSkills: { skill: string }[];
  missingSkills: { skill: string }[];
  gapHours: number;
  deadlineLabel: string | null;
}

interface RadarResponse {
  mode: "batch" | "fallback";
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  top: RadarJob[];
  counts: { candidates: number; matched: number; favorites: number; applications: number };
}

/** V3 就业雷达（移动端）：批量匹配结果卡片流 */
export default function RadarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/jobs/radar", { headers });
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

  const top = data?.top ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="就业雷达"
        subtitle={data?.targetRole ? `目标：${data.targetRole}${data.profileCity ? ` · ${data.profileCity}` : ""}` : "今日适合你的岗位信号"}
        compact
      />

      {data && data.mode === "batch" ? (
        <Text style={styles.meta}>
          已扫描 {data.counts.candidates} 个候选岗位 · 匹配 {data.counts.matched} 个（收藏 {data.counts.favorites} / 投递 {data.counts.applications}）
        </Text>
      ) : null}

      {loading && top.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : top.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            {data?.hasProfile ? "暂时没有可匹配的岗位" : "先补全「我的资料」与技能，雷达才能算出匹配度"}
          </Text>
        </Card>
      ) : (
        top.map((j) => (
          <Card key={j.jobId} style={styles.item}>
            <View style={styles.head}>
              <View style={styles.scoreWrap}>
                <Text style={[styles.score, j.overall >= 75 && { color: colors.success ?? colors.primary }]}>{j.overall}%</Text>
              </View>
              <View style={styles.headInfo}>
                <Text style={styles.title} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {[j.company, j.city, j.education].filter(Boolean).join(" · ")}
                </Text>
                {j.salaryText ? <Text style={styles.salary}>{j.salaryText}</Text> : null}
              </View>
              {j.deadlineLabel ? <Text style={styles.deadline}>{j.deadlineLabel}</Text> : null}
            </View>

            <View style={styles.chips}>
              {j.matchedSkills.slice(0, 3).map((s) => (
                <Text key={`m-${s.skill}`} style={[styles.chip, styles.chipHit]}>✓ {s.skill}</Text>
              ))}
              {j.missingSkills.slice(0, 3).map((s) => (
                <Text key={`x-${s.skill}`} style={styles.chip}>○ {s.skill}</Text>
              ))}
            </View>

            <View style={styles.footer}>
              {j.gapHours > 0 ? <Text style={styles.muted}>缺口约 {Math.round(j.gapHours)} 小时</Text> : <View />}
              {j.url ? (
                <Pressable hitSlop={8} onPress={() => void Linking.openURL(j.url)}>
                  <Text style={styles.link}>查看原始来源</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))
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
    meta: { fontSize: 11, color: colors.textMuted },
    item: { gap: 8 },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    scoreWrap: { minWidth: 46, alignItems: "center", justifyContent: "center" },
    score: { fontSize: 18, fontWeight: "800", color: colors.primary },
    headInfo: { flex: 1, minWidth: 0, gap: 1 },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    muted: { fontSize: 11, color: colors.textMuted },
    salary: { fontSize: 12, fontWeight: "700", color: colors.text },
    deadline: { fontSize: 11, fontWeight: "700", color: colors.accentStrong },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { fontSize: 11, color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    chipHit: { color: colors.text },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { fontSize: 12, color: colors.primary, fontWeight: "700" },
  });