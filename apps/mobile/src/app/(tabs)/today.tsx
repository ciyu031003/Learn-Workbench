import { RefreshControl, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { CelebrationBurst } from "@/components/celebration-burst";
import { CelebrationModal } from "@/components/celebration-modal";
import { QuickStartSheet } from "@/components/quick-start-sheet";
import { TodayDualCards } from "@/components/today/today-dual-cards";
import { TodayFocusHero } from "@/components/today/today-focus-hero";
import { TodayHabitTiles } from "@/components/today/today-habit-tiles";
import { TodayInsightSection } from "@/components/today/today-insight-section";
import { TodayNotificationsSheet } from "@/components/today/today-notifications-sheet";
import { TodayPageHead } from "@/components/today/today-page-head";
import { TodayQuickEntries } from "@/components/today/today-quick-entries";
import { TodayStatsStrip } from "@/components/today/today-stats-strip";
import { TodayTaskDetailSheet } from "@/components/today/today-task-detail-sheet";
import { TodayTasksSection } from "@/components/today/today-tasks-section";
import { SportSheet } from "@/components/today/today-widgets";
import { TodayContinueSection } from "@/components/today/today-continue-section";
import { TodayDaySummary } from "@/components/today/today-day-summary";
import { useTodayScreen } from "@/components/today/use-today-screen";
import { InlineNotice } from "@/components/states/inline-notice";
import { CollapsibleSection } from "@/components/v2/collapsible-section";
import { MoodPicker } from "@/components/v2/mood-picker";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import { useAppStore } from "@/store/app-store";

/**
 * 今日（移动端首页）。
 *
 * 纯组合层：取数 / 副作用 / 派生值在 components/today/use-today-screen.ts，
 * 样式表在 components/today/today-styles.ts，各区块组件在 components/today/ 下，
 * 本文件只负责把模型按原顺序摆到 ScrollView 与三个弹层里。
 */
export default function TodayScreen() {
  const {
    styles,
    headerTop,
    tabBarSpace,
    todayScrollRef,
    todayRefresh,
    reduced,
    motionActive,
    dateLabel,
    weekNo,
    greetLine,
    greetSub,
    avatarUri,
    avatarLetter,
    quote,
    heroTip,
    todayTasks,
    todayDone,
    learningSnapshot,
    streak,
    checkedInToday,
    checkinToday,
    habitRows,
    habitOnlyRows,
    habitOnlyDone,
    pendingHabits,
    toggleHabit,
    toggleTaskDone,
    fireBurst,
    maybeCelebratePlan,
    focusMinutesToday,
    focusH,
    focusM,
    focusGoalPercent,
    focusGoalLabel,
    dailyFocusGoalMinutes,
    weekFocusMinutes,
    weekFocusPercent,
    weekFocusHint,
    focusDeltaPercent,
    insightLead,
    last7Minutes,
    last7Labels,
    waterPercent,
    waterHint,
    energyLevel,
    energyBusy,
    pickEnergy,
    sportSheetOpen,
    setSportSheetOpen,
    notifOpen,
    setNotifOpen,
    detailTask,
    setDetailTask,
    quickOpen,
    setQuickOpen,
    pendingChoice,
    setPendingChoice,
    openFocus,
    openQuickStart,
    celebrationRequest,
    closeCelebration,
    burst,
    setBurst,
  } = useTodayScreen();

  /**
   * P1 状态体系：待同步条只在"确实有待发内容"时出现——
   * 避免冷启动瞬间 sync-engine 尚未拿到网络状态时误报"当前离线"。
   */
  const pendingCount = useAppStore((s) => s.pendingChanges.length);
  const syncStatus = useSyncEngineStatus();
  const retrySeconds = syncStatus.retryInMs ? Math.max(1, Math.round(syncStatus.retryInMs / 1000)) : null;
  const unfinishedTask = todayTasks.find((t) => !t.done) ?? null;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={todayScrollRef}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 页头：日期 · 周号 / 问候 / 一句话，右侧通知与头像 */}
        <TodayPageHead
          dateLabel={dateLabel}
          weekNo={weekNo}
          greetLine={greetLine}
          greetSub={greetSub}
          avatarUri={avatarUri}
          avatarLetter={avatarLetter}
          onOpenNotifications={() => setNotifOpen(true)}
        />

        {/* P1：离线 / 待同步统一轻条（只回答"我刚做的操作有没有保存"） */}
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

        {/* ② 今日专注 hero：大数字 / 环形目标 / 唯一主 CTA */}
        <TodayFocusHero
          focusMinutesToday={focusMinutesToday}
          focusH={focusH}
          focusM={focusM}
          focusGoalLabel={focusGoalLabel}
          dailyFocusGoalMinutes={dailyFocusGoalMinutes}
          focusGoalPercent={focusGoalPercent}
          onStartFocus={openQuickStart}
        />

        {/* ③ 三格数据：今日任务 / 今日刷题 / 连续打卡 */}
        <TodayStatsStrip
          todayTasks={todayTasks}
          todayDone={todayDone}
          questionsToday={learningSnapshot.questionsToday}
          streak={streak}
        />

        {/* ③ 刷题 / 阅读 / 训练三个既有入口（既有功能，保持原位置） */}
        <TodayQuickEntries onOpenSportSheet={() => setSportSheetOpen(true)} />

        {/* ④ 今日任务：时间轴式任务行（首屏最多 5 条） */}
        <TodayTasksSection
          todayTasks={todayTasks}
          todayDone={todayDone}
          pendingHabits={pendingHabits}
          reduced={reduced}
          onOpenTask={setDetailTask}
          onToggleTask={toggleTaskDone}
          fireBurst={fireBurst}
          maybeCelebratePlan={maybeCelebratePlan}
        />

        {/* ⑤ 继续上次：未完成任务 → 未学完阶段 → 直接专注（P1 新增） */}
        <TodayContinueSection
          unfinishedTask={unfinishedTask}
          stageDone={learningSnapshot.stageDone}
          stageTotal={learningSnapshot.stageTotal}
          onOpenTask={setDetailTask}
          onStartFocus={openQuickStart}
        />

        {/* ⑥ 成长摘要：双列小卡 + 今日习惯瓦片 */}
        <View style={styles.v3SecHead}>
          <Text style={styles.v3SecTitle}>成长摘要</Text>
        </View>
        {/* 双列小卡：本周专注 / 今日饮水 */}
        <TodayDualCards
          weekFocusPercent={weekFocusPercent}
          weekFocusHint={weekFocusHint}
          waterPercent={waterPercent}
          waterHint={waterHint}
        />

        {/* 今日习惯：3 列瓦片 */}
        <TodayHabitTiles
          habitRows={habitRows}
          habitOnlyRows={habitOnlyRows}
          habitOnlyDone={habitOnlyDone}
          todayDone={todayDone}
          pendingHabits={pendingHabits}
          onToggleHabit={toggleHabit}
          fireBurst={fireBurst}
          maybeCelebratePlan={maybeCelebratePlan}
        />

        {/* ⑦ 洞察（折叠）：默认收起；展开后才挂载图表/精力/建议，首屏不渲染 */}
        <CollapsibleSection title="洞察" meta={weekFocusHint}>
          <TodayInsightSection
            insightLead={insightLead}
            focusDeltaPercent={focusDeltaPercent}
            weekFocusMinutes={weekFocusMinutes}
            last7Minutes={last7Minutes}
            last7Labels={last7Labels}
            onStartFocus={openQuickStart}
          />

          {/* 今天的状态：精力记录（保留既有 /api/wellbeing/energy 链路） */}
          <MoodPicker value={energyLevel} onSelect={(l) => void pickEnergy(l)} busy={energyBusy} />

          {/* 今日建议：AI 可用时用 AI，否则规则版 */}
          <View style={styles.v3Tip}>
            <View style={styles.v3TipDot} />
            <Text style={styles.v3TipText} numberOfLines={2}>{heroTip}</Text>
          </View>
        </CollapsibleSection>

        {/* ⑧ 日终总结（折叠）：今日完成 / 专注分钟 / 连续天数 + 写复盘入口 */}
        <CollapsibleSection
          title="日终总结"
          meta={todayTasks.length > 0 ? todayDone + "/" + todayTasks.length + " 完成" : "今天还没有任务"}
        >
          <TodayDaySummary
            doneCount={todayDone}
            taskCount={todayTasks.length}
            focusMinutes={focusMinutesToday}
            streakDays={streak}
          />
        </CollapsibleSection>

        <Text style={styles.quoteFoot} numberOfLines={2}>{quote}</Text>
      </Animated.ScrollView>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} motionActive={motionActive} />
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
