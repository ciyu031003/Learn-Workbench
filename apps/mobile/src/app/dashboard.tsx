/* eslint-disable react-hooks/immutability */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useAppStore } from "@/store/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { pct, formatDuration, taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { Card } from "@/components/card";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SettingsGearButton() {
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: rotate.value + "deg" }, { scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => router.push("/settings")}
      onPressIn={() => {
        rotate.value = withTiming(-90, { duration: 180 });
        scale.value = withSpring(0.9, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        rotate.value = withTiming(0, { duration: 180 });
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      style={[styles.gearBtn, animatedStyle]}
    >
      <Ionicons name="settings-outline" size={20} color="#ffffff" />
    </AnimatedPressable>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const github = useAppStore((s) => s.github);
  const addGithub = useAppStore((s) => s.addGithub);
  const removeGithub = useAppStore((s) => s.removeGithub);

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

  const [ghTitle, setGhTitle] = useState("");
  const [ghUrl, setGhUrl] = useState("");
  const [ghDesc, setGhDesc] = useState("");

  const submitGithub = () => {
    const t = ghTitle.trim();
    if (!t) return;
    addGithub(t, ghUrl.trim() || null, ghDesc.trim() || null);
    setGhTitle("");
    setGhUrl("");
    setGhDesc("");
  };

  const h = new Date().getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{greet}，继续今天的 ICT 学习规划</Text>
            <Text style={styles.heroSub}>路线图 · 每日任务 · 专注 · 输出</Text>
          </View>
          <SettingsGearButton />
        </View>
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
                <View style={[styles.barFill, { width: (percent + "%") as DimensionValue }]} />
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
                  {
                    width: (pct(agentPhase.topics.filter((t) => progress[t.id]?.done).length, agentPhase.topics.length) + "%") as DimensionValue,
                    backgroundColor: "#0ea5e9",
                  },
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

      <Card title="GitHub 记录" subtitle={github.length + " 条项目资产"}>
        <TextInput style={styles.input} placeholder="项目 / 仓库名称（必填）" placeholderTextColor="#9ca3af" value={ghTitle} onChangeText={setGhTitle} />
        <TextInput style={styles.input} placeholder="GitHub 链接（可选）" placeholderTextColor="#9ca3af" value={ghUrl} onChangeText={setGhUrl} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="一句话说明（可选）" placeholderTextColor="#9ca3af" value={ghDesc} onChangeText={setGhDesc} />
        <Pressable style={styles.primaryBtn} onPress={submitGithub} disabled={!ghTitle.trim()}>
          <Text style={styles.primaryBtnText}>添加记录</Text>
        </Pressable>
        {github.length === 0 ? (
          <Text style={styles.empty}>还没有 GitHub 记录，添加你的项目资产吧</Text>
        ) : (
          github.map((g) => (
            <View key={g.id} style={styles.ghRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ghTitle} numberOfLines={1}>{g.title}</Text>
                {g.content ? <Text style={styles.ghDesc} numberOfLines={1}>{g.content}</Text> : null}
                {g.url ? <Text style={styles.ghUrl} numberOfLines={1}>{g.url}</Text> : null}
              </View>
              <Pressable onPress={() => removeGithub(g.id)} hitSlop={8}>
                <Text style={styles.ghDelete}>✕</Text>
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
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  hero: { paddingTop: 24, paddingBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTextWrap: { flex: 1, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.42)",
  },
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
  input: {
    backgroundColor: "rgba(24,24,27,0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18181b",
  },
  primaryBtn: { backgroundColor: "#4f46e5", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  ghRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  ghTitle: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  ghDesc: { fontSize: 12, color: "#71717a" },
  ghUrl: { fontSize: 12, color: "#0ea5e9" },
  ghDelete: { fontSize: 14, color: "#dc2626", paddingHorizontal: 4 },
});
