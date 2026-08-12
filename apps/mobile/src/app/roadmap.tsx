import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { pct } from "@learn-workbench/shared";
import { Card } from "@/components/card";

function PhaseBlock({
  title,
  weeks,
  accent,
  topics,
  progress,
  onToggle,
  defaultOpen,
}: {
  title: string;
  weeks: string | null;
  accent: boolean;
  topics: { id: number; title: string; summary: string | null; agentTask: string | null; done: boolean }[];
  progress: Record<number, { done: boolean }>;
  onToggle: (topicId: number) => void;
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
            <Pressable key={t.id} style={styles.topicRow} onPress={() => onToggle(t.id)}>
              <Text style={[styles.topicCheck, t.done && styles.topicChecked]}>
                {t.done ? "✓" : "○"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.topicTitle, t.done && styles.topicTitleDone]}>{t.title}</Text>
                {t.agentTask ? (
                  <Text style={styles.topicAgent} numberOfLines={2}>
                    ✦ {t.agentTask}
                  </Text>
                ) : null}
                {t.summary ? <Text style={styles.topicSummary} numberOfLines={2}>{t.summary}</Text> : null}
              </View>
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

  const toView = (id: number, title: string, summary: string | null, agentTask: string | null) => ({
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

      {mainPhases.map((p, i) => (
        <PhaseBlock
          key={p.id}
          title={p.title}
          weeks={p.weeks}
          accent={false}
          defaultOpen={i < 2}
          topics={p.topics.map((t) => toView(t.id, t.title, t.summary, t.agentTask))}
          progress={progress}
          onToggle={toggleTopic}
        />
      ))}

      {agentPhase ? (
        <PhaseBlock
          title={agentPhase.title}
          weeks={agentPhase.weeks}
          accent
          defaultOpen={false}
          topics={agentPhase.topics.map((t) => toView(t.id, t.title, t.summary, t.agentTask))}
          progress={progress}
          onToggle={toggleTopic}
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
  phaseHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  phaseDot: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  phaseDotMain: { backgroundColor: "rgba(79,70,229,0.12)" },
  phaseDotAccent: { backgroundColor: "rgba(14,165,233,0.14)" },
  phaseDotText: { fontSize: 13, fontWeight: "700", color: "#4f46e5" },
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
  topicAgent: { marginTop: 2, fontSize: 12, color: "#0ea5e9" },
  topicSummary: { marginTop: 2, fontSize: 12, color: "#71717a" },
});
