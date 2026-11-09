import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { Skeleton } from "@/components/skeleton";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { ProgressBar } from "@/components/v2/progress-bar";
import { BarList, RadarChart } from "@/components/v2/charts";
import { withAlpha } from "@/lib/chart-math";
import { fetchJobStats } from "@/lib/jobs";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { INITIAL_FIRST_LOAD_GATE, nextFirstLoadGate, shouldShowSkeleton } from "@/lib/first-load";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { formatRelativeTime } from "@learn-workbench/shared/dates";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { CareerReadiness, JobStats, ReadinessDimension, UserSkillView } from "@learn-workbench/shared/schemas";

/**
 * 职业 Hub：只做统计与入口，岗位列表统一回到「招花」。
 *
 * 页面结构：页头简报 → 四项 KPI → 招花入口 → 求职漏斗 / 准备度 → 面试、简历、证书
 * → 技能画像 → 更多入口。数据全部来自既有接口，缺失时显示「—」，不估算。
 */

const RADAR_FETCH_LIMIT = 200;

const ACTIVE_APPLICATION_STAGES = [
  "favorite",
  "ready",
  "applied",
  "online_test",
  "interview1",
  "interview2",
] as const;

const APPLICATION_STAGES = ["已投递", "筛选", "笔试", "面试", "Offer"] as const;

const DIMENSION_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "专业基础",
  project: "项目经验",
  resume: "证书技能",
  interview: "面试表达",
};
const DIMENSION_KEYS: ReadinessDimension["key"][] = ["skill", "project", "resume", "interview"];
const DIMENSION_AXIS_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "基础",
  project: "项目",
  resume: "证书",
  interview: "面试",
};

type ToolTone = "primary" | "teal" | "success" | "accent";
const TOOL_TONES: Record<ToolTone, { soft: keyof ThemeColors; strong: keyof ThemeColors }> = {
  primary: { soft: "primarySoft", strong: "primary" },
  teal: { soft: "surfaceMuted", strong: "teal" },
  success: { soft: "successSoft", strong: "success" },
  accent: { soft: "accentSoft", strong: "accent" },
};

const SKILL_GAP_LEVEL = 3;

interface RadarSummary {
  hasProfile: boolean;
  total?: number;
  buckets?: { highMatch?: unknown[] };
}

function resolveStageIndex(stats: Record<string, number> | null): number {
  if (!stats) return 0;
  const count = (key: string) => Number(stats[key]) || 0;
  if (count("offer") + count("hired") > 0) return 4;
  if (count("interview1") + count("interview2") > 0) return 3;
  if (count("online_test") > 0) return 2;
  if (count("applied") > 0) return 1;
  return 0;
}

interface EntryRowSpec {
  key: string;
  title: string;
  subtitle?: string;
  end?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: ToolTone;
  href: string;
  accessibilityLabel: string;
}

function EntryRow({ row }: { row: EntryRowSpec }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = TOOL_TONES[row.tone];
  return (
    <PressableScale
      style={styles.entryRow}
      hitSlop={4}
      haptic
      onPress={() => router.push(row.href as never)}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
    >
      <View style={[styles.entryIcon, { backgroundColor: colors[tone.soft] as string }]}>
        <ThemedIcon name={row.icon} size={16} color={colors[tone.strong] as string} />
      </View>
      <View style={styles.entryBody}>
        <Text style={styles.entryTitle} numberOfLines={1}>{row.title}</Text>
        {row.subtitle ? <Text style={styles.entrySub} numberOfLines={1}>{row.subtitle}</Text> : null}
      </View>
      {row.end ? <Text style={[styles.entryEnd, tabularNums]} numberOfLines={1}>{row.end}</Text> : null}
      <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
    </PressableScale>
  );
}

interface KpiSpec {
  key: string;
  label: string;
  value: string;
  unit: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: ToolTone;
  href: string;
  accessibilityLabel: string;
}

function KpiCard({ item }: { item: KpiSpec }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = TOOL_TONES[item.tone];
  return (
    <PressableScale
      style={styles.kpiCard}
      hitSlop={3}
      haptic
      onPress={() => router.push(item.href as never)}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
    >
      <View style={styles.kpiTop}>
        <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: colors[tone.soft] as string }]}>
          <ThemedIcon name={item.icon} size={15} color={colors[tone.strong] as string} />
        </View>
      </View>
      <Text style={[styles.kpiValue, tabularNums]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {item.value}
        {item.unit ? <Text style={styles.kpiUnit}>{item.unit}</Text> : null}
      </Text>
      <Text style={styles.kpiHint} numberOfLines={1}>{item.hint}</Text>
    </PressableScale>
  );
}

export default function CareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const headerTop = useHeaderTopInset("hero");
  const careerScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/career", careerScrollRef);
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);

  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
  const showSkeleton = shouldShowSkeleton(gate);
  const [todayNewJobs, setTodayNewJobs] = useState<number | null>(null);
  const [appStats, setAppStats] = useState<Record<string, number> | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [radar, setRadar] = useState<RadarSummary | null>(null);
  /** 换号/退出时丢弃上一账号还在飞的请求，避免旧准备度/投递数短暂串号。 */
  const loadSeq = useRef(0);

  const loadCareer = useCallback(async (reset = false) => {
    const seq = ++loadSeq.current;
    if (reset) {
      setReadiness(null);
      setSkills([]);
      setTodayNewJobs(null);
      setAppStats(null);
      setJobStats(null);
      setRadar(null);
      setGate(INITIAL_FIRST_LOAD_GATE);
    }
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    try {
      const [readinessRes, skillsRes, jobsRes, applicationsRes, statsRes, radarRes] = await Promise.all([
        fetch(getApiUrl() + "/api/profile/readiness", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/profile/skills", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/jobs?publishedWithin=today&pageSize=1", { headers }).catch(() => null),
        token ? fetch(getApiUrl() + "/api/jobs/applications", { headers }).catch(() => null) : Promise.resolve(null),
        fetchJobStats().catch(() => null),
        fetch(getApiUrl() + "/api/jobs/radar?limit=" + RADAR_FETCH_LIMIT, { headers }).catch(() => null),
      ]);
      if (seq !== loadSeq.current) return;
      if (readinessRes?.ok) {
        const data = await readinessRes.json().catch(() => null);
        if (data) {
          setReadiness(data as CareerReadiness);
          setGate((g) => nextFirstLoadGate(g, { type: "load-success" }));
        }
      }
      if (skillsRes?.ok) {
        const data = await skillsRes.json().catch(() => null);
        if (Array.isArray(data?.skills)) setSkills(data.skills as UserSkillView[]);
      }
      if (jobsRes?.ok) {
        const data = await jobsRes.json().catch(() => null);
        const total = Number(data?.total);
        setTodayNewJobs(Number.isFinite(total) ? total : null);
      }
      if (applicationsRes?.ok) {
        const data = await applicationsRes.json().catch(() => null);
        const stats = data?.stats;
        if (stats && typeof stats === "object") setAppStats(stats as Record<string, number>);
      }
      if (statsRes) setJobStats(statsRes);
      if (radarRes?.ok) {
        const data = (await radarRes.json().catch(() => null)) as RadarSummary | null;
        if (data && typeof data.hasProfile === "boolean") setRadar(data);
      }
    } catch {
      if (seq === loadSeq.current) setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    } finally {
      if (seq === loadSeq.current) setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load / account switch reset
    void loadCareer(true);
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

  const dimensions = useMemo(
    () =>
      DIMENSION_KEYS.map((key) => {
        const found = readiness?.dimensions.find((item) => item.key === key);
        return { key, label: DIMENSION_LABELS[key], score: found?.score ?? 0, detail: found?.detail ?? "" };
      }),
    [readiness]
  );

  const weakest = dimensions.reduce((min, item) => (item.score < min.score ? item : min), dimensions[0]);
  const weakestChip = weakest.score >= 100 ? "四维已达标 · 保持节奏" : "优先补齐 · " + weakest.label + " " + weakest.score + "%";
  const weakStrong = weakest.score >= 100 ? colors.success : colors.warning;
  const weakSoft = weakest.score >= 100 ? colors.successSoft : colors.warningSoft;
  const resumeScore = dimensions.find((item) => item.key === "resume")?.score ?? 0;
  const resumeMissingKinds = Math.max(0, 4 - Math.round(resumeScore / 25));
  const interviewDetail = dimensions.find((item) => item.key === "interview")?.detail ?? "";
  const matchedJobs = readiness?.matchedJobs ?? 0;

  const activeApplications = useMemo(() => {
    if (!appStats) return null;
    return ACTIVE_APPLICATION_STAGES.reduce((sum, stage) => sum + (Number(appStats[stage]) || 0), 0);
  }, [appStats]);
  const currentStageLabel = APPLICATION_STAGES[resolveStageIndex(appStats)];
  const applicationStateText =
    appStats === null
      ? "登录后可记录投递阶段"
      : activeApplications !== null && activeApplications > 0
        ? "进行中 " + activeApplications + " 个 · 当前 " + currentStageLabel
        : "还没有投递记录 · 先去招花挑岗位";

  const countStages = useCallback(
    (keys: string[]): number | null => {
      if (!appStats) return null;
      return keys.reduce((sum, key) => sum + (Number(appStats[key]) || 0), 0);
    },
    [appStats]
  );
  const submittedCount = countStages(["applied", "online_test", "interview1", "interview2", "offer", "hired", "closed"]);
  const funnelStages = [
    { key: "applied", label: "已投递", count: submittedCount },
    { key: "test", label: "笔试", count: countStages(["online_test", "interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "interview", label: "面试", count: countStages(["interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "offer", label: "Offer", count: countStages(["offer", "hired"]) },
  ];

  const gapSkills = skills.filter((skill) => skill.level < SKILL_GAP_LEVEL).length;
  const gapSkillItems = useMemo(
    () =>
      skills
        .filter((skill) => skill.level < SKILL_GAP_LEVEL)
        .slice()
        .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, 5)
        .map((skill) => ({
          key: String(skill.id),
          label: skill.name,
          value: SKILL_GAP_LEVEL - skill.level,
          valueLabel: "Lv " + skill.level,
          hint: skill.category,
          color: skill.level <= 0 ? colors.danger : colors.warning,
        })),
    [skills, colors]
  );

  const todayCount = jobStats?.todayNew ?? todayNewJobs;
  const highMatchCount = radar?.hasProfile ? radar.buckets?.highMatch?.length ?? 0 : null;
  const subtitle =
    todayCount !== null
      ? "今日新增 " + todayCount + " 条岗位" + (highMatchCount !== null ? " · 高匹配 " + highMatchCount + " 条" : "")
      : "岗位抓取、准备度与投递进度集中在这里。";

  const kpiItems: KpiSpec[] = [
    {
      key: "new",
      label: "今日新增",
      value: todayCount === null ? "—" : String(todayCount),
      unit: todayCount === null ? "" : "个",
      hint: "招花今日抓取",
      icon: "cloud-download-outline",
      tone: "primary",
      href: "/jobs",
      accessibilityLabel: "今日新增岗位 " + (todayCount ?? "未知") + " 个，打开招花",
    },
    {
      key: "match",
      label: "高匹配",
      value: highMatchCount === null ? "—" : String(highMatchCount),
      unit: highMatchCount === null ? "" : "个",
      hint: highMatchCount === null ? "完善技能画像后显示" : "按真实匹配度统计",
      icon: "locate-outline",
      tone: "teal",
      href: "/radar",
      accessibilityLabel: "高匹配岗位 " + (highMatchCount ?? "未知") + " 个，打开岗位雷达",
    },
    {
      key: "active",
      label: "进行中投递",
      value: activeApplications === null ? "—" : String(activeApplications),
      unit: activeApplications === null ? "" : "个",
      hint: activeApplications === null ? "登录后统计" : "当前 " + currentStageLabel,
      icon: "briefcase-outline",
      tone: "accent",
      href: "/applications",
      accessibilityLabel: "进行中投递 " + (activeApplications ?? "未知") + " 个，打开投递页",
    },
    {
      key: "ready",
      label: "准备度",
      value: readiness === null ? "—" : String(overall),
      unit: readiness === null ? "" : "%",
      hint: hasTarget ? targetRole : "先设置目标方向",
      icon: "speedometer-outline",
      tone: "success",
      href: hasTarget ? "/radar" : "/radar?editTarget=1",
      accessibilityLabel: hasTarget ? "求职准备度 " + overall + "%，打开岗位雷达" : "设置目标方向",
    },
  ];

  const zhaohuaSub =
    todayCount !== null
      ? "今日新增 " + todayCount + " 条" + (highMatchCount !== null ? " · 高匹配 " + highMatchCount + " 条" : "")
      : "浏览全部岗位、匹配度与收藏";

  const prepRows: EntryRowSpec[] = [
    {
      key: "interview",
      title: "面试题库",
      subtitle: interviewDetail || "题库 · 模拟面试",
      end: "去练习",
      icon: "chatbubbles-outline",
      tone: "primary",
      href: "/interview",
      accessibilityLabel: "面试题库，打开面试页",
    },
    {
      key: "resume",
      title: "简历与附件",
      subtitle: resumeScore >= 100 ? "四类资产齐全" : "还缺 " + resumeMissingKinds + " 类资产",
      end: resumeScore + "%",
      icon: "document-text-outline",
      tone: "success",
      href: "/resume",
      accessibilityLabel: "简历与附件，完成度 " + resumeScore + "%，打开简历页",
    },
    {
      key: "certificates",
      title: "证书",
      subtitle: "证书 · 有效期提醒",
      end: "查看",
      icon: "ribbon-outline",
      tone: "teal",
      href: "/certificates",
      accessibilityLabel: "证书与有效期，打开证书页",
    },
  ];

  const moreRows: EntryRowSpec[] = [
    {
      key: "applications",
      title: "我的投递",
      subtitle: applicationStateText,
      end: activeApplications !== null && activeApplications > 0 ? activeApplications + " 个" : "—",
      icon: "briefcase-outline",
      tone: "accent",
      href: "/applications",
      accessibilityLabel: "我的投递，" + applicationStateText + "，打开投递页",
    },
    {
      key: "radar",
      title: "岗位雷达",
      subtitle: "匹配度 · 城市 / 薪资筛选",
      end: matchedJobs > 0 ? matchedJobs + " 个" : "—",
      icon: "radio-outline",
      tone: "primary",
      href: "/radar",
      accessibilityLabel: "岗位雷达，打开匹配岗位页",
    },
    {
      key: "market",
      title: "市场分析",
      subtitle: "城市 · 薪资 · 技能热度",
      icon: "trending-up-outline",
      tone: "teal",
      href: "/market",
      accessibilityLabel: "市场分析，打开市场页",
    },
    {
      key: "crawl",
      title: "岗位抓取记录",
      subtitle: jobStats ? "今日新增 " + jobStats.todayNew + " · " + jobStats.platformCount + " 个平台" : "抓取状态与岗位来源",
      end: jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "—",
      icon: "refresh",
      tone: "success",
      href: "/jobs",
      accessibilityLabel: "岗位抓取记录，打开招花",
    },
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
        <PageHead eyebrow="CAREER DESK" title="职业" subtitle={subtitle} style={styles.pageHead} />

        <Animated.View entering={entrance(0)} style={styles.kpiGrid}>
          {kpiItems.map((item) => (
            <KpiCard key={item.key} item={item} />
          ))}
        </Animated.View>

        <Animated.View entering={entrance(1)}>
          <PressableScale
            style={styles.zhaohuaCard}
            hitSlop={4}
            haptic
            onPress={() => router.push("/jobs" as never)}
            accessibilityRole="button"
            accessibilityLabel="打开招花，浏览全部岗位"
          >
            <View style={styles.zhaohuaIcon}>
              <ThemedIcon name="compass-outline" size={23} color="#FFFFFF" />
            </View>
            <View style={styles.zhaohuaBody}>
              <Text style={styles.zhaohuaKicker}>JOB MARKET</Text>
              <Text style={styles.zhaohuaTitle}>招花</Text>
              <Text style={styles.zhaohuaSub} numberOfLines={2}>{zhaohuaSub}</Text>
            </View>
            <View style={styles.zhaohuaCta}>
              <Text style={styles.zhaohuaCtaText}>进入</Text>
              <ThemedIcon name="chevron-forward" size={13} color="#FFFFFF" />
            </View>
          </PressableScale>
        </Animated.View>

        <SectionTitle
          title="求职准备"
          right={<Text style={styles.sectionMeta}>{readiness ? "准备度 " + overall + "%" : "准备度 —"}</Text>}
          style={styles.section}
        />
        <Animated.View entering={entrance(2)}>
          {!gate.firstLoadPending && !hasTarget ? (
            <Surface style={styles.card}>
              <EmptyState
                pattern="none"
                icon="flag-outline"
                title="还没有目标方向"
                hint="设置目标岗位后，准备度与匹配结果会自动更新。"
                actionLabel="设置目标方向"
                onAction={() => router.push("/radar?editTarget=1" as never)}
              />
            </Surface>
          ) : showSkeleton ? (
            <Skeleton variant="card" style={styles.prepSkeleton} />
          ) : (
            <Surface style={styles.prepCard}>
              <View style={styles.prepTop}>
                <View style={styles.prepTopText}>
                  <Text style={styles.prepLabel}>目标方向</Text>
                  <Text style={styles.prepGoal}>{targetRole}</Text>
                </View>
                <View style={styles.prepScoreBox}>
                  <Text style={[styles.prepScore, tabularNums]}>
                    {overall}
                    <Text style={styles.prepScoreUnit}>%</Text>
                  </Text>
                  <Text style={styles.prepScoreLabel}>综合准备度</Text>
                </View>
              </View>
              <Text style={styles.prepVerdict}>{goalVerdict}</Text>
              <View style={[styles.weakChip, { backgroundColor: weakSoft, borderColor: withAlpha(weakStrong, 0.28) }]}>
                <ThemedIcon
                  name={weakest.score >= 100 ? "checkmark-circle-outline" : "alert-circle-outline"}
                  size={13}
                  color={weakStrong}
                />
                <Text style={styles.weakChipText}>{weakestChip}</Text>
              </View>
              <View style={styles.dimList}>
                {dimensions.map((dimension) => (
                  <View key={dimension.key} style={styles.dimRow}>
                    <View style={styles.dimHead}>
                      <Text style={styles.dimLabel}>{dimension.label}</Text>
                      <Text style={[styles.dimScore, tabularNums]}>{dimension.score}%</Text>
                    </View>
                    <ProgressBar
                      value={Math.max(0, dimension.score) / 100}
                      tone={dimension.score >= 80 ? "success" : dimension.score >= 55 ? "primary" : "warning"}
                      height={6}
                    />
                    {dimension.detail ? <Text style={styles.dimDetail} numberOfLines={1}>{dimension.detail}</Text> : null}
                  </View>
                ))}
              </View>

              {appStats ? (
                <View style={styles.funnelBlock}>
                  <View style={styles.funnelHead}>
                    <Text style={styles.funnelTitle}>投递漏斗</Text>
                    <Text style={styles.funnelMeta}>{activeApplications ?? 0} 个进行中</Text>
                  </View>
                  <View style={styles.funnelRow}>
                    {funnelStages.map((stage) => {
                      const base = Math.max(1, submittedCount ?? 0);
                      const ratio = stage.count === null ? 0 : Math.min(1, stage.count / base);
                      const width = ((stage.count && stage.count > 0 ? Math.max(0.08, ratio) : 0) * 100 + "%") as `${number}%`;
                      return (
                        <View key={stage.key} style={styles.funnelStep}>
                          <View style={styles.funnelBar}>
                            <View style={[styles.funnelFill, { width }]} />
                          </View>
                          <Text style={styles.funnelLabel} numberOfLines={1}>{stage.label}</Text>
                          <Text style={[styles.funnelCount, tabularNums]}>{stage.count ?? "—"}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Surface>
          )}
        </Animated.View>

        {hasTarget ? (
          <Animated.View entering={entrance(3)}>
            <Surface style={styles.radarCard}>
              <RadarChart
                title="能力雷达"
                axes={dimensions.map((dimension) => ({ key: dimension.key, label: DIMENSION_AXIS_LABELS[dimension.key] }))}
                values={dimensions.map((dimension) => Math.max(0, dimension.score) / 100)}
                score={overall}
                scoreLabel="综合"
                size={220}
                rings={4}
              />
            </Surface>
          </Animated.View>
        ) : null}

        <Animated.View entering={entrance(4)}>
          <Surface padded={false} style={styles.rowList}>
            {prepRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <EntryRow row={row} />
              </View>
            ))}
          </Surface>
        </Animated.View>

        <SectionTitle title="更多入口" style={styles.section} />
        <Animated.View entering={entrance(5)}>
          <Surface padded={false} style={styles.rowList}>
            {moreRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <EntryRow row={row} />
              </View>
            ))}
          </Surface>
        </Animated.View>

        {skills.length > 0 ? (
          <>
            <SectionTitle
              title="我的技能"
              right={<Text style={styles.sectionMeta}>{skills.length + " 项" + (gapSkills > 0 ? " · 待补 " + gapSkills : " · 已覆盖")}</Text>}
              style={styles.section}
            />
            <Animated.View entering={entrance(6)}>
              <Surface style={styles.skillsCard}>
                <View style={styles.skillChips}>
                  {skills.slice(0, 12).map((skill) => (
                    <View key={String(skill.id)} style={styles.skillChip}>
                      <Text style={styles.skillChipText} numberOfLines={1}>{skill.name}</Text>
                    </View>
                  ))}
                </View>
                {gapSkillItems.length > 0 ? (
                  <>
                    <View style={styles.skillsDivider} />
                    <View style={styles.gapHead}>
                      <Text style={styles.gapTitle}>待补技能</Text>
                      <Text style={styles.gapCount}>{gapSkills} 项低于 Lv 3</Text>
                    </View>
                    <View style={styles.gapList}>
                      <BarList items={gapSkillItems} />
                    </View>
                  </>
                ) : null}
              </Surface>
            </Animated.View>
          </>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    pageHead: { marginBottom: 0 },
    section: { marginTop: spacing.md, marginBottom: 0 },
    sectionMeta: { ...typography.micro, fontWeight: "700", color: colors.textMuted },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
    kpiCard: {
      flexBasis: "48%",
      flexGrow: 1,
      minWidth: 0,
      minHeight: 112,
      padding: 14,
      gap: 7,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    kpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    kpiLabel: { ...typography.meta, fontWeight: "600", color: colors.textMuted, flex: 1, minWidth: 0 },
    kpiIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    kpiValue: { ...typography.title2, fontWeight: "800", color: colors.text },
    kpiUnit: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    kpiHint: { ...typography.micro, color: colors.textFaint },

    zhaohuaCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: radius.card,
      backgroundColor: colors.primary,
    },
    zhaohuaIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha("#FFFFFF", 0.16),
      flexShrink: 0,
    },
    zhaohuaBody: { flex: 1, minWidth: 0, gap: 1 },
    zhaohuaKicker: { ...typography.micro, fontWeight: "700", color: withAlpha("#FFFFFF", 0.7) },
    zhaohuaTitle: { ...typography.title2, fontWeight: "800", color: "#FFFFFF" },
    zhaohuaSub: { ...typography.meta, color: withAlpha("#FFFFFF", 0.82) },
    zhaohuaCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: withAlpha("#FFFFFF", 0.16),
      flexShrink: 0,
    },
    zhaohuaCtaText: { ...typography.caption, fontWeight: "700", color: "#FFFFFF" },

    card: { paddingVertical: 6 },
    prepCard: { gap: 12 },
    prepTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    prepTopText: { flex: 1, minWidth: 0, gap: 3 },
    prepLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    prepGoal: { ...typography.headline, fontWeight: "700", color: colors.text },
    prepScoreBox: { alignItems: "flex-end", minWidth: 62 },
    prepScore: { ...typography.title2, color: colors.text },
    prepScoreUnit: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    prepScoreLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    prepVerdict: { ...typography.meta, color: colors.textSecondary, lineHeight: 17 },
    weakChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderRadius: radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 6,
      maxWidth: "100%",
    },
    weakChipText: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1 },
    dimList: { gap: 10, paddingTop: 2 },
    dimRow: { gap: 5 },
    dimHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    dimLabel: { ...typography.micro, fontWeight: "600", color: colors.textSecondary },
    dimScore: { ...typography.micro, fontWeight: "800", color: colors.text },
    dimDetail: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    prepSkeleton: { height: 168, borderRadius: radius.card },

    funnelBlock: { gap: 8, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    funnelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8 },
    funnelTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    funnelMeta: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    funnelRow: { flexDirection: "row", gap: 7 },
    funnelStep: { flex: 1, minWidth: 0, gap: 3 },
    funnelBar: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    funnelFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
    funnelLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    funnelCount: { ...typography.caption, fontWeight: "700", color: colors.text },

    radarCard: { paddingTop: 12, paddingBottom: 6 },
    rowList: { paddingVertical: 2 },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 14, marginRight: 14 },
    entryRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 13, minHeight: 56 },
    entryIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    entryBody: { flex: 1, minWidth: 0, gap: 2 },
    entryTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    entrySub: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    entryEnd: { ...typography.micro, fontWeight: "700", color: colors.textMuted, maxWidth: 96 },

    skillsCard: { gap: 10 },
    skillsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 2 },
    gapHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    gapTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    gapCount: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    gapList: { marginTop: 2 },
    skillChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    skillChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    skillChipText: { ...typography.micro, fontWeight: "700", color: colors.primary },
  });
