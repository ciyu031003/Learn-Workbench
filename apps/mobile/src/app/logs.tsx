import { useState , useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { useAppStore, type LogKind } from "@/store/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logKindLabels } from "@learn-workbench/shared";
import { Card } from "@/components/card";

const KINDS: LogKind[] = ["feynman", "review", "project", "interview"];

export default function LogsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const logs = useAppStore((s) => s.logs);
  const addLog = useAppStore((s) => s.addLog);
  const [kind, setKind] = useState<LogKind>("feynman");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    addLog(kind, t, c);
    setTitle("");
    setContent("");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.heroTitle}>学习日志</Text>
        <Text style={styles.heroSub}>费曼讲稿 · 周复盘 · 项目笔记 · 面试记录</Text>
      </View>

      <Card title="写一篇日志">
        <View style={styles.typeRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[styles.typeChip, kind === k && styles.typeChipActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.typeChipText, kind === k && styles.typeChipTextActive]}>
                {logKindLabels[k]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="标题"
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.contentInput]}
          placeholder="写下你的理解 / 复盘 / 项目进展…"
          placeholderTextColor={colors.textFaint}
          value={content}
          onChangeText={setContent}
          multiline
        />
        <Pressable style={styles.primaryBtn} onPress={submit}>
          <Text style={styles.primaryBtnText}>保存日志</Text>
        </Pressable>
      </Card>

      <Card title="全部日志" subtitle={`共 ${logs.length} 篇`}>
        {logs.length === 0 ? (
          <Text style={styles.empty}>还没有日志，写第一篇吧</Text>
        ) : (
          logs.map((l) => (
            <View key={l.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text style={styles.logKind}>{logKindLabels[l.kind] ?? l.kind}</Text>
                <Text style={styles.logDate}>
                  {new Date(l.createdAt).toLocaleDateString("zh-CN")}
                </Text>
              </View>
              <Text style={styles.logTitle}>{l.title}</Text>
              <Text style={styles.logContent} numberOfLines={4}>
                {l.content}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(24,24,27,0.05)" },
  typeChipActive: { backgroundColor: "rgba(79,70,229,0.12)" },
  typeChipText: { fontSize: 12, color: colors.textMuted },
  typeChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  input: {
    backgroundColor: "rgba(24,24,27,0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  contentInput: { minHeight: 200, textAlignVertical: "top", fontSize: 14, lineHeight: 21 },
  primaryBtn: { backgroundColor: "#4f46e5", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  logItem: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(24,24,27,0.05)" },
  logHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logKind: { fontSize: 11, color: "#4f46e5", fontWeight: "600" },
  logDate: { fontSize: 11, color: colors.textFaint },
  logTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  logContent: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 12 },
});
