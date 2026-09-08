import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/card";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { InterviewQuestion, QuestionModule } from "@learn-workbench/shared";

export default function InterviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [modules, setModules] = useState<QuestionModule[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; answer: string } | null>(null);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = async (module?: string) => {
    try {
      setLoading(true);
      const suffix = module ? `&module=${encodeURIComponent(module)}` : "";
      const r = await fetch(`${getApiUrl()}/api/questions${suffix}`, { headers: headers() });
      if (!r.ok) return;
      const data = await r.json();
      setQuestions(data.questions ?? []);
      setModules(data.modules ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const selectModule = (m: string | null) => {
    setModuleFilter(m);
    void load(m ?? undefined);
  };

  const submit = async () => {
    if (!active) return;
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch(`${getApiUrl()}/api/questions/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ questionId: active.id, mode: "quiz", chosenAnswer: answer.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setResult({ correct: !!data.isCorrect, answer: data.answer || "" });
      } else {
        Alert.alert("提交失败", data.error || "请稍后重试");
      }
    } catch (e) {
      Alert.alert("提交失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const shown = moduleFilter ? questions : questions;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>面试流程</Text>
        <Text style={styles.heroSub}>题库刷题 · 记录每一次模拟与复盘</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleScroller}>
        <Pressable onPress={() => selectModule(null)} style={[styles.moduleChip, moduleFilter === null && styles.moduleChipActive]}>
          <Text style={[styles.moduleChipText, moduleFilter === null && styles.moduleChipTextActive]}>全部</Text>
        </Pressable>
        {modules.map((m) => (
          <Pressable key={m.module} onPress={() => selectModule(m.module)} style={[styles.moduleChip, moduleFilter === m.module && styles.moduleChipActive]}>
            <Text style={[styles.moduleChipText, moduleFilter === m.module && styles.moduleChipTextActive]}>{m.module}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        <Card><Text style={styles.empty}>这个模块暂时没有题目</Text></Card>
      ) : (
        shown.map((q, i) => (
          <Pressable key={q.id} onPress={() => { setActive(q); setAnswer(""); setResult(null); }}>
            <Card style={styles.questionCard}>
              <View style={styles.questionHead}>
                <Text style={styles.questionIndex}>{i + 1}</Text>
                <Text style={styles.difficulty}>{q.difficulty}</Text>
              </View>
              <Text style={styles.questionText}>{q.question}</Text>
            </Card>
          </Pressable>
        ))
      )}

      <Modal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setActive(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {active ? (
              <>
                <Text style={styles.modalTitle}>{active.module}</Text>
                <Text style={styles.modalQuestion}>{active.question}</Text>
                <TextInput
                  style={styles.answerInput}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="写下你的答案"
                  placeholderTextColor={colors.textFaint}
                  multiline
                />
                {result ? (
                  <View style={[styles.resultBox, result.correct ? styles.resultGood : styles.resultBad]}>
                    <Text style={styles.resultText}>{result.correct ? "回答正确" : "参考答案"}</Text>
                    <Text style={styles.resultAnswer}>{result.answer}</Text>
                  </View>
                ) : null}
                <Pressable style={[styles.submitBtn, submitting && { opacity: 0.5 }]} disabled={submitting} onPress={() => void submit()}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>提交作答</Text>}
                </Pressable>
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
    hero: { marginBottom: 4 },
    heroTitle: { fontSize: 28, fontWeight: "800", color: colors.text },
    heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    moduleScroller: { flexGrow: 0 },
    moduleChip: { marginRight: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    moduleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    moduleChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    moduleChipTextActive: { color: "#ffffff" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    questionCard: { gap: 6 },
    questionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    questionIndex: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.primarySoft, color: colors.primary, textAlign: "center", lineHeight: 24, fontWeight: "800", fontSize: 12 },
    difficulty: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },
    questionText: { fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 22 },
    modalScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: 20 },
    modalCard: { backgroundColor: colors.surfaceStrong, borderRadius: 20, padding: 18, gap: 10 },
    modalTitle: { fontSize: 12, fontWeight: "800", color: colors.primary },
    modalQuestion: { fontSize: 17, fontWeight: "800", color: colors.text, lineHeight: 25 },
    answerInput: { minHeight: 120, textAlignVertical: "top", backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    resultBox: { borderRadius: 12, padding: 12, gap: 4 },
    resultGood: { backgroundColor: colors.successSoft },
    resultBad: { backgroundColor: colors.warningSoft },
    resultText: { fontSize: 12, fontWeight: "800", color: colors.text },
    resultAnswer: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    submitBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
    submitText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
