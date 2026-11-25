import { useMemo } from "react";
import { RefreshControl, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";

import { CareerDecisionLog } from "@/components/career/career-decision-log";
import { makeStyles } from "@/components/career/career-styles";
import { CareerDecisionMatrix } from "@/components/career/career-decision-matrix";
import { CareerFunnel } from "@/components/career/career-funnel";
import { CareerGapBars } from "@/components/career/career-gap-bars";
import { CareerNorthStar } from "@/components/career/career-north-star";
import { CareerWeekActions } from "@/components/career/career-week-actions";
import { useCareerScreen } from "@/components/career/use-career-screen";
import { PressableScale } from "@/components/pressable-scale";
import { InlineToast, TOAST_DEFAULT_LIFE_MS } from "@/components/toast";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";

/**
 * 职业 · 个人职业决策工作台（V7）。
 *
 * 对齐 prototype/learn-workbench-mobile-demo-v7.html 的「职业：决策工作台」：
 * ① 目标方向卡（暖橙渐变 + 大号匹配度 + 三条细进度条）
 * ② 岗位决策矩阵（表格：岗位 / 匹配 / 薪资 / 成长 / 截止，点行进岗位详情）
 * ③ 技能缺口（3 条进度条 + 「把 N 个缺口生成学习任务」）
 * ④ 投递漏斗（收藏 / 已投 / 笔试 / 面试 / Offer + 转化率）
 * ⑤ 本周行动（3 条可勾选清单）
 * ⑥ 决策日志（左侧日期 + 一句话）
 * ⑦ 底部「分析工具（仅参考）」入口（跳 /market）
 *
 * 纯组合层：取数 / 副作用 / 派生在 use-career-screen.ts，
 * 纯数据构造在 career-model.ts，样式在 career-styles.ts，区块组件在 components/career/ 下。
 * 入场错峰编号 0–6，与既有 tab 页节奏一致。
 */
export default function CareerScreen() {
  const {
    styles,
    headerTop,
    tabBarSpace,
    careerScrollRef,
    careerRefresh,
    entrance,
    direction,
    decisionRows,
    matrixMeta,
    gapBars,
    gapMeta,
    gapEnrolling,
    handleGenerateGaps,
    funnelRows,
    hasApplications,
    funnelMeta,
    weekActions,
    decisionLog,
    toast,
    setToast,
  } = useCareerScreen();

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={careerScrollRef}
        refreshControl={<RefreshControl {...careerRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 目标方向：画像派生标题 + 匹配度 + 技能命中 / 薪资 / 城市三条细进度条 */}
        <Animated.View entering={entrance(0)}>
          <CareerNorthStar direction={direction} />
        </Animated.View>

        {/* ② 岗位决策矩阵：radar.top 前 4 个，表格式（不是卡片流） */}
        <SectionTitle
          title="岗位决策矩阵"
          right={<Text style={styles.sectionMeta}>{matrixMeta}</Text>}
          actionLabel="卡片浏览"
          onAction={() => router.push("/job-deck" as never)}
          style={styles.section}
        />
        <Animated.View entering={entrance(1)}>
          <CareerDecisionMatrix rows={decisionRows} />
        </Animated.View>

        {/* ③ 技能缺口：level<3 的前 3 条 + 一键生成学习任务（唯一写操作） */}
        <SectionTitle title="技能缺口" right={<Text style={styles.sectionMeta}>{gapMeta}</Text>} style={styles.section} />
        <Animated.View entering={entrance(2)}>
          {/* CTA 上的 N 与列出的条数一致（3 条）；总缺口数在区块标题右侧 */}
          <CareerGapBars bars={gapBars} count={gapBars.length} enrolling={gapEnrolling} onGenerate={handleGenerateGaps} />
        </Animated.View>

        {/* ④ 投递漏斗：收藏 / 已投 / 笔试 / 面试 / Offer，右侧是逐级转化率 */}
        <SectionTitle
          title="投递漏斗"
          right={<Text style={styles.sectionMeta}>{funnelMeta}</Text>}
          actionLabel="我的投递"
          onAction={() => router.push("/applications" as never)}
          style={styles.section}
        />
        <Animated.View entering={entrance(3)}>
          <CareerFunnel rows={funnelRows} hasData={hasApplications} />
        </Animated.View>

        {/* ⑤ 本周行动：3 条可勾选清单（本地 state 真实 toggle） */}
        <SectionTitle
          title="本周行动"
          right={<Text style={styles.sectionMeta}>{weekActions.length + " 件"}</Text>}
          style={styles.section}
        />
        <Animated.View entering={entrance(4)}>
          <CareerWeekActions actions={weekActions} />
        </Animated.View>

        {/* ⑥ 决策日志：最近 3 条，左日期 + 一句话 */}
        <SectionTitle title="决策日志" right={<Text style={styles.sectionMeta}>最近 3 条</Text>} style={styles.section} />
        <Animated.View entering={entrance(5)}>
          <CareerDecisionLog items={decisionLog} />
        </Animated.View>

        {/* ⑦ 分析工具（仅参考）：参考数据，不是下一步动作，单独一行放底部 */}
        <Animated.View entering={entrance(6)}>
          <AnalysisEntry />
        </Animated.View>

        <Text style={styles.quote}>把机会，交给准备好的自己。</Text>

        {/* 技能缺口 → 学习任务的结果提示（2400ms 自动消失，可手动关闭） */}
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

/**
 * 底部「分析工具（仅参考）」入口：一行，跳市场分析。
 * 保留这个入口是因为市场数据是参考口径（不是求职动作），与决策区的层级要区分开。
 */
function AnalysisEntry() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.99}
      hitSlop={4}
      onPress={() => router.push("/market" as never)}
      style={styles.analysisRow}
      accessibilityRole="button"
      accessibilityLabel="分析工具（仅参考），打开市场分析页"
    >
      <View style={styles.analysisIcon}>
        <Icon name="trend" size={ICON_SIZE.sm} weight="regular" color={colors.textMuted} />
      </View>
      <View style={styles.analysisBody}>
        <Text style={styles.analysisTitle}>分析工具（仅参考）</Text>
        <Text style={styles.analysisSub} numberOfLines={1}>
          城市 · 薪资 · 技能热度
        </Text>
      </View>
      <Text style={styles.analysisEnd}>参考</Text>
      <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color={colors.textFaint} />
    </PressableScale>
  );
}

/** V7 上线护栏：本屏渲染异常时只兜住这一屏，不让整个 App 闪退。 */
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";
