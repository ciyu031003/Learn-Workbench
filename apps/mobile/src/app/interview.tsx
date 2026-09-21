import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { InterviewQuestion, QuestionModule } from "@learn-workbench/shared";

/** 难度徽章：文案 +配色（浅深色通用，靠文字/底色区分） */
const DIFF_LABEL: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
const DIFF_STYLE: Record<string, { color: string; backgroundColor: string }> = {
  easy: { color: "#2E7D4F", backgroundColor: "#E7F6EC" },
  medium: { color: "#A96A12", backgroundColor: "#FCF3DF" },
  hard: { color: "#A33", backgroundColor: "#FBEBEB" },
};

export default function InterviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [modules, setModules] = useState<QuestionModule[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; answer: string } | null>(null);
  /** v12 P2-1：难度筛选 + 错题本（只看做错的） */
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [wrongIds, setWrongIds] = useState<number[]>([]);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = async (module?: string, diff?: string | null) => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      const m = module ?? moduleFilter;
      const d = diff === undefined ? difficulty : diff;
      if (m) qs.set("module", m);
      if (d) qs.set("difficulty", d);
      const r = await fetch(`${getApiUrl()}/api/questions${qs.size ? "?" + qs.toString() : ""}`, { headers: headers() });
      if (!r.ok) return;
      const data = await r.json();
      setQuestions(data.questions ?? []);
      setModules(data.modules ?? []);
    } finally {
      setLoading(false);
    }
  };

  /** 答题记录 → 错题 id 列表（错题本） */
  const loadWrong = async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/questions/attempts`, { headers: headers() });
      if (!r.ok) return;
      const data = await r.json();
      const ids = (data.attempts ?? [])
        .filter((a: { questionId: number | null; isCorrect?: boolean | null; selfRating?: number | null }) =>
          a.questionId !== null && (a.isCorrect === false || (a.isCorrect == null && (a.selfRating ?? 5) <= 2))
        )
        .map((a: { questionId: number | null }) => Number(a.questionId))
        .filter((n: number) => Number.isInteger(n) && n > 0);
      setWrongIds([...new Set<number>(ids)]);
    } catch {
      // 忽略：错题本不可用不影响刷题
    }
  };

  useEffect(() => {
    // 延后到下一拍执行：避免在 effect 里同步 setState（仓库里其它页面的既有写法）
    const t = setTimeout(() => {
      void load();
      void loadWrong();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在登录态变化时重新拉题库与错题本
  }, [token]);

  const selectModule = (m: string | null) => {
    setModuleFilter(m);
    void load(m ?? undefined);
  };

  const selectDifficulty = (d: string | null) => {
    setDifficulty(d);
    void load(undefined, d);
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
        void loadWrong(); // 刷新错题本
      } else {
        Alert.alert("提交失败", data.error || "请稍后重试");
      }
    } catch (e) {
      Alert.alert("提交失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  /** 错题本：只看做错过的（按 id 过滤，模块/难度筛选仍然生效） */
  const shown = onlyWrong ? questions.filter((q) => wrongIds.includes(q.id)) : questions;

  /** 下一题（在当前筛选结果里顺序往下） */
  const nextQuestion = () => {
    if (!active) return;
    const idx = shown.findIndex((q) => q.id === active.id);
    const next = idx >= 0 ? shown[idx + 1] : undefined;
    setActive(next ?? null);
    setAnswer("");
    setResult(null);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="面试流程" subtitle="题库刷题 · 记录每一次模拟与复盘" compact />

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

      {/* 难度 / 错题本 二级筛选（v12 P2-1） */}
      <View style={styles.filterRow}>
        {([["全部", null], ["简单", "easy"], ["中等", "medium"], ["困难", "hard"]] as const).map(([label, key]) => (
          <Pressable
            key={label}
            onPress={() => selectDifficulty(key)}
            style={[styles.filterChip, difficulty === key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, difficulty === key && styles.filterChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setOnlyWrong((v) => !v)}
          style={[styles.filterChip, onlyWrong && styles.filterChipWrong]}
          accessibilityLabel="只看错题"
        >
          <Text style={[styles.filterChipText, onlyWrong && styles.filterChipTextWrong]}>
            只看错题{  wrongIds.length > 0 ? ` ${wrongIds.length}` : ""}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{onlyWrong ? "错题本是空的：继续刷题吧" : "这个筛选下暂时没有题目"}</Text>
        </Card>
      ) : (
        shown.slice(0, 60).map((q, i) => (
          <Pressable key={q.id} onPress={() => { setActive(q); setAnswer(""); setResult(null); }}>
            <Card style={styles.questionCard}>
              <View style={styles.questionHead}>
                <Text style={styles.questionIndex}>{i + 1}</Text>
                <Text style={[styles.difficulty, DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.medium]}>
                  {DIFF_LABEL[q.difficulty] ?? q.difficulty}
                </Text>
                {q.sourceSite ? <Text style={styles.sourceTag} numberOfLines={1}>来源 {q.sourceSite.replace("github:", "")}</Text> : null}
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
                  <>
                    {/* v12 P2-1：自填答案 ↔ 参考答案 并排对照（这是"检查自己答得对不对"的关键） */}
                    <View style={styles.compareRow}>
                      <View style={[styles.compareCol, styles.compareMine]}>
                        <Text style={styles.compareHead}>我的答案</Text>
                        <Text style={styles.compareBody}>{answer.trim() || "（空）"}</Text>
                      </View>
                      <View style={[styles.compareCol, result.correct ? styles.compareGood : styles.compareRef]}>
                        <Text style={styles.compareHead}>参考答案</Text>
                        <Text style={styles.compareBody}>{result.answer || "暂无参考答案"}</Text>
                      </View>
                    </View>
                    <Text style={[styles.verdict, result.correct ? { color: colors.success } : { color: colors.warning }]}>
                      {result.correct ? "判定：答得不错 ✅" : "判定：再对照一下参考答案，把差异补上"}
                    </Text>
                    {active.sourceSite ? (
                      <Text style={styles.sourceLine} numberOfLines={2}>
                        来源：{active.sourceSite}
                        {active.license ? " · " + active.license : ""}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.submitBtn, styles.submitGhost]}
                    onPress={() => {
                      setActive(null);
                      setAnswer("");
                      setResult(null);
                    }}
                  >
                    <Text style={[styles.submitText, { color: colors.text }]}>关闭</Text>
                  </Pressable>
                  {result ? (
                    <Pressable style={styles.submitBtn} onPress={nextQuestion}>
                      <Text style={styles.submitText}>下一题</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={[styles.submitBtn, submitting && { opacity: 0.5 }]} disabled={submitting} onPress={() => void submit()}>
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>提交作答</Text>}
                    </Pressable>
                  )}
                </View>
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
    content: { padding: 16, gap: 12 },
    hero: { marginBottom: 4 },
    // 二级筛选（难度 / 错题本）
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.surfaceStrong,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    filterChipTextActive: { color: "#fff" },
    filterChipWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
    filterChipTextWrong: { color: colors.danger },
    sourceTag: { flex: 1, textAlign: "right", fontSize: 10, color: colors.textFaint },
    // 作答对照
    compareRow: { flexDirection: "row", gap: 8 },
    compareCol: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, gap: 4 },
    compareMine: { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
    compareRef: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
    compareGood: { borderColor: colors.success, backgroundColor: colors.successSoft },
    compareHead: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
    compareBody: { fontSize: 12, lineHeight: 18, color: colors.text },
    verdict: { fontSize: 12, fontWeight: "700" },
    sourceLine: { fontSize: 10, color: colors.textFaint },
    modalActions: { flexDirection: "row", gap: 8 },
    submitGhost: { backgroundColor: colors.surfaceMuted },
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
    submitBtn: {
      flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
    submitText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
