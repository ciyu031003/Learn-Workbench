import { RefreshControl, ScrollView, Text } from "react-native";
import { ScreenBlurTarget } from "@/components/screen-blur-target";
import { PageWash } from "@/components/demo/page-wash";
import Animated from "react-native-reanimated";

import { LearnCabinHero } from "@/components/learn/learn-hero";
import { LearnChapterRail } from "@/components/learn/learn-chapter-rail";
import { LearnRhythm } from "@/components/learn/learn-rhythm";
import { LearnAwardRail } from "@/components/learn/learn-award-rail";
import { LearnShelfActions } from "@/components/learn/learn-shelf";
import { LearnToolsSection } from "@/components/learn/learn-tools-section";
import {
  LearnCustomPhaseSheet,
  LearnCustomTopicSheet,
  LearnMdSheet,
  LearnTopicModal,
} from "@/components/learn/learn-sheets";
import { useLearnScreen } from "@/components/learn/use-learn-screen";

/**
 * 学习（移动端 hub）· v7 学习舱。
 *
 * 纯组合层：取数 / 副作用 / 派生值在 components/learn/use-learn-screen.ts，
 * 样式表在 components/learn/learn-styles.ts，各区块组件在 components/learn/ 下。
 * 本文件按 demo 的学习 section 摆五块：
 *   ① 学习舱头部（eyebrow + 两行标题 + 84 环形进度 + 说明 + chips + 通栏 CTA）
 *   ② 章节树（垂直轨道：当前阶段主题，完成绿 / 在读蓝 + 光晕 / 未开始灰）
 *   ③ 学习节律（近 7 天柱状条 + 星期标签 + 学习成果数字一行）
 *   ④ 学习成就（3 张金属卡横向轨道）
 *   ⑤ 学习工具（今日主线 + 2×3 竖式大卡：复习 / 题库 / 408 / 统计 / 阶段路线 / 材料阅读）
 *   ⑥ 底部引言
 * 章节管理（新建/编辑/删除阶段 · 新增主题 · 导入 MD）收敛成章节树下的一行管理条，
 * 沿用既有四个弹层；安全区仍由页面模型统一提供（headerTop / tabBarSpace）。
 */
export default function LearnScreen() {
  const {
    styles,
    headerTop,
    tabBarSpace,
    learnScrollRef,
    learnRefresh,
    entrance,
    /* ① 学习舱头部 */
    cabin,
    /* ② 章节树 */
    chapterNodes,
    chapterMeta,
    /* ③ 学习节律 */
    last7Minutes,
    rhythmLabels,
    weekTotal,
    avgDailyMinutes,
    streak,
    /* ④ 学习工具 */
    reviewStats,
    learningSummary,
    questionCount,
    exam408ChapterCount,
    exam408PointCount,
    practiceAccuracy,
    /* 章节管理（沿用既有弹层） */
    roadmapLoading,
    selectedPhase,
    openCreatePhase,
    openImportMd,
    openEditPhase,
    removePhase,
    /* 弹层状态 */
    customTopicSheet,
    setCustomTopicSheet,
    customTopicTitle,
    setCustomTopicTitle,
    customTopicSummary,
    setCustomTopicSummary,
    submitCustomTopic,
    customPhaseSheet,
    setCustomPhaseSheet,
    editingPhase,
    customPhaseTitle,
    setCustomPhaseTitle,
    customPhaseSummary,
    setCustomPhaseSummary,
    submitCustomPhase,
    mdSheet,
    setMdSheet,
    mdText,
    setMdText,
    setMdPreview,
    setMdMsg,
    mdPreview,
    mdBusy,
    mdMsg,
    previewMd,
    confirmMd,
    contentTopic,
    setContentTopic,
    activeTopic,
    removeCustomTopic,
  } = useLearnScreen();

  return (
    <ScreenBlurTarget>
      <PageWash tone="learn" />
      <ScrollView
      ref={learnScrollRef}
      refreshControl={<RefreshControl {...learnRefresh} />}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ① 学习舱头部 */}
      <Animated.View entering={entrance(0)}>
        <LearnCabinHero cabin={cabin} />
      </Animated.View>

      {/* ② 章节树 + 管理条 */}
      <Animated.View entering={entrance(1)}>
        <LearnChapterRail nodes={chapterNodes} meta={chapterMeta} />
        <LearnShelfActions
          canManage={Boolean(selectedPhase)}
          onCreatePhase={openCreatePhase}
          onEditPhase={() => {
            if (selectedPhase) openEditPhase(selectedPhase);
          }}
          onDeletePhase={() => {
            if (selectedPhase) removePhase(selectedPhase);
          }}
          onAddTopic={() => setCustomTopicSheet(true)}
          onImportMd={openImportMd}
        />
      </Animated.View>

      {/* ③ 学习节律（近 7 天柱状条 + 学习成果数字） */}
      <Animated.View entering={entrance(2)}>
        <LearnRhythm
          minutes={last7Minutes}
          labels={rhythmLabels}
          weekTotal={weekTotal}
          avgDailyMinutes={avgDailyMinutes}
          streak={streak}
        />
      </Animated.View>

      {/* ④ 学习成就（金属卡轨） */}
      <Animated.View entering={entrance(3)}>
        <LearnAwardRail
          streak={streak}
          phaseDone={cabin.ring.done}
          phaseTotal={cabin.ring.total}
          phasePercent={cabin.ring.percent}
          exam408PointCount={exam408PointCount}
        />
      </Animated.View>

      {/* ⑤ 学习工具（今日主线 + 2×3 大卡） */}
      <Animated.View entering={entrance(4)}>
        <LearnToolsSection
          reviewStats={reviewStats}
          learningSummary={learningSummary}
          questionCount={questionCount}
          exam408ChapterCount={exam408ChapterCount}
          exam408PointCount={exam408PointCount}
          practiceAccuracy={practiceAccuracy}
          phaseWeeks={cabin.weeksChip}
          topicCount={cabin.ring.total}
          phasePercent={cabin.ring.percent}
        />
      </Animated.View>

      {/* ⑥ 底部引言（纯装饰文案） */}
      <Text style={styles.quote}>把今天的动作，记成明天的底气。</Text>

      <LearnCustomTopicSheet
        customTopicSheet={customTopicSheet}
        setCustomTopicSheet={setCustomTopicSheet}
        selectedPhase={selectedPhase}
        customTopicTitle={customTopicTitle}
        setCustomTopicTitle={setCustomTopicTitle}
        customTopicSummary={customTopicSummary}
        setCustomTopicSummary={setCustomTopicSummary}
        submitCustomTopic={submitCustomTopic}
      />

      <LearnCustomPhaseSheet
        customPhaseSheet={customPhaseSheet}
        setCustomPhaseSheet={setCustomPhaseSheet}
        editingPhase={editingPhase}
        customPhaseTitle={customPhaseTitle}
        setCustomPhaseTitle={setCustomPhaseTitle}
        customPhaseSummary={customPhaseSummary}
        setCustomPhaseSummary={setCustomPhaseSummary}
        roadmapLoading={roadmapLoading}
        submitCustomPhase={submitCustomPhase}
      />

      {/* 粘贴 Markdown → 预览 → 导入（服务端解析 + 事务写入） */}
      <LearnMdSheet
        mdSheet={mdSheet}
        setMdSheet={setMdSheet}
        mdBusy={mdBusy}
        mdPreview={mdPreview}
        mdText={mdText}
        setMdText={setMdText}
        setMdPreview={setMdPreview}
        setMdMsg={setMdMsg}
        mdMsg={mdMsg}
        previewMd={previewMd}
        confirmMd={confirmMd}
      />

      <LearnTopicModal
        activeTopic={activeTopic}
        contentTopic={contentTopic}
        setContentTopic={setContentTopic}
        removeCustomTopic={removeCustomTopic}
      />
      </ScrollView>
    </ScreenBlurTarget>
  );
}

/** V7 上线护栏：本屏渲染异常时只兜住这一屏，不让整个 App 闪退。 */
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";
