import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { ProgressBar } from "@/components/v2/progress-bar";
import { BarList, RadarChart } from "@/components/v2/charts";
import { withAlpha } from "@/lib/chart-math";
import { fetchJobStats, toggleJobFavorite } from "@/lib/jobs";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import {
  INITIAL_FIRST_LOAD_GATE,
  nextFirstLoadGate,
  shouldShowSkeleton,
} from "@/lib/first-load";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { formatRelativeTime } from "@learn-workbench/shared/dates";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { CareerReadiness, JobStats, ReadinessDimension, UserSkillView } from "@learn-workbench/shared/schemas";

/**
 * 职业 Hub（V3 浅色科技风 · 按《移动端 UI 优化提案》重排）
 *
 * 结构（对齐 .local/index-demo-optimized.html 职业页 872-949 行）：
 *   ① PageHead：eyebrow「CAREER DESK」/ 职业 / 「今日抓取 N 条新岗位，其中 M 条高匹配」
 *   ② 筛选 chips：全部 / 高匹配 / 岗位方向 / 已收藏 / 已投递（点选即时切换下方列表）
 *   ③ 岗位卡列表：公司字块 + 职位 + 公司·城市·学历 + 收藏 + 薪资/标签 + 匹配度条 + 百分比；
 *      点卡片进 /job-detail?id=（详情页负责投递），卡片右上角书签直接收藏/取消收藏
 *   ④ 求职准备：准备度卡（目标方向 + 综合准备度 + 四维 + 优先补齐）+ 能力雷达卡
 *      （v2.1 RadarChart，与四维条同一份 readiness 数据）+ 三行入口
 *      （面试题库 / 简历与附件 / 岗位抓取记录）
 *   ⑤ 更多入口：我的投递 / 岗位雷达 / 市场分析 / 证书（保留旧版全部跳转目标）
 *   ⑥ 我的技能：技能画像 chips + 待补技能排行（v2.1 BarList，数据仍来自 /api/profile/skills）
 *
 * 数据口径（全部为现有真实接口，失败降级、不清空旧数据、不编造数字）：
 *   - /api/profile/readiness  四维准备度 + overall + targetRole + matchedJobs（旧版同源）
 *   - /api/profile/skills     技能画像（旧版同源）
 *   - /api/jobs?publishedWithin=today  今日新岗位数（旧版同源，未登录也能取）
 *   - /api/jobs/stats         今日抓取（今日新增 / 平台数 / 最近一次抓取时间，用于「岗位抓取记录」行）
 *   - /api/jobs/applications  投递各阶段数量（旧版同源）
 *   - /api/jobs/radar         匹配岗位候选集（每岗真实匹配度 overall / 方向 functionKey / 收藏 / 投递标记）
 *   匹配度只来自雷达接口真实打分；没有画像或该岗位未进候选集时显示「—」，不估算、不伪造。
 *
 * 动效只沿用既有 entrance 分组（useScreenEntrance），不新增补间 / 弹簧动效点。
 */

/** 岗位候选集上限：与 /radar 页的 FETCH_LIMIT 同口径（≤200，接口硬上限） */
const RADAR_FETCH_LIMIT = 200;
/** 首页岗位卡最多展示条数（其余引导到招花市场） */
const FEED_LIMIT = 8;
/** 高匹配阈值：与 Web 侧雷达分桶 HIGH_MATCH_MIN 一致 */
const HIGH_MATCH_MIN = 75;

/** 「进行中」= 未到终态的投递（offer / hired / closed 之外） */
const ACTIVE_APPLICATION_STAGES = [
  "favorite",
  "ready",
  "applied",
  "online_test",
  "interview1",
  "interview2",
] as const;

/** 求职进度五阶段（与 /applications 页同口径，只用于当前阶段文案） */
const APPLICATION_STAGES = ["已投递", "筛选", "笔试", "面试", "Offer"] as const;

/**
 * readiness 四维在 V3 原型里的文案：数据仍取服务端四维分数（skill/project/resume/interview），
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
 * 雷达轴名（v2.1 P3 沿用）：RadarChart 的轴标画在 Svg 画布边缘，4 维时左右两轴余量很小，
 * 4 字名称会被画布裁掉；轴名统一用 2 字短名，完整名称 + 分数 + detail 在准备度卡的四维条里。
 */
const DIMENSION_AXIS_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "基础",
  project: "项目",
  resume: "证书",
  interview: "面试",
};

/** 入口图标色调：只取主题 token 里的 soft/strong 一对 */
type ToolTone = "primary" | "teal" | "success" | "accent";
const TOOL_TONES: Record<ToolTone, { soft: keyof ThemeColors; strong: keyof ThemeColors }> = {
  primary: { soft: "primarySoft", strong: "primary" },
  teal: { soft: "surfaceMuted", strong: "teal" },
  success: { soft: "successSoft", strong: "success" },
  accent: { soft: "accentSoft", strong: "accent" },
};

/** 技能画像里 level 只有 0-5；<3 视为「待补」（无画像时为 0 项） */
const SKILL_GAP_LEVEL = 3;

/** 雷达接口返回的岗位（只声明页面用到的字段，其余字段原样忽略） */
interface RadarFeedJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  education: string;
  experience: string;
  salaryText: string;
  functionKey: string;
  overall: number;
  matchedSkills: { skill: string }[];
  deadlineLabel: string | null;
  fromFavorite: boolean;
  fromApplication: boolean;
}

interface RadarFeed {
  hasProfile: boolean;
  total: number;
  top: RadarFeedJob[];
  buckets?: { highMatch?: RadarFeedJob[] };
}

/** 筛选维度：全部 / 高匹配 / 已收藏 / 已投递 / 岗位方向 */
type FeedFilter =
  | { kind: "all" }
  | { kind: "high" }
  | { kind: "fav" }
  | { kind: "applied" }
  | { kind: "function"; key: string };

const ALL_FILTER: FeedFilter = { kind: "all" };

function isSameFilter(a: FeedFilter, b: FeedFilter): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "function" || b.kind !== "function" || a.key === b.key;
}

/** 匹配度 → 语义色（沿用旧版四维的分档：≥80 达标、55–79 进行中、<55 提示） */
function matchToneOf(value: number): "success" | "primary" | "warning" {
  return value >= 80 ? "success" : value >= 55 ? "primary" : "warning";
}

/**
 * 求职进度当前阶段：按各阶段数量取「最远一步」。
 * 与旧版 StageTrack 的语义一致（current = 当前进行中的那一格，左侧为已完成）。
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

/** 公司首字（中文取首字，英文取首字母大写；空公司名给兜底字） */
function logoLetterOf(company: string): string {
  const trimmed = company.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "公";
}

/** 薪资文案：接口给的是原文；缺失时按「面议」占位，不估算区间 */
function salaryLabelOf(job: RadarFeedJob): string {
  const text = job.salaryText?.trim();
  return text ? text : "面议";
}

/** 卡片标签（最多 4 枚）：薪资（高亮）+ 经验 + 学历 + 命中技能/截止提醒，全部来自接口真实字段 */
function tagItemsOf(job: RadarFeedJob): { key: string; label: string; hot?: boolean }[] {
  const items: { key: string; label: string; hot?: boolean }[] = [
    { key: "salary", label: salaryLabelOf(job), hot: true },
  ];
  const experience = job.experience?.trim();
  if (experience) items.push({ key: "experience", label: experience });
  const education = job.education?.trim();
  if (education) items.push({ key: "education", label: education });
  for (const skill of job.matchedSkills ?? []) {
    if (items.length >= 4) break;
    const label = skill?.skill?.trim();
    if (label) items.push({ key: "skill-" + label, label });
  }
  if (items.length < 4 && job.deadlineLabel) {
    items.push({ key: "deadline", label: job.deadlineLabel });
  }
  return items.slice(0, 4);
}

/** 行式入口（求职准备 / 更多入口共用）：图标芯片 + 标题 + 副文案 + 右侧值 + 箭头 */
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
        <Text style={styles.entryTitle} numberOfLines={1}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text style={styles.entrySub} numberOfLines={1}>
            {row.subtitle}
          </Text>
        ) : null}
      </View>
      {row.end ? (
        <Text style={[styles.entryEnd, tabularNums]} numberOfLines={1}>
          {row.end}
        </Text>
      ) : null}
      <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
    </PressableScale>
  );
}

/** 岗位卡：左上公司字块 + 职位/公司·城市·学历 + 右上书签 + 标签 + 匹配度条 */
interface JobCardProps {
  job: RadarFeedJob;
  tone: ToolTone;
  /** 是否有真实匹配度（无画像 / 未进候选集时为 false，匹配度显示「—」） */
  hasMatchData: boolean;
  favorited: boolean;
  favoriteBusy: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

function JobCard({
  job,
  tone,
  hasMatchData,
  favorited,
  favoriteBusy,
  onOpen,
  onToggleFavorite,
}: JobCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /** logo 两种色调交替（原型：蓝 / 橘）；橘色底用 accentStrong 保证字块对比度 */
  const logoSoft = tone === "accent" ? colors.accentSoft : colors.primarySoft;
  const logoStrong = tone === "accent" ? colors.accentStrong : colors.primary;
  const match = hasMatchData ? Math.max(0, Math.min(100, Math.round(job.overall))) : null;
  const tags = tagItemsOf(job);
  const meta =
    job.company.trim() +
    " · " +
    (job.city.trim() || "城市不限") +
    " · " +
    (job.education.trim() || "学历不限");

  return (
    <Surface tier="elevated" style={styles.jobCard}>
      {/* 卡片主体：进岗位详情（收藏按钮是 Surface 的另一个子节点，非嵌套可点区域） */}
      <PressableScale
        style={styles.jobMain}
        hitSlop={4}
        haptic
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={
          "查看岗位详情：" + job.title + "，" + job.company +
          (match === null ? "" : "，匹配度 " + match + "%")
        }
      >
        <View style={styles.jobTop}>
          <View style={[styles.logo, { backgroundColor: logoSoft }]}>
            <Text style={[styles.logoText, { color: logoStrong }]} numberOfLines={1}>
              {logoLetterOf(job.company)}
            </Text>
          </View>
          <View style={styles.jobTitleBox}>
            <Text style={styles.jobTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.jobMeta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </View>

        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag.key} style={[styles.tag, tag.hot ? styles.tagHot : null]}>
              <Text
                style={[styles.tagText, tag.hot ? styles.tagTextHot : null]}
                {...TEXT_SCALE_POLICY.chrome}
                numberOfLines={1}
              >
                {tag.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.matchRow}>
          <Text style={styles.matchLabel}>匹配度</Text>
          <View style={styles.matchBar}>
            <ProgressBar
              value={match === null ? 0 : match / 100}
              tone={match === null ? "primary" : matchToneOf(match)}
              height={5}
            />
          </View>
          <Text style={[styles.matchValue, tabularNums]}>{match === null ? "—" : match + "%"}</Text>
        </View>
      </PressableScale>

      {/* 收藏：右上角书签，独立热区（hitSlop 10），不会触发卡片跳转 */}
      <PressableScale
        style={[styles.bookmark, favorited ? styles.bookmarkOn : null]}
        hitSlop={10}
        haptic
        disabled={favoriteBusy}
        onPress={onToggleFavorite}
        accessibilityRole="button"
        accessibilityState={{ selected: favorited, disabled: favoriteBusy }}
        accessibilityLabel={(favorited ? "取消收藏：" : "收藏：") + job.title}
      >
        <ThemedIcon
          ios={favorited ? "bookmark.fill" : "bookmark"}
          name={favorited ? "bookmark" : "bookmark-outline"}
          size={18}
          color={favorited ? colors.primary : colors.textMuted}
        />
      </PressableScale>
    </Surface>
  );
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
  /** v20-E3：首屏入场错峰（减弱动态时自动不播；不新增动效点） */
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  /** 首屏骨架屏闸门（lib/first-load）：只在首轮无数据时出现，刷新不回退 */
  const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
  const showSkeleton = shouldShowSkeleton(gate);
  /** 今日新岗位数（/api/jobs 现有接口；失败/未登录为 null，文案降级） */
  const [todayNewJobs, setTodayNewJobs] = useState<number | null>(null);
  /** 投递各阶段数量（/api/jobs/applications；null = 未登录 / 拉取失败） */
  const [appStats, setAppStats] = useState<Record<string, number> | null>(null);
  /** 招花统计（今日抓取 / 平台数 / 最近一次抓取时间；登录后可用） */
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  /** 匹配岗位候选集（每岗真实匹配度 + 方向 + 收藏/投递标记） */
  const [radar, setRadar] = useState<RadarFeed | null>(null);
  /** 收藏乐观覆盖（jobId → 是否已收藏），失败回滚 */
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  /** 当前筛选（无效筛选自动回落「全部」，见 effectiveFilter） */
  const [filter, setFilter] = useState<FeedFilter>(ALL_FILTER);

  /**
   * 取数：沿用旧版 readiness / skills / 今日岗位数 / 投递统计四条链路，
   * 新增 /api/jobs/stats（抓取记录）与 /api/jobs/radar（匹配岗位集）。
   * 除 readiness 外全部允许失败（.catch → null / 保留旧值），不影响首屏。
   */
  const loadCareer = useCallback(async () => {
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
        if (stats && typeof stats === "object") {
          setAppStats(stats as Record<string, number>);
        }
      }
      if (statsRes) setJobStats(statsRes);
      if (radarRes?.ok) {
        const data = (await radarRes.json().catch(() => null)) as RadarFeed | null;
        if (data && Array.isArray(data.top)) setRadar(data);
      }
    } catch {
      // 离线或未登录：保持上一次数据（首屏 hero 降级）
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    } finally {
      // 首轮落定（成功时幂等保留 hasData；失败时也不会清空已有数据）
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    }
  }, [token]);

  // 沿用本仓既有写法：首帧加载推迟一个宏任务（不触发 set-state-in-effect 的级联渲染）
  useEffect(() => {
    const timer = setTimeout(() => void loadCareer(), 0);
    return () => clearTimeout(timer);
  }, [loadCareer]);

  const { control: careerRefresh } = usePullRefresh(loadCareer, { stickyHeader: true });

  /* ---------------- 准备度（旧版数据全部保留） ---------------- */
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
  const weakStrong = weakest.score >= 100 ? colors.success : colors.warning;
  const weakSoft = weakest.score >= 100 ? colors.successSoft : colors.warningSoft;

  const resumeScore = dimensions.find((item) => item.key === "resume")?.score ?? 0;
  const resumeMissingKinds = Math.max(0, 4 - Math.round(resumeScore / 25));
  const interviewDetail = dimensions.find((item) => item.key === "interview")?.detail ?? "";
  const matchedJobs = readiness?.matchedJobs ?? 0;

  /* ---------------- 投递（旧版同源） ---------------- */
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
        : "还没有投递记录 · 先收藏目标岗位";

  /** 待补技能：技能画像中熟练度低于 3 的项（无画像即 0） */
  const gapSkills = skills.filter((skill) => skill.level < SKILL_GAP_LEVEL).length;

  /**
   * 待补技能排行（v2.1 BarList 保留）：与 gapSkills 同一批「待补」项，
   * 条长 = 缺口大小（Lv 越低缺口越大），右侧仍显示真实 Lv，不做任何推断。
   * 排序用普通字符串比较（Hermes 的 Intl 不保证完整，见 lib/focus-stats.ts 的同款注释）。
   */
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
          /** Lv 0 完全空白 → danger；Lv 1–2 → warning（越浅缺口越小） */
          color: skill.level <= 0 ? colors.danger : colors.warning,
        })),
    [skills, colors]
  );

  /* ---------------- 岗位列表 / 筛选 ---------------- */
  const feedJobs = useMemo(() => (radar?.top ?? []).slice(0, FEED_LIMIT), [radar]);
  const hasMatchData = Boolean(radar?.hasProfile);
  /** 高匹配条数来自雷达分桶（真实打分）；无画像时为 null（不显示该 chip） */
  const highMatchCount = hasMatchData ? radar?.buckets?.highMatch?.length ?? 0 : null;

  const isBookmarked = useCallback(
    (job: RadarFeedJob) => favOverride[String(job.jobId)] ?? job.fromFavorite,
    [favOverride]
  );

  /** 岗位方向 chips：从候选集真实 functionKey 聚合（排除未分类「其他」），最多 3 个 */
  const functionChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of feedJobs) {
      const key = job.functionKey?.trim();
      if (!key || key === "其他") continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, 3)
      .map(([key, count]) => ({ key, count }));
  }, [feedJobs]);

  const filterChips = useMemo(() => {
    const list: { key: string; label: string; filter: FeedFilter }[] = [
      { key: "all", label: "全部 " + feedJobs.length, filter: ALL_FILTER },
    ];
    if (hasMatchData) {
      const highInFeed = feedJobs.filter((job) => job.overall >= HIGH_MATCH_MIN).length;
      if (highInFeed > 0) {
        list.push({ key: "high", label: "高匹配 " + highInFeed, filter: { kind: "high" } });
      }
    }
    // 方向 chips 与原型一致排在收藏之前（全部 → 方向 → 收藏 → 投递）
    for (const item of functionChips) {
      list.push({ key: "function:" + item.key, label: item.key + " " + item.count, filter: { kind: "function", key: item.key } });
    }
    const favoriteCount = feedJobs.filter(isBookmarked).length;
    if (favoriteCount > 0) {
      list.push({ key: "fav", label: "已收藏 " + favoriteCount, filter: { kind: "fav" } });
    }
    const appliedCount = feedJobs.filter((job) => job.fromApplication).length;
    if (appliedCount > 0) {
      list.push({ key: "applied", label: "已投递 " + appliedCount, filter: { kind: "applied" } });
    }
    return list;
  }, [feedJobs, hasMatchData, isBookmarked, functionChips]);

  /** 选中项失效（例如刚取消掉最后一个收藏）时自动回落「全部」，不需要副作用修正 */
  const effectiveFilter = useMemo(
    () => (filterChips.some((chip) => isSameFilter(chip.filter, filter)) ? filter : ALL_FILTER),
    [filterChips, filter]
  );

  const visibleJobs = useMemo(() => {
    switch (effectiveFilter.kind) {
      case "high":
        return feedJobs.filter((job) => hasMatchData && job.overall >= HIGH_MATCH_MIN);
      case "fav":
        return feedJobs.filter(isBookmarked);
      case "applied":
        return feedJobs.filter((job) => job.fromApplication);
      case "function":
        return feedJobs.filter((job) => (job.functionKey ?? "").trim() === effectiveFilter.key);
      default:
        return feedJobs;
    }
  }, [feedJobs, effectiveFilter, hasMatchData, isBookmarked]);

  const openJob = useCallback((job: RadarFeedJob) => {
    router.push(("/job-detail?id=" + encodeURIComponent(String(job.jobId))) as never);
  }, []);

  /** 收藏 / 取消收藏：乐观更新 + 失败回滚（POST /api/jobs/:id/favorite，与收藏夹页同源） */
  const toggleFavorite = useCallback(
    async (job: RadarFeedJob) => {
      if (!token) {
        // 未登录：收藏需要账号，跳登录入口（与页面空态的「去设置」同目标）
        router.push("/settings" as never);
        return;
      }
      const key = String(job.jobId);
      if (favoriteBusy) return;
      const wasFav = isBookmarked(job);
      setFavoriteBusy(key);
      setFavOverride((prev) => ({ ...prev, [key]: !wasFav }));
      try {
        const favorited = await toggleJobFavorite(key);
        setFavOverride((prev) => ({ ...prev, [key]: favorited }));
      } catch (error) {
        setFavOverride((prev) => ({ ...prev, [key]: wasFav }));
        Alert.alert("收藏操作失败", error instanceof Error ? error.message : "请稍后重试");
      } finally {
        setFavoriteBusy(null);
      }
    },
    [token, favoriteBusy, isBookmarked]
  );

  /** 页头副文案：今日抓取数 + 高匹配数（任一缺失时降级为说明文案，不编数字） */
  const todayCount = jobStats?.todayNew ?? todayNewJobs;
  const subtitle =
    todayCount !== null && highMatchCount !== null
      ? "今日抓取 " + todayCount + " 条新岗位，其中 " + highMatchCount + " 条高匹配。"
      : todayCount !== null
        ? "今日抓取 " + todayCount + " 条新岗位，完善技能画像后可看匹配度。"
        : highMatchCount !== null
          ? "今日抓取记录待同步，当前有 " + highMatchCount + " 条高匹配岗位。"
          : "登录后同步岗位抓取与匹配度；也可以先看看岗位库。";

  /** 求职准备三行（demo 结构）：面试题库 / 简历与附件 / 岗位抓取记录 */
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
      key: "crawl",
      title: "岗位抓取记录",
      subtitle: jobStats
        ? "今日新增 " + jobStats.todayNew + " · " + jobStats.platformCount + " 个平台"
        : "抓取状态与岗位来源",
      end: jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "—",
      icon: "refresh",
      tone: "teal",
      href: "/jobs",
      accessibilityLabel: "岗位抓取记录，打开招花市场",
    },
  ];

  /** 更多入口（旧版工具区全部跳转目标保留） */
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
      key: "certificates",
      title: "证书",
      subtitle: "证书 · 有效期提醒",
      icon: "ribbon-outline",
      tone: "success",
      href: "/certificates",
      accessibilityLabel: "证书，打开证书页",
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
        {/* ① 页头：Career Desk / 职业 / 今日抓取 N 条新岗位，其中 M 条高匹配 */}
        <PageHead
          eyebrow="CAREER DESK"
          title="职业"
          subtitle={subtitle}
          style={styles.pageHead}
        />

        {/* ② 筛选 chips：点选即时切换下方岗位列表（chips 横向可滑，不挤压布局） */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {filterChips.map((chip) => {
            const selected = isSameFilter(chip.filter, effectiveFilter);
            return (
              <Pressable
                key={chip.key}
                onPress={() => setFilter(chip.filter)}
                hitSlop={7}
                style={[styles.chip, selected ? styles.chipOn : null]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={chip.label}
              >
                <Text
                  style={[styles.chipText, selected ? styles.chipTextOn : null]}
                  {...TEXT_SCALE_POLICY.chrome}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ③ 岗位卡列表：匹配度来自 /api/jobs/radar 真实打分；点卡片进详情 */}
        <Animated.View style={styles.jobList} entering={entrance(0)}>
          {showSkeleton ? (
            <SkeletonCard count={2} />
          ) : visibleJobs.length === 0 ? (
            radar === null ? (
              <Surface style={styles.emptyCard}>
                <EmptyState
                  pattern="none"
                  icon="cloud-offline-outline"
                  title="岗位数据暂时不可用"
                  hint="检查网络后下拉刷新，或先打开招花市场浏览全部岗位。"
                  actionLabel="重新加载"
                  onAction={() => void loadCareer()}
                />
              </Surface>
            ) : effectiveFilter.kind !== "all" ? (
              <Surface style={styles.emptyFilterCard}>
                <Text style={styles.emptyFilterText}>当前筛选没有岗位</Text>
                <PressableScale
                  style={styles.emptyFilterCta}
                  hitSlop={8}
                  haptic
                  onPress={() => setFilter(ALL_FILTER)}
                  accessibilityRole="button"
                  accessibilityLabel="清除筛选，查看全部岗位"
                >
                  <Text style={styles.emptyFilterCtaText}>查看全部</Text>
                </PressableScale>
              </Surface>
            ) : (
              <Surface style={styles.emptyCard}>
                <EmptyState
                  pattern="none"
                  icon="search-outline"
                  title="还没有匹配的岗位"
                  hint="每天抓取的岗位会按匹配度排在这里；也可以先去招花市场看看。"
                  actionLabel="打开招花市场"
                  onAction={() => router.push("/jobs" as never)}
                />
              </Surface>
            )
          ) : (
            <>
              {visibleJobs.map((job, index) => (
                <JobCard
                  key={String(job.jobId)}
                  job={job}
                  tone={index % 2 === 0 ? "primary" : "accent"}
                  hasMatchData={hasMatchData}
                  favorited={isBookmarked(job)}
                  favoriteBusy={favoriteBusy === String(job.jobId)}
                  onOpen={() => openJob(job)}
                  onToggleFavorite={() => void toggleFavorite(job)}
                />
              ))}
              <PressableScale
                style={styles.feedMore}
                hitSlop={8}
                haptic
                onPress={() => router.push("/jobs" as never)}
                accessibilityRole="button"
                accessibilityLabel="查看全部岗位，打开招花市场"
              >
                <Text style={styles.feedMoreText}>查看全部岗位</Text>
                <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
              </PressableScale>
            </>
          )}
        </Animated.View>

        {/* ④ 求职准备：准备度卡 + 能力雷达 + 三行入口 */}
        <SectionTitle
          title="求职准备"
          right={
            <Text style={styles.sectionMeta}>
              {overall > 0 ? "准备度 " + overall + "%" : "准备度 —"}
            </Text>
          }
          style={styles.section}
        />
        <Animated.View entering={entrance(1)}>
          {!gate.firstLoadPending && !hasTarget ? (
            <Surface style={styles.card}>
              <EmptyState
                pattern="none"
                icon="flag-outline"
                title="还没有目标方向"
                hint="在「我的」里选择职业方向后，这里会显示准备度、四维明细与优先补齐建议。"
                actionLabel="去设置职业方向"
                onAction={() => router.push("/settings" as never)}
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
                <Text style={styles.weakChipText} {...TEXT_SCALE_POLICY.chrome}>
                  {weakestChip}
                </Text>
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
                    {dimension.detail ? (
                      <Text style={styles.dimDetail} numberOfLines={1}>
                        {dimension.detail}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </Surface>
          )}
        </Animated.View>

        {/* 能力雷达（v2.1 数据面板保留）：与上方四维条同一份 readiness 数据的雷达视图 */}
        {hasTarget ? (
          <Animated.View entering={entrance(2)}>
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

        <Animated.View entering={entrance(3)}>
          <Surface padded={false} style={styles.rowList}>
            {prepRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <EntryRow row={row} />
              </View>
            ))}
          </Surface>
        </Animated.View>

        {/* ⑤ 更多入口：旧版工具区的跳转目标全部保留 */}
        <SectionTitle title="更多入口" style={styles.section} />
        <Animated.View entering={entrance(4)}>
          <Surface padded={false} style={styles.rowList}>
            {moreRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <EntryRow row={row} />
              </View>
            ))}
          </Surface>
        </Animated.View>

        {/* ⑥ 我的技能：技能画像 chips（旧版 ⑦ 区块，数据同源） */}
        {skills.length > 0 ? (
          <>
            <SectionTitle
              title="我的技能"
              right={
                <Text style={styles.sectionMeta}>
                  {skills.length + " 项" + (gapSkills > 0 ? " · 待补 " + gapSkills : " · 已覆盖")}
                </Text>
              }
              style={styles.section}
            />
            <Animated.View entering={entrance(5)}>
              <Surface style={styles.skillsCard}>
                <View style={styles.skillChips}>
                  {skills.slice(0, 12).map((skill) => (
                    <View key={String(skill.id)} style={styles.skillChip}>
                      <Text style={styles.skillChipText} numberOfLines={1}>
                        {skill.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {gapSkillItems.length > 0 ? (
                  <>
                    <View style={styles.skillsDivider} />
                    <View style={styles.gapHead}>
                      <Text style={styles.gapTitle}>待补技能排行</Text>
                      <Text style={styles.gapCount}>{gapSkillItems.length + " 项 · 低于 Lv " + SKILL_GAP_LEVEL}</Text>
                    </View>
                    <BarList items={gapSkillItems} showRank style={styles.gapList} />
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
    /** 根容器必须不透明 —— Tab 场景叠放叠滑时不透出下层 */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /** 页头自带 17 下边距，content 的 gap 已经接管卡间距 */
    pageHead: { marginBottom: 0 },
    /** SectionTitle 自带 21 上边距，这里略收并与内容 gap 对齐 */
    section: { marginTop: spacing.md, marginBottom: 0 },
    sectionMeta: { ...typography.micro, fontWeight: "700", color: colors.textMuted },

    /* 筛选 chips：横向出血到屏幕边（父容器有 16 的内边距） */
    chipScroll: { marginHorizontal: -spacing.lg, marginTop: 2 },
    chipRow: { paddingHorizontal: spacing.lg, paddingVertical: 2, gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 32,
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    /** 选中：墨色底 + 反白字（与原型 .chips button.on 一致，浅/深主题都成立） */
    chipOn: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    chipTextOn: { color: colors.surface },

    /* 岗位卡 */
    jobList: { gap: 11 },
    jobCard: { padding: 15, gap: 11 },
    jobMain: { gap: 11 },
    jobTop: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingRight: 32 },
    logo: {
      width: 40,
      height: 40,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    logoText: { ...typography.headline, fontWeight: "800" },
    jobTitleBox: { flex: 1, minWidth: 0, gap: 3 },
    jobTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    jobMeta: { ...typography.meta, color: colors.textMuted },
    bookmark: {
      position: "absolute",
      top: 9,
      right: 9,
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    bookmarkOn: { backgroundColor: colors.primarySoft },
    tags: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    /** 薪资是卡内唯一「暖色」信息：阳光橘只标「钱 / 今天」，与提案一致 */
    tagHot: { backgroundColor: colors.accentSoft, borderColor: withAlpha(colors.accent, 0.16) },
    tagText: { ...typography.micro, fontWeight: "600", color: colors.textSecondary },
    tagTextHot: { color: colors.accentStrong, fontWeight: "700" },
    matchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    matchLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    matchBar: { flex: 1, minWidth: 0 },
    matchValue: { ...typography.micro, fontWeight: "800", color: colors.textSecondary, minWidth: 32, textAlign: "right" },
    feedMore: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    feedMoreText: { ...typography.caption, fontWeight: "700", color: colors.primary },

    /* 列表空态 / 筛选空态 */
    emptyCard: { paddingVertical: 6 },
    emptyFilterCard: { paddingVertical: 12, alignItems: "center", gap: 8 },
    emptyFilterText: { ...typography.meta, color: colors.textMuted },
    emptyFilterCta: {
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyFilterCtaText: { ...typography.caption, fontWeight: "700", color: colors.primary },

    /* 准备度卡 */
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
    /** 语义色放在图标/底色/描边上，文字用正文色：warning 橙在 warningSoft 上小字不可读 */
    weakChipText: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1 },
    dimList: { gap: 10, paddingTop: 2 },
    dimRow: { gap: 5 },
    dimHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    dimLabel: { ...typography.micro, fontWeight: "600", color: colors.textSecondary },
    dimScore: { ...typography.micro, fontWeight: "800", color: colors.text },
    dimDetail: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    prepSkeleton: { height: 168, borderRadius: radius.card },

    /* 能力雷达（v2.1 数据面板）：卡片内边距略收，图表自身自带标题行 */
    radarCard: { paddingTop: 12, paddingBottom: 6 },

    /* 行式入口（求职准备 / 更多入口） */
    rowList: { paddingVertical: 2 },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 14, marginRight: 14 },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      paddingVertical: 13,
      minHeight: 56,
    },
    entryIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    entryBody: { flex: 1, minWidth: 0, gap: 2 },
    entryTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    entrySub: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    entryEnd: { ...typography.micro, fontWeight: "700", color: colors.textMuted, maxWidth: 96 },

    /* 我的技能 */
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
