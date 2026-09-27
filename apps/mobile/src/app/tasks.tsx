import { useCallback, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { typography } from "@/theme/tokens";
import { RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { useAppStore, type TaskType } from "@/store/app-store";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { syncPull, syncPush } from "@/lib/sync";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { haptics } from "@/lib/haptics";
import { AnimatedCheckMark } from "@/components/check-mark";
import { SuccessBurst } from "@/components/success-burst";
import { AnimatedNumber } from "@/components/animated-number";
import { ProgressBar } from "@/components/stat";
import { taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { BottomSheet } from "@/components/bottom-sheet";
import { FocusTimer } from "@/components/focus-timer";
import { ContentPicker, EMPTY_CONTENT, contentLabelOf, type ContentChoice } from "@/components/content-picker";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import { FocusShareSheet } from "@/components/focus-share-card";
import { focusShareDataFromStats } from "@/lib/focus-share";

const TYPES: TaskType[] = ["study", "agent", "output", "review", "exam"];

export default function TasksScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const tasks = useAppStore((s) => s.tasks);
  const sessions = useAppStore((s) => s.sessions);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);
  const token = useAppStore((s) => s.token);

  /**
   * v17 收尾：本页数据来自本地 store + 同步引擎（没有页面级 loader），
   * 所以下拉刷新 = 推本地变更 + 拉远端（与「我的 → 立即同步」同一条链路，不改取数口径）。
   * 未登录时直接返回，转圈由 hook 负责复位。
   */
  const refreshFromCloud = useCallback(async () => {
    if (!token) return;
    await syncPush(token);
    await syncPull(token);
  }, [token]);
  /** 本页有吸顶紧凑栏 → stickyHeader 默认 true（转圈落在吸顶栏下方） */
  const { control: pullControl } = usePullRefresh(refreshFromCloud);

  /** v17-D（R8）：入场错峰只在首帧做，滚动复现不做；减弱动态下完全不做 */
  const reduced = useReducedMotion();
  /** v19-M3：勾选成功的行内 ripple（按任务 id 计数，换 key 重放 SuccessBurst） */
  const [bursts, setBursts] = useState<Record<number, number>>({});
  /** 勾选反馈语义化：完成给 success、取消给 soft（Apple 手感的核心是"轻且语义化"） */
  const onToggleTask = (id: number, done: boolean) => {
    if (done) haptics.soft();
    else {
      haptics.success();
      setBursts((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
    }
    toggleTaskDone(id);
  };

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("study");
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSession, setTimerSession] = useState(0);
  const [timerTask, setTimerTask] = useState<{ id: number | null; title: string | null } | null>(null);
  /** v4 P1：新建任务改为弹层输入（不再让输入框常驻首屏第一位） */
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /**
   * v5 P2-1：「自由专注」入口先问"这次学什么"（复用 ContentPicker），选完立即开始。
   * 与首页一键开始同样的 Modal 串行处理：先关选择弹层，等它卸载后再开计时器。
   */
  const [contentOpen, setContentOpen] = useState(false);
  const [content, setContent] = useState<ContentChoice>(EMPTY_CONTENT);
  const [pendingStart, setPendingStart] = useState<{ label: string | null; timerMode: "countdown" | "stopwatch" } | null>(null);
  /** 由"自由专注"弹出的计时器：需要自动开始 + 指定模式 + 带内容名 */
  const [autoTimer, setAutoTimer] = useState<{ label: string | null; timerMode: "countdown" | "stopwatch" } | null>(null);

  const today = todayISO();
  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const totalFocus = todayTasks.reduce((a, t) => a + t.focusMinutes, 0);
  const stats = computeFocusStats(sessions);
  const allDone = todayTasks.length > 0 && todayTasks.every((t) => t.done);
  const doneCount = todayTasks.filter((t) => t.done).length;
  const donePct = todayTasks.length === 0 ? 0 : Math.round((doneCount / todayTasks.length) * 100);
  /** 「下一步」= 第一个未完成的任务（不引入优先级字段，见 v4 方案 §P1-3） */
  const nextTask = todayTasks.find((t) => !t.done) ?? null;
  const maxMin = Math.max(1, ...stats.last14.map((d) => d.minutes));

  const openTimer = (taskId: number | null, taskTitle: string | null) => {
    haptics.soft();
    setAutoTimer(null);
    setTimerTask({ id: taskId, title: taskTitle });
    setTimerSession((s) => s + 1);
    setTimerOpen(true);
  };

  /** 「自由专注」：带着"这次学什么"直接开始（不需要再点一次开始） */
  const startFreeFocus = (timerMode: "countdown" | "stopwatch") => {
    setPendingStart({ label: contentLabelOf(content), timerMode });
    setContentOpen(false);
    // 用完即清（D4：不记住上次）——否则下次打开会静默沿用上次内容
    setContent(EMPTY_CONTENT);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    addTask(t, type);
    setTitle("");
    setNewTaskOpen(false);
  };

  /**
   * v1.22：分享打卡改为**卡片图片**（用户真机反馈："以卡片图片类型分享，不要几个文字分享"）。
   * 弹层里预览卡片 → 截图 → 系统分享面板；不可用时弹层内会自动退回文字分享。
   */
  const shareCard = () => setShareOpen(true);

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏放到滚动容器**之外**才能真吸顶（原来它在内容流里，会跟着一起滚走） */}
      <ScreenHeaderStickyBar title="每日任务" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        refreshControl={<RefreshControl {...pullControl} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 大标题留在内容里随内容滚走；顶部让位高度由组件自己吃 insets */}
        <ScreenHeaderLargeTitle title="每日任务" subtitle="计划 → 专注 → 复盘，形成学习闭环" />

      {/* ① 焦点 hero：今天第一件该做的事（v4 P1-3）。
          放在这里而不是 Card 列表里，是为了让"进页面 1 秒内知道先做什么"成立。 */}
      <Card
        variant="hero"
        title={nextTask ? "下一步" : allDone ? "今日已全部完成" : "今天还没有任务"}
        subtitle={todayTasks.length > 0 ? `共 ${todayTasks.length} 项 · 已完成 ${doneCount}` : "先写下一个今天要学的东西"}
      >
        <Text style={styles.nextTitle} numberOfLines={2}>
          {nextTask ? nextTask.title : allDone ? "🎉 收工，明天继续" : "任务越具体，越容易开始"}
        </Text>
        <Text style={styles.nextMeta}>
          {nextTask
            ? `${taskTypeLabels[nextTask.taskType]}${nextTask.focusMinutes > 0 ? ` · 已专注 ${nextTask.focusMinutes} 分钟` : " · 还没有专注记录"}`
            : allDone
              ? "可以再定一个小目标，或者早点休息"
              : "例如：把 V3 方案的 Phase 5 读一遍"}
        </Text>
        <PressableScale
          style={styles.primaryBtn}
          scaleTo={0.97}
          onPress={() => (nextTask ? openTimer(nextTask.id, nextTask.title) : setNewTaskOpen(true))}
        >
          <Text style={styles.primaryBtnText}>{nextTask ? "开始专注这 25 分钟" : "新建任务"}</Text>
        </PressableScale>
      </Card>

      {/* ② 今日任务：信息量最大的一张，升到工具区之前，并补进度条（v19-M2：动画进度条） */}
      <Card title="今日任务" subtitle={`${doneCount}/${todayTasks.length} 已完成 · 专注 ${totalFocus} 分钟`}>
        <ProgressBar progress={donePct / 100} color={colors.success} height={6} style={styles.progressTrack} />
        {allDone ? (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>🎉 今日任务已全部完成！生成打卡卡片分享吧</Text>
          </View>
        ) : null}
        {todayTasks.length === 0 ? (
          <Text style={styles.empty}>今天还没有任务</Text>
        ) : (
          todayTasks.map((t, i) => (
            <Animated.View
              key={t.id}
              style={styles.taskRow}
              entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              layout={reduced ? undefined : LinearTransition}
            >
              <PressableScale onPress={() => onToggleTask(t.id, t.done)} hitSlop={8} scaleTo={0.88}>
                {/* v19-M3：文本 ✓ 换成描边画勾 + 行内 ripple（与 today/health 同一语言） */}
                <View style={[styles.taskBox, t.done && styles.taskBoxDone]}>
                  <AnimatedCheckMark checked={t.done} size={14} color="#ffffff" />
                  {bursts[t.id] ? <SuccessBurst key={bursts[t.id]} size={38} color={colors.success} /> : null}
                </View>
              </PressableScale>
              <Text style={[styles.taskTitle, t.done && styles.taskTitleDone]} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType]}</Text>
              {t.focusMinutes > 0 ? <Text style={styles.taskFocus}>{t.focusMinutes}′</Text> : null}
              <PressableScale onPress={() => openTimer(t.id, t.title)} hitSlop={8} scaleTo={0.85}>
                <Text style={styles.taskPlay}>▶</Text>
              </PressableScale>
            </Animated.View>
          ))
        )}
      </Card>

      {/* ③ 工具区收拢：原来「专注计时」「新建任务」两张等权卡占首屏前两位，现合成一张紧凑卡 */}
      <Card variant="glass" title="快速开始" subtitle={`当日累计专注 ${totalFocus} 分钟`}>
        <View style={styles.toolRow}>
          <PressableScale style={[styles.toolBtn, styles.toolBtnPrimary]} scaleTo={0.97} onPress={() => setContentOpen(true)}>
            <Text style={styles.toolBtnTextPrimary}>⏱ 自由专注 · 选内容</Text>
          </PressableScale>
          <PressableScale style={[styles.toolBtn, styles.toolBtnGhost]} scaleTo={0.97} onPress={() => setNewTaskOpen(true)}>
            <Text style={styles.toolBtnTextGhost}>＋ 新建任务</Text>
          </PressableScale>
        </View>
        <Text style={styles.toolHint}>自由专注可先选「这次学什么」；倒计时可切正向秒表、可换背景；新建任务在弹层里输入</Text>
      </Card>

      {/* ④ 统计降权：整卡改玻璃，明细仍保留在这里 */}
      <Card variant="glass" title="专注打卡" subtitle={`${stats.date} · 分布图 / 时间轴`}>
        <View style={styles.statGrid}>
          {[
            { label: "累计专注", value: stats.totalFocusDays, suffix: "" },
            { label: "连续专注", value: stats.streak, suffix: "" },
            { label: "今日次数", value: stats.todaySessions, suffix: "" },
            { label: "今日时长", value: stats.todayMinutes, suffix: "′" },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <View style={styles.statValueRow}>
                {/* v19-M2：统计数字滚动（400ms），不再瞬间跳变 */}
                <AnimatedNumber value={s.value} style={styles.statValue} />
                {s.suffix ? <Text style={styles.statValue}>{s.suffix}</Text> : null}
              </View>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>近 14 天分布</Text>
        <View style={styles.barChart}>
          {stats.last14.map((d, i) => (
            <Animated.View
              key={d.date}
              style={styles.barCol}
              entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              layout={reduced ? undefined : LinearTransition}
            >
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(4, (d.minutes / maxMin) * 100)}%` }]} />
              </View>
              <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>今日时间轴</Text>
        {stats.todayList.length === 0 ? (
          <Text style={styles.empty}>今天还没有专注记录</Text>
        ) : (
          stats.todayList.map((s, i) => (
            <View key={i} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>{s.startTime} – {s.endTime}</Text>
              <Text style={styles.timelineMin}>{s.minutes} 分钟</Text>
            </View>
          ))
        )}

        <Text style={styles.quoteLine}>{FOCUS_MOTIVATIONS[Math.min(stats.streak, FOCUS_MOTIVATIONS.length - 1)]}</Text>
        <PressableScale style={styles.shareBtn} scaleTo={0.97} onPress={shareCard}>
          <Text style={styles.shareBtnText}>📤 分享打卡卡片</Text>
        </PressableScale>
      </Card>

      <FocusShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} data={focusShareDataFromStats(stats)} />

      <BottomSheet
        visible={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        title="新建任务"
        subtitle="写清楚今天要做什么，越具体越容易开始"
        icon="add-circle-outline"
        height="58%"
        footer={
          <SheetStickyCta
            label="添加任务"
            icon="checkmark"
            onPress={submit}
            disabled={!title.trim()}
          />
        }
        footerHint="任务会加到今天，可在首页直接勾选完成"
      >
        <SheetSection title="任务内容" hint="一句话就够，例如「把 Phase 5 读一遍」">
          <TextInput
            style={styles.input}
            placeholder="今天要学什么？"
            placeholderTextColor={colors.textFaint}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={submit}
            returnKeyType="done"
            autoFocus
          />
        </SheetSection>
        <SheetSection title="类型" last>
          <ChipGroup
            multiple={false}
            wrap
            options={TYPES.map((t) => ({ key: t, label: taskTypeLabels[t] }))}
            selected={[type]}
            onToggle={(k) => setType(k as TaskType)}
          />
        </SheetSection>
      </BottomSheet>

      <BottomSheet
        visible={contentOpen}
        onClose={() => setContentOpen(false)}
        title="自由专注"
        subtitle="先定这次学什么，再点底部按钮开始"
        icon="book-outline"
        height="78%"
        footer={
          <SheetStickyCta
            label={`开始倒计时 · ${contentLabelOf(content) ?? "自由专注"}`}
            icon="timer-outline"
            onPress={() => startFreeFocus("countdown")}
            secondaryLabel="正向计时（秒表）"
            onSecondary={() => startFreeFocus("stopwatch")}
          />
        }
        footerHint="返回或点空白只会关闭，不会开始计时"
        onClosed={() => {
          // 等选择弹层真正卸载后再开计时器（两个 Modal 同帧 present 会互相吞掉）
          if (!pendingStart) return;
          setTimerTask({ id: null, title: pendingStart.label ?? "自由专注" });
          setAutoTimer({ label: pendingStart.label, timerMode: pendingStart.timerMode });
          setPendingStart(null);
          setTimerSession((s) => s + 1);
          setTimerOpen(true);
        }}
      >
        <SheetSection title="这次学什么" hint="不指定就是自由专注" last>
          <ContentPicker value={content} onChange={setContent} />
        </SheetSection>
      </BottomSheet>

      <FocusTimer
        key={timerSession}
        open={timerOpen}
        task={timerTask}
        sessions={sessions}
        autoStart={!!autoTimer}
        initialTimerMode={autoTimer?.timerMode}
        contentLabel={autoTimer?.label ?? null}
        onClose={() => {
          setTimerOpen(false);
          setAutoTimer(null);
        }}
        onRecorded={(taskId, seconds, label) =>
          // 任务行 ▶ 进入的专注没有显式内容名 → 用任务标题兜底，避免统计里全是「未分类」
          addSession(taskId, seconds, label ?? (taskId ? (timerTask?.title ?? null) : null))
        }
      />
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  // 焦点 hero 内的"下一步"
  nextTitle: { ...typography.title2, fontWeight: "800", color: colors.text },
  nextMeta: { ...typography.caption, color: colors.textMuted, marginTop: -4 },
  // 今日任务进度条（v19-M2：填充宽度动画化，样式只保留轨道）
  progressTrack: { backgroundColor: colors.surfaceMuted, overflow: "hidden", marginBottom: 10 },
  // 工具区
  toolRow: { flexDirection: "row", gap: 8 },
  toolBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  toolBtnPrimary: { backgroundColor: colors.primary },
  toolBtnGhost: { backgroundColor: colors.surfaceMuted },
  toolBtnTextPrimary: { ...typography.callout, color: "#fff", fontWeight: "700" },
  toolBtnTextGhost: { ...typography.callout, color: colors.primary, fontWeight: "700" },
  toolHint: { ...typography.caption, color: colors.textMuted, marginTop: 8 },
  sheetBody: { gap: 12, paddingTop: 4 },
  ghostStartBtn: { backgroundColor: colors.surfaceMuted },
  ghostStartText: { color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { ...typography.callout, color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.callout,
    color: colors.text,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  typeChipActive: { backgroundColor: colors.primarySoft },
  typeChipText: { ...typography.caption, color: colors.textMuted },
  typeChipTextActive: { color: colors.primary, fontWeight: "600" },
  doneBanner: { backgroundColor: colors.successSoft, borderRadius: 12, padding: 10, marginBottom: 8 },
  doneBannerText: { ...typography.callout, color: colors.success, fontWeight: "600" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  // v19-M3：勾选框（描边画勾的容器）+ 完成态点亮
  taskBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  taskBoxDone: { backgroundColor: colors.success, borderColor: colors.success },
  taskTitle: {
    ...typography.headline,
    flex: 1,
    color: colors.text,
  },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.textSecondary },
  taskMeta: { ...typography.caption, color: colors.textMuted },
  taskFocus: { ...typography.caption, color: colors.primary },
  taskPlay: { fontSize: 14, color: colors.primary },
  empty: { ...typography.callout, color: colors.textSecondary, textAlign: "center", paddingVertical: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 },
  statBox: { width: "46%", backgroundColor: colors.accentSoft, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  statValueRow: { flexDirection: "row", alignItems: "flex-end" },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 3 },
  sectionLabel: { ...typography.caption, fontWeight: "700", color: colors.text, marginTop: 12, marginBottom: 8 },
  barChart: { flexDirection: "row", alignItems: "flex-end", height: 96, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: "hidden" },
  bar: { width: "100%", backgroundColor: colors.accent, borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, color: colors.textFaint },
  timelineRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  timelineTime: { ...typography.caption, color: colors.textMuted },
  timelineMin: { ...typography.caption, fontWeight: "700", color: colors.text },
  quoteLine: { ...typography.callout, color: colors.accentStrong, marginTop: 10 },
  shareBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  shareBtnText: { ...typography.callout, color: "#fff", fontWeight: "700" },
});
