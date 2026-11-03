import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { Surface } from "@/components/surface";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { ProgressArc } from "@/components/progress-arc";
import { Skeleton } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { MetricGrid } from "@/components/v2/metric-grid";
import { StageTrack } from "@/components/v2/stage-track";
import { ProgressBar } from "@/components/v2/progress-bar";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { CareerReadiness, ReadinessDimension, UserSkillView } from "@learn-workbench/shared/schemas";

/**
 * 职业 Hub（v2.0 UI 重构）
 *
 * 结构（原型 V3）：
 *   PageHead → 准备度卡（glassStrong 视觉锚点：96 环 + 目标方向 + 优先补齐胶囊）
 *   → 准备度明细四维 → MetricGrid 三格
 *   → 职业成长路径三行（岗位雷达 chips / 求职进度 StageTrack / 简历完成度）
 *   → 更多工具（招花 · 我的投递 · 面试 · 证书 · 市场）+ 技能 chips。
 *
 * 数据口径与 v1 完全一致：/api/profile/readiness（四维 + overall + matchedJobs）、
 * /api/profile/skills（技能画像）、/api/jobs?publishedWithin=today（今日新岗位）、
 * /api/jobs/applications（各阶段数量）。后两个失败/未登录时降级为 0 与静态文案，
 * 不新增后端接口、不改数据逻辑；动效只沿用已有的按压反馈与首屏入场错峰。
 */

/** 「进行中」= 未到终态的投递（offer / hired / closed 之外） */
const ACTIVE_APPLICATION_STAGES = [
  "favorite",
  "ready",
  "applied",
  "online_test",
  "interview1",
  "interview2",
] as const;

/** 求职进度五阶段（原型 V3）：已投递 → 筛选 → 笔试 → 面试 → Offer */
const APPLICATION_STAGES = ["已投递", "筛选", "笔试", "面试", "Offer"] as const;

/**
 * readiness 四维在 v2 原型里的文案：数据仍取服务端四维分数（skill/project/resume/interview），
 * 只换展示标签，避免与后端契约耦合出新字段。
 */
const DIMENSION_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "专业基础",
  project: "项目经验",
  resume: "证书技能",
  interview: "面试表达",
};
const DIMENSION_KEYS: ReadinessDimension["key"][] = ["skill", "project", "resume", "interview"];

/** 更多工具的图标色调：只取主题 token 里的 soft/strong 一对 */
type ToolTone = "primary" | "teal" | "success" | "accent";
const TOOL_TONES: Record<ToolTone, { soft: keyof ThemeColors; strong: keyof ThemeColors }> = {
  primary: { soft: "primarySoft", strong: "primary" },
  teal: { soft: "surfaceMuted", strong: "teal" },
  success: { soft: "successSoft", strong: "success" },
  accent: { soft: "accentSoft", strong: "accent" },
};

/** 技能画像里 level 只有 0-5；<3 视为「待补」（无画像时为 0 项） */
const SKILL_GAP_LEVEL = 3;

/**
 * 求职进度当前阶段：按各阶段数量取「最远一步」。
 * 与 StageTrack 的语义对齐（current = 当前进行中的那一格，左侧为已完成）。
 */
function resolveStageIndex(stats: Record<string, number> | null): number {
  if (!stats) return 0;
  const count = (key: string) => Number(stats[key]) || 0;
  if (count("offer") + count("hired") > 0) return 4;
  if (count("interview1") + count("interview2") > 0) return 3;
  if (count("online_test") > 0) return 2;
  if (count("applied") > 0) return 1;
  return 0;
}

export default function CareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v19-M8：TabBar 双击回顶 */
  const careerScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/career", careerScrollRef);
  /** v20-E3：首屏入场错峰（减弱动态时自动不播） */
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [loading, setLoading] = useState(true);
  /** 今日新岗位数（现有 /api/jobs 接口；失败/未登录为 null，meta 降级为静态文案） */
  const [todayNewJobs, setTodayNewJobs] = useState<number | null>(null);
  /** 投递各阶段数量（现有 /api/jobs/applications 接口；null = 未登录 / 拉取失败） */
  const [appStats, setAppStats] = useState<Record<string, number> | null>(null);

  /**
   * 取数口径与改造前一致：readiness + skills。
   * 额外两个 meta 数字复用现有接口，均允许失败（.catch → null），不影响首屏。
   */
  const loadCareer = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    try {
      const [readinessRes, skillsRes, jobsRes, applicationsRes] = await Promise.all([
        fetch(getApiUrl() + "/api/profile/readiness", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/profile/skills", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/jobs?publishedWithin=today&pageSize=1", { headers }).catch(() => null),
        token ? fetch(getApiUrl() + "/api/jobs/applications", { headers }).catch(() => null) : Promise.resolve(null),
      ]);
      if (readinessRes?.ok) {
        const data = await readinessRes.json().catch(() => null);
        if (data) setReadiness(data);
      }
      if (skillsRes?.ok) {
        const data = await skillsRes.json().catch(() => null);
        if (Array.isArray(data?.skills)) setSkills(data.skills);
      }
      if (jobsRes?.ok) {
        const data = await jobsRes.json().catch(() => null);
        const total = Number(data?.total);
        setTodayNewJobs(Number.isFinite(total) ? total : null);
      }
      if (applicationsRes?.ok) {
        const data = await applicationsRes.json().catch(() => null);
        const stats = data?.stats;
        if (stats && typeof stats === "object") {
          setAppStats(stats as Record<string, number>);
        }
      }
    } catch {
      // 离线或未登录：保持上一次数据（首屏 hero 降级为 0）
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 沿用本仓既有写法：首帧加载推迟一个宏任务（不触发 set-state-in-effect 的级联渲染）
  useEffect(() => {
    const timer = setTimeout(() => void loadCareer(), 0);
    return () => clearTimeout(timer);
  }, [loadCareer]);

  const { control: careerRefresh } = usePullRefresh(loadCareer, { stickyHeader: true });

  const overall = readiness?.overall ?? 0;
  const hasTarget = Boolean(readiness && readiness.targetRole.trim());
  const targetRole = readiness?.targetRole?.trim() || "未设置目标方向";
  const goalVerdict =
    overall >= 80
      ? "准备充分，可以直接投递"
      : overall >= 55
        ? "接近达标，补一补短板"
        : overall > 0
          ? "还在积累，先补技能与项目"
          : "登录并记录技能 / 项目后显示";

  /** 四维：服务端给的分数按固定顺序展开（缺项按 0 展示，不隐藏行） */
  const dimensions = useMemo(
    () =>
      DIMENSION_KEYS.map((key) => {
        const found = readiness?.dimensions.find((item) => item.key === key);
        return {
          key,
          label: DIMENSION_LABELS[key],
          score: found?.score ?? 0,
          detail: found?.detail ?? "",
        };
      }),
    [readiness]
  );

  /** 最短板 → 「优先补齐」胶囊（四维全满时给正向话术） */
  const weakest = dimensions.reduce((min, item) => (item.score < min.score ? item : min), dimensions[0]);
  const weakestChip = weakest.score >= 100 ? "四维已达标 · 保持节奏" : "优先补齐 · " + weakest.label + " " + weakest.score + "%";

  /** 进行中投递：现有统计派生，未登录/无数据为 null（MetricGrid 显示 0） */
  const activeApplications = useMemo(() => {
    if (!appStats) return null;
    return ACTIVE_APPLICATION_STAGES.reduce((sum, stage) => sum + (Number(appStats[stage]) || 0), 0);
  }, [appStats]);

  const currentStage = resolveStageIndex(appStats);
  const currentStageLabel = APPLICATION_STAGES[currentStage];

  /** 待补技能：技能画像中熟练度低于 3 的项（无画像即 0） */
  const gapSkills = skills.filter((skill) => skill.level < SKILL_GAP_LEVEL).length;

  const jobsMeta =
    todayNewJobs !== null
      ? `今日新岗位 ${todayNewJobs} 个 · 搜索 / 收藏 / 匹配`
      : readiness && readiness.matchedJobs > 0
        ? `${readiness.matchedJobs} 个匹配岗位 · 搜索 / 收藏`
        : "岗位搜索 · 收藏 · 匹配";
  const radarMeta =
    readiness && readiness.matchedJobs > 0
      ? `${readiness.matchedJobs} 个匹配岗位 · 按匹配度排序`
      : "匹配度 · 信号岗位";
  const applicationsMeta =
    appStats === null
      ? "收藏 → Offer 全流程"
      : activeApplications !== null && activeApplications > 0
        ? `进行中 ${activeApplications} 个 · 按阶段推进`
        : "暂无进行中的投递";
  const applicationStateText =
    appStats === null
      ? "登录后可记录投递阶段"
      : activeApplications !== null && activeApplications > 0
        ? `进行中 ${activeApplications} 个 · 当前 ${currentStageLabel}`
        : "还没有投递记录 · 先收藏目标岗位";

  /** 岗位雷达 chips：最多 3 枚，全部来自现有统计 */
  const radarChips = [
    readiness && readiness.matchedJobs > 0 ? `匹配 ${readiness.matchedJobs} 个` : null,
    todayNewJobs !== null && todayNewJobs > 0 ? `今日新增 ${todayNewJobs}` : null,
    "按匹配度排序",
  ].filter((chip): chip is string => Boolean(chip));

  /** 简历完成度取 readiness 的 resume 维度（四类资产完整度），缺口文案由分数反推 */
  const resumeScore = dimensions.find((item) => item.key === "resume")?.score ?? 0;
  const resumeMissingKinds = Math.max(0, 4 - Math.round(resumeScore / 25));
  const resumeGapText =
    resumeScore >= 100
      ? "四类资产齐全，可预览与导出"
      : `还缺 ${resumeMissingKinds} 类资产（技能 / 项目 / GitHub / 证书）`;

  const tools: { key: string; title: string; meta: string; icon: keyof typeof Ionicons.glyphMap; tone: ToolTone; href: string }[] = [
    { key: "jobs", title: "招花市场", meta: jobsMeta, icon: "flower-outline", tone: "primary", href: "/jobs" },
    { key: "applications", title: "我的投递", meta: applicationsMeta, icon: "briefcase-outline", tone: "accent", href: "/applications" },
    { key: "interview", title: "面试", meta: "题库 · 模拟面试", icon: "chatbubbles-outline", tone: "teal", href: "/interview" },
    { key: "certificates", title: "证书", meta: "证书 · 有效期提醒", icon: "ribbon-outline", tone: "success", href: "/certificates" },
    { key: "market", title: "市场分析", meta: "城市 · 薪资 · 技能热度", icon: "trending-up-outline", tone: "primary", href: "/market" },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="职业" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={careerScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...careerRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 页头 */}
        <PageHead
          eyebrow="PERSONAL WORKSPACE"
          title="职业"
          subtitle="从职业目标出发，连接岗位、能力、项目与投递进度。"
          style={styles.pageHead}
        />

        {/* ② 准备度卡：左环 + 目标方向 + 说明 + 优先补齐（本屏唯一 glassStrong 锚点） */}
        <Animated.View entering={entrance(0)}>
          {!loading && !hasTarget ? (
            <Card>
              <EmptyState
                pattern="none"
                icon="flag-outline"
                title="还没有目标方向"
                hint="在「我的」里选择职业方向后，这里会显示准备度、四维明细与优先补齐建议。"
                actionLabel="去设置职业方向"
                onAction={() => router.push("/settings" as never)}
              />
            </Card>
          ) : (
            <Surface tier="glassStrong" corner={radius.panel} style={styles.readinessCard}>
              <View style={styles.readinessTop}>
                {loading && !readiness ? (
                  <Skeleton variant="card" style={styles.ringSkeleton} />
                ) : (
                  <ProgressArc
                    progress={overall / 100}
                    size={96}
                    strokeWidth={9}
                    value={`${overall}%`}
                    label="准备度"
                    beatOnChange
                  />
                )}
                <View style={styles.readinessBody}>
                  <Text style={styles.readinessLabel}>目标方向</Text>
                  <Text style={styles.readinessGoal} numberOfLines={2}>{targetRole}</Text>
                  <Text style={styles.readinessHint} numberOfLines={3}>{goalVerdict}</Text>
                  <View style={styles.weakChip}>
                    <Text style={styles.weakChipText} numberOfLines={1}>{weakestChip}</Text>
                  </View>
                </View>
              </View>
            </Surface>
          )}
        </Animated.View>

        {/* ③ 准备度明细：四维进度条 */}
        <SectionTitle title="准备度明细" style={styles.section} />
        <Animated.View entering={entrance(1)}>
          <Card style={styles.dimCard}>
            {readiness && readiness.dimensions.length > 0 ? (
              dimensions.map((dimension) => (
                <View key={dimension.key} style={styles.dimRow}>
                  <View style={styles.dimHead}>
                    <Text style={styles.dimLabel}>{dimension.label}</Text>
                    <Text style={[styles.dimScore, tabularNums]}>{dimension.score}%</Text>
                  </View>
                  <ProgressBar value={dimension.score / 100} height={6} />
                  {dimension.detail ? (
                    <Text style={styles.dimDetail} numberOfLines={1}>{dimension.detail}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.dimEmpty}>
                {loading ? "正在计算准备度…" : "登录并记录技能 / 项目 / 面试日志后，这里会呈现职业画像"}
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* ④ 三格指标：进行中投递 / 新匹配岗位 / 待补技能（没有则 0） */}
        <Animated.View entering={entrance(2)}>
          <MetricGrid
            items={[
              { icon: "paper-plane-outline", value: activeApplications ?? 0, unit: "个", label: "进行中投递", tone: "primary" },
              { icon: "radio-outline", value: readiness?.matchedJobs ?? 0, unit: "个", label: "新匹配岗位", tone: "success" },
              { icon: "school-outline", value: gapSkills, unit: "项", label: "待补技能", tone: "accent" },
            ]}
          />
        </Animated.View>

        {/* ⑤ 职业成长路径：3 行入口 */}
        <SectionTitle title="职业成长路径" style={styles.section} />
        <Animated.View entering={entrance(3)}>
          <Card style={styles.pathCard}>
            <PressableScale
              style={styles.pathRow}
              hitSlop={4}
              haptic
              onPress={() => router.push("/radar" as never)}
              accessibilityRole="button"
              accessibilityLabel={`岗位雷达，${radarChips.join("，")}，查看匹配岗位`}
            >
              <View style={styles.pathHead}>
                <View style={[styles.pathIcon, { backgroundColor: colors.primarySoft }]}>
                  <ThemedIcon name="radio-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.pathBody}>
                  <Text style={styles.pathTitle}>岗位雷达</Text>
                  <Text style={styles.pathMeta} numberOfLines={1}>{radarMeta}</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
              </View>
              <View style={styles.chipRow}>
                {radarChips.map((chip) => (
                  <View key={chip} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{chip}</Text>
                  </View>
                ))}
              </View>
            </PressableScale>

            <View style={styles.pathDivider} />

            <PressableScale
              style={styles.pathRow}
              hitSlop={4}
              haptic
              onPress={() => router.push("/applications" as never)}
              accessibilityRole="button"
              accessibilityLabel={`求职进度，${applicationStateText}，更新投递阶段`}
            >
              <View style={styles.pathHead}>
                <View style={[styles.pathIcon, { backgroundColor: colors.accentSoft }]}>
                  <ThemedIcon name="briefcase-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.pathBody}>
                  <Text style={styles.pathTitle}>求职进度</Text>
                  <Text style={styles.pathMeta} numberOfLines={1}>{applicationStateText}</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
              </View>
              <StageTrack stages={[...APPLICATION_STAGES]} current={currentStage} />
            </PressableScale>

            <View style={styles.pathDivider} />

            <PressableScale
              style={styles.pathRow}
              hitSlop={4}
              haptic
              onPress={() => router.push("/resume" as never)}
              accessibilityRole="button"
              accessibilityLabel={`简历完成度 ${resumeScore}%，${resumeGapText}，打开简历`}
            >
              <View style={styles.pathHead}>
                <View style={[styles.pathIcon, { backgroundColor: colors.successSoft }]}>
                  <ThemedIcon name="document-text-outline" size={18} color={colors.success} />
                </View>
                <View style={styles.pathBody}>
                  <Text style={styles.pathTitle}>简历完成度</Text>
                  <Text style={styles.pathMeta} numberOfLines={1}>四类资产完整度</Text>
                </View>
                <Text style={[styles.pathValue, tabularNums]}>{resumeScore}%</Text>
                <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
              </View>
              <ProgressBar value={resumeScore / 100} tone={resumeScore >= 100 ? "success" : "primary"} height={6} style={styles.resumeBar} />
              <Text style={styles.gapText} numberOfLines={2}>{resumeGapText}</Text>
            </PressableScale>
          </Card>
        </Animated.View>

        {/* ⑥ 更多工具：既有入口全保留（招花 / 我的投递 / 面试 / 证书 / 市场） */}
        <SectionTitle title="更多工具" style={styles.section} />
        <Animated.View style={styles.toolGrid} entering={entrance(4)}>
          {tools.map((tool) => {
            const tone = TOOL_TONES[tool.tone];
            return (
              <PressableScale
                key={tool.key}
                style={styles.toolTile}
                haptic
                onPress={() => router.push(tool.href as never)}
                accessibilityRole="button"
                accessibilityLabel={`${tool.title}，${tool.meta}`}
              >
                <View style={[styles.toolIcon, { backgroundColor: colors[tone.soft] as string }]}>
                  <ThemedIcon name={tool.icon} size={18} color={colors[tone.strong] as string} />
                </View>
                <Text style={styles.toolTitle} numberOfLines={1}>{tool.title}</Text>
                <Text style={styles.toolMeta} numberOfLines={2}>{tool.meta}</Text>
              </PressableScale>
            );
          })}
        </Animated.View>

        {/* ⑦ 我的技能（保留 chips） */}
        {skills.length > 0 ? (
          <Card style={styles.skillsCard}>
            <View style={styles.skillsHead}>
              <Text style={styles.skillsTitle}>我的技能</Text>
              <Text style={[styles.skillsCount, tabularNums]}>{skills.length} 项</Text>
            </View>
            <View style={styles.skillChips}>
              {skills.slice(0, 12).map((skill) => (
                <View key={skill.id} style={styles.skillChip}>
                  <Text style={styles.skillChipText} numberOfLines={1}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /* 页头与区块标题：SectionTitle 自带 21 上边距，这里收到 12（与卡片间距节奏一致） */
    pageHead: { marginBottom: 0 },
    section: { marginTop: spacing.md, marginBottom: 0 },

    /* 准备度卡（glassStrong） */
    readinessCard: { gap: spacing.sm },
    readinessTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    ringSkeleton: { width: 96, height: 96, borderRadius: 48 },
    readinessBody: { flex: 1, minWidth: 0, gap: 3 },
    readinessLabel: { ...typography.meta, fontWeight: "700", color: colors.textMuted },
    readinessGoal: { ...typography.hero, color: colors.text },
    readinessHint: { ...typography.meta, color: colors.textSecondary },
    weakChip: {
      alignSelf: "flex-start",
      marginTop: 4,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      maxWidth: "100%",
    },
    weakChipText: { ...typography.meta, fontWeight: "700", color: colors.primary },

    /* 四维明细 */
    dimCard: { gap: spacing.md },
    dimRow: { gap: 4 },
    dimHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    dimLabel: { ...typography.callout, fontWeight: "600", color: colors.text },
    dimScore: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    dimDetail: { ...typography.meta, color: colors.textMuted },
    dimEmpty: { ...typography.callout, color: colors.textSecondary },

    /* 职业成长路径 */
    pathCard: { padding: 0, gap: 0 },
    pathRow: { paddingHorizontal: 14, paddingVertical: 14, gap: 10, minHeight: 44 },
    pathDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 14,
      marginRight: 14,
    },
    pathHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38 },
    pathIcon: { width: 38, height: 38, borderRadius: radius.control - 1, alignItems: "center", justifyContent: "center" },
    pathBody: { flex: 1, minWidth: 0, gap: 2 },
    pathTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    pathMeta: { ...typography.meta, color: colors.textMuted },
    pathValue: { ...typography.caption, fontWeight: "800", color: colors.text },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: "100%",
    },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    resumeBar: { marginTop: 2 },
    gapText: { ...typography.meta, color: colors.textMuted },

    /* 更多工具 2 列 */
    toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    toolTile: {
      width: "47.5%",
      flexGrow: 1,
      minHeight: 96,
      padding: 14,
      gap: 6,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    toolIcon: { width: 34, height: 34, borderRadius: radius.control - 2, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    toolTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    toolMeta: { ...typography.meta, color: colors.textMuted },

    /* 技能 */
    skillsCard: { gap: spacing.md },
    skillsHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    skillsTitle: { ...typography.section, color: colors.text },
    skillsCount: { ...typography.meta, color: colors.textMuted },
    skillChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    skillChip: {
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
      maxWidth: "100%",
    },
    skillChipText: { ...typography.caption, fontWeight: "700", color: colors.primary },
  });
