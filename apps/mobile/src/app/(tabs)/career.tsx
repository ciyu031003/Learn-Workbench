import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { Surface } from "@/components/surface";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { Skeleton } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { StageTrack } from "@/components/v2/stage-track";
import { ProgressBar } from "@/components/v2/progress-bar";
import { RadarChart, SegmentRing, StatTileRow } from "@/components/v2/charts";
import { withAlpha } from "@/lib/chart-math";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
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
 * 职业 Hub（v2.0 UI 重构 · v2.1 P3 面板接入）
 *
 * 结构（原型 V3）：
 *   PageHead → 准备度卡（glassStrong 视觉锚点：SegmentRing 四维分段环 + 目标方向 + 优先补齐胶囊）
 *   → 准备度明细（RadarChart 四维能力 + 逐维分数 / detail）
 *   → StatTileRow 三格（进行中投递 / 匹配岗位 / 待补技能）+ BarList 待补技能排行
 *   → 职业成长路径三行（岗位雷达 chips / 求职进度 StageTrack / 简历完成度）
 *   → 更多工具（招花 · 我的投递 · 面试 · 证书 · 市场）+ 技能 chips。
 *
 * 数据口径与 v1 完全一致：/api/profile/readiness（四维 + overall + matchedJobs）、
 * /api/profile/skills（技能画像）、/api/jobs?publishedWithin=today（今日新岗位）、
 * /api/jobs/applications（各阶段数量）。后两个失败/未登录时降级为 0 与静态文案，
 * 不新增后端接口、不改数据逻辑；动效只沿用已有的按压反馈与首屏入场错峰
 * （v2.1 P3 只做静态面板替换，不新增动效点，新块沿用原有的 entrance 分组）。
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

/**
 * 雷达轴名（v2.1 P3）：RadarChart 的轴标在 Svg 画布边缘，4 维时左右两轴只剩约 12pt 余量，
 * 4 字名称会被画布裁掉；轴名统一用 2 字短名，完整名称 + 分数 + detail 在雷达下方的明细行里。
 */
const DIMENSION_AXIS_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "基础",
  project: "项目",
  resume: "证书",
  interview: "面试",
};

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
 * 分数 → 语义色（四维明细 / 缺口排行共用）：
 * ≥80 达标（success）、55–79 进行中（primary）、<55 提示补齐（warning）。
 * 只返回语义名，具体色值统一从 useTheme().colors 取，避免裸色值。
 */
function scoreToneOf(score: number): "success" | "primary" | "warning" {
  return score >= 80 ? "success" : score >= 55 ? "primary" : "warning";
}

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
  /** v2.0.1：Tab 页页头让开状态栏/刘海（与今日/学习/我的同口径） */
  const headerTop = useHeaderTopInset("hero");
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
  /** 「优先补齐」胶囊的语义色：缺口用 warning，四维全满用 success（不再一律主色） */
  const weakStrong = weakest.score >= 100 ? colors.success : colors.warning;
  const weakSoft = weakest.score >= 100 ? colors.successSoft : colors.warningSoft;

  /** 进行中投递：现有统计派生，未登录/无数据为 null（MetricGrid 显示 0） */
  const activeApplications = useMemo(() => {
    if (!appStats) return null;
    return ACTIVE_APPLICATION_STAGES.reduce((sum, stage) => sum + (Number(appStats[stage]) || 0), 0);
  }, [appStats]);

  const currentStage = resolveStageIndex(appStats);
  const currentStageLabel = APPLICATION_STAGES[currentStage];

  /** 待补技能：技能画像中熟练度低于 3 的项（无画像即 0） */
  const gapSkills = skills.filter((skill) => skill.level < SKILL_GAP_LEVEL).length;

  /**
   * 缺口技能排行（v2.1 P3 · BarList）：与上面的 `gapSkills` 同一批「待补」项，
   * 条长 = 缺口大小（Lv 越低缺口越大），右侧仍显示真实 Lv，不做任何推断。
   * 排序用普通字符串比较（Hermes 的 Intl 不保证完整，见 lib/focus-stats.ts 的同款注释）。
   */
  const gapSkillItems = useMemo(
    () =>
      skills
        .filter((skill) => skill.level < SKILL_GAP_LEVEL)
        .slice()
        .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, 6)
        .map((skill) => ({
          key: String(skill.id),
          label: skill.name,
          value: SKILL_GAP_LEVEL - skill.level,
          valueLabel: `Lv ${skill.level}`,
          hint: skill.category,
          /** Lv 0 完全空白 → danger；Lv 1–2 → warning（越浅缺口越小） */
          tone: (skill.level <= 0 ? "danger" : "warning") as "danger" | "warning",
        })),
    [skills]
  );

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
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
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
                  <View style={styles.readinessRing}>
                    {/* 总分：环放大到 132 / 加粗到 14，环心数字随 size 提到 32pt 级；下方标签改为「综合准备度」 */}
                    <SegmentRing
                      segments={dimensions.map((dimension) => ({
                        key: dimension.key,
                        label: dimension.label,
                        value: Math.max(0, dimension.score),
                      }))}
                      score={`${overall}%`}
                      scoreLabel="综合准备度"
                      legend={false}
                      size={132}
                      thickness={14}
                      gapDeg={10}
                    />
                  </View>
                )}
                <View style={styles.readinessBody}>
                  <Text style={styles.readinessLabel}>目标方向</Text>
                  {/* 目标方向是卡内第二主信息：22/700 大字，不设 numberOfLines（130% 字号下换行而不截断） */}
                  <Text style={styles.readinessGoal}>{targetRole}</Text>
                  <Text style={styles.readinessHint}>{goalVerdict}</Text>
                </View>
              </View>
              {/* 缺口胶囊独立成行：不再和长目标方向挤在同一列，长文案也能完整显示 */}
              <View style={[styles.weakChip, { backgroundColor: weakSoft, borderColor: withAlpha(weakStrong, 0.28) }]}>
                <ThemedIcon
                  name={weakest.score >= 100 ? "checkmark-circle-outline" : "alert-circle-outline"}
                  size={13}
                  color={weakStrong}
                />
                <Text style={styles.weakChipText} {...TEXT_SCALE_POLICY.chrome}>
                  {weakestChip}
                </Text>
              </View>
            </Surface>
          )}
        </Animated.View>

        {/* ③ 准备度明细（v2.1 P3）：四维能力雷达 + 逐维明细（分数与 detail 文案全保留） */}
        <SectionTitle title="准备度明细" style={styles.section} />
        <Animated.View entering={entrance(1)}>
          <Card style={styles.dimCard}>
            {readiness && readiness.dimensions.length > 0 ? (
              <>
                <RadarChart
                  title="四维能力"
                  axes={dimensions.map((dimension) => ({ key: dimension.key, label: DIMENSION_AXIS_LABELS[dimension.key] }))}
                  values={dimensions.map((dimension) => Math.max(0, dimension.score) / 100)}
                  score={`${overall}`}
                  scoreLabel="综合"
                  size={236}
                />
                <View style={styles.dimList}>
                  {dimensions.map((dimension) => {
                    const tone = scoreToneOf(dimension.score);
                    const toneColor = colors[tone] as string;
                    return (
                      <View key={dimension.key} style={styles.dimRow}>
                        <View style={styles.dimHead}>
                          <View style={styles.dimNameRow}>
                            <View style={[styles.dimDot, { backgroundColor: toneColor }]} />
                            <Text style={styles.dimLabel}>{dimension.label}</Text>
                          </View>
                          {/* 分数用 20/800 等宽数字 + 语义色，和标签（15/700 正文色）拉开权重 */}
                          <Text style={[styles.dimScore, tabularNums, { color: toneColor }]}>{dimension.score}%</Text>
                        </View>
                        <ProgressBar value={Math.max(0, dimension.score) / 100} tone={tone} height={8} />
                        {dimension.detail ? (
                          <Text style={styles.dimDetail}>{dimension.detail}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.dimEmpty}>
                {loading ? "正在计算准备度…" : "登录并记录技能 / 项目 / 面试日志后，这里会呈现职业画像"}
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* ④ 三格指标：进行中投递 / 新匹配岗位 / 待补技能（没有则 0） */}
        <Animated.View entering={entrance(2)}>
          <StatTileRow
            items={[
              { label: "进行中投递", value: activeApplications ?? 0, unit: "个", icon: "paper-plane-outline", tone: "primary" },
              { label: "匹配岗位", value: readiness?.matchedJobs ?? 0, unit: "个", icon: "radio-outline", tone: "success" },
              { label: "待补技能", value: gapSkills, unit: "项", icon: "school-outline", tone: "accent" },
            ]}
          />
          {gapSkillItems.length > 0 ? (
            <Card style={styles.gapCard}>
              <View style={styles.gapHead}>
                <Text style={styles.gapTitle}>待补技能排行</Text>
                <Text style={[styles.gapCount, tabularNums]}>{gapSkillItems.length} 项 · 低于 Lv {SKILL_GAP_LEVEL}</Text>
              </View>
              {/* 排行条加粗到 8 并换成行内进度条（BarList 的背景条只有 40pt 行高、无法更粗）：
                  排名 / 名称 / Lv 三段对齐，Lv 用 warning（Lv 0 用 danger）语义色 */}
              <View style={styles.gapList}>
                {gapSkillItems.map((item, index) => (
                  <View key={item.key} style={styles.gapRow}>
                    <View style={styles.gapRowHead}>
                      <View style={styles.gapRank}>
                        <Text style={[styles.gapRankText, tabularNums]}>{index + 1}</Text>
                      </View>
                      <View style={styles.gapNameWrap}>
                        <Text style={styles.gapName} numberOfLines={2}>{item.label}</Text>
                        {item.hint ? (
                          <Text style={styles.gapHint} numberOfLines={1}>{item.hint}</Text>
                        ) : null}
                      </View>
                      <Text style={[styles.gapLevel, tabularNums, { color: colors[item.tone] as string }]}>
                        {item.valueLabel}
                      </Text>
                    </View>
                    <ProgressBar value={item.value / SKILL_GAP_LEVEL} tone={item.tone} height={8} />
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
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
                <View
                  style={[
                    styles.toolIcon,
                    {
                      backgroundColor: colors[tone.soft] as string,
                      borderColor: withAlpha(colors[tone.strong] as string, 0.28),
                    },
                  ]}
                >
                  <ThemedIcon name={tool.icon} size={20} color={colors[tone.strong] as string} />
                </View>
                <Text style={styles.toolTitle} numberOfLines={1}>{tool.title}</Text>
                {/* 不设 numberOfLines：窄屏 + 130% 字号下换行，不被省略号截断（卡高随内容增长） */}
                <Text style={styles.toolMeta}>{tool.meta}</Text>
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
    readinessCard: { gap: spacing.md },
    readinessTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    /** SegmentRing 是 width:100% 的自适应组件，放在行内必须给一个定宽容器 */
    readinessRing: { width: 132 },
    ringSkeleton: { width: 132, height: 132, borderRadius: 66 },
    readinessBody: { flex: 1, minWidth: 0, gap: 4 },
    readinessLabel: { ...typography.caption, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.2 },
    readinessGoal: { ...typography.title2, color: colors.text },
    readinessHint: { ...typography.meta, color: colors.textSecondary, lineHeight: 17 },
    weakChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.warningSoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 6,
      maxWidth: "100%",
    },
    /** 语义色放在图标/底色/描边上，文字用正文色：warning 橙在 warningSoft 上只有 ~2.4，小字不可读 */
    weakChipText: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1 },

    /* 四维明细 */
    dimCard: { gap: spacing.md },
    dimList: { gap: spacing.lg },
    dimRow: { gap: 6 },
    dimHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    dimNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    dimDot: { width: 6, height: 6, borderRadius: 3 },
    dimLabel: { ...typography.callout, fontWeight: "700", color: colors.text },
    dimScore: { ...typography.num },
    dimDetail: { ...typography.meta, color: colors.textMuted, lineHeight: 17 },
    dimEmpty: { ...typography.callout, color: colors.textSecondary },

    /* 待补技能排行（自绘行：粗条 + 排名/名称/Lv 三段对齐） */
    gapCard: { marginTop: spacing.md, gap: spacing.md },
    gapHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    gapTitle: { ...typography.section, color: colors.text },
    gapCount: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    gapList: { gap: spacing.md },
    gapRow: { gap: 6 },
    gapRowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    gapRank: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    gapRankText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    gapNameWrap: { flex: 1, minWidth: 0, gap: 1 },
    gapName: { ...typography.callout, fontWeight: "600", color: colors.text },
    gapHint: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    gapLevel: { ...typography.callout, fontWeight: "800", minWidth: 40, textAlign: "right" },

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

    /* 更多工具 2 列：图标芯片放大到 40 + 语义描边，标题提到 headline 档 */
    toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    toolTile: {
      width: "47.5%",
      flexGrow: 1,
      minHeight: 108,
      padding: 14,
      gap: 7,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    toolIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth * 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    toolTitle: { ...typography.headline, fontWeight: "700", color: colors.text },
    toolMeta: { ...typography.meta, color: colors.textMuted, lineHeight: 17 },

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
