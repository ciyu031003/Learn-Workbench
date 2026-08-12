import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppStore, type TaskType } from "@/store/app-store";
import { taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { Card } from "@/components/card";

const TYPES: TaskType[] = ["study", "agent", "output", "review", "exam"];

function fmt(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function TasksScreen() {
  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("study");
  const [running, setRunning] = useState<{ taskId: number | null; start: number; elapsed: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = todayISO();
  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const totalFocus = todayTasks.reduce((a, t) => a + t.focusMinutes, 0);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const start = (taskId: number | null) => {
    if (timer.current) clearInterval(timer.current);
    const start = Date.now();
    setRunning({ taskId, start, elapsed: 0 });
    timer.current = setInterval(() => {
      setRunning((r) => (r ? { ...r, elapsed: Math.floor((Date.now() - r.start) / 1000) } : r));
    }, 1000);
  };

  const stop = () => {
    if (!running) return;
    if (timer.current) clearInterval(timer.current);
    addSession(running.taskId, running.elapsed);
    setRunning(null);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    addTask(t, type);
    setTitle("");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>每日任务</Text>
        <Text style={styles.heroSub}>计划 → 专注 → 复盘，形成学习闭环</Text>
      </View>

      <Card title="专注计时" subtitle="当日累计专注 {totalFocus} 分钟">
        <Text style={styles.timer}>{running ? fmt(running.elapsed) : "00:00:00"}</Text>
        <Pressable
          style={[styles.primaryBtn, running && styles.dangerBtn]}
          onPress={() => (running ? stop() : start(null))}
        >
          <Text style={styles.primaryBtnText}>{running ? "结束并记录" : "开始专注"}</Text>
        </Pressable>
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
            <Pressable
              key={t}
              style={[styles.typeChip, type === t && styles.typeChipActive]}
              onPress={() => setType(t)}
            >
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
              <Pressable onPress={() => (running?.taskId === t.id ? stop() : start(t.id))} hitSlop={8}>
                <Text style={styles.taskPlay}>{running?.taskId === t.id ? "⏹" : "▶"}</Text>
              </Pressable>
            </View>
          ))
        )}
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
  timer: { fontSize: 40, fontWeight: "700", textAlign: "center", color: "#18181b", fontVariant: ["tabular-nums"] },
  primaryBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerBtn: { backgroundColor: "#dc2626" },
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
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(24,24,27,0.05)",
  },
  typeChipActive: { backgroundColor: "rgba(79,70,229,0.12)" },
  typeChipText: { fontSize: 12, color: "#71717a" },
  typeChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  taskCheck: { fontSize: 16, color: "rgba(24,24,27,0.3)", width: 18 },
  taskChecked: { color: "#16a34a" },
  taskTitle: { flex: 1, fontSize: 14, color: "#18181b" },
  taskTitleDone: { textDecorationLine: "line-through", color: "#71717a" },
  taskMeta: { fontSize: 12, color: "#71717a" },
  taskFocus: { fontSize: 12, color: "#0ea5e9" },
  taskPlay: { fontSize: 14, color: "#4f46e5" },
  empty: { fontSize: 13, color: "#71717a", textAlign: "center", paddingVertical: 12 },
});
