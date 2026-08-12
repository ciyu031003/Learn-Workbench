import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { pct, formatDuration, taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { Card } from "@/components/card";

export default function DashboardScreen() {
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const checkinToday = useAppStore((s) => s.checkinToday);

  const today = todayISO();
  const allTopics = useMemo(
    () => mainPhases.flatMap((p) => p.topics).concat(agentPhase?.topics ?? []),
    []
  );
  const doneCount = allTopics.filter((t) => progress[t.id]?.done).length;
  const overall = pct(doneCount, allTopics.length);

  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const todayDone = todayTasks.filter((t) => t.done).length;
  const focusSeconds = sessions.reduce((a, s) => a + (s.durationSeconds ?? 0), 0);

  const streak = useMemo(() => {
    const set = new Set(checkins);
    let s = 0;
    const d = new Date();
    if (!set.has(today)) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) {
      s += 1;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [checkins, today]);

  const h = new Date().getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{greet}，继续今天的 ICT 学习</Text>
        <Text style={styles.heroSub}>路线图 · 每日任务 · 专注 · 输出</Text>
      </View>

      <View style={styles.grid}>
        <Card style={styles.statCard} title="整体进度">
          <Text style={styles.statValue}>{overall}%</Text>
          <Text style={styles.statSub}>{doneCount}/{allTopics.length} 主题</Text>
        </Card>
        <Card style={styles.statCard} title="连续打卡">
          <Text style={styles.statValue}>{streak} 天</Text>
          <Pressable style={styles.checkinBtn} onPress={checkinToday}>
            <Text style={styles.checkinText}>今日打卡</Text>
          </Pressable>
        </Card>
        <Card style={styles.statCard} title="本周专注">
          <Text style={styles.statValue}>{formatDuration(Math.round(focusSeconds / 60))}</Text>
          <Text style={styles.statSub}>专注会话统计</Text>
        </Card>
        <Card style={styles.statCard} title="今日任务">
          <Text style={styles.statValue}>
            {todayDone}/{todayTasks.length}
          </Text>
          <Text style={styles.statSub}>已完成 / 全部</Text>
        </Card>
      </View>

      <Card title="学习进度" subtitle="6 个主阶段 + Agent 副线">
        {mainPhases.slice(0, 3).map((p) => {
          const done = p.topics.filter((t) => progress[t.id]?.done).length;
          const percent = pct(done, p.topics.length);
          return (
            <View key={p.id} style={styles.barRow}>
              <Text style={styles.barLabel}>{p.title}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.barValue}>{percent}%</Text>
            </View>
          );
        })}
        {agentPhase ? (
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>{agentPhase.title}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct(agentPhase.topics.filter((t) => progress[t.id]?.done).length, agentPhase.topics.length)}%`, backgroundColor: "#0ea5e9" },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{pct(agentPhase.topics.filter((t) => progress[t.id]?.done).length, agentPhase.topics.length)}%</Text>
          </View>
        ) : null}
      </Card>

      <Card title="今日任务" subtitle="计划 → 专注 → 复盘">
        {todayTasks.length === 0 ? (
          <Text style={styles.empty}>今天还没有任务，去任务页添加一个吧</Text>
        ) : (
          todayTasks.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <Text style={[styles.taskText, t.done && styles.taskDone]} numberOfLines={1}>
                {t.done ? "✓ " : "○ "}
                {t.title}
              </Text>
              <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", flexGrow: 1 },
  statValue: { fontSize: 26, fontWeight: "700", color: "#18181b" },
  statSub: { fontSize: 12, color: "#71717a" },
  checkinBtn: {
    marginTop: 6,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  checkinText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 130, fontSize: 13, color: "#18181b" },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(24,24,27,0.08)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: "#4f46e5" },
  barValue: { width: 40, fontSize: 12, color: "#71717a", textAlign: "right" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskText: { flex: 1, fontSize: 14, color: "#18181b" },
  taskDone: { textDecorationLine: "line-through", color: "#71717a" },
  taskMeta: { fontSize: 12, color: "#71717a" },
  empty: { fontSize: 13, color: "#71717a", textAlign: "center", paddingVertical: 12 },
});
