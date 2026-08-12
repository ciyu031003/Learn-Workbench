import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { pct } from "@learn-workbench/shared";
import { Card } from "@/components/card";

interface TopicView {
  id: number;
  title: string;
  summary: string | null;
  agentTask: string | null;
  done: boolean;
  isCustom?: boolean;
}

function PhaseBlock({
  title,
  weeks,
  accent,
  topics,
  progress,
  onToggle,
  onDelete,
  defaultOpen,
}: {
  title: string;
  weeks: string | null;
  accent: boolean;
  topics: TopicView[];
  progress: Record<number, { done: boolean }>;
  onToggle: (topicId: number) => void;
  onDelete?: (id: number) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const doneCount = topics.filter((t) => progress[t.id]?.done).length;
  const percent = pct(doneCount, topics.length);

  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.phaseHeader}>
        <View style={[styles.phaseDot, accent ? styles.phaseDotAccent : styles.phaseDotMain]}>
          <Text style={styles.phaseDotText}>{accent ? "A" : "P"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.phaseTitle}>{title}</Text>
            {weeks ? <Text style={styles.phaseWeeks}>{weeks}</Text> : null}
          </View>
          <Text style={styles.phasePercent}>
            {doneCount}/{topics.length} · {percent}%
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.topicList}>
          {topics.map((t) => (
            <Pressable key={`${t.id}-${t.isCustom ? "c" : "b"}`} style={styles.topicRow} onPress={() => onToggle(t.id)}>
              <Text style={[styles.topicCheck, t.done && styles.topicChecked]}>{t.done ? "✓" : "○"}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.topicTitle, t.done && styles.topicTitleDone]}>{t.title}</Text>
                  {t.isCustom ? <Text style={styles.customTag}>自定义</Text> : null}
                </View>
                {t.agentTask ? (
                  <Text style={styles.topicAgent} numberOfLines={2}>✦ {t.agentTask}</Text>
                ) : null}
                {t.summary ? <Text style={styles.topicSummary} numberOfLines={2}>{t.summary}</Text> : null}
              </View>
              {t.isCustom && onDelete ? (
                <Pressable onPress={() => onDelete(t.id)} hitSlop={8}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function RoadmapScreen() {
  const progress = useAppStore((s) => s.progress);
  const toggleTopic = useAppStore((s) => s.toggleTopic);
  const customTopics = useAppStore((s) => s.customTopics);
  const addCustomTopic = useAppStore((s) => s.addCustomTopic);
  const removeCustomTopic = useAppStore((s) => s.removeCustomTopic);

  const [adding, setAdding] = useState(false);
  const [phaseId, setPhaseId] = useState<number>(mainPhases[0]?.id ?? 1);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const allPhases = [...mainPhases, ...(agentPhase ? [agentPhase] : [])];

  const submitCustom = () => {
    const t = title.trim();
    if (!t) return;
    addCustomTopic(phaseId, t, summary.trim() || null);
    setTitle("");
    setSummary("");
    setAdding(false);
  };

  const renderTopics = (phaseIdNum: number, base: TopicView[]): TopicView[] => {
    const custom = customTopics
      .filter((c) => c.phaseId === phaseIdNum)
      .map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        agentTask: null,
        done: !!progress[c.id]?.done,
        isCustom: true,
      }));
    return [...base, ...custom];
  };

  const toView = (id: number, title: string, summary: string | null, agentTask: string | null): TopicView => ({
    id,
    title,
    summary,
    agentTask,
    done: !!progress[id]?.done,
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>学习路线图</Text>
        <Text style={styles.heroSub}>6 个主阶段 + Agent 应用副线，点击主题完成打勾</Text>
      </View>

      <Card>
        <Pressable onPress={() => setAdding((v) => !v)} style={styles.addToggle}>
          <Text style={styles.addToggleText}>{adding ? "取消自定义" : "＋ 添加自定义学习内容"}</Text>
        </Pressable>
        {adding ? (
          <View style={styles.addForm}>
            <Text style={styles.addLabel}>所属阶段</Text>
            <View style={styles.phasePicker}>
              {allPhases.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, phaseId === p.id && styles.chipActive]}
                  onPress={() => setPhaseId(p.id)}
                >
                  <Text style={[styles.chipText, phaseId === p.id && styles.chipTextActive]} numberOfLines={1}>
                    {p.title.replace(/^.*?：/, "")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="学习内容标题（必填）" placeholderTextColor="#9ca3af" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="简要说明（可选）" placeholderTextColor="#9ca3af" value={summary} onChangeText={setSummary} />
            <Pressable style={styles.primaryBtn} onPress={submitCustom} disabled={!title.trim()}>
              <Text style={styles.primaryBtnText}>添加</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {mainPhases.map((p, i) => (
        <PhaseBlock
          key={p.id}
          title={p.title}
          weeks={p.weeks}
          accent={false}
          defaultOpen={i < 1}
          topics={renderTopics(p.id, p.topics.map((t) => toView(t.id, t.title, t.summary, t.agentTask)))}
          progress={progress}
          onToggle={toggleTopic}
          onDelete={removeCustomTopic}
        />
      ))}

      {agentPhase ? (
        <PhaseBlock
          title={agentPhase.title}
          weeks={agentPhase.weeks}
          accent
          defaultOpen={false}
          topics={renderTopics(agentPhase.id, agentPhase.topics.map((t) => toView(t.id, t.title, t.summary, t.agentTask)))}
          progress={progress}
          onToggle={toggleTopic}
          onDelete={removeCustomTopic}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  addToggle: { alignItems: "center", paddingVertical: 10 },
  addToggleText: { fontSize: 14, fontWeight: "600", color: "#e8930c" },
  addForm: { gap: 8 },
  addLabel: { fontSize: 12, color: "#71717a" },
  phasePicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(24,24,27,0.05)" },
  chipActive: { backgroundColor: "rgba(232,147,12,0.18)" },
  chipText: { fontSize: 11, color: "#71717a", maxWidth: 120 },
  chipTextActive: { color: "#e8930c", fontWeight: "600" },
  input: {
    backgroundColor: "rgba(24,24,27,0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18181b",
  },
  primaryBtn: { backgroundColor: "#e8930c", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  phaseHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  phaseDot: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  phaseDotMain: { backgroundColor: "rgba(232,147,12,0.14)" },
  phaseDotAccent: { backgroundColor: "rgba(239,106,94,0.15)" },
  phaseDotText: { fontSize: 13, fontWeight: "700", color: "#e8930c" },
  phaseTitle: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  phaseWeeks: { fontSize: 11, color: "#71717a", backgroundColor: "rgba(24,24,27,0.06)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  phasePercent: { marginTop: 2, fontSize: 12, color: "#71717a" },
  chevron: { fontSize: 16, color: "#9ca3af" },
  topicList: { borderTopWidth: 1, borderTopColor: "rgba(24,24,27,0.06)", paddingTop: 6, gap: 2 },
  topicRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  topicCheck: { fontSize: 16, color: "rgba(24,24,27,0.3)", width: 18, textAlign: "center" },
  topicChecked: { color: "#16a34a" },
  topicTitle: { fontSize: 14, fontWeight: "500", color: "#18181b" },
  topicTitleDone: { textDecorationLine: "line-through", color: "#71717a" },
  customTag: { fontSize: 10, color: "#e8930c", backgroundColor: "rgba(232,147,12,0.14)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, overflow: "hidden" },
  topicAgent: { marginTop: 2, fontSize: 12, color: "#ef6a5e" },
  topicSummary: { marginTop: 2, fontSize: 12, color: "#71717a" },
  deleteBtn: { fontSize: 13, color: "#dc2626", paddingHorizontal: 4 },
});
