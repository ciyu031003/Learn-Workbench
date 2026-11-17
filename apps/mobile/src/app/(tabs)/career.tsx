import { RefreshControl, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";

import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { CareerDecisionCards } from "@/components/career/career-decision-cards";
import { CareerHero } from "@/components/career/career-hero";
import { CareerPageHead } from "@/components/career/career-page-head";
import { CareerRadarChart } from "@/components/career/career-radar-chart";
import { CareerReadiness } from "@/components/career/career-readiness";
import { CareerRowsList } from "@/components/career/career-rows";
import { CareerSkills } from "@/components/career/career-skills";
import { useCareerScreen } from "@/components/career/use-career-screen";
import { InlineToast, TOAST_DEFAULT_LIFE_MS } from "@/components/toast";
import { SectionTitle } from "@/components/v2/section-title";

/**
 * 职业 Hub：只做统计与入口，岗位列表统一回到「招花」。
 *
 * 纯组合层：取数 / 副作用 / 派生值在 components/career/use-career-screen.ts，
 * 纯数据构造在 components/career/career-model.ts，样式表在 components/career/career-styles.ts，
 * 各区块组件在 components/career/ 下。本文件只负责把页面模型按原顺序摆进 ScrollView：
 * 页头简报 → 岗位 hero → 下一步（决策区）→ 求职准备（准备度 + 漏斗）→ 能力雷达
 * → 求职工具 → 更多入口 → 分析工具（仅参考）→ 我的技能 → 结果提示。
 *
 * 入场错峰编号 0 / 1 / 2 / 3 / 4 / 5 / 6（技能区沿用 6 的历史编号，保持既有动画节奏）。
 * 数据全部来自既有接口，缺失时显示「—」，不估算。
 */
export default function CareerScreen() {
  const {
    styles,
    headerScroll,
    headerTop,
    tabBarSpace,
    careerScrollRef,
    careerRefresh,
    entrance,
    /* 页头 + hero */
    subtitle,
    hasTarget,
    todayCount,
    highMatchCount,
    /* 下一步（决策区） */
    gapSkills,
    gapHoursTotal,
    gapSkillNames,
    deadlines,
    gapEnrolling,
    handleEnrollGaps,
    /* 求职准备 */
    hasReadiness,
    showSkeleton,
    targetRole,
    overall,
    goalVerdict,
    dimensions,
    weakestScore,
    weakestChip,
    weakStrong,
    weakSoft,
    showFunnel,
    activeApplications,
    submittedCount,
    funnelStages,
    /* 行列表 */
    prepRows,
    moreRows,
    analysisRows,
    /* 我的技能 + 待补技能 */
    skills,
    gapSkillItems,
    /* 结果提示 */
    toast,
    setToast,
  } = useCareerScreen();

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="职业" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={careerScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...careerRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <CareerPageHead subtitle={subtitle} />

        <Animated.View entering={entrance(0)}>
          <CareerHero hasTarget={hasTarget} todayCount={todayCount} highMatchCount={highMatchCount} />
        </Animated.View>

        {/* P3 决策区：匹配方向 / 技能差距（可一键生成学习任务）/ 即将截止 */}
        <Animated.View entering={entrance(1)}>
          <SectionTitle
            title="下一步"
            right={<Text style={styles.sectionMeta}>{hasTarget ? "按你的目标方向" : "先设置目标方向"}</Text>}
            style={styles.section}
          />
          <CareerDecisionCards
            hasTarget={hasTarget}
            matchedCount={highMatchCount}
            readinessPercent={overall}
            gapCount={gapSkills}
            gapHours={gapHoursTotal}
            gapSkills={gapSkillNames}
            deadlines={deadlines}
            enrolling={gapEnrolling}
            onOpenRadar={() => router.push("/radar" as never)}
            onEnrollGaps={() => void handleEnrollGaps()}
          />
        </Animated.View>

        <SectionTitle
          title="求职准备"
          right={<Text style={styles.sectionMeta}>{hasReadiness ? "准备度 " + overall + "%" : "准备度 —"}</Text>}
          style={styles.section}
        />
        <Animated.View entering={entrance(2)}>
          <CareerReadiness
            showSkeleton={showSkeleton}
            targetRole={targetRole}
            overall={overall}
            goalVerdict={goalVerdict}
            weakestScore={weakestScore}
            weakestChip={weakestChip}
            weakStrong={weakStrong}
            weakSoft={weakSoft}
            dimensions={dimensions}
            showFunnel={showFunnel}
            activeApplications={activeApplications}
            submittedCount={submittedCount}
            funnelStages={funnelStages}
          />
        </Animated.View>

        {hasTarget ? (
          <Animated.View entering={entrance(3)}>
            <CareerRadarChart dimensions={dimensions} overall={overall} />
          </Animated.View>
        ) : null}

        <Animated.View entering={entrance(4)}>
          <CareerRowsList rows={prepRows} />
        </Animated.View>

        <SectionTitle title="更多入口" style={styles.section} />
        <Animated.View entering={entrance(5)}>
          <CareerRowsList rows={moreRows} />
        </Animated.View>

        <SectionTitle title="分析工具（仅参考）" style={styles.section} />
        <Animated.View entering={entrance(6)}>
          <CareerRowsList rows={analysisRows} />
        </Animated.View>

        {skills.length > 0 ? (
          <>
            <SectionTitle
              title="我的技能"
              right={<Text style={styles.sectionMeta}>{skills.length + " 项" + (gapSkills > 0 ? " · 待补 " + gapSkills : " · 已覆盖")}</Text>}
              style={styles.section}
            />
            <Animated.View entering={entrance(6)}>
              <CareerSkills skills={skills} gapSkills={gapSkills} gapSkillItems={gapSkillItems} />
            </Animated.View>
          </>
        ) : null}

        {/* P3：技能差距 → 学习任务的结果提示（2200ms 自动消失，可手动关闭） */}
        {toast ? (
          <InlineToast
            message={toast.message}
            kind={toast.kind}
            lifeMs={TOAST_DEFAULT_LIFE_MS}
            onClose={() => setToast(null)}
            style={styles.toast}
          />
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}
