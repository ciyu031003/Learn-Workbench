/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { radius, spacing, typography } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { ListGroup, ListRow } from "@/components/list-row";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { Skeleton } from "@/components/skeleton";
import { ProgressBar, Stat, StatLine } from "@/components/stat";
import { Button } from "@/components/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { router } from "expo-router";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { CareerReadiness, UserSkillView } from "@learn-workbench/shared";

type IconName = Parameters<typeof ThemedIcon>[0]["name"];

/**
 * 职业 Hub 的信息分级（见 docs/APP端优化方案-v2 §3）：
 * - 首屏重点（≤2 块）：① 职业准备度 hero ② 三个主入口（招花 / 雷达 / 我的求职）
 * - 非重点收纳：市场分析 / 简历 / 证书 / 面试 + 准备度维度明细 → 「更多职业工具」Sheet
 */
const FOCUS_SECTIONS = [
  { key: "jobs", title: "招花市场", desc: "岗位搜索 · 收藏 · 匹配", icon: "flower-outline" as IconName, href: "/jobs" },
  { key: "radar", title: "就业雷达", desc: "匹配度 · 信号岗位", icon: "radio-outline" as IconName, href: "/radar" },
  { key: "applications", title: "我的求职", desc: "收藏 → Offer 全流程", icon: "briefcase-outline" as IconName, href: "/applications" },
] as const;

const MORE_SECTIONS = [
  { key: "market", title: "市场分析", desc: "城市 · 薪资 · 技能热度", icon: "trending-up-outline" as IconName, href: "/market" },
  { key: "resume", title: "简历", desc: "资产整理与预览", icon: "document-text-outline" as IconName, href: "/resume" },
  { key: "certificates", title: "我的证书", desc: "证书 · 有效期提醒", icon: "ribbon-outline" as IconName, href: "/certificates" },
  { key: "interview", title: "面试", desc: "题库 · 模拟面试", icon: "chatbubbles-outline" as IconName, href: "/interview" },
] as const;

export default function CareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** 入场错峰统一走 lib/stagger（步长取 token）；减弱动态时不传 entering，彻底不动 */
  const reduced = useReducedMotion();
  const token = useAppStore((s) => s.token);
  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  /**
   * v17/v18 收尾：把 loader 从 useEffect 内提到组件作用域（useCallback 稳定引用），
   * 首次加载与下拉刷新共用同一条路径 —— 取数口径、端点与同步逻辑一行未改。
   */
  const loadCareer = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = "Bearer " + token;
      const [rR, sR] = await Promise.all([
        fetch(getApiUrl() + "/api/profile/readiness", { headers }),
        fetch(getApiUrl() + "/api/profile/skills", { headers }),
      ]);
      const rd = await rR.json().catch(() => null);
      const sd = await sR.json().catch(() => null);
      if (rR.ok && rd) setReadiness(rd);
      if (sR.ok && Array.isArray(sd.skills)) setSkills(sd.skills);
    } catch {
      // 离线或未登录：保持 null
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 沿用本仓既有写法（today.tsx 同款）：首帧加载推迟一个宏任务 ——
  // 既不触发 react-hooks/set-state-in-effect（同步 setState 级联渲染），也不与首帧渲染抢同一帧。
  useEffect(() => {
    const t = setTimeout(() => void loadCareer(), 0);
    return () => clearTimeout(t);
  }, [loadCareer]);

  /** 本页有吸顶紧凑栏，下拉转圈需要让开它 */
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

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="职业" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView
      onScroll={headerScroll.onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl {...careerRefresh} />}
      style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <ScreenHeaderLargeTitle title="职业" subtitle="画像 · 技能 · 简历 · 面试" />

      {/* ① 职业准备度 hero：进度弧 + 结论 + 三个关键值 */}
      <GlassSurface corner={radius.xl} style={styles.hero}>
        {loading ? (
          /* v13 U1：首屏占位统一走骨架屏（原来是一个转圈，感知更慢） */
          <Skeleton variant="hero" style={styles.heroSkeleton} />
        ) : (
          <>
            <ProgressArc
              progress={overall / 100}
              size={126}
              strokeWidth={11}
              value={`${overall}%`}
              label="职业准备度"
              caption={goalVerdict}
            />
            <View style={styles.heroStats}>
              <StatLine label="目标岗位" value={readiness?.targetRole ?? "未设置"} />
              <StatLine label="匹配岗位" value={readiness ? `${readiness.matchedJobs} 个` : "—"} />
              <StatLine label="技能" value={`${skills.length} 项`} />
            </View>
          </>
        )}
      </GlassSurface>

      {readiness && readiness.matchedJobs > 0 ? (
        <Button
          label={`发现 ${readiness.matchedJobs} 个适合你的职位`}
          icon="flower-outline"
          variant="secondary"
          onPress={() => router.push("/jobs" as never)}
        />
      ) : null}

      {/* ② 三个主入口（首屏只留重点） */}
      <SectionHeader title="主入口" />
      <ListGroup>
        {FOCUS_SECTIONS.map((s, i) => (
          <ListRow
            key={s.key}
            icon={s.icon}
            title={s.title}
            subtitle={s.desc}
            showChevron
            last={i === FOCUS_SECTIONS.length - 1}
            onPress={() => router.push(s.href as never)}
          />
        ))}
      </ListGroup>

      {/* 非重点：更多职业工具 + 准备度维度明细 */}
      <SectionHeader title="更多职业工具" actionLabel="全部" onAction={() => setMoreOpen(true)} />
      <PressableScale haptic scaleTo={0.98} onPress={() => setMoreOpen(true)}>
        <View style={styles.moreRow}>
          {MORE_SECTIONS.map((s) => (
            <View key={s.key} style={styles.moreItem}>
              <View style={styles.moreIcon}>
                <ThemedIcon name={s.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.moreLabel} numberOfLines={1}>{s.title}</Text>
            </View>
          ))}
        </View>
      </PressableScale>

      {skills.length > 0 ? (
        <GlassSurface corner={radius.lg} style={styles.skillsCard}>
          <View style={styles.skillsHead}>
            <Text style={styles.skillsTitle}>我的技能</Text>
            <Stat value={skills.length} unit="项" size={22} />
          </View>
          <View style={styles.skillChips}>
            {skills.slice(0, 12).map((s, i) => (
              <Animated.View
                key={s.id}
                style={styles.skillChip}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              >
                <Text style={styles.skillChipText}>{s.name}</Text>
              </Animated.View>
            ))}
          </View>
        </GlassSurface>
      ) : null}

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="更多职业工具" height="72%">
        <ListGroup>
          {MORE_SECTIONS.map((s, i) => (
            <ListRow
              key={s.key}
              icon={s.icon}
              title={s.title}
              subtitle={s.desc}
              showChevron
              last={i === MORE_SECTIONS.length - 1}
              onPress={() => {
                setMoreOpen(false);
                router.push(s.href as never);
              }}
            />
          ))}
        </ListGroup>

        {readiness && readiness.dimensions.length > 0 ? (
          <View style={styles.dimBlock}>
            <SectionHeader title="准备度明细" subtitle={readiness.targetRole ?? undefined} />
            {readiness.dimensions.map((d) => (
              <View key={d.key} style={styles.dim}>
                <View style={styles.dimHeader}>
                  <Text style={styles.dimLabel}>{d.label}</Text>
                  <Text style={styles.dimScore}>{d.score}%</Text>
                </View>
                <ProgressBar progress={d.score / 100} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>登录并记录技能 / 项目 / 面试日志后，这里会呈现职业画像</Text>
        )}
      </BottomSheet>
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.lg },
    heroStats: { flex: 1, minWidth: 0, gap: spacing.sm },
    loader: { marginVertical: 28, flex: 1 },
    // v13 U1：hero 骨架在弧形卡里要能撑开
    heroSkeleton: { flex: 1, alignSelf: "stretch" },
    moreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    moreItem: { flex: 1, alignItems: "center", gap: 6 },
    moreIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    moreLabel: { ...typography.micro, color: colors.textMuted },
    dimBlock: { gap: spacing.md, marginTop: spacing.sm },
    dim: { gap: 6 },
    dimHeader: { flexDirection: "row", justifyContent: "space-between" },
    dimLabel: { ...typography.caption, fontWeight: "600", color: colors.text },
    dimScore: { ...typography.caption, color: colors.textMuted },
    // v18 对比度：callout(15pt) 属正文字号，textMuted 对白底仅约 3.0，低于 WCAG AA 4.5
  emptyHint: { ...typography.callout, color: colors.textSecondary, paddingVertical: spacing.md },
    skillsCard: { gap: spacing.md },
    skillsHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    skillsTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    skillChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    skillChip: {
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    skillChipText: { ...typography.caption, fontWeight: "700", color: colors.primary },
  });
