/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";
import type { MarketAnalysis } from "@learn-workbench/shared";

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = "Bearer " + token;
        const r = await fetch(getApiUrl() + "/api/market", { headers });
        const d = await r.json();
        if (alive && r.ok) setData(d);
      } catch {
        // 保持空
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const bar = (value: number, max: number, color: string) => ({
    width: (max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 6) + "%" as DimensionValue,
    backgroundColor: color,
  });

  const cityMax = Math.max(1, ...(data?.byCity.map((c) => c.count) ?? [1]));
  const skillMax = Math.max(1, ...(data?.bySkill.map((s) => s.count) ?? [1]));
  const salaryMax = Math.max(1, ...(data?.salaryDist.map((s) => s.count) ?? [1]));
  const eduMax = Math.max(1, ...(data?.byEducation.map((e) => e.count) ?? [1]));
  const expMax = Math.max(1, ...(data?.byExperience.map((e) => e.count) ?? [1]));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>招聘市场分析</Text>
      <Text style={styles.sub}>市场到底需要什么？样本 {data?.total ?? "—"} 个职位</Text>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color="#10b981" /></View>
      ) : !data || data.total === 0 ? (
        <View style={styles.loadingBox}>
          <Ionicons name="trending-up-outline" size={30} color="#9ca3af" />
          <Text style={styles.emptyText}>暂无招聘数据，先抓取职位</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          <Card style={styles.card} title={"城市需求 TOP"}>
            {data.byCity.slice(0, 8).map((c) => (
              <View key={c.city} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} ellipsizeMode="tail">{c.city}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, bar(c.count, cityMax, "#10b981")]} />
                </View>
                <Text style={styles.rowValue}>{c.count}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.card} title={"技能热度 TOP"}>
            {data.bySkill.slice(0, 10).map((s) => (
              <View key={s.skill} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} ellipsizeMode="tail">{s.skill}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, bar(s.count, skillMax, "#0ea5e9")]} />
                </View>
                <Text style={styles.rowValue}>{s.count}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.card} title={"薪资分布（K/月）"}>
            {data.salaryDist.map((s) => (
              <View key={s.label} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} ellipsizeMode="tail">{s.label}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, bar(s.count, salaryMax, "#f59e0b")]} />
                </View>
                <Text style={styles.rowValue}>{s.count}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.card} title={"学历 · 经验"}>
            <Text style={styles.groupTitle}>学历需求</Text>
            {data.byEducation.map((e) => (
              <View key={e.label} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} ellipsizeMode="tail">{e.label}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, bar(e.count, eduMax, "#8b5cf6")]} />
                </View>
                <Text style={styles.rowValue}>{e.count}</Text>
              </View>
            ))}
            <Text style={styles.groupTitle}>经验需求</Text>
            {data.byExperience.map((e) => (
              <View key={e.label} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} ellipsizeMode="tail">{e.label}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, bar(e.count, expMax, "#f43f5e")]} />
                </View>
                <Text style={styles.rowValue}>{e.count}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { fontSize: 26, fontWeight: "900", color: "#18181b" },
  sub: { fontSize: 13, color: "#71717a", marginTop: 2 },
  loadingBox: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  grid: { gap: 12 },
  card: { padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: "700", color: "#52525b", textAlign: "right" },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: "rgba(24,24,27,0.07)", overflow: "hidden" },
  fill: { height: 12, borderRadius: 6 },
  rowValue: { width: 32, fontSize: 12, fontWeight: "800", color: "#18181b", textAlign: "right" },
  groupTitle: { fontSize: 12, fontWeight: "800", color: "#18181b", marginTop: 6 },
});

