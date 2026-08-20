/* eslint-disable react-hooks/immutability */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/card";

const ENTRIES = [
  { key: "roadmap", title: "路线图", desc: "学习路线 · 主题进度", icon: "map-outline", href: "/roadmap", color: "#4f46e5" },
  { key: "tasks", title: "今日任务", desc: "计划 → 专注 → 复盘", icon: "checkbox-outline", href: "/tasks", color: "#0ea5e9" },
  { key: "logs", title: "学习日志", desc: "费曼讲稿 · 复盘 · 面试记录", icon: "book-outline", href: "/logs", color: "#16a34a" },
] as const;

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>学习</Text>
        <Text style={styles.heroSub}>路线图 · 今日任务 · 日志 · 专注</Text>
      </View>
      <View style={styles.grid}>
        {ENTRIES.map((e) => (
          <Pressable key={e.key} onPress={() => router.push(e.href)} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
            <Card style={styles.entryCard}>
              <View style={[styles.iconChip, { backgroundColor: e.color + "22" }]}>
                <Ionicons name={e.icon} size={22} color={e.color} />
              </View>
              <Text style={styles.entryTitle}>{e.title}</Text>
              <Text style={styles.entryDesc}>{e.desc}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" style={styles.chevron} />
            </Card>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>健康提醒已收敛为系统级浮层，不再占导航入口</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  hero: { marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: "700", color: "#18181b" },
  heroSub: { fontSize: 13, color: "#71717a", marginTop: 4 },
  grid: { gap: 12 },
  entry: { borderRadius: 20 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  entryCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconChip: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  entryTitle: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  entryDesc: { fontSize: 12, color: "#71717a", marginTop: 2 },
  chevron: { marginLeft: "auto" },
  hint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 },
});
