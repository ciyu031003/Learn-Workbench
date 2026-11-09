import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import {
  ChipGroup,
  SheetSection,
  SheetSegmented,
  SheetStickyCta,
  StepperRow,
  type SegmentOption,
} from "@/components/sheet";
import {
  ContentPicker,
  EMPTY_CONTENT,
  contentLabelOf,
  type ContentChoice,
  type ContentSource,
} from "@/components/content-picker";
import type { SportItem } from "@learn-workbench/shared/types";
import { SPORT_CATALOG, exerciseTypeOptions } from "@learn-workbench/shared/labels";
import { getDailyQuote } from "@/lib/quotes";
import { radius, typography, type ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/** 一键开始的会话类型（由 App 决定，随后直接进入计时） */
export interface QuickStartChoice {
  /** focus=学习专注（写专注 sessions）；exercise=运动（写运动记录） */
  kind: "focus" | "exercise";
  /** countdown=倒计时；stopwatch=正向秒表 */
  timerMode: "countdown" | "stopwatch";
  minutes?: number;
  sportKey?: string;
  sportName?: string;
  /** v5 P2-1：本次绑定的学习内容（写进 focus_sessions.tag） */
  contentLabel?: string;
  contentSource?: ContentSource;
  /** 本轮仅用于拼 label，不落库（为将来结构化列预留） */
  phaseId?: number;
  topicId?: number;
}

const MODE_OPTIONS: readonly SegmentOption<"countdown" | "stopwatch">[] = [
  { key: "countdown", label: "倒计时", icon: "timer-outline" },
  { key: "stopwatch", label: "正向计时", icon: "play-forward-outline" },
];

/**
 * 「一键开始」弹层（v16 重构：Sheet v3 + 原子组件）。
 *
 * 交互不变（v1.4.2 的不变量）：**选择 ≠ 开始**。这里的点选只改选择态，
 * 只有底部的吸底 CTA 会真正进入计时；侧滑 / 点空白 / 返回键一律只关闭。
 * 观感升级：分段用滑动胶囊、分组用 SheetSection、时长用 ChipGroup + StepperRow、
 * 启动按钮吸底（内容再长也不会被推走），并把"选择 ≠ 开始"写进副标题与底部提示。
 *
 * v2.0.1（真机反馈「专注开始界面要一屏，不要上下滑动」）：
 * `oneScreen` 模式把弹层改成**近全屏、不滚动**的一屏启动页 ——
 * 顶部是标题与说明（由 BottomSheet 头部承担），中间是时长档位（25/45/60）+ 自定义步进 +
 * 计时方式 + 一行内容摘要，底部是今日励志短句（图标 + 纯文字，无 emoji）。
 * 高度一律用 flex 分配 + useWindowDimensions 判断小屏档位，不用 ScrollView；
 * 「选内容」是一个**子步骤**（点内容摘要进入、返回即回设置），只有这一步内部可滚（列表型选择器）。
 * 数据不变：仍然只产出 QuickStartChoice，仍然只有底部 CTA 会真正开始计时。
 */
export function QuickStartSheet({
  visible,
  onClose,
  onPick,
  onClosed,
  oneScreen = false,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (choice: QuickStartChoice) => void;
  /** 退场动画结束、Modal 卸载后回调（父级用它延后打开全屏计时器） */
  onClosed?: () => void;
  /**
   * true = 一屏化启动页（v2.0.1）：近全屏、不滚动、只承载「学习专注」。
   * false（默认）= 旧的多分组可滚弹层（学习 / 运动），既有调用方不受影响。
   */
  oneScreen?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: winHeight } = useWindowDimensions();
  /** 小屏档位（320×640 这类）：收紧间距，保证顶部标题到最底部短句都落在一屏内 */
  const compact = winHeight < 700;
  /** 一屏化模式的「选内容」子步骤 */
  const [contentStep, setContentStep] = useState(false);
  /** 一屏化模式的「选运动项目」子步骤 */
  const [exerciseStep, setExerciseStep] = useState(false);
  /** 每日一言来自纯函数（按天取）——与 FocusTimer 的「励志短句」同一内容源，此处只读展示 */
  const dailyQuote = useMemo(() => getDailyQuote(), []);
  const [tab, setTab] = useState<"learning" | "exercise">("learning");
  const [sportType, setSportType] = useState<string>(exerciseTypeOptions[0]?.type ?? "AEROBIC");
  const [sport, setSport] = useState<SportItem | null>(null);
  const [sportMinutes, setSportMinutes] = useState(30);
  /** v5 P2-1：这次学什么（默认不指定；不做"记住上次"——D4） */
  const [content, setContent] = useState<ContentChoice>(EMPTY_CONTENT);
  /** 学习：时长与模式的**选择态**（不再直接开始） */
  const [learningMinutes, setLearningMinutes] = useState(25);
  const [learningMode, setLearningMode] = useState<"countdown" | "stopwatch">("countdown");
  /** 运动：模式的选择态 */
  const [exerciseMode, setExerciseMode] = useState<"countdown" | "stopwatch">("countdown");

  const sports = useMemo(() => SPORT_CATALOG.filter((s) => s.type === sportType), [sportType]);
  /** 切换运动类型后旧的 sport 可能不属于当前类型，按 key 重新校验 */
  const pickedSport = sport && sports.some((s) => s.key === sport.key) ? sport : sports[0] ?? null;

  /** 每次关闭都回到默认选择（D4：不记住上次）——所有关闭路径（含侧滑/点空白）都会走它 */
  const reset = () => {
    setContent(EMPTY_CONTENT);
    setLearningMinutes(25);
    setLearningMode("countdown");
    setExerciseMode("countdown");
    setSport(null);
    setSportMinutes(30);
    setTab("learning");
    setContentStep(false);
    setExerciseStep(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  /** 底部按钮文案：把当前选择说清楚，避免"点错才知道会开始" */
  const startLabel =
    tab === "learning"
      ? learningMode === "stopwatch"
        ? "开始计时 · 学习（正向计时）"
        : `开始计时 · 学习 ${learningMinutes} 分钟`
      : exerciseMode === "stopwatch"
        ? `开始计时 · ${pickedSport?.name ?? "运动"}（正向计时）`
        : `开始计时 · ${pickedSport?.name ?? "运动"} ${sportMinutes} 分钟`;

  const start = () => {
    if (tab === "learning") {
      const label = contentLabelOf(content);
      onPick({
        kind: "focus",
        timerMode: learningMode,
        minutes: learningMode === "countdown" ? learningMinutes : undefined,
        contentLabel: label ?? undefined,
        // 没填内容时明确记为 none（而不是留下一个可能会被误读的 source）
        contentSource: label ? content.source : "none",
        phaseId: label ? content.phaseId : undefined,
        topicId: label ? content.topicId : undefined,
      });
      close();
      return;
    }
    // 只接受"当前分类下真实存在"的项目：否则会静默回落到目录第一项
    if (!pickedSport) return;
    onPick({
      kind: "exercise",
      timerMode: exerciseMode,
      minutes: exerciseMode === "countdown" ? sportMinutes : undefined,
      sportKey: pickedSport.key,
      sportName: pickedSport.name,
    });
    close();
  };

  /**
   * v2.0.1 一屏化启动页：近全屏、不滚动（真机反馈：专注开始界面要一屏展示）。
   * 只在 oneScreen 时渲染；旧的多分组弹层（学习/运动）原样保留，其它调用方零改动。
   */
  if (oneScreen) {
    const isExercise = tab === "exercise";
    const focusStartLabel = isExercise
      ? exerciseMode === "stopwatch"
        ? "开始锻炼 · " + (pickedSport?.name ?? "运动")
        : "开始锻炼 · " + (pickedSport?.name ?? "运动") + " " + sportMinutes + " 分钟"
      : learningMode === "stopwatch"
        ? "开始专注 · 正向计时"
        : `开始专注 · ${learningMinutes} 分钟`;
    return (
      <BottomSheet
        visible={visible}
        onClose={close}
        title={isExercise ? "开始运动" : "开始专注"}
        subtitle={isExercise ? "选好项目和时长，点底部按钮开始记录" : "选好时长，点底部按钮进入全屏专注"}
        icon={isExercise ? "barbell-outline" : "play-circle-outline"}
        // 常规屏贴合内容；小屏仍保留 94% 防止设置区被压缩
        height={compact ? "96%" : "84%"}
        expandable={false}
        // 关键：不内置滚动容器 —— 一屏内的高度全部交给 flex 分配
        scroll={false}
        autoHeight={false}
        onClosed={onClosed}
        footer={
          <View style={styles.footerWrap}>
            <SheetStickyCta label={focusStartLabel} icon="play" onPress={start} />
            <Text style={styles.footerHint}>返回或下滑只会关闭，不会开始计时</Text>
            {/* 最下方励志短句：图标 + 纯文字（无 emoji），永远在一屏最底部 */}
            <View style={styles.quoteWrap}>
              <ThemedIcon name="sparkles" size={14} color={colors.primary} />
              <Text style={[styles.quoteText, compact && styles.quoteTextCompact]} numberOfLines={2}>
                {dailyQuote}
              </Text>
            </View>
          </View>
        }
      >
        <View style={[styles.oneScreen, compact && styles.oneScreenCompact]}>
          {!contentStep && !exerciseStep ? (
            <View style={styles.oneModeSwitch}>
              <SheetSegmented
                options={[
                  { key: "learning", label: "学习", icon: "book-outline" },
                  { key: "exercise", label: "运动", icon: "barbell-outline" },
                ]}
                value={tab}
                onChange={(next) => {
                  setTab(next);
                  setContentStep(false);
                  setExerciseStep(false);
                }}
              />
            </View>
          ) : null}

          {contentStep ? (
            <View style={styles.stepWrap}>
              <View style={styles.stepHead}>
                <Pressable
                  onPress={() => setContentStep(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="返回专注设置"
                  style={styles.stepBack}
                >
                  <ThemedIcon name="chevron-back" size={16} color={colors.text} />
                  <Text style={styles.stepBackText}>返回</Text>
                </Pressable>
                <Text style={styles.stepTitle}>这次学什么</Text>
              </View>
              {/* 只有「选内容」这个列表型子步骤内部可滚；启动页本身不滚 */}
              <ScrollView
                style={styles.stepScroll}
                contentContainerStyle={styles.stepScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <ContentPicker value={content} onChange={setContent} />
              </ScrollView>
            </View>
          ) : exerciseStep ? (
            <View style={styles.stepWrap}>
              <View style={styles.stepHead}>
                <Pressable
                  onPress={() => setExerciseStep(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="返回运动设置"
                  style={styles.stepBack}
                >
                  <ThemedIcon name="chevron-back" size={16} color={colors.text} />
                  <Text style={styles.stepBackText}>返回</Text>
                </Pressable>
                <Text style={styles.stepTitle}>选择运动</Text>
              </View>
              <ScrollView
                style={styles.stepScroll}
                contentContainerStyle={styles.stepScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <SheetSection title="项目类型">
                  <ChipGroup
                    multiple={false}
                    wrap
                    options={exerciseTypeOptions.map((t) => ({ key: t.type, label: t.label }))}
                    selected={[sportType]}
                    onToggle={(k) => {
                      setSportType(k);
                      setSport(null);
                    }}
                  />
                </SheetSection>
                <SheetSection title="项目" last>
                  <ChipGroup
                    multiple={false}
                    wrap
                    options={sports.map((s) => ({ key: s.key, label: s.name }))}
                    selected={pickedSport ? [pickedSport.key] : []}
                    onToggle={(k) => {
                      const next = sports.find((s) => s.key === k);
                      if (next) setSport(next);
                    }}
                  />
                </SheetSection>
              </ScrollView>
            </View>
          ) : (
            <ScrollView
              style={styles.oneMainScroll}
              contentContainerStyle={[styles.oneMain, compact && styles.oneMainCompact]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {tab === "learning" ? (
                <>
                  <View style={styles.oneBlock}>
                    <Text style={styles.oneLabel}>专注时长</Text>
                    <View style={styles.chipRow}>
                      {[25, 45, 60].map((m) => {
                        const active = learningMode === "countdown" && learningMinutes === m;
                        return (
                          <Pressable
                            key={m}
                            onPress={() => {
                              setLearningMode("countdown");
                              setLearningMinutes(m);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`专注 ${m} 分钟`}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{m} 分钟</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <StepperRow
                      label="自定义时长"
                      hint="5–180 分钟"
                      value={learningMinutes}
                      step={5}
                      min={5}
                      max={180}
                      unit="分钟"
                      onChange={(v) => {
                        setLearningMode("countdown");
                        setLearningMinutes(v);
                      }}
                    />
                  </View>

                  <View style={styles.oneBlock}>
                    <Text style={styles.oneLabel}>计时方式</Text>
                    <SheetSegmented options={MODE_OPTIONS} value={learningMode} onChange={setLearningMode} />
                  </View>

                  <Pressable
                    onPress={() => setContentStep(true)}
                    accessibilityRole="button"
                    accessibilityLabel="选择这次学习的内容"
                    style={styles.contentRow}
                  >
                    <ThemedIcon name="bookmark-outline" size={14} color={colors.primary} />
                    <Text style={styles.contentRowText} numberOfLines={1}>
                      {contentLabelOf(content) ?? "不指定 · 自由专注"}
                    </Text>
                    <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.oneBlock}>
                    {compact ? null : <Text style={styles.oneLabel}>运动项目</Text>}
                    <Pressable
                      onPress={() => setExerciseStep(true)}
                      accessibilityRole="button"
                      accessibilityLabel="选择运动项目"
                      style={styles.contentRow}
                    >
                      <ThemedIcon name="barbell-outline" size={14} color={colors.primary} />
                      <Text style={styles.contentRowText} numberOfLines={1}>
                        {pickedSport ? pickedSport.name : "选择运动项目"}
                      </Text>
                      <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                    </Pressable>
                  </View>

                  <View style={styles.oneBlock}>
                    {compact ? null : <Text style={styles.oneLabel}>运动时长</Text>}
                    <View style={styles.chipRow}>
                      {[15, 30, 45, 60].map((m) => {
                        const active = exerciseMode === "countdown" && sportMinutes === m;
                        return (
                          <Pressable
                            key={m}
                            onPress={() => {
                              setExerciseMode("countdown");
                              setSportMinutes(m);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`运动 ${m} 分钟`}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{m} 分钟</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <StepperRow
                      label="自定义时长"
                      hint="5–300 分钟"
                      value={sportMinutes}
                      step={5}
                      min={5}
                      max={300}
                      unit="分钟"
                      onChange={(v) => {
                        setExerciseMode("countdown");
                        setSportMinutes(v);
                      }}
                    />
                  </View>

                  <View style={styles.oneBlock}>
                    <Text style={styles.oneLabel}>计时方式</Text>
                    <SheetSegmented options={MODE_OPTIONS} value={exerciseMode} onChange={setExerciseMode} />
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </BottomSheet>
    );
  }

  const learningBody = (
    <>
      <SheetSection title="这次学什么" hint="不指定就是自由专注">
        <ContentPicker value={content} onChange={setContent} />
      </SheetSection>

      <SheetSection
        title="时长"
        hint={learningMode === "stopwatch" ? "正向计时不限时长" : "选常用档，或自己加减"}
      >
        <ChipGroup
          multiple={false}
          options={[
            { key: "15", label: "15 分钟" },
            { key: "25", label: "25 分钟" },
            { key: "45", label: "45 分钟" },
          ]}
          selected={learningMode === "countdown" ? [String(learningMinutes)] : []}
          onToggle={(k) => {
            setLearningMode("countdown");
            setLearningMinutes(Number(k));
          }}
        />
        <StepperRow
          label="自定义时长"
          hint="5–180 分钟"
          value={learningMinutes}
          step={5}
          min={5}
          max={180}
          unit="分钟"
          onChange={(v) => {
            setLearningMode("countdown");
            setLearningMinutes(v);
          }}
        />
      </SheetSection>

      <SheetSection title="计时方式" last>
        <SheetSegmented options={MODE_OPTIONS} value={learningMode} onChange={setLearningMode} />
      </SheetSection>
    </>
  );

  const exerciseBody = (
    <>
      <SheetSection title="项目类型">
        <ChipGroup
          multiple={false}
          wrap
          options={exerciseTypeOptions.map((t) => ({ key: t.type, label: t.label }))}
          selected={[sportType]}
          onToggle={(k) => {
            setSportType(k);
            setSport(null);
          }}
        />
      </SheetSection>

      <SheetSection title="项目">
        <ChipGroup
          multiple={false}
          wrap
          options={sports.map((s) => ({ key: s.key, label: s.name }))}
          selected={pickedSport ? [pickedSport.key] : []}
          onToggle={(k) => {
            const next = sports.find((s) => s.key === k);
            if (next) setSport(next);
          }}
        />
      </SheetSection>

      <SheetSection title="时长" hint={exerciseMode === "stopwatch" ? "正向计时不限时长" : "选常用档，或自己加减"}>
        <ChipGroup
          multiple={false}
          options={[15, 30, 45, 60].map((m) => ({ key: String(m), label: `${m} 分钟` }))}
          selected={exerciseMode === "countdown" ? [String(sportMinutes)] : []}
          onToggle={(k) => {
            setExerciseMode("countdown");
            setSportMinutes(Number(k));
          }}
        />
        <StepperRow
          label="自定义时长"
          hint="5–300 分钟"
          value={sportMinutes}
          step={5}
          min={5}
          max={300}
          unit="分钟"
          onChange={(v) => {
            setExerciseMode("countdown");
            setSportMinutes(v);
          }}
        />
      </SheetSection>

      <SheetSection title="计时方式" last>
        <SheetSegmented options={MODE_OPTIONS} value={exerciseMode} onChange={setExerciseMode} />
      </SheetSection>
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="一键开始"
      subtitle="先选好这次做什么；只有点底部按钮才会开始计时"
      icon="play-circle-outline"
      height="78%"
      /**
       * v1.45：允许把抽屉往上拉直到全屏（也可以点一下顶部横线切换）。
       * 用户反馈："点击抽屉弹窗上方的横线，可以把组件往上拉…可以直接拖动直至全屏显示"，
       * 这样挑内容时不用先在小窗里上下滚。
       * BottomSheet 的下拉关闭手势只挂在 grabber 区，展开后内容区滚动不受影响。
       */
      expandable
      onClosed={onClosed}
      segmented={
        <SheetSegmented
          options={[
            { key: "learning", label: "学习", icon: "book-outline" },
            { key: "exercise", label: "运动", icon: "barbell-outline" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      footer={
        <SheetStickyCta
          label={startLabel}
          icon="play"
          onPress={start}
          disabled={tab === "exercise" && !pickedSport}
        />
      }
      footerHint="返回、点空白或下滑只会关闭，不会开始计时"
    >
      {tab === "learning" ? learningBody : exerciseBody}
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // 一屏化启动页：内容区撑满，短句用 space-between 钉在底部
    /** 顶部对齐：模式切换之后直接进入设置，避免一屏弹层上方出现大块空白 */
    oneScreen: { flex: 1, justifyContent: "flex-start", gap: 12, minHeight: 0 },
    oneModeSwitch: { paddingTop: 2 },
    oneMainScroll: { flex: 1, minHeight: 0 },
    footerWrap: { gap: 8 },
    footerHint: { ...typography.micro, color: colors.textMuted, textAlign: "center" },
    oneScreenCompact: { gap: 8 },
    oneMain: { gap: 16, paddingTop: 2 },
    oneMainCompact: { gap: 8 },
    oneBlock: { gap: 8 },
    oneLabel: { ...typography.section, color: colors.textMuted },
    chipRow: { flexDirection: "row", gap: 8 },
    chip: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { ...typography.callout, fontWeight: "700", color: colors.textMuted },
    chipTextActive: { color: colors.canvas },
    contentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    contentRowText: { flex: 1, ...typography.caption, color: colors.text },
    quoteWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2, paddingBottom: 2 },
    quoteText: { flex: 1, ...typography.caption, color: colors.textMuted },
    quoteTextCompact: { ...typography.meta },
    stepWrap: { flex: 1, gap: 10, minHeight: 0 },
    stepHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepBack: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingRight: 6 },
    stepBackText: { ...typography.caption, fontWeight: "700", color: colors.text },
    stepTitle: { ...typography.section, color: colors.text },
    stepScroll: { flex: 1 },
    stepScrollContent: { paddingBottom: 8 },
  });
