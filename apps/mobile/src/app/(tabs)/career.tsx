import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { EntryCard } from "@/components/entry-card";
import { StatStrip } from "@/components/stat-strip";
import { ProgressArc } from "@/components/progress-arc";
import { ProgressBar } from "@/components/stat";
import { Skeleton } from "@/components/skeleton";
import { Card } from "@/components/card";
import { ThemedIcon } from "@/components/themed-icon";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { spacing, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { CareerReadiness, UserSkillView } from "@learn-workbench/shared/schemas";

/**
 * 职业 Hub（v1.62 P0-4a 重构）
 *
 * 结构：紧凑 header（标题 + 准备度小环）→ 准备度卡（96 环 + StatStrip 三格 + 明细折叠）
 *      → 求职行动 3 张 hero 入口（招花 / 就业雷达 / 我的投递）
 *      → 简历与面试 2×2 mid 入口 → 技能 chips。
 *
 * 首屏入口 = 3 hero + 4 mid = 7 个（≤8），原来的 ListGroup 主入口与「更多职业工具」小卡/Sheet 已移除。
 * 数据：/api/profile/readiness + /api/profile/skills（沿用原口径）；「今日新岗位 / 进行中投递」两个
 * meta 数字复用现有接口（/api/jobs?publishedWithin=today、/api/jobs/applications），失败时降级为静态文案，
 * 不新增后端接口、不改数据逻辑。动效只沿用 PressableScale 按压与既有入场错峰（不新增动效点）。
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
  /** 进行中的投递数（现有 /api/jobs/applications 接口） */
  const [activeApplications, setActiveApplications] = useState<number | null>(null);
  /** 准备度明细折叠（默认收起） */
  const [dimensionsOpen, setDimensionsOpen] = useState(false);

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
          const active = ACTIVE_APPLICATION_STAGES.reduce(
            (sum, stage) => sum + (Number((stats as Record<string, unknown>)[stage]) || 0),
            0,
          );
          setActiveApplications(active);
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
  const goalVerdict =
    overall >= 80
      ? "准备充分，可以直接投递"
      : overall >= 55
        ? "接近达标，补一补短板"
        : overall > 0
          ? "还在积累，先补技能与项目"
          : "登录并记录技能 / 项目后显示";

  /** StatStrip 格子窄：目标岗位过长时截断（完整名称在准备度卡正文里） */
  const targetRoleShort = (() => {
    const role = readiness?.targetRole?.trim() || "未设置";
    return role.length > 8 ? role.slice(0, 8) + "…" : role;
  })();

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
    activeApplications !== null
      ? `进行中 ${activeApplications} 个 · 收藏 → Offer 全流程`
      : "收藏 → Offer 全流程";

  const midEntries = [
    { key: "resume", title: "简历", meta: "资产整理与预览", icon: "document-text-outline" as const, tone: "primary" as const, href: "/resume" },
    { key: "interview", title: "面试", meta: "题库 · 模拟面试", icon: "chatbubbles-outline" as const, tone: "teal" as const, href: "/interview" },
    { key: "certificates", title: "证书", meta: "证书 · 有效期提醒", icon: "ribbon-outline" as const, tone: "success" as const, href: "/certificates" },
    { key: "market", title: "市场分析", meta: "城市 · 薪资 · 技能热度", icon: "trending-up-outline" as const, tone: "accent" as const, href: "/market" },
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
        {/* ① 紧凑 header：标题 + 准备度小环（替代原 LargeTitle 大标题） */}
        <View style={styles.pageHead}>
          <View style={styles.pageHeadText}>
            <Text style={styles.pageTitle}>职业</Text>
            <Text style={styles.pageSubtitle} numberOfLines={1}>{goalVerdict}</Text>
          </View>
          {loading && !readiness ? (
            <Skeleton variant="line" style={styles.headSkeleton} />
          ) : (
            <ProgressArc
              progress={overall / 100}
              size={52}
              strokeWidth={6}
              value={`${overall}%`}
              showDot={false}
              beatOnChange
            />
          )}
        </View>

        {/* ② 准备度卡：96 环 + StatStrip 三格 + 明细折叠 */}
        <Animated.View entering={entrance(0)}>
          <Card style={styles.readinessCard}>
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
                <Text style={styles.readinessLabel}>目标岗位</Text>
                <Text style={styles.readinessGoal} numberOfLines={2}>
                  {readiness?.targetRole?.trim() || "未设置目标岗位"}
                </Text>
                <Text style={styles.readinessHint} numberOfLines={2}>{goalVerdict}</Text>
              </View>
            </View>

            <StatStrip
              items={[
                { label: "目标岗位", value: targetRoleShort, tone: "primary" },
                { label: "匹配岗位", value: readiness ? readiness.matchedJobs : "—", unit: "个", tone: "success" },
                { label: "技能", value: skills.length, unit: "项", tone: "accent" },
              ]}
            />

            <Pressable
              onPress={() => setDimensionsOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded: dimensionsOpen }}
              accessibilityLabel={dimensionsOpen ? "收起准备度明细" : "展开准备度明细"}
              style={styles.dimToggle}
            >
              <Text style={styles.dimToggleText}>准备度明细</Text>
              <Text style={styles.dimToggleHint}>
                {readiness && readiness.dimensions.length > 0 ? `${readiness.dimensions.length} 个维度` : "暂无维度"}
              </Text>
              <ThemedIcon name={dimensionsOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
            </Pressable>

            {dimensionsOpen ? (
              readiness && readiness.dimensions.length > 0 ? (
                <View style={styles.dimList}>
                  {readiness.dimensions.map((dimension) => (
                    <View key={dimension.key} style={styles.dim}>
                      <View style={styles.dimHead}>
                        <Text style={styles.dimLabel}>{dimension.label}</Text>
                        <Text style={styles.dimScore}>{dimension.score}%</Text>
                      </View>
                      <ProgressBar progress={dimension.score / 100} height={6} />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.dimEmpty}>登录并记录技能 / 项目 / 面试日志后，这里会呈现职业画像</Text>
              )
            ) : null}
          </Card>
        </Animated.View>

        {/* ③ 求职行动：3 张 hero 入口 */}
        <SectionHeader title="求职行动" />
        <Animated.View style={styles.stack} entering={entrance(1)}>
          <EntryCard
            size="hero"
            icon="flower-outline"
            tone="primary"
            title="招花市场"
            meta={jobsMeta}
            cta="去搜岗位"
            badge={todayNewJobs !== null && todayNewJobs > 0 ? `今日 +${todayNewJobs}` : undefined}
            onPress={() => router.push("/jobs" as never)}
          />
          <EntryCard
            size="hero"
            icon="radio-outline"
            tone="teal"
            title="就业雷达"
            meta={radarMeta}
            cta="看匹配"
            onPress={() => router.push("/radar" as never)}
          />
          <EntryCard
            size="hero"
            icon="briefcase-outline"
            tone="accent"
            title="我的投递"
            meta={applicationsMeta}
            cta="推进流程"
            onPress={() => router.push("/applications" as never)}
          />
        </Animated.View>

        {/* ④ 简历与面试：2×2 mid 入口 */}
        <SectionHeader title="简历与面试" />
        <Animated.View style={styles.grid} entering={entrance(2)}>
          {midEntries.map((entry) => (
            <EntryCard
              key={entry.key}
              size="mid"
              icon={entry.icon}
              tone={entry.tone}
              title={entry.title}
              meta={entry.meta}
              style={styles.gridItem}
              onPress={() => router.push(entry.href as never)}
            />
          ))}
        </Animated.View>

        {/* ⑤ 我的技能（保留 chips） */}
        {skills.length > 0 ? (
          <Card style={styles.skillsCard}>
            <View style={styles.skillsHead}>
              <Text style={styles.skillsTitle}>我的技能</Text>
              <Text style={styles.skillsCount}>{skills.length} 项</Text>
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

    /* 紧凑 header */
    pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    pageHeadText: { flex: 1, minWidth: 0, gap: 2 },
    pageTitle: { ...typography.title2, color: colors.text },
    pageSubtitle: { ...typography.caption, color: colors.textMuted },
    headSkeleton: { width: 52, height: 52, borderRadius: 26 },

    /* 准备度卡 */
    readinessCard: { gap: spacing.md },
    readinessTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    ringSkeleton: { width: 96, height: 96, borderRadius: 48 },
    readinessBody: { flex: 1, minWidth: 0, gap: 2 },
    readinessLabel: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    readinessGoal: { ...typography.headline, color: colors.text },
    readinessHint: { ...typography.caption, color: colors.textSecondary },
    dimToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    dimToggleText: { ...typography.callout, fontWeight: "700", color: colors.text, flex: 1, minWidth: 0 },
    dimToggleHint: { ...typography.caption, color: colors.textMuted },
    dimList: { gap: spacing.sm },
    dim: { gap: 4 },
    dimHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    dimLabel: { ...typography.caption, fontWeight: "600", color: colors.text },
    dimScore: { ...typography.caption, color: colors.textMuted },
    dimEmpty: { ...typography.callout, color: colors.textSecondary },

    /* 求职行动 */
    stack: { gap: spacing.sm },

    /* 2×2 入口 */
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    gridItem: { width: "47.5%", flexGrow: 1 },

    /* 技能 */
    skillsCard: { gap: spacing.md },
    skillsHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    skillsTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    skillsCount: { ...typography.caption, color: colors.textMuted },
    skillChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    skillChip: {
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      maxWidth: "100%",
    },
    skillChipText: { ...typography.caption, fontWeight: "700", color: colors.primary },
  });
