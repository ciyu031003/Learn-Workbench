/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeader } from "@/components/screen-header";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { fetchRoadmap, readCachedRoadmap } from "@/lib/roadmap";
import type { Phase } from "@learn-workbench/shared";
import { pct } from "@learn-workbench/shared";

const THEME_COLORS: [string, string][] = [
  ["#2F74C0", "#78C2E8"],
  ["#F28C28", "#FF8F6B"],
  ["#8D7BD8", "#B39AD9"],
];

function toPhase(value: unknown): Phase | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<Phase>;
  if (!p.id || !p.title) return null;
  return { ...p, topics: p.topics ?? [] } as Phase;
}

export default function PhaseScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const phaseId = Number(params.id);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const progress = useAppStore((s) => s.progress);
  const customTopics = useAppStore((s) => s.customTopics);
  const addCustomTopic = useAppStore((s) => s.addCustomTopic);
  const removeCustomTopic = useAppStore((s) => s.removeCustomTopic);
  const toggleTopic = useAppStore((s) => s.toggleTopic);

  const [phase, setPhase] = useState<Phase | null>(
    () => [...mainPhases, ...(agentPhase ? [agentPhase] : [])].find((p) => p.id === phaseId) ?? null
  );
  const [loading, setLoading] = useState(true);
  const [topicSheet, setTopicSheet] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicSummary, setTopicSummary] = useState("");
  const [activeTopic, setActiveTopic] = useState<{ id: number; title: string; summary: string | null; isCustom?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await readCachedRoadmap();
        const fromCache = cached.find((p) => p.id === phaseId);
        if (alive && fromCache) setPhase(toPhase(fromCache));
        if (token) {
          const remote = await fetchRoadmap();
          const fromRemote = remote.find((p) => p.id === phaseId);
          if (alive && fromRemote) setPhase(toPhase(fromRemote));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [phaseId, token]);

  const phaseTopics = phase?.topics ?? [];
  const custom = customTopics.filter((t) => t.phaseId === phaseId);
  const merged = [
    ...phaseTopics,
    ...custom.map((t, i) => ({
      id: t.id,
      topicKey: `custom-${t.id}`,
      title: t.title,
      summary: t.summary,
      agentTask: null as string | null,
      sortOrder: 100000 + i,
      resources: [] as never[],
      practices: [] as never[],
      projects: [] as never[],
      checkpoints: [] as never[],
      isCustomSubject: true,
    })),
  ];
  const doneTopics = phaseTopics.filter((t) => progress[t.id]?.done).length;
  const progressInfo = { done: doneTopics, total: phaseTopics.length };

  const submit = () => {
    const title = topicTitle.trim();
    if (!title) {
      Alert.alert("请填写主题标题");
      return;
    }
    addCustomTopic(phaseId, title, topicSummary.trim() || null);
    setTopicSheet(false);
    setTopicTitle("");
    setTopicSummary("");
  };

  const remove = (topic: { id: number; isCustom?: boolean }) => {
    if (!topic.isCustom) return;
    Alert.alert("删除主题", "删除后本阶段将不再展示这个主题。", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomTopic(topic.id) },
    ]);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title={phase?.title ?? "学习阶段"}
        subtitle={phase?.summary || phase?.weeks || "管理这个阶段下的学习内容"}
        compact
      />

      {loading && !phase ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          <Card style={styles.progressCard}>
            <View style={styles.progressHead}>
              <View>
                <Text style={styles.progressLabel}>阶段完成度</Text>
                <Text style={styles.progressValue}>{pct(progressInfo.done, progressInfo.total)}%</Text>
              </View>
              <Text style={styles.progressMeta}>{progressInfo.done} / {progressInfo.total} 个主题</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct(progressInfo.done, progressInfo.total)}%` }]} />
            </View>
          </Card>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>当前主题</Text>
            <Pressable
              hitSlop={8}
              style={styles.addBtn}
              onPress={() => { setTopicTitle(""); setTopicSummary(""); setTopicSheet(true); }}
            >
              <ThemedIcon name="add" size={15} color={colors.primary} />
              <Text style={styles.addText}>添加主题</Text>
            </Pressable>
          </View>

          {merged.length === 0 ? (
            <Card><Text style={styles.empty}>这个阶段还没有主题，先从上面添加一个开始。</Text></Card>
          ) : (
            merged.map((topic, i) => {
              const c = THEME_COLORS[i % THEME_COLORS.length] ?? THEME_COLORS[0];
              const done = progress[topic.id]?.done ? 1 : 0;
              return (
                <PressableScale
                  key={topic.topicKey}
                  haptic
                  onPress={() => setActiveTopic({ id: topic.id, title: topic.title, summary: topic.summary ?? null, isCustom: "isCustomSubject" in topic && !!topic.isCustomSubject })}
                  style={styles.topicCard}
                >
                  <View style={[styles.topicBlob, { backgroundColor: c[1] }]} />
                  <View style={styles.topicInner}>
                    <View style={styles.topicTitleRow}>
                      <Text style={styles.topicName} numberOfLines={1}>{topic.title}</Text>
                      {done ? (
                        <View style={styles.doneChip}><ThemedIcon name="checkmark" size={12} color="#fff" /></View>
                      ) : null}
                    </View>
                    <Text style={styles.topicMeta} numberOfLines={1}>{topic.summary || "尚未添加说明"}</Text>
                    <View style={styles.topicDots}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <View key={j} style={[styles.dot, j < done * 6 ? styles.dotOn : styles.dotOff]} />
                      ))}
                    </View>
                  </View>
                  <View style={styles.topicActions}>
                    <Pressable hitSlop={6} onPress={() => toggleTopic(topic.id)}>
                      <ThemedIcon name={done ? "checkmark-circle" : "ellipse-outline"} size={20} color={done ? "#ffffff" : "rgba(255,255,255,0.72)"} />
                    </Pressable>
                    {("isCustomSubject" in topic && !!topic.isCustomSubject) ? (
                      <Pressable hitSlop={6} onPress={() => remove({ id: topic.id, isCustom: true })}>
                        <ThemedIcon name="trash-outline" size={18} color="rgba(255,255,255,0.72)" />
                      </Pressable>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })
          )}
        </>
      )}

      <BottomSheet visible={topicSheet} onClose={() => setTopicSheet(false)} title="添加学习内容" height="46%">
        <View style={styles.form}>
          <Text style={styles.label}>主题标题</Text>
          <TextInput style={styles.input} value={topicTitle} onChangeText={setTopicTitle} placeholder="例如：网络安全命令速查" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>一句话说明（选填）</Text>
          <TextInput style={[styles.input, styles.area]} value={topicSummary} onChangeText={setTopicSummary} placeholder="这个主题要掌握什么" placeholderTextColor={colors.textFaint} multiline />
          <Pressable style={styles.primaryBtn} onPress={submit}>
            <Text style={styles.primaryText}>保存并同步</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <Modal visible={!!activeTopic} transparent animationType="fade" onRequestClose={() => setActiveTopic(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setActiveTopic(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {activeTopic ? (
              <>
                <View style={styles.modalHead}>
                  <View style={styles.modalDot} />
                  <Text style={styles.modalTitle}>{activeTopic.title}</Text>
                </View>
                <Text style={styles.modalSub}>{activeTopic.summary || "这个阶段的学习内容会在这里展开。"}</Text>
                <Pressable style={styles.modalPrimary} onPress={() => { toggleTopic(activeTopic.id); setActiveTopic(null); }}>
                  <ThemedIcon name={progress[activeTopic.id]?.done ? "checkmark-done" : "checkmark-circle"} size={16} color="#fff" />
                  <Text style={styles.modalPrimaryText}>{progress[activeTopic.id]?.done ? "已完成" : "标记为已完成"}</Text>
                </Pressable>
                {activeTopic.isCustom ? (
                  <Pressable style={styles.modalDelete} onPress={() => { remove({ id: activeTopic.id, isCustom: true }); setActiveTopic(null); }}>
                    <Text style={styles.modalDeleteText}>删除这个主题</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    loading: { marginTop: 36, alignSelf: "center" },
    progressCard: { padding: 16, gap: 12 },
    progressHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    progressLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    progressValue: { fontSize: 32, fontWeight: "900", color: colors.text },
    progressMeta: { fontSize: 12, color: colors.textMuted },
    progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
    addText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 10 },
    topicCard: {
      minHeight: 94,
      borderRadius: 20,
      padding: 16,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#2F74C0",
      shadowColor: "#14548D",
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    topicBlob: { position: "absolute", width: 130, height: 130, borderRadius: 65, right: -28, top: -42, opacity: 0.5 },
    topicInner: { flex: 1, minWidth: 0 },
    topicTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    topicName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "800" },
    doneChip: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.24)" },
    topicMeta: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 4 },
    topicDots: { flexDirection: "row", gap: 4, marginTop: 12 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    dotOn: { backgroundColor: "rgba(255,255,255,0.92)" },
    dotOff: { backgroundColor: "rgba(255,255,255,0.22)" },
    topicActions: { alignItems: "center", gap: 12, marginLeft: 12 },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    area: { minHeight: 96, textAlignVertical: "top" },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    modalScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: 20 },
    modalCard: { backgroundColor: colors.surfaceStrong, borderRadius: 20, padding: 18, gap: 12 },
    modalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    modalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    modalTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.text },
    modalSub: { fontSize: 13, lineHeight: 20, color: colors.textMuted },
    modalPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12 },
    modalPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    modalDelete: { alignSelf: "center", padding: 8 },
    modalDeleteText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  });
