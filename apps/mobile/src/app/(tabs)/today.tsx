import { useMemo } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated from "react-native-reanimated";
import { CelebrationBurst } from "@/components/celebration-burst";
import { CelebrationModal } from "@/components/celebration-modal";
import { QuickStartSheet } from "@/components/quick-start-sheet";
import { InlineNotice } from "@/components/states/inline-notice";
import { TodayContinueLine } from "@/components/today/today-continue-line";
import { TodayDayArc } from "@/components/today/today-day-arc";
import { TodayDayHead } from "@/components/today/today-day-head";
import { TodayHabitLine } from "@/components/today/today-habit-line";
import { TodayNightReview } from "@/components/today/today-night-review";
import { TodayNotificationsSheet } from "@/components/today/today-notifications-sheet";
import { TodayOneLine } from "@/components/today/today-one-line";
import { TodayTaskDetailSheet } from "@/components/today/today-task-detail-sheet";
import { TodayThreeThings } from "@/components/today/today-three-things";
import { useTodayScreen } from "@/components/today/use-today-screen";
import { haptics } from "@/lib/haptics";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { typography } from "@/theme/tokens";

/**
 * 今日（V7 · Day Sheet）。
 *
 * 从「仪表盘」改成一页日程：大日期抬头 → 时间弧 + 唯一主 CTA → 只做三件事 →
 * 今日一句 → 继续上次 → 今日习惯（紧凑一行）→ 夜间回顾占位。
 * 旧的 stats 三卡 / 快捷入口 / hero 大卡 / 成长摘要双卡已下线（demo 不再使用）。
 *
 * 取数 / 副作用 / 派生值仍在 components/today/use-today-screen.ts，
 * 本文件只做组合与弹层挂载；真实交互（任务勾选、习惯打卡、专注入口、通知）全部保留。
 */
export default function TodayScreen() {
  const {
    styles,
    headerTop,
    tabBarSpace,
    todayScrollRef,
    todayRefresh,
    reduced,
    quote,
    // Day Sheet 抬头 / 时间弧
    dateNum,
    monthLabel,
    weekdayLabel,
    weekNo,
    nowLabel,
    nowProgress,
    greetFirst,
    greetHeadline,
    focusDots,
    focusTodayLabel,
    taskRatioLabel,
    streak,
    // 三件事
    todayTasks,
    todayDone,
    pendingHabits,
    toggleTaskDone,
    // 继续上次 / 习惯
    learningSnapshot,
    habitOnlyRows,
    toggleHabit,
    // 庆祝反馈
    fireBurst,
    maybeCelebratePlan,
    // 通知弹层用的既有口径（专注分钟 / 目标 / 今日打卡）
    focusMinutesToday,
    focusGoalLabel,
    dailyFocusGoalMinutes,
    checkedInToday,
    checkinToday,
    // 弹层与专注入口
    quickOpen,
    setQuickOpen,
    pendingChoice,
    setPendingChoice,
    openFocus,
    openQuickStart,
    notifOpen,
    setNotifOpen,
    detailTask,
    setDetailTask,
    celebrationRequest,
    closeCelebration,
    burst,
    setBurst,
  } = useTodayScreen();
  const { colors } = useTheme();
  const pageStyles = useMemo(
    () =>
      StyleSheet.create({
        /** 区块之间的发丝线：Day Sheet 用横线分段，而不是堆卡片 */
        rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 2 },
        /** 复盘入口：/logs 此前只有日终总结卡进得去，卡下线后这里补一条细链接 */
        reviewLink: { alignSelf: "center", paddingVertical: 2 },
        reviewLinkText: { ...typography.meta, fontWeight: "600", color: colors.primary },
      }),
    [colors]
  );

  /**
   * P1 状态体系：待同步条只在「确实有待发内容」时出现——
   * 避免冷启动瞬间 sync-engine 尚未拿到网络状态时误报「当前离线」。
   */
  const pendingCount = useAppStore((s) => s.pendingChanges.length);
  const syncStatus = useSyncEngineStatus();
  const retrySeconds = syncStatus.retryInMs ? Math.max(1, Math.round(syncStatus.retryInMs / 1000)) : null;
  const unfinishedTask = todayTasks.find((t) => !t.done) ?? null;
  /** 任务页是「三件事」的唯一收口：调整 / 空态 / 已加满 小字都跳这里 */
  const openTasks = () => router.push("/tasks" as never);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={todayScrollRef}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Day Sheet 抬头：21 / NOV / 周六 + 第 47 周 · 09:41 + 两行大标题 */}
        <TodayDayHead
          dateNum={dateNum}
          monthLabel={monthLabel}
          weekdayLabel={weekdayLabel}
          weekNo={weekNo}
          nowLabel={nowLabel}
          greetFirst={greetFirst}
          greetHeadline={greetHeadline}
          onOpenNotifications={() => setNotifOpen(true)}
        />

        {/* P1：离线 / 待同步统一轻条（只回答「我刚做的操作有没有保存」） */}
        {pendingCount > 0 ? (
          <InlineNotice
            variant={syncStatus.online ? "pending" : "offline"}
            message={
              syncStatus.online
                ? "已保存，" + pendingCount + " 条待同步"
                : "当前离线，已保存 " + pendingCount + " 条待联网同步"
            }
            detail={
              syncStatus.online
                ? retrySeconds
                  ? "上次同步失败，" + retrySeconds + " 秒后自动重试"
                  : "联网后自动同步，不影响继续使用"
                : "本地内容照常可看，不影响继续使用"
            }
            style={styles.noticeGap}
          />
        ) : null}

        {/* 时间弧 + 三格数字 + 唯一主 CTA */}
        <TodayDayArc
          dots={focusDots}
          nowProgress={nowProgress}
          nowLabel={nowLabel}
          focusLabel={focusTodayLabel}
          taskRatio={taskRatioLabel}
          streak={streak}
          reduced={reduced}
          onStartFocus={openQuickStart}
        />

        <View style={pageStyles.rule} />

        {/* 01 今天只做三件事（整行勾选，保留庆祝反馈） */}
        <TodayThreeThings
          tasks={todayTasks}
          todayDone={todayDone}
          pendingHabits={pendingHabits}
          reduced={reduced}
          onToggleTask={toggleTaskDone}
          fireBurst={fireBurst}
          maybeCelebratePlan={maybeCelebratePlan}
          onManage={openTasks}
        />

        <View style={pageStyles.rule} />

        {/* 02 今日一句（点一下轮换） */}
        <TodayOneLine />

        <View style={pageStyles.rule} />

        {/* 03 继续上次（未完成任务优先，否则回到没学完的知识点） */}
        <TodayContinueLine
          unfinishedTask={unfinishedTask}
          stageDone={learningSnapshot.stageDone}
          stageTotal={learningSnapshot.stageTotal}
          onOpenTask={setDetailTask}
        />

        {/* 今日习惯：紧凑一行标签，替代旧的三列瓦片 */}
        <TodayHabitLine habits={habitOnlyRows} onToggleHabit={toggleHabit} />

        {/* 夜间回顾占位（21:00 解锁） */}
        <TodayNightReview />

        {/* 复盘入口：改版前藏在「日终总结」折叠卡里，下线后保留一条细链接，避免 /logs 变成孤岛 */}
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptics.light();
            router.push("/logs" as never);
          }}
          style={pageStyles.reviewLink}
          accessibilityRole="button"
          accessibilityLabel="写今日复盘，打开学习记录"
        >
          <Text style={pageStyles.reviewLinkText}>写今日复盘 →</Text>
        </Pressable>

        <Text style={styles.quoteFoot} numberOfLines={2}>
          {quote}
        </Text>
      </Animated.ScrollView>

      <QuickStartSheet
        visible={quickOpen}
        oneScreen
        onClose={() => setQuickOpen(false)}
        onPick={(choice) => {
          setPendingChoice(choice);
        }}
        onClosed={() => {
          const choice = pendingChoice;
          if (!choice) return;
          setPendingChoice(null);
          openFocus({
            task: {
              id: null,
              title:
                choice.contentLabel ??
                (choice.kind === "exercise" ? choice.sportName ?? "运动" : "自由专注"),
            },
            autoStart: true,
            initialTimerMode: choice.timerMode,
            initialMinutes: choice.minutes,
            mode: choice.kind === "exercise" ? "exercise" : "focus",
            exerciseLabel: choice.sportName ?? null,
            contentLabel: choice.kind === "focus" ? choice.contentLabel ?? null : null,
            sportKey: choice.sportKey ?? null,
          });
        }}
      />
      <CelebrationModal
        visible={!!celebrationRequest}
        onClose={closeCelebration}
        title={celebrationRequest?.title ?? ""}
        subtitle={celebrationRequest?.subtitle}
        badge={celebrationRequest?.badge}
        kicker={celebrationRequest?.kicker}
        buttonText={celebrationRequest?.buttonText}
        tone={celebrationRequest?.tone}
      />
      <CelebrationBurst
        visible={!!burst}
        kicker={burst?.kicker}
        title={burst?.title ?? ""}
        subtitle={burst?.subtitle}
        onDone={() => setBurst(null)}
      />
      <TodayTaskDetailSheet
        detailTask={detailTask}
        onClose={() => setDetailTask(null)}
        onToggleTask={toggleTaskDone}
        fireBurst={fireBurst}
        maybeCelebratePlan={maybeCelebratePlan}
        todayDone={todayDone}
        pendingHabits={pendingHabits}
      />
      <TodayNotificationsSheet
        notifOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        todayTasks={todayTasks}
        todayDone={todayDone}
        focusMinutesToday={focusMinutesToday}
        focusGoalLabel={focusGoalLabel}
        dailyFocusGoalMinutes={dailyFocusGoalMinutes}
        checkedInToday={checkedInToday}
        checkinToday={checkinToday}
        streak={streak}
      />
    </View>
  );
}

/** V7 上线护栏：本屏渲染异常时只兜住这一屏，不让整个 App 闪退。 */
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";
