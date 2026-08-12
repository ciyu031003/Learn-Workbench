import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";

export default function SettingsScreen() {
  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
  const resetAll = useAppStore((s) => s.resetAll);
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);

  const confirmReset = () => {
    Alert.alert("重置数据", "将清空本机所有进度、任务、日志与打卡，确定吗？", [
      { text: "取消", style: "cancel" },
      { text: "重置", style: "destructive", onPress: resetAll },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>设置</Text>
        <Text style={styles.heroSub}>外观、背景图与数据</Text>
      </View>

      <Card title="每日背景图" subtitle="每天自动更换 Bing 每日风景壁纸">
        <View style={styles.row}>
          <Text style={styles.rowLabel}>启用每日壁纸</Text>
          <Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: "#4f46e5" }} />
        </View>
      </Card>

      <Card title="数据" subtitle="本机数据保存在 AsyncStorage，无登录也可用">
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            进度 {Object.values(progress).filter((p) => p.done).length} · 任务 {tasks.length} · 日志 {logs.length}
          </Text>
        </View>
        <Pressable style={[styles.primaryBtn, styles.dangerBtn]} onPress={confirmReset}>
          <Text style={styles.primaryBtnText}>清空本机数据</Text>
        </Pressable>
      </Card>

      <Card title="关于" subtitle="ICT 学习工作台 v0.1">
        <Text style={styles.about}>Expo + React Native + 每日 Bing 壁纸 · 路线图内容来自《新疆ICT学习规划优化方案》</Text>
        <Text style={styles.about}>云同步（Supabase）将在 P1 提供。</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { fontSize: 14, color: "#18181b" },
  primaryBtn: { backgroundColor: "#4f46e5", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  dangerBtn: { backgroundColor: "#dc2626" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  about: { fontSize: 13, color: "#71717a", lineHeight: 19 },
});
