import { useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/card";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { shouldStagger, staggerDelay } from "@/lib/stagger";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection, SheetSegmented, SheetStickyCta, type SegmentOption } from "@/components/sheet";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { InterviewQuestion, QuestionModule } from "@learn-workbench/shared";

/** 难度徽章：文案 +配色（浅深色通用，靠文字/底色区分） */
import { ThemedIcon } from "@/components/themed-icon";
import { typography } from "@/theme/tokens";

/** v1.26：题型只预览前 3 个，其余从「更多」弹层选（不再一行横滑找） */
const MODULE_PREVIEW = 3;
/** v1.26：每页题目数（分页展示，不再一路下滑） */
const PAGE_SIZE = 10;

const DIFF_LABEL: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
const DIFF_STYLE: Record<string, { color: string; backgroundColor: string }> = {
  easy: { color: "#2E7D4F", backgroundColor: "#E7F6EC" },
  medium: { color: "#A96A12", backgroundColor: "#FCF3DF" },
  hard: { color: "#A33", backgroundColor: "#FBEBEB" },
};

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
  // v1.26 分页（只影响展示条数，不动数据来源与筛选口径）
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = shown.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = shown.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(shown.length, safePage * PAGE_SIZE + PAGE_SIZE);

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
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏必须在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title="面试流程" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...pullControl} />} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <ScreenHeaderLargeTitle title="面试流程" subtitle="题库刷题 · 记录每一次模拟与复盘" />

      {/* v1.26：题型只展示前 MODULE_PREVIEW 个 + 「更多」，其余从下方弹层选择（不再横滑长列表） */}
      <View style={styles.moduleRow}>
        <Pressable
          onPress={() => { setPage(0); selectModule(null); }}
          style={[styles.moduleChip, moduleFilter === null && styles.moduleChipActive]}
        >
          <Text style={[styles.moduleChipText, moduleFilter === null && styles.moduleChipTextActive]}>全部</Text>
        </Pressable>
        {modules.slice(0, MODULE_PREVIEW).map((m) => (
          <Pressable
            key={m.module}
            onPress={() => { setPage(0); selectModule(m.module); }}
            style={[styles.moduleChip, moduleFilter === m.module && styles.moduleChipActive]}
          >
            <Text style={[styles.moduleChipText, moduleFilter === m.module && styles.moduleChipTextActive]} numberOfLines={1}>
              {m.module}
            </Text>
          </Pressable>
        ))}
        {modules.length > MODULE_PREVIEW ? (
          <Pressable onPress={() => setModuleSheet(true)} style={[styles.moduleChip, styles.moduleMore]} accessibilityLabel="更多题型">
            <Text style={styles.moduleMoreText}>更多</Text>
            <ThemedIcon name="chevron-down" size={13} color={colors.primary} />
          </Pressable>
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
            entering={
              reduced || !shouldStagger(i, paged.length)
                ? undefined
                : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))
            }
          >
          <Pressable onPress={() => { setActive(q); setAnswer(""); setResult(null); }}>
            <Card style={styles.questionCard}>
              <View style={styles.questionHead}>
                <Text style={styles.questionIndex}>{safePage * PAGE_SIZE + i + 1}</Text>
                <Text style={[styles.difficulty, DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.medium]}>
                  {DIFF_LABEL[q.difficulty] ?? q.difficulty}
                </Text>
                {q.sourceSite ? <Text style={styles.sourceTag} numberOfLines={1}>来源 {q.sourceSite.replace("github:", "")}</Text> : null}
              </View>
              <Text style={styles.questionText}>{q.question}</Text>
            </Card>
          </Pressable>
          </Animated.View>
        ))
      )}

      {shown.length > 0 ? (
        <View style={styles.pager}>
          <Pressable
            disabled={safePage <= 0}
            onPress={() => setPage(Math.max(0, safePage - 1))}
            style={[styles.pagerBtn, safePage <= 0 && styles.pagerBtnOff]}
            accessibilityRole="button"
            accessibilityLabel="上一页"
          >
            <ThemedIcon name="chevron-back" size={16} color={safePage <= 0 ? colors.textFaint : colors.primary} />
            <Text style={[styles.pagerBtnText, safePage <= 0 && styles.pagerTextOff]}>上一页</Text>
          </Pressable>

          <View style={styles.pagerMid}>
            <Text style={styles.pagerPage}>第 {safePage + 1} / {pageCount} 页</Text>
            <Text style={styles.pagerCount}>已显示 {from}–{to} / 共 {shown.length} 题</Text>
          </View>

          <Pressable
            disabled={safePage >= pageCount - 1}
            onPress={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            style={[styles.pagerBtn, safePage >= pageCount - 1 && styles.pagerBtnOff]}
            accessibilityRole="button"
            accessibilityLabel="下一页"
          >
            <Text style={[styles.pagerBtnText, safePage >= pageCount - 1 && styles.pagerTextOff]}>下一页</Text>
            <ThemedIcon name="chevron-forward" size={16} color={safePage >= pageCount - 1 ? colors.textFaint : colors.primary} />
          </Pressable>
        </View>
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
                <Text style={[styles.verdict, result.correct ? { color: colors.success } : { color: colors.warning }]}>
                  {result.correct ? "判定：答得不错 ✅" : "判定：再对照一下参考答案，把差异补上"}
                </Text>
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
    /* v1.26 分页条 */
    pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 6 },
    pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.primarySoft },
    pagerBtnOff: { backgroundColor: colors.surfaceMuted },
    pagerBtnText: { fontSize: 12, fontWeight: "800", color: colors.primary },
    pagerTextOff: { color: colors.textFaint },
    pagerMid: { alignItems: "center", gap: 1 },
    pagerPage: { fontSize: 12, fontWeight: "800", color: colors.text },
    pagerCount: { fontSize: 10, color: colors.textMuted },
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
