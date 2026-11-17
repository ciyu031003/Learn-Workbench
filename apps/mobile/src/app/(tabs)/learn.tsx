import { RefreshControl, ScrollView, Text } from "react-native";
import Animated from "react-native-reanimated";

import { ListGroup, ListRow } from "@/components/list-row";
import { LearnHero } from "@/components/learn/learn-hero";
import { LearnInsight } from "@/components/learn/learn-insight";
import { LearnPageHead } from "@/components/learn/learn-page-head";
import { LearnShelf } from "@/components/learn/learn-shelf";
import { LearnToolsSection } from "@/components/learn/learn-tools-section";
import { SectionTitle } from "@/components/v2/section-title";
import {
  LearnCustomPhaseSheet,
  LearnCustomTopicSheet,
  LearnMdSheet,
  LearnTopicModal,
} from "@/components/learn/learn-sheets";
import { useLearnScreen } from "@/components/learn/use-learn-screen";

/**
 * 学习（移动端 hub）。
 *
 * 纯组合层：取数 / 副作用 / 派生值在 components/learn/use-learn-screen.ts，
 * 样式表在 components/learn/learn-styles.ts，各区块组件在 components/learn/ 下。
 * 本文件只负责把页面模型按三层结构摆进 ScrollView 与四个弹层（P2）：
 * ① 页头 → ② 当前学习（hero）→ ③ 学习工具（4 工具 2×2）→ ④ 学习成果（洞察 + 练习记录 + 学习架折叠）→ 弹层。
 * 入场错峰编号 0 / 1 / 3 / 4（3 与 4 之间沿用历史空位，保持既有动画节奏）。
 * 安全区仍在页面这一层生效：headerTop / tabBarSpace 由页面模型统一提供（取值 hook 在 use-learn-screen.ts）。
 */
export default function LearnScreen() {
  const {
    styles,
    headerTop,
    tabBarSpace,
    learnScrollRef,
    learnRefresh,
    motionActive,
    entrance,
    stageDragging,
    /* ① 页头 */
    headSub,
    /* ② 学习 hero */
    roadmapLoading,
    roadmap,
    currentPhaseNumber,
    stageName,
    routeSummary,
    currentPhasePercent,
    continueCard,
    /* ④ 数据洞察 */
    weekTotal,
    todayMinutes,
    insightDeltaText,
    focusDelta,
    focusDeltaPercent,
    last7Minutes,
    last7Labels,
    avgDailyMinutes,
    streak,
    /* ⑤ 复习与题库 */
    reviewStats,
    learningSummary,
    questionCount,
    exam408ChapterCount,
    exam408PointCount,
    practiceAccuracy,
    /* ⑥ 学习架（默认折叠） */
    shelfOpen,
    setShelfOpen,
    selectedPhase,
    selectedPhaseId,
    phaseDone,
    swapPhase,
    removePhase,
    openEditPhase,
    stageDragIndex,
    stageDragTarget,
    stageDragY,
    stageHeights,
    measureStage,
    onStageDragChange,
    /* 弹层 */
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
    setEditingPhase,
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
    <ScrollView
      ref={learnScrollRef}
      refreshControl={<RefreshControl {...learnRefresh} />}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!stageDragging}
    >
      {/* ① 页头：eyebrow + 主标题 + 副文案；右上保留「阶段路线 / 全局搜索」两个入口 */}
      <Animated.View style={styles.headRow} entering={entrance(0)}>
        <LearnPageHead headSub={headSub} />
      </Animated.View>

      {/* ② 学习 hero（对齐 demo .spotlight）：阶段 chip + 路线名 + 进度 + 继续学习 + 唯一主 CTA */}
      <Animated.View entering={entrance(1)}>
        <LearnHero
          roadmapLoading={roadmapLoading}
          roadmap={roadmap}
          currentPhaseNumber={currentPhaseNumber}
          stageName={stageName}
          routeSummary={routeSummary}
          currentPhasePercent={currentPhasePercent}
          continueCard={continueCard}
        />
      </Animated.View>

      {/* ③ 学习工具：4 个带真实数字的工具卡（待复习 / 题库 / 错题 / 408） */}
      <Animated.View entering={entrance(3)}>
        <LearnToolsSection
          reviewStats={reviewStats}
          learningSummary={learningSummary}
          questionCount={questionCount}
          exam408ChapterCount={exam408ChapterCount}
          exam408PointCount={exam408PointCount}
          practiceAccuracy={practiceAccuracy}
        />
      </Animated.View>

      {/* ④ 学习成果：数据洞察 + 练习记录 + 学习架（默认折叠） */}
      <Animated.View entering={entrance(4)} style={styles.shelfWrap}>
        <SectionTitle
          title="学习成果"
          right={<Text style={styles.sectionMeta}>近 7 天</Text>}
          style={styles.sectionTitle}
        />
        <LearnInsight
          weekTotal={weekTotal}
          todayMinutes={todayMinutes}
          insightDeltaText={insightDeltaText}
          focusDelta={focusDelta}
          focusDeltaPercent={focusDeltaPercent}
          last7Minutes={last7Minutes}
          last7Labels={last7Labels}
          avgDailyMinutes={avgDailyMinutes}
          routeSummary={routeSummary}
          streak={streak}
        />

        {/* 练习记录：沿用原「复习与题库」里的信息行（无独立页面，只做展示） */}
        <ListGroup style={styles.questionList}>
          <ListRow
            icon="stats-chart-outline"
            title="练习记录"
            subtitle={
              learningSummary.attempted > 0
                ? "累计 " + learningSummary.attempted + " 题 · 错题 " + learningSummary.wrong + " 道"
                : "还没有作答记录，去题库练一组"
            }
            value={practiceAccuracy === null ? "—" : "正确率 " + practiceAccuracy + "%"}
            last
          />
        </ListGroup>

        {/* 学习架与管理入口：默认收起为折叠条，展开后保留原列表 */}
        <LearnShelf
          shelfOpen={shelfOpen}
          setShelfOpen={setShelfOpen}
          routeSummary={routeSummary}
          roadmap={roadmap}
          roadmapLoading={roadmapLoading}
          selectedPhase={selectedPhase}
          selectedPhaseId={selectedPhaseId}
          phaseDone={phaseDone}
          swapPhase={swapPhase}
          removePhase={removePhase}
          openEditPhase={openEditPhase}
          stageDragIndex={stageDragIndex}
          stageDragTarget={stageDragTarget}
          stageDragY={stageDragY}
          stageHeights={stageHeights}
          measureStage={measureStage}
          onStageDragChange={onStageDragChange}
          motionActive={motionActive}
          setMdText={setMdText}
          setMdPreview={setMdPreview}
          setMdMsg={setMdMsg}
          setMdSheet={setMdSheet}
          setEditingPhase={setEditingPhase}
          setCustomPhaseTitle={setCustomPhaseTitle}
          setCustomPhaseSummary={setCustomPhaseSummary}
          setCustomPhaseSheet={setCustomPhaseSheet}
          setCustomTopicSheet={setCustomTopicSheet}
        />
      </Animated.View>

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

      {/* v6 P3-2：粘贴 Markdown → 预览 → 导入（服务端解析 + 事务写入） */}
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
  );
}
