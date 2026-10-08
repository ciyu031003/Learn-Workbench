import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { JobDetailModal, type JobDetailSeed } from "@/components/job-detail-modal";
import { PressableScale } from "@/components/pressable-scale";
import { ProgressArc } from "@/components/progress-arc";
import { toggleJobFavorite } from "@/lib/jobs";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton";
import { Card } from "@/components/card";
import { ThemedIcon } from "@/components/themed-icon";
import { PagerBar } from "@/components/pager-bar";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { shouldStagger, staggerDelay } from "@/lib/stagger";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { ChipGroup } from "@/components/sheet";
import { haptics } from "@/lib/haptics";
import {
  applyRadarFilter,
  radarFacets,
  RADAR_CATEGORY_LABELS,
  RADAR_CATEGORY_ORDER,
  RADAR_SORT_LABELS,
  type RadarCategory,
  type RadarSort,
} from "@/lib/radar-filter";

interface RadarJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  education: string;
  salaryText: string;
  url: string;
  overall: number;
  matchedSkills: { skill: string }[];
  missingSkills: { skill: string }[];
  gapHours: number;
  deadlineLabel: string | null;
  functionKey?: string;
  industrySector?: string;
}

interface RadarResponse {
  mode: "batch" | "fallback";
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  top: RadarJob[];
  counts: { candidates: number; matched: number; favorites: number; applications: number };
  total?: number;
  facets?: { cities: string[]; functions: string[]; industries?: string[] };
}

/** 每屏先展示的条数，点「加载更多」再递增（不再是一个无限长列表） */
const PAGE_SIZE = 10;
/** 一次拉全候选集，筛选/排序在本地即时完成 */
const FETCH_LIMIT = 200;

/** V3 就业雷达（移动端）：筛选 + 排序 + 分页的匹配结果卡片流 */
export default function RadarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /** v17-D（R8）：入场错峰；减弱动态不做（每屏封顶 12 项、只在首帧入场） */
  const reduced = useReducedMotion();
  const headerScroll = useLargeTitleHeader();
  /** v17-C2b：下拉转圈要出现在吸顶栏下方 */
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 筛选 / 排序 / 分页（真机反馈：原来只能一直往下滑，不能筛选也不能切换）
  const [category, setCategory] = useState<RadarCategory>("all");
  const [city, setCity] = useState<string | null>(null);
  const [functionKey, setFunctionKey] = useState<string | null>(null);
  const [sort, setSort] = useState<RadarSort>("match_desc");
  /** v1.26：当前页（0 基）；筛选/排序变化时回到第 1 页 */
  const [page, setPage] = useState(0);
  /** v20-B5：筛选卡折叠态（默认展开，收起后只留标题行 + 结果数） */
  const [filtersOpen, setFiltersOpen] = useState(true);
  /** v20-B3：错误态独立于空态（断网不再伪装成"还没有岗位画像"） */
  const [loadError, setLoadError] = useState(false);
  /** v20-B1：点结果卡打开岗位详情弹层 */
  const [detailJob, setDetailJob] = useState<JobDetailSeed | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`${getApiUrl()}/api/jobs/radar?limit=${FETCH_LIMIT}`, { headers });
      if (r.ok) setData(await r.json());
      else setLoadError(true);
    } catch {
      // v20-B3：网络失败 → 错误态（带重试），不再落到"还没有岗位画像"空态
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // v17/v18 收尾：下拉刷新统一走 usePullRefresh（吸顶栏存在 → 偏移自动 = insets.top + 44）
  const { control: pullControl } = usePullRefresh(load, { stickyHeader: true });

  const top = useMemo(() => data?.top ?? [], [data?.top]);
  const facets = useMemo(
    () => data?.facets ?? radarFacets(top),
    [data?.facets, top]
  );
  const filtered = useMemo(
    () => applyRadarFilter(top, { city, category, functionKey }, sort),
    [top, city, category, functionKey, sort]
  );

  // v1.26：真正分页（每页固定 PAGE_SIZE，底部给「已显示 x–y / 共 n」与翻页）
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);
  const activeFilters = (city ? 1 : 0) + (category !== "all" ? 1 : 0) + (functionKey ? 1 : 0);

  /** 改筛选/排序：先回到第一页（避免"筛完只剩 2 条却还停在原来的滚动深度"） */
  const pick = (fn: () => void) => {
    haptics.soft();
    setPage(0);
    fn();
  };

  const gotoPage = (next: number) => {
    haptics.soft();
    setPage(Math.max(0, Math.min(pageCount - 1, next)));
  };

  /** v20-B1：雷达条目 → 详情弹层种子（缺的字段由弹层内 fetchJobDetail 拉全量补齐） */
  const seedOf = (j: RadarJob): JobDetailSeed => ({
    id: j.jobId,
    title: j.title,
    company: j.company,
    city: j.city || undefined,
    education: j.education || undefined,
    salaryText: j.salaryText || undefined,
    url: j.url || undefined,
    channel: "job",
  });

  const openJob = (j: RadarJob) => {
    haptics.light();
    setDetailJob(seedOf(j));
    setDetailVisible(true);
  };

  /** v20-B1：收藏与招花页同链路（同步到「我的求职」）；雷达条目无 isFav 字段，状态以收藏接口为准 */
  const toggleFavorite = async (seed: JobDetailSeed) => {
    if (!token) {
      Alert.alert("请先登录", "收藏功能需要登录后使用。");
      return;
    }
    try {
      const favorited = await toggleJobFavorite(seed.id);
      if (favorited) haptics.success();
      else haptics.soft();
    } catch {
      Alert.alert("收藏失败", "请稍后重试");
    }
  };

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title="就业雷达" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl {...pullControl} />
      }
    >
      <ScreenHeaderLargeTitle
        title="就业雷达"
        subtitle={data?.targetRole ? `目标：${data.targetRole}${data.profileCity ? ` · ${data.profileCity}` : ""}` : "今日适合你的岗位信号"} />

      {data && data.mode === "batch" ? (
        <Text style={styles.meta}>
          已扫描 {data.counts.candidates} 个候选岗位 · 匹配 {data.counts.matched} 个（收藏 {data.counts.favorites} / 投递 {data.counts.applications}）
        </Text>
      ) : null}

      {/* ── 筛选区：领域 / 城市 / 岗位方向 + 匹配度排序（v20-B5：可折叠，默认展开） ───────────────── */}
      {top.length > 0 ? (
        <Card style={styles.filterCard}>
          <View style={styles.filterHead}>
            <Pressable
              style={styles.filterTitleRow}
              onPress={() => {
                haptics.soft();
                setFiltersOpen((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityLabel={filtersOpen ? "收起筛选" : "展开筛选"}
            >
              <ThemedIcon name="options-outline" size={16} color={colors.primary} />
              <Text style={styles.filterTitle}>筛选</Text>
              {activeFilters > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                </View>
              ) : null}
              <Text style={styles.filterSummary}>
                {filtersOpen ? "" : `${filtered.length} 个结果`}
              </Text>
              <ThemedIcon name={filtersOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => pick(() => setSort((s) => (s === "match_desc" ? "match_asc" : "match_desc")))}
              style={styles.sortBtn}
              accessibilityLabel={`排序：${RADAR_SORT_LABELS[sort]}`}
            >
              <ThemedIcon name="swap-vertical" size={14} color={colors.primary} />
              <Text style={styles.sortText}>{RADAR_SORT_LABELS[sort]}</Text>
            </Pressable>
          </View>

          {filtersOpen ? (
          <>
          {/* 领域分类（v16：收敛到 ChipGroup 的滑动胶囊） */}
          <Text style={styles.filterLabel}>领域</Text>
          <ChipGroup
            multiple={false}
            options={RADAR_CATEGORY_ORDER.map((c) => ({ key: c, label: RADAR_CATEGORY_LABELS[c] }))}
            selected={[category]}
            onToggle={(k) => pick(() => setCategory(k as RadarCategory))}
          />

          {/* 城市 */}
          {facets.cities.length > 0 ? (
            <>
              <Text style={styles.filterLabel}>城市</Text>
              <ChipGroup
                multiple={false}
                allKey="__all__"
                allLabel="全部城市"
                options={facets.cities.map((c) => ({ key: c, label: c }))}
                selected={[city ?? "__all__"]}
                onToggle={(k) => pick(() => setCity(k === "__all__" ? null : k))}
              />
            </>
          ) : null}

          {/* 岗位方向（function_key） */}
          {facets.functions.length > 0 ? (
            <>
              <Text style={styles.filterLabel}>岗位方向</Text>
              <ChipGroup
                multiple={false}
                allKey="__all__"
                allLabel="全部方向"
                options={facets.functions.map((f) => ({ key: f, label: f }))}
                selected={[functionKey ?? "__all__"]}
                onToggle={(k) => pick(() => setFunctionKey(k === "__all__" ? null : k))}
              />
            </>
          ) : null}

          <View style={styles.filterFoot}>
            <Text style={styles.filterCount}>
              {filtered.length} 个结果{activeFilters > 0 ? ` · 已筛选` : ""}
            </Text>
            {activeFilters > 0 || sort !== "match_desc" ? (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  pick(() => {
                    setCategory("all");
                    setCity(null);
                    setFunctionKey(null);
                    setSort("match_desc");
                  })
                }
              >
                <Text style={styles.resetText}>重置</Text>
              </Pressable>
            ) : null}
          </View>
          </>
          ) : null}
        </Card>
      ) : null}

      {loading && top.length === 0 ? (
        <SkeletonCard count={3} />
      ) : loadError && top.length === 0 ? (
        /* v20-B3：网络失败给明确错误态 + 重试（原先断网伪装成"还没有岗位画像"） */
        <EmptyState
          icon="cloud-offline-outline"
          title="雷达扫描失败"
          hint="网络似乎不太顺，稍后再试试"
          actionLabel="重新扫描"
          onAction={() => void load()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="radio-outline"
          title={top.length === 0 ? (data?.hasProfile ? "暂时没有可匹配的岗位" : "还没有岗位画像") : "没有符合筛选的岗位"}
          hint={
            top.length === 0
              ? data?.hasProfile
                ? "试试调整城市筛选，或稍后刷新雷达"
                : "先补全「我的资料」与技能，雷达才能算出匹配度"
              : "换个领域 / 城市，或点「重置」看全部"
          }
        />
      ) : (
        <>
          {shown.map((j, i) => (
            <Animated.View
              key={j.jobId}
              layout={reduced ? undefined : LinearTransition}
              entering={
                reduced || !shouldStagger(i, shown.length)
                  ? undefined
                  : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))
              }
            >
            {/* v20-B1：卡片可点进详情（收藏/学习计划在弹层内），动线不再断头 */}
            <PressableScale onPress={() => openJob(j)} scaleTo={0.97}>
            <Card style={styles.item}>
              <View style={styles.head}>
                {/* v20-B2：匹配度从纯文本升级为小号进度圆环（雷达的核心指标该有视觉权重） */}
                <ProgressArc
                  progress={j.overall / 100}
                  size={48}
                  strokeWidth={5}
                  value={`${j.overall}%`}
                  beatOnChange
                />
                <View style={styles.headInfo}>
                  <Text style={styles.title} numberOfLines={1}>{j.title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {[j.company, j.city, j.education].filter(Boolean).join(" · ")}
                  </Text>
                  {j.salaryText ? <Text style={styles.salary}>{j.salaryText}</Text> : null}
                </View>
                {j.deadlineLabel ? <Text style={styles.deadline}>{j.deadlineLabel}</Text> : null}
              </View>

              <View style={styles.chips}>
                {j.matchedSkills.slice(0, 3).map((s) => (
                  <View key={`m-${s.skill}`} style={[styles.chipTag, styles.chipHit]}>
                    <ThemedIcon name="checkmark-circle-outline" size={12} color={colors.success} />
                    <Text style={[styles.chipTagText, styles.chipHitText]} numberOfLines={1}>{s.skill}</Text>
                  </View>
                ))}
                {j.missingSkills.slice(0, 3).map((s) => (
                  <View key={`x-${s.skill}`} style={styles.chipTag}>
                    <ThemedIcon name="ellipse-outline" size={12} color={colors.textFaint} />
                    <Text style={styles.chipTagText} numberOfLines={1}>{s.skill}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.footer}>
                {j.gapHours > 0 ? <Text style={styles.muted}>缺口约 {Math.round(j.gapHours)} 小时</Text> : <View />}
                {j.url ? (
                  <Pressable hitSlop={8} onPress={() => void Linking.openURL(j.url)}>
                    <Text style={styles.link}>查看原始来源</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
            </PressableScale>
            </Animated.View>
          ))}

          {/* v20-J2：分页条收单源 */}
          <PagerBar
            page={safePage}
            pageCount={pageCount}
            from={from}
            to={to}
            total={filtered.length}
            unit="个"
            onPageChange={gotoPage}
          />
        </>
      )}
      {/* v20-B1：岗位详情弹层（与招花页同一组件；收藏同链路同步「我的求职」） */}
      <JobDetailModal
        job={detailJob}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onToggleFavorite={toggleFavorite}
      />
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    meta: { fontSize: 11, color: colors.textMuted },

    /* 筛选区 */
    filterCard: { gap: 8, padding: 14 },
    filterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    filterSummary: { ...typography.caption, color: colors.textMuted, marginLeft: "auto", marginRight: 4 },
    filterTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    filterBadge: {
      minWidth: 16,
      height: 16,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBadgeText: { color: colors.canvas, fontSize: 10, fontWeight: "800" },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    sortText: { fontSize: 11, fontWeight: "800", color: colors.primary },
    filterLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted, marginTop: 2 },
    filterFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    filterCount: { fontSize: 11, color: colors.textMuted },
    resetText: { fontSize: 12, fontWeight: "800", color: colors.primary },

    /* 卡片 */
    item: { gap: 8 },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    headInfo: { flex: 1, minWidth: 0, gap: 1 },
    title: { ...typography.headline, fontWeight: "800", color: colors.text },
    muted: { fontSize: 11, color: colors.textMuted },
    salary: { fontSize: 12, fontWeight: "700", color: colors.text },
    deadline: { fontSize: 11, fontWeight: "700", color: colors.accentStrong },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    // v20-B4：技能 chips 改「图标 + 文本」小胶囊（原先 ✓/○ 拼进文本，命中/缺失不分色）
    chipTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      overflow: "hidden",
    },
    chipHit: { backgroundColor: colors.successSoft },
    chipTagText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    chipHitText: { color: colors.text },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { fontSize: 12, color: colors.primary, fontWeight: "700" },
  });
