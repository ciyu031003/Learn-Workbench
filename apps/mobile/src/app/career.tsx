/* eslint-disable react-hooks/immutability */
import { useEffect, useState , useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";
import type { CareerReadiness, UserSkillView } from "@learn-workbench/shared";

const SECTIONS = [
  { key: "applications", title: "我的求职", desc: "收藏 → Offer 全流程", icon: "briefcase-outline", color: "#10b981", href: "/applications" },
  { key: "market", title: "市场分析", desc: "城市 · 薪资 · 技能热度", icon: "trending-up-outline", color: "#0ea5e9", href: "/market" },
  { key: "skills", title: "技能树", desc: "技能画像 · 岗位匹配", icon: "git-branch-outline", color: "#4f46e5", href: "" },
  { key: "resume", title: "简历", desc: "资产整理与预览（P3）", icon: "document-text-outline", color: "#0ea5e9", href: "" },
  { key: "interview", title: "面试", desc: "题库 · 模拟面试（P3）", icon: "chatbubbles-outline", color: "#16a34a", href: "" },
] as const;

const LEVEL_LABELS = ["未掌握", "了解", "入门", "熟练", "精通", "专家"];

export default function CareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = "Bearer " + token;
        const [rR, sR] = await Promise.all([
          fetch(getApiUrl() + "/api/profile/readiness", { headers }),
          fetch(getApiUrl() + "/api/profile/skills", { headers }),
        ]);
        const rd = await rR.json().catch(() => null);
        const sd = await sR.json().catch(() => null);
        if (alive && rR.ok && rd) setReadiness(rd);
        if (alive && sR.ok && Array.isArray(sd.skills)) setSkills(sd.skills);
      } catch {
        // 离线或未登录：保持 null
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>职业</Text>
        <Text style={styles.heroSub}>画像 · 技能 · 简历 · 面试</Text>
      </View>

      <Card style={styles.readinessCard} title={readiness?.targetRole ?? "职业准备度"}>
        {loading ? (
          <ActivityIndicator color="#4f46e5" style={styles.loader} />
        ) : readiness ? (
          <View style={styles.readinessBody}>
            <View style={styles.readinessTop}>
              <Text style={styles.overall}>{readiness.overall}%</Text>
              <Text style={styles.overallLabel}>职业准备度</Text>
            </View>
            {readiness.dimensions.map((d) => (
              <View key={d.key} style={styles.dim}>
                <View style={styles.dimHeader}>
                  <Text style={styles.dimLabel}>{d.label}</Text>
                  <Text style={styles.dimScore}>{d.score}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: (d.score + "%") as DimensionValue, backgroundColor: d.key === "project" || d.key === "interview" ? "#0ea5e9" : "#4f46e5" }]} />
                </View>
              </View>
            ))}
            <Pressable onPress={() => router.push("/jobs")} style={({ pressed }) => [styles.jobBtn, pressed && { opacity: 0.8 }]}>
              <ThemedIcon name="flower-outline" size={16} color="#0d9488" />
              <Text style={styles.jobBtnText}>发现 {readiness.matchedJobs} 个适合你的职位</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.emptyHint}>登录并记录技能 / 项目 / 面试日志后，这里会呈现职业画像</Text>
        )}
      </Card>

      {skills.length > 0 ? (
        <Card style={styles.skillsCard} title={"我的技能 · " + skills.length}>
          <View style={styles.skillChips}>
            {skills.slice(0, 12).map((s) => (
              <View key={s.id} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{s.name}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <View style={styles.grid}>
        {SECTIONS.map((s) => (
          <Pressable key={s.key} disabled={!s.href} onPress={() => { if (s.href) router.push(s.href as never); }}>
            <Card style={styles.entryCard}>
              <View style={[styles.iconChip, { backgroundColor: s.color + "22" }]}>
                <ThemedIcon name={s.icon} size={22} color={s.color} />
              </View>
              <View style={styles.entryText}>
                <Text style={styles.entryTitle}>{s.title}</Text>
                <Text style={styles.entryDesc}>{s.desc}</Text>
              </View>
              {s.href ? <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} /> : null}
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  hero: { marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: "700", color: colors.text },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  readinessCard: { padding: 16 },
  loader: { marginVertical: 24 },
  readinessBody: { gap: 10 },
  readinessTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  overall: { fontSize: 40, fontWeight: "800", color: "#4f46e5" },
  overallLabel: { fontSize: 12, color: colors.textMuted },
  dim: { gap: 4 },
  dimHeader: { flexDirection: "row", justifyContent: "space-between" },
  dimLabel: { fontSize: 12, fontWeight: "600", color: colors.text },
  dimScore: { fontSize: 12, color: colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(24,24,27,0.08)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  jobBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(13,148,136,0.10)", alignSelf: "flex-start" },
  jobBtnText: { fontSize: 13, fontWeight: "600", color: "#0d9488" },
  emptyHint: { fontSize: 13, color: colors.textMuted, paddingVertical: 12 },
  grid: { gap: 12 },
  entry: { borderRadius: 20 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  entryCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconChip: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  entryText: { flex: 1 },
  entryTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  entryDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  skillsCard: { padding: 16, gap: 10 },
  skillChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    backgroundColor: "rgba(79,70,229,0.10)",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.28)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skillChipText: { fontSize: 12, fontWeight: "700", color: "#4338ca" },
});
