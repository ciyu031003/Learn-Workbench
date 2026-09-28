import { useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/card";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { shouldStagger, staggerDelay } from "@/lib/stagger";
import { haptics } from "@/lib/haptics";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { PagerBar } from "@/components/pager-bar";
import { SuccessBurst } from "@/components/success-burst";
import { ChipGroup, SheetSection, SheetSegmented, SheetStickyCta, type SegmentOption } from "@/components/sheet";
import { QuizStack, type QuizItem } from "@/components/quiz-stack";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { InterviewQuestion, QuestionModule } from "@learn-workbench/shared";

/** 难度徽章：文案 +配色（v20-E1：色收进主题 token） */
import { ThemedIcon } from "@/components/themed-icon";

/** v1.26：题型只预览前 3 个，其余从「更多」弹层选（不再一行横滑找） */
const MODULE_PREVIEW = 3;
/** v1.26：每页题目数（分页展示，不再一路下滑） */
const PAGE_SIZE = 10;
/** v1.31 快速过题：可选题量（随机抽题） */
const QUIZ_COUNTS = [10, 15, 20] as const;

const DIFF_LABEL: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
/** v20-E1：难度徽章色收进主题 token（原硬编码浅色 hex 在暗色模式下离群） */
function diffStyleOf(colors: ThemeColors, level: string): { color: string; backgroundColor: string } {
  switch (level) {
    case "easy":
      return { color: colors.success, backgroundColor: colors.successSoft };
    case "medium":
      return { color: colors.warning, backgroundColor: colors.warningSoft };
    case "hard":
      return { color: colors.danger, backgroundColor: colors.dangerSoft };
    default:
      return { color: colors.textSecondary, backgroundColor: colors.surfaceMuted };
  }
}

/** v16：难度筛选收敛到滑动分段（全部 / 简单 / 中等 / 困难） */
const DIFFICULTY_OPTIONS: SegmentOption[] = [
  { key: "all", label: "全部" },
  { key: "easy", label: "简单" },
  { key: "medium", label: "中等" },
  { key: "hard", label: "困难" },
];

export default function InterviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /** v17-D（R8）：入场错峰；减弱动态不做（每屏封顶 12 项、只在首帧入场） */
  const reduced = useReducedMotion();
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [modules, setModules] = useState<QuestionModule[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** v20-E1：判定成功光圈计数（换 key 重放 SuccessBurst） */
  const [burstN, setBurstN] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; answer: string } | null>(null);
  /** v12 P2-1：难度筛选 + 错题本（只看做错的） */
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [wrongIds, setWrongIds] = useState<number[]>([]);
  /** v1.26：题型不再一行横滑 —— 只展示前若干个，其余从「更多」弹层里选 */
  const [moduleSheet, setModuleSheet] = useState(false);
  /** v1.26：分页（0 基），每页固定条数，不再一路下滑 */
  const [page, setPage] = useState(0);

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

  // v17-D（R9）：下拉刷新走统一 hook（吸顶栏存在 → 偏移 = insets.top + 44）
  const { control: pullControl } = usePullRefresh(() => load());

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
        const correct = !!data.isCorrect;
        setResult({ correct, answer: data.answer || "" });
        // v20-E1：判定反馈链——答对 success + SuccessBurst 光圈，答错 error 触觉
        if (correct) haptics.success();
        else haptics.error();
        setBurstN((n) => n + 1);
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
  // v1.26 分页（只影响展示条数，不动数据来源与筛选口径）
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = shown.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = shown.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(shown.length, safePage * PAGE_SIZE + PAGE_SIZE);

  /**
   * v1.31 快速过题：屏幕中间选题型/题量 → 随机抽题 → 堆叠卡速览。
   * 答案走**只读**接口 /api/questions/answers（不写 attempts、不改统计与错题本）。
   */
  const [quizPicker, setQuizPicker] = useState(false);
  const [quizModule, setQuizModule] = useState<string>("__all__");
  const [quizCount, setQuizCount] = useState<number>(QUIZ_COUNTS[0]);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [quizVisible, setQuizVisible] = useState(false);
  /** 每次开始速览都换 key 重挂 QuizStack —— 免掉"用 effect 重置内部状态"的反模式 */
  const [quizSession, setQuizSession] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);

  const startQuiz = async () => {
    if (quizLoading) return;
    setQuizLoading(true);
    try {
      const qs = new URLSearchParams();
      if (quizModule !== "__all__") qs.set("module", quizModule);
      const r = await fetch(getApiUrl() + "/api/questions" + (qs.size ? "?" + qs.toString() : ""), { headers: headers() });
      const data = (await r.json().catch(() => null)) as { questions?: InterviewQuestion[] } | null;
      const pool: InterviewQuestion[] = Array.isArray(data?.questions) ? data!.questions! : [];
      if (pool.length === 0) {
        Alert.alert("暂无题目", "这个题型下还没有题目，换个题型试试");
        return;
      }
      const want = Math.min(quizCount, pool.length);
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }
      const picked = shuffled.slice(0, want);
      const ar = await fetch(
        getApiUrl() + "/api/questions/answers?ids=" + picked.map((q) => q.id).join(","),
        { headers: headers() }
      );
      const ad = (await ar.json().catch(() => null)) as { answers?: { id: number; answer: string }[] } | null;
      const answerOf: Record<number, string> = {};
      if (Array.isArray(ad?.answers)) {
        for (const a of ad!.answers!) answerOf[Number(a.id)] = String(a.answer ?? "");
      }
      setQuizItems(
        picked.map((q) => ({
          id: q.id,
          module: q.module,
          question: q.question,
          difficulty: q.difficulty,
          answer: answerOf[q.id] ?? "",
        }))
      );
      if (pool.length < quizCount) {
        Alert.alert("题目不足", "该题型只有 " + pool.length + " 道题，本次抽取全部");
      }
      setQuizPicker(false);
      setQuizSession((s) => s + 1);
      setQuizVisible(true);
    } catch {
      Alert.alert("加载失败", "题库暂时不可用，请稍后重试");
    } finally {
      setQuizLoading(false);
    }
  };

  /** 下一题（在当前筛选结果里顺序往下） */
  const nextQuestion = () => {
    if (!active) return;
    // v19-M5：切题给 soft 触觉
    haptics.soft();
    const idx = shown.findIndex((q) => q.id === active.id);
    const next = idx >= 0 ? shown[idx + 1] : undefined;
    setActive(next ?? null);
    setAnswer("");
    setResult(null);
  };

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏必须在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title="面试流程" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...pullControl} />} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <ScreenHeaderLargeTitle title="面试流程" subtitle="题库刷题 · 记录每一次模拟与复盘" />

      {/* v1.26：题型只展示前 MODULE_PREVIEW 个 + 「更多」；v20-E1：PressableScale + 触觉 */}
      <View style={styles.moduleRow}>
        <PressableScale
          onPress={() => { haptics.soft(); setPage(0); selectModule(null); }}
          scaleTo={0.94}
          style={[styles.moduleChip, moduleFilter === null && styles.moduleChipActive]}
        >
          <Text style={[styles.moduleChipText, moduleFilter === null && styles.moduleChipTextActive]}>全部</Text>
        </PressableScale>
        {modules.slice(0, MODULE_PREVIEW).map((m) => (
          <PressableScale
            key={m.module}
            onPress={() => { haptics.soft(); setPage(0); selectModule(m.module); }}
            scaleTo={0.94}
            style={[styles.moduleChip, moduleFilter === m.module && styles.moduleChipActive]}
          >
            <Text style={[styles.moduleChipText, moduleFilter === m.module && styles.moduleChipTextActive]} numberOfLines={1}>
              {m.module}
            </Text>
          </PressableScale>
        ))}
        {modules.length > MODULE_PREVIEW ? (
          <PressableScale onPress={() => setModuleSheet(true)} scaleTo={0.94} style={[styles.moduleChip, styles.moduleMore]} accessibilityLabel="更多题型">
            <Text style={styles.moduleMoreText}>更多</Text>
            <ThemedIcon name="chevron-down" size={13} color={colors.primary} />
          </PressableScale>
        ) : null}
      </View>

      {/* 难度 / 错题本 二级筛选（v12 P2-1；v16：分段用滑动胶囊、错题本用胶囊 chip） */}
      <SheetSegmented
        options={DIFFICULTY_OPTIONS}
        value={difficulty ?? "all"}
        onChange={(key) => { setPage(0); selectDifficulty(key === "all" ? null : key); }}
      />
      <ChipGroup
        options={[{ key: "wrong", label: wrongIds.length > 0 ? `只看错题 ${wrongIds.length}` : "只看错题" }]}
        selected={onlyWrong ? ["wrong"] : []}
        multiple={false}
        onToggle={() => { setPage(0); setOnlyWrong((v) => !v); }}
        wrap
      />

      {/* v1.31：快速过题入口 —— 面试前把题目与答案快速过一遍 */}
      <PressableScale
        onPress={() => { haptics.soft(); setQuizPicker(true); }}
        scaleTo={0.98}
        style={styles.quizCta}
        accessibilityLabel="快速过题"
      >
        <View style={styles.quizCtaIcon}>
          <ThemedIcon name="flash-outline" size={16} color={colors.canvas} />
        </View>
        <View style={styles.quizCtaBody}>
          <Text style={styles.quizCtaTitle}>快速过题</Text>
          <Text style={styles.quizCtaHint}>随机 10~20 题 · 左右滑动速览题目与答案</Text>
        </View>
        <ThemedIcon name="chevron-forward" size={16} color={colors.canvas} />
      </PressableScale>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : shown.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{onlyWrong ? "错题本是空的：继续刷题吧" : "这个筛选下暂时没有题目"}</Text>
        </Card>
      ) : (
        paged.map((q, i) => (
          <Animated.View
            key={q.id}
            layout={reduced ? undefined : LinearTransition}
            entering={
              reduced || !shouldStagger(i, paged.length)
                ? undefined
                : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))
            }
          >
          <PressableScale onPress={() => { setActive(q); setAnswer(""); setResult(null); }} scaleTo={0.98}>
            <Card style={styles.questionCard}>
              <View style={styles.questionHead}>
                <Text style={styles.questionIndex}>{safePage * PAGE_SIZE + i + 1}</Text>
                <Text style={[styles.difficulty, diffStyleOf(colors, q.difficulty)]}>
                  {DIFF_LABEL[q.difficulty] ?? q.difficulty}
                </Text>
                {q.sourceSite ? <Text style={styles.sourceTag} numberOfLines={1}>来源 {q.sourceSite.replace("github:", "")}</Text> : null}
              </View>
              <Text style={styles.questionText}>{q.question}</Text>
            </Card>
          </PressableScale>
          </Animated.View>
        ))
      )}

      {shown.length > 0 ? (
        /* v20-J2：分页条收单源 */
        <PagerBar
          page={safePage}
          pageCount={pageCount}
          from={from}
          to={to}
          total={shown.length}
          unit="题"
          onPageChange={setPage}
          style={styles.pager}
        />
      ) : null}

      {/* v1.26：题型「更多」弹层 —— 全量题型列表，选中即回填并关闭 */}
      <BottomSheet
        visible={moduleSheet}
        onClose={() => setModuleSheet(false)}
        title="选择题型"
        subtitle={modules.length > 0 ? `共 ${modules.length} 个题型` : undefined}
        icon="grid-outline"
        height="64%"
      >
        <SheetSection title="题型" hint="选中后立即筛选并关闭" last>
          <ChipGroup
            wrap
            multiple={false}
            options={[{ key: "__all__", label: "全部" }, ...modules.map((m) => ({ key: m.module, label: m.module }))]}
            selected={[moduleFilter ?? "__all__"]}
            onToggle={(k) => {
              setPage(0);
              selectModule(k === "__all__" ? null : k);
              setModuleSheet(false);
            }}
          />
        </SheetSection>
      </BottomSheet>

      {/* v16：作答弹层迁移到 Sheet v3（头部有难度/来源副标题，底部动作收敛成吸底 CTA） */}
      <BottomSheet
        visible={!!active}
        onClose={() => {
          setActive(null);
          setAnswer("");
          setResult(null);
        }}
        title={active?.module ?? ""}
        subtitle={
          active
            ? [DIFF_LABEL[active.difficulty] ?? active.difficulty, active.sourceSite ? `来源 ${active.sourceSite.replace("github:", "")}` : ""]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        icon="chatbubbles-outline"
        height="88%"
        footer={
          <SheetStickyCta
            label={result ? "下一题" : "提交作答"}
            icon={result ? "arrow-forward" : "checkmark"}
            loading={submitting}
            onPress={() => (result ? nextQuestion() : void submit())}
            secondaryLabel="关闭"
            onSecondary={() => {
              setActive(null);
              setAnswer("");
              setResult(null);
            }}
          />
        }
        footerHint={result ? undefined : "提交后会和参考答案并排对照"}
      >
        {active ? (
          <>
            <SheetSection title="题目">
              <Text style={styles.questionText}>{active.question}</Text>
            </SheetSection>

            <SheetSection title="我的答案">
              <TextInput
                style={styles.answerInput}
                value={answer}
                onChangeText={setAnswer}
                placeholder="写下你的答案"
                placeholderTextColor={colors.textFaint}
                multiline
              />
            </SheetSection>

            {result ? (
              <SheetSection title="我的答案 ↔ 参考答案" last>
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
                <View style={styles.verdictRow}>
                  {/* v20-E1：判定成功时行内光圈（SuccessBurst 终于有了第二处消费） */}
                  {result.correct && burstN > 0 ? <SuccessBurst key={burstN} size={44} color={colors.success} /> : null}
                  <Text style={[styles.verdict, result.correct ? { color: colors.success } : { color: colors.warning }]}>
                    {result.correct ? "判定：答得不错 ✅" : "判定：再对照一下参考答案，把差异补上"}
                  </Text>
                </View>
                {active.sourceSite ? (
                  <Text style={styles.sourceLine} numberOfLines={2}>
                    来源：{active.sourceSite}
                    {active.license ? " · " + active.license : ""}
                  </Text>
                ) : null}
              </SheetSection>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
      </Animated.ScrollView>

      {/* v1.31：快速过题 —— 屏幕中间选题型与题量（点空白关闭，只有确认按钮提交） */}
      <Modal visible={quizPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setQuizPicker(false)}>
        <View style={styles.quizModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuizPicker(false)} accessibilityLabel="关闭快速过题" />
          <Card style={styles.quizModalCard}>
            <Text style={styles.quizModalTitle}>快速过题</Text>
            <Text style={styles.quizModalHint}>选择题型与题量，随机抽题后左右滑动速览</Text>

            <Text style={styles.quizFieldLabel}>题型</Text>
            <ChipGroup
              wrap
              multiple={false}
              options={[{ key: "__all__", label: "全部" }, ...modules.map((m) => ({ key: m.module, label: m.module }))]}
              selected={[quizModule]}
              onToggle={(k) => setQuizModule(k)}
            />

            <Text style={styles.quizFieldLabel}>题量</Text>
            <ChipGroup
              wrap
              multiple={false}
              options={QUIZ_COUNTS.map((n) => ({ key: String(n), label: n + " 题" }))}
              selected={[String(quizCount)]}
              onToggle={(k) => setQuizCount(Number(k))}
            />

            <SheetStickyCta
              label={quizLoading ? "准备中…" : "开始快速过题"}
              icon="flash-outline"
              loading={quizLoading}
              onPress={() => void startQuiz()}
            />
          </Card>
        </View>
      </Modal>

      <QuizStack key={quizSession} visible={quizVisible} items={quizItems} onClose={() => setQuizVisible(false)} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    hero: { marginBottom: 4 },
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
    verdictRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sourceLine: { fontSize: 10, color: colors.textFaint },
    heroTitle: {
      ...typography.display,
      color: colors.text,
    },
    heroSub: {
      ...typography.callout,
      // 任务4：正文级（callout 15pt）不能用 textMuted（浅色下对白底约 3.0，低于 WCAG AA 4.5）。
      // token 只有三档灰、不能新增，故用 text 加 0.72 透明（≈ #5A5A5C，约 7:1）保留副标题层级。
      color: colors.textSecondary,
      marginTop: 4,
    },
    moduleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    moduleChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, maxWidth: "46%" },
    moduleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    moduleChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    moduleChipTextActive: { color: colors.canvas },
    moduleMore: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft, maxWidth: "100%" },
    moduleMoreText: { fontSize: 12, fontWeight: "800", color: colors.primary },
    /* v20-J2：分页条本体收进 components/pager-bar.tsx，仅留外边距 */
    pager: { paddingTop: 6 },
    /** v1.31 快速过题：入口 CTA */
    quizCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    quizCtaIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    quizCtaBody: { flex: 1, gap: 2 },
    quizCtaTitle: { ...typography.headline, color: colors.canvas },
    quizCtaHint: { ...typography.caption, color: colors.canvas, opacity: 0.85 },
    /** v1.31 快速过题：居中选题弹窗 */
    quizModalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.scrim },
    quizModalCard: { width: "100%", maxWidth: 420, gap: spacing.sm },
    quizModalTitle: { ...typography.title2, color: colors.text },
    quizModalHint: { ...typography.caption, color: colors.textMuted },
    quizFieldLabel: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    questionCard: { gap: 6 },
    questionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    questionIndex: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.primarySoft, color: colors.primary, textAlign: "center", lineHeight: 24, fontWeight: "800", fontSize: 12 },
    difficulty: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },
    questionText: { ...typography.headline, fontWeight: "700", color: colors.text, lineHeight: 22 },
    answerInput: { ...typography.callout, minHeight: 120, textAlignVertical: "top", backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,  color: colors.text },
    resultBox: { borderRadius: 12, padding: 12, gap: 4 },
    resultGood: { backgroundColor: colors.successSoft },
    resultBad: { backgroundColor: colors.warningSoft },
    resultText: { fontSize: 12, fontWeight: "800", color: colors.text },
    resultAnswer: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  });
