import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppStore, type TaskType } from "@/store/app-store";
import { taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { Card } from "@/components/card";
import { FocusTimer } from "@/components/focus-timer";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";

const TYPES: TaskType[] = ["study", "agent", "output", "review", "exam"];

export default function TasksScreen() {
  const tasks = useAppStore((s) => s.tasks);
  const sessions = useAppStore((s) => s.sessions);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("study");
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSession, setTimerSession] = useState(0);
  const [timerTask, setTimerTask] = useState<{ id: number | null; title: string | null } | null>(null);

  const today = todayISO();
  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const totalFocus = todayTasks.reduce((a, t) => a + t.focusMinutes, 0);
  const stats = computeFocusStats(sessions);
  const allDone = todayTasks.length > 0 && todayTasks.every((t) => t.done);
  const maxMin = Math.max(1, ...stats.last14.map((d) => d.minutes));

  const openTimer = (taskId: number | null, taskTitle: string | null) => {
    setTimerTask({ id: taskId, title: taskTitle });
    setTimerSession((s) => s + 1);
    setTimerOpen(true);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    addTask(t, type);
    setTitle("");
  };

  const shareCard = async () => {
    const msg = [
      "📚 学习工作台 · 专注打卡",
      `📅 ${stats.date}`,
      `🔥 连续专注 ${stats.streak} 天 ｜ 累计专注 ${stats.totalFocusDays} 天`,
      `⏱ 今日专注 ${stats.todaySessions} 次 · ${stats.todayMinutes} 分钟`,
      "",
      `💪 ${FOCUS_MOTIVATIONS[Math.min(stats.streak, FOCUS_MOTIVATIONS.length - 1)]}`,
    ].join("\n");
    try {
      await Share.share({ message: msg });
    } catch {
      // 忽略
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>每日任务</Text>
        <Text style={styles.heroSub}>计划 → 专注 → 复盘，形成学习闭环</Text>
      </View>

      <Card title="专注计时" subtitle="点击进入全屏环形倒计时">
        <Text style={styles.timerHint}>⏱ 25:00 · 环形进度 · 可切换背景</Text>
        <Pressable style={styles.primaryBtn} onPress={() => openTimer(null, null)}>
          <Text style={styles.primaryBtnText}>开始倒计时</Text>
        </Pressable>
        <Text style={styles.timerSub}>当日累计专注 {totalFocus} 分钟</Text>
      </Card>

      <Card title="新建任务">
        <TextInput
          style={styles.input}
          placeholder="今天要学什么？"
          placeholderTextColor="#9ca3af"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable key={t} style={[styles.typeChip, type === t && styles.typeChipActive]} onPress={() => setType(t)}>
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                {taskTypeLabels[t]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryBtn} onPress={submit}>
          <Text style={styles.primaryBtnText}>添加任务</Text>
        </Pressable>
      </Card>

      <Card title="今日任务" subtitle={`${todayTasks.filter((t) => t.done).length}/${todayTasks.length} 已完成`}>
        {allDone ? (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>🎉 今日任务已全部完成！生成打卡卡片分享吧</Text>
          </View>
        ) : null}
        {todayTasks.length === 0 ? (
          <Text style={styles.empty}>今天还没有任务</Text>
        ) : (
          todayTasks.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <Pressable onPress={() => toggleTaskDone(t.id)} hitSlop={8}>
                <Text style={[styles.taskCheck, t.done && styles.taskChecked]}>{t.done ? "✓" : "○"}</Text>
              </Pressable>
              <Text style={[styles.taskTitle, t.done && styles.taskTitleDone]} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType]}</Text>
              {t.focusMinutes > 0 ? <Text style={styles.taskFocus}>{t.focusMinutes}′</Text> : null}
              <Pressable onPress={() => openTimer(t.id, t.title)} hitSlop={8}>
                <Text style={styles.taskPlay}>▶</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {/* 专注打卡统计 */}
      <Card title="专注打卡" subtitle={`${stats.date} · 分布图 / 时间轴`}>
        <View style={styles.statGrid}>
          {[
            { label: "累计专注", value: `${stats.totalFocusDays}` },
            { label: "连续专注", value: `${stats.streak}` },
            { label: "今日次数", value: `${stats.todaySessions}` },
            { label: "今日时长", value: `${stats.todayMinutes}′` },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>近 14 天分布</Text>
        <View style={styles.barChart}>
          {stats.last14.map((d) => (
            <View key={d.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(4, (d.minutes / maxMin) * 100)}%` }]} />
              </View>
              <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>今日时间轴</Text>
        {stats.todayList.length === 0 ? (
          <Text style={styles.empty}>今天还没有专注记录</Text>
        ) : (
          stats.todayList.map((s, i) => (
            <View key={i} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>{s.startTime} – {s.endTime}</Text>
              <Text style={styles.timelineMin}>{s.minutes} 分钟</Text>
            </View>
          ))
        )}

        <Text style={styles.quoteLine}>{FOCUS_MOTIVATIONS[Math.min(stats.streak, FOCUS_MOTIVATIONS.length - 1)]}</Text>
        <Pressable style={styles.shareBtn} onPress={shareCard}>
          <Text style={styles.shareBtnText}>📤 分享打卡卡片</Text>
        </Pressable>
      </Card>

      <FocusTimer
        key={timerSession}
        open={timerOpen}
        task={timerTask}
        sessions={sessions}
        onClose={() => setTimerOpen(false)}
        onRecorded={(taskId, seconds) => addSession(taskId, seconds)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  timerHint: { fontSize: 15, color: "#18181b", textAlign: "center", marginBottom: 10 },
  timerSub: { fontSize: 12, color: "#71717a", textAlign: "center", marginTop: 8 },
  primaryBtn: { backgroundColor: "#e8930c", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(24,24,27,0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18181b",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(24,24,27,0.05)" },
  typeChipActive: { backgroundColor: "rgba(79,70,229,0.12)" },
  typeChipText: { fontSize: 12, color: "#71717a" },
  typeChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  doneBanner: { backgroundColor: "rgba(22,163,74,0.12)", borderRadius: 12, padding: 10, marginBottom: 8 },
  doneBannerText: { color: "#166534", fontSize: 13, fontWeight: "600" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  taskCheck: { fontSize: 16, color: "rgba(24,24,27,0.3)", width: 18 },
  taskChecked: { color: "#16a34a" },
  taskTitle: { flex: 1, fontSize: 14, color: "#18181b" },
  taskTitleDone: { textDecorationLine: "line-through", color: "#71717a" },
  taskMeta: { fontSize: 12, color: "#71717a" },
  taskFocus: { fontSize: 12, color: "#0ea5e9" },
  taskPlay: { fontSize: 14, color: "#4f46e5" },
  empty: { fontSize: 13, color: "#71717a", textAlign: "center", paddingVertical: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 },
  statBox: { width: "46%", backgroundColor: "rgba(232,147,12,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#18181b" },
  statLabel: { fontSize: 12, color: "#71717a", marginTop: 3 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#18181b", marginTop: 12, marginBottom: 8 },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: 96, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", backgroundColor: "rgba(24,24,27,0.05)", borderRadius: 4, overflow: "hidden" },
  bar: { width: "100%", backgroundColor: "#e8930c", borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, color: "#9ca3af" },
  timelineRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "rgba(24,24,27,0.04)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  timelineTime: { fontSize: 13, color: "#52525b" },
  timelineMin: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  quoteLine: { fontSize: 13, color: "#b45309", lineHeight: 20, marginTop: 10 },
  shareBtn: { backgroundColor: "#e8930c", borderRadius: 999, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
