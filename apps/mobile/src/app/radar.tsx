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
import { toggleJobFavorite } from "@/lib/jobs";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonBlock, SkeletonCard } from "@/components/skeleton";
import { Card } from "@/components/card";
import { ThemedIcon } from "@/components/themed-icon";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { shouldStagger, staggerDelay } from "@/lib/stagger";
import { radius, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { haptics } from "@/lib/haptics";
import {
  applyRadarFilter,
  buildRadarOverview,
  citiesForProvinces,
  clearRadarFilterKey,
  EMPTY_RADAR_FILTER,
  filterRadar,
  radarActiveFilterCount,
  radarDirectionLabel,
  radarFacets,
  radarFilterChips,
  RADAR_PAGE_SIZE,
  RADAR_SALARY_OPTIONS,
  RADAR_SORT_LABELS,
  RADAR_SORT_ORDER,
  radarUpdatedLabel,
  radarVisibleSlice,
  removeRadarFilterChip,
  toggleRadarFilterValue,
  type RadarFacets,
  type RadarFilter,
  type RadarFilterChip,
  type RadarJobLike,
  type RadarOverview,
  type RadarSort,
} from "@/lib/radar-filter";

interface RadarJob extends RadarJobLike {
  jobId: number;
  url: string;
  deadlineLabel: string | null;
  matchedSkills: { skill: string }[];
  missingSkills: { skill: string }[];
  gapHours: number;
  fromFavorite?: boolean;
  fromApplication?: boolean;
}

interface RadarResponse {
  mode: "batch" | "fallback";
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  top: RadarJob[];
  counts: { candidates: number; matched: number; favorites: number; applications: number };
  total?: number;
}

/** 一次拉全候选集，筛选/排序在本地即时完成 */
const FETCH_LIMIT = 200;
/** 卡片里默认展示的技能标签数（超出折叠） */
const CHIP_LIMIT = 4;
/** 展开后最多展示的技能标签数 */
const CHIP_LIMIT_EXPANDED = 10;

/**
 * V4 就业雷达（移动端）：概览统计 + 多条件底部弹层 + 三种排序 + 加载更多。
 *
 * 数据口径：GET /api/jobs/radar 一次取回 ≤200 条候选（含匹配度/匹配技能/缺口小时/来源/发布时间），
 * 屏幕层只做纯函数筛选排序（见 lib/radar-filter.ts，全部有单测）。
 * 经验维度：接口当前未下发 experience，缺失时卡片不展示该段、弹层里整段隐藏（不伪造数据）。
 */
export default function RadarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /** 已应用的筛选与弹层里的草稿（关闭不丢草稿，应用才生效） */
  const [filter, setFilter] = useState<RadarFilter>(EMPTY_RADAR_FILTER);
  const [draft, setDraft] = useState<RadarFilter>(EMPTY_RADAR_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<RadarSort>("match_desc");
  const [visibleSize, setVisibleSize] = useState(RADAR_PAGE_SIZE);
  const [expandedJobs, setExpandedJobs] = useState<ReadonlySet<number>>(() => new Set());
  const [detailJob, setDetailJob] = useState<JobDetailSeed | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  /** 相对时间基准（挂载时取一次，避免每帧 Date.now 触发无谓重渲染） */
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${getApiUrl()}/api/jobs/radar?limit=${FETCH_LIMIT}`, { headers });
      if (response.ok) setData((await response.json()) as RadarResponse);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const { control: pullControl } = usePullRefresh(load, { stickyHeader: true });

  const top = useMemo(() => data?.top ?? [], [data?.top]);
  const facets = useMemo(() => radarFacets(top), [top]);
  const overview = useMemo(
    () => buildRadarOverview(top, { total: data?.total, counts: data?.counts, now }),
    [top, data?.total, data?.counts, now],
  );
  const filtered = useMemo(() => applyRadarFilter(top, filter, sort), [top, filter, sort]);
  const slice = useMemo(() => radarVisibleSlice(filtered, visibleSize), [filtered, visibleSize]);
  const activeCount = radarActiveFilterCount(filter);
  const chips = useMemo(() => radarFilterChips(filter), [filter]);
  const previewCount = useMemo(() => filterRadar(top, draft).length, [top, draft]);

  /** 修改已应用条件后统一回到第一页（避免停在旧的滚动深度） */
  const applyFilter = (next: RadarFilter) => {
    setFilter(next);
    setVisibleSize(RADAR_PAGE_SIZE);
  };

  const openSheet = () => {
    haptics.soft();
    setDraft(filter);
    setSheetOpen(true);
  };

  const resetAll = () => {
    haptics.soft();
    applyFilter(EMPTY_RADAR_FILTER);
  };

  const removeChip = (chip: RadarFilterChip) => {
    haptics.soft();
    applyFilter(removeRadarFilterChip(filter, chip));
  };

  const changeSort = (next: RadarSort) => {
    if (next === sort) return;
    haptics.soft();
    setSort(next);
    setVisibleSize(RADAR_PAGE_SIZE);
  };

  const loadMore = () => {
    haptics.soft();
    setVisibleSize(slice.nextSize);
  };

  const toggleExpanded = (jobId: number) => {
    haptics.soft();
    setExpandedJobs((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  /** 雷达条目 → 详情弹层种子（缺的字段由弹层内 fetchJobDetail 拉全量补齐） */
  const openJob = (job: RadarJob) => {
    haptics.light();
    setDetailJob({
      id: String(job.jobId),
      title: job.title,
      company: job.company,
      city: job.city || undefined,
      education: job.education || undefined,
      salaryText: job.salaryText || undefined,
      url: job.url || undefined,
      channel: "job",
    });
    setDetailVisible(true);
  };

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

  const showSkeleton = loading && top.length === 0;
  const showError = !loading && loadError && top.length === 0;
  const showNoProfile = !loading && !loadError && top.length === 0;
  const showEmpty = !loading && top.length > 0 && filtered.length === 0;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="就业雷达" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...pullControl} />}
      >
        {/* 弱化大标题：一行小标题 + 刷新，把视觉权重让给概览卡 */}
        <View style={styles.pageHead}>
          <View style={styles.pageHeadText}>
            <Text style={styles.pageTitle}>就业雷达</Text>
            <Text style={styles.pageSubtitle} numberOfLines={1}>
              {data?.targetRole
                ? `目标 ${data.targetRole}${data.profileCity ? ` · ${data.profileCity}` : ""}`
                : "按匹配度给今日适合你的岗位排序"}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="刷新雷达">
            <ThemedIcon name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {showSkeleton ? (
          <>
            <SkeletonBlock variant="card" style={styles.overviewSkeleton} />
            <SkeletonCard count={3} />
          </>
        ) : showError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="雷达扫描失败"
            hint="网络似乎不太顺，稍后再试试"
            actionLabel="重新扫描"
            onAction={() => void load()}
          />
        ) : showNoProfile ? (
          <EmptyState
            icon="radio-outline"
            title={data?.hasProfile ? "暂时没有可匹配的岗位" : "还没有岗位画像"}
            hint={
              data?.hasProfile
                ? "换个城市或稍后刷新雷达；也可以在「我的资料」里补充目标岗位"
                : "先补全「我的资料」与技能，雷达才能算出匹配度"
            }
            actionLabel="刷新雷达"
            onAction={() => void load()}
          />
        ) : (
          <>
            <RadarOverviewCard overview={overview} fallback={data?.mode === "fallback"} colors={colors} styles={styles} />

            <View style={styles.controlRow}>
              <View style={styles.sortGroup}>
                {RADAR_SORT_ORDER.map((key) => (
                  <PressableScale
                    key={key}
                    style={[styles.sortPill, sort === key && styles.sortPillActive]}
                    onPress={() => changeSort(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sort === key }}
                    accessibilityLabel={`按${RADAR_SORT_LABELS[key]}排序`}
                  >
                    <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>{RADAR_SORT_LABELS[key]}</Text>
                  </PressableScale>
                ))}
              </View>
              <PressableScale
                style={styles.filterBtn}
                onPress={openSheet}
                accessibilityRole="button"
                accessibilityLabel={activeCount > 0 ? `筛选，已选 ${activeCount} 项` : "筛选岗位"}
              >
                <ThemedIcon name="options-outline" size={14} color={colors.primary} />
                <Text style={styles.filterBtnText}>筛选</Text>
                {activeCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeCount}</Text>
                  </View>
                ) : null}
              </PressableScale>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {filtered.length} 个岗位 · 按{RADAR_SORT_LABELS[sort]}排序
              </Text>
              {activeCount > 0 ? (
                <Pressable hitSlop={8} onPress={resetAll} accessibilityRole="button" accessibilityLabel="清空筛选">
                  <Text style={styles.resetText}>重置</Text>
                </Pressable>
              ) : (
                <Text style={styles.resultHint}>共 {overview.matchedTotal} 个匹配</Text>
              )}
            </View>

            {chips.length > 0 ? (
              <View style={styles.chipsWrap}>
                {chips.map((chip) => (
                  <PressableScale
                    key={chip.group + ":" + chip.value}
                    style={styles.chipActive}
                    onPress={() => removeChip(chip)}
                    accessibilityRole="button"
                    accessibilityLabel={`移除筛选 ${chip.label}`}
                  >
                    <Text style={styles.chipActiveText} numberOfLines={1}>{chip.label}</Text>
                    <ThemedIcon name="close" size={12} color={colors.primary} />
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {showEmpty ? (
              <EmptyState
                icon="funnel-outline"
                title="没有符合筛选的岗位"
                hint="试着放宽条件：减少城市 / 薪资 / 学历限制，或清空筛选看全部"
                actionLabel="清空筛选"
                onAction={resetAll}
              />
            ) : (
              <>
                {slice.items.map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    layout={reduced ? undefined : LinearTransition}
                    entering={
                      reduced || !shouldStagger(index, slice.items.length)
                        ? undefined
                        : FadeInDown.duration(DURATION.base).delay(staggerDelay(index))
                    }
                  >
                    <RadarJobCard
                      job={job}
                      expanded={expandedJobs.has(job.jobId)}
                      onToggleExpand={toggleExpanded}
                      onPress={openJob}
                      now={now}
                      colors={colors}
                      styles={styles}
                    />
                  </Animated.View>
                ))}

                {slice.hasMore ? (
                  <PressableScale
                    style={styles.loadMore}
                    onPress={loadMore}
                    accessibilityRole="button"
                    accessibilityLabel={`加载更多，还有 ${slice.total - slice.shown} 个岗位`}
                  >
                    <ThemedIcon name="chevron-down" size={16} color={colors.primary} />
                    <Text style={styles.loadMoreText}>加载更多（还有 {slice.total - slice.shown} 个）</Text>
                  </PressableScale>
                ) : slice.total > 0 ? (
                  <Text style={styles.endText}>已显示全部 {slice.total} 个岗位</Text>
                ) : null}
              </>
            )}
          </>
        )}

        <JobDetailModal
          job={detailJob}
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          onToggleFavorite={toggleFavorite}
        />
      </Animated.ScrollView>

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        facets={facets}
        previewCount={previewCount}
        onToggle={(group, value) => setDraft((current) => toggleRadarFilterValue(current, group, value))}
        onClear={(group) => setDraft((current) => clearRadarFilterKey(current, group))}
        onReset={() => setDraft(EMPTY_RADAR_FILTER)}
        onApply={() => {
          haptics.light();
          applyFilter(draft);
          setSheetOpen(false);
        }}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 概览卡                                                              */
/* ------------------------------------------------------------------ */

function RadarOverviewCard({
  overview,
  fallback,
  colors,
  styles,
}: {
  overview: RadarOverview;
  fallback: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Card style={styles.overviewCard}>
      <View style={styles.overviewHead}>
        <View style={styles.overviewTitleRow}>
          <ThemedIcon name="radio-outline" size={15} color={colors.primary} />
          <Text style={styles.overviewTitle}>雷达概览</Text>
        </View>
        <Text style={styles.overviewUpdated} numberOfLines={1}>{overview.updatedLabel}</Text>
      </View>

      <View style={styles.statRow}>
        <Stat styles={styles} value={overview.matchedTotal} label="匹配岗位" highlight />
        <Stat styles={styles} value={overview.scanned} label="已扫描" />
        <Stat styles={styles} value={overview.favoriteCount} label="已收藏" />
        <Stat styles={styles} value={overview.applicationCount} label="已投递" />
      </View>

      <View style={styles.distRow}>
        <Text style={styles.distLabel}>城市 Top3</Text>
        <View style={styles.distChips}>
          {overview.topCities.length > 0 ? (
            overview.topCities.map((item) => (
              <View key={item.city} style={styles.distChip}>
                <Text style={styles.distChipText} numberOfLines={1}>
                  {item.city} {item.count}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.distEmpty}>暂无城市分布</Text>
          )}
        </View>
      </View>

      <View style={styles.distRow}>
        <Text style={styles.distLabel}>方向 Top3</Text>
        <View style={styles.distChips}>
          {overview.topCategories.length > 0 ? (
            overview.topCategories.map((item) => (
              <View key={item.category} style={styles.distChip}>
                <Text style={styles.distChipText} numberOfLines={1}>
                  {item.label} {item.count}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.distEmpty}>暂无方向分布</Text>
          )}
        </View>
      </View>

      {fallback ? (
        <Text style={styles.overviewNote}>当前按城市推荐（未完善画像，匹配度按岗位方向与技能近似估算）</Text>
      ) : null}
    </Card>
  );
}

function Stat({
  value,
  label,
  highlight = false,
  styles,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 岗位卡                                                              */
/* ------------------------------------------------------------------ */

function RadarJobCard({
  job,
  expanded,
  onToggleExpand,
  onPress,
  now,
  colors,
  styles,
}: {
  job: RadarJob;
  expanded: boolean;
  onToggleExpand: (jobId: number) => void;
  onPress: (job: RadarJob) => void;
  now: number;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const matched = job.matchedSkills.map((item) => item.skill);
  const missing = job.missingSkills.map((item) => item.skill);
  const direction = radarDirectionLabel(job);
  const tags = [...matched, ...missing];
  const limit = expanded ? CHIP_LIMIT_EXPANDED : CHIP_LIMIT;
  const visibleTags = tags.slice(0, limit);
  const hidden = Math.max(0, tags.length - visibleTags.length);
  const tone = job.overall >= 75 ? colors.success : job.overall >= 55 ? colors.primary : colors.warning;
  const soft = job.overall >= 75 ? colors.successSoft : job.overall >= 55 ? colors.primarySoft : colors.warningSoft;
  const meta = [job.company, job.city || "城市不限", job.education || "学历不限", job.experience].filter(Boolean).join(" · ");
  const sourceLabel = job.source ? String(job.source) : "";
  const updatedLabel = radarUpdatedLabel(job.publishedAt, now);

  return (
    <PressableScale onPress={() => onPress(job)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${job.title}，${job.company}，匹配度 ${job.overall}%`}>
      <Card style={styles.jobCard}>
        <View style={styles.jobHead}>
          <View style={styles.jobHeadInfo}>
            <Text style={styles.jobTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.jobMeta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <View style={[styles.matchPill, { backgroundColor: soft }]}>
            <Text style={[styles.matchPillText, { color: tone }]}>{job.overall}%</Text>
          </View>
        </View>

        <View style={styles.salaryRow}>
          <Text style={styles.salaryText} numberOfLines={1}>
            {job.salaryText || "薪资面议"}
          </Text>
          {job.deadlineLabel ? (
            <Text style={styles.deadlineText} numberOfLines={1}>
              {job.deadlineLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.matchBarRow}>
          <View style={styles.matchTrack}>
            <View
              style={[
                styles.matchFill,
                { width: `${Math.max(2, Math.min(100, job.overall))}%`, backgroundColor: tone },
              ]}
            />
          </View>
          <Text style={styles.matchBarLabel}>匹配度</Text>
        </View>

        <View style={styles.reasonRow}>
          <ThemedIcon name="sparkles-outline" size={12} color={colors.textMuted} />
          <Text style={styles.reasonText} numberOfLines={1}>
            {matched.length > 0 ? `命中 ${matched.length} 项技能` : "技能命中待补充"}
            {missing.length > 0 ? ` · 还缺 ${missing.length} 项` : ""} · 方向 {direction}
          </Text>
        </View>

        <View style={styles.tagRow}>
          {visibleTags.map((tag) => {
            const hit = matched.includes(tag);
            return (
              <View key={`${hit ? "hit" : "gap"}:${tag}`} style={[styles.tag, hit ? styles.tagHit : styles.tagGap]}>
                <ThemedIcon
                  name={hit ? "checkmark-circle-outline" : "ellipse-outline"}
                  size={12}
                  color={hit ? colors.success : colors.textFaint}
                />
                <Text style={[styles.tagText, hit && styles.tagTextHit]} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            );
          })}
          {hidden > 0 || (expanded && tags.length > CHIP_LIMIT) ? (
            <Pressable hitSlop={8} onPress={() => onToggleExpand(job.jobId)} accessibilityRole="button" accessibilityLabel={expanded ? "收起标签" : `展开 ${hidden} 个标签`}>
              <View style={[styles.tag, styles.tagMore]}>
                <Text style={styles.tagMoreText}>{expanded ? "收起" : `+${hidden}`}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.jobFoot}>
          <Text style={styles.footText} numberOfLines={1}>
            {[sourceLabel, updatedLabel].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.footRight}>
            {job.fromFavorite ? <Text style={styles.flagText}>已收藏</Text> : null}
            {job.fromApplication ? <Text style={styles.flagText}>已投递</Text> : null}
            {job.gapHours > 0 ? (
              <Text style={styles.gapText}>缺口约 {Math.round(job.gapHours)} 小时</Text>
            ) : null}
            {job.url ? (
              <Pressable hitSlop={8} onPress={() => void Linking.openURL(job.url)} accessibilityRole="link" accessibilityLabel="查看原始来源">
                <Text style={styles.sourceLink}>原始来源</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* 筛选弹层                                                            */
/* ------------------------------------------------------------------ */

function FilterSheet({
  visible,
  onClose,
  draft,
  facets,
  previewCount,
  onToggle,
  onClear,
  onReset,
  onApply,
  colors,
  styles,
}: {
  visible: boolean;
  onClose: () => void;
  draft: RadarFilter;
  facets: RadarFacets;
  previewCount: number;
  onToggle: (group: Parameters<typeof toggleRadarFilterValue>[1], value: string) => void;
  onClear: (group: Parameters<typeof clearRadarFilterKey>[1]) => void;
  onReset: () => void;
  onApply: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const provinceOptions = facets.provinces.map((item) => ({
    key: item.province,
    label: item.province,
    badge: item.count,
  }));
  const cityPool = useMemo(() => {
    const counts = new Map<string, number>();
    for (const province of facets.provinces) {
      for (const city of province.cities) counts.set(city.city, city.count);
    }
    return counts;
  }, [facets.provinces]);
  const allCities = [...cityPool.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([city, count]) => ({ key: city, label: city, badge: count }));
  const cityChoices = citiesForProvinces(
    draft.provinces,
    allCities.map((item) => item.key),
  ).map((city) => allCities.find((item) => item.key === city) ?? { key: city, label: city, badge: 0 });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="筛选岗位"
      subtitle="多选可叠加；应用后回到第一页"
      icon="options-outline"
      height="88%"
      headerAction={
        <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="重置全部筛选">
          <Text style={styles.sheetReset}>重置</Text>
        </Pressable>
      }
      footer={
        <SheetStickyCta
          label={previewCount > 0 ? `应用筛选 · ${previewCount} 个岗位` : "应用筛选 · 无结果"}
          icon="checkmark"
          onPress={onApply}
          secondaryLabel="清空全部条件"
          onSecondary={onReset}
        />
      }
      footerHint="关闭不会丢失已选条件；重新打开继续调整"
    >
      <SheetSection title="城市" hint="省市二级，可多选">
        <ChipGroup
          multiple
          wrap
          allKey="__all_province__"
          allLabel="全部省份"
          options={provinceOptions}
          selected={draft.provinces.length > 0 ? draft.provinces : ["__all_province__"]}
          onToggle={(key) => {
            if (key === "__all_province__") {
              onClear("provinces");
              return;
            }
            onToggle("provinces", key);
          }}
        />
        {cityChoices.length > 0 ? (
          <ChipGroup
            multiple
            wrap
            options={cityChoices}
            selected={draft.cities}
            onToggle={(key) => onToggle("cities", key)}
          />
        ) : null}
      </SheetSection>

      <SheetSection title="方向 / 职能" hint="领域、职能、行业可叠加">
        <Text style={styles.groupLabel}>领域</Text>
        <ChipGroup
          multiple
          wrap
          options={facets.categories}
          selected={draft.categories}
          onToggle={(key) => onToggle("categories", key)}
        />
        {facets.functions.length > 0 ? (
          <>
            <Text style={styles.groupLabel}>职能</Text>
            <ChipGroup
              multiple
              wrap
              options={facets.functions}
              selected={draft.functions}
              onToggle={(key) => onToggle("functions", key)}
            />
          </>
        ) : null}
        {facets.industries.length > 0 ? (
          <>
            <Text style={styles.groupLabel}>行业</Text>
            <ChipGroup
              multiple
              wrap
              options={facets.industries}
              selected={draft.industries}
              onToggle={(key) => onToggle("industries", key)}
            />
          </>
        ) : null}
      </SheetSection>

      <SheetSection title="薪资区间" hint="按区间重叠匹配">
        <ChipGroup
          multiple
          wrap
          options={RADAR_SALARY_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
          selected={draft.salaryBands}
          onToggle={(key) => onToggle("salaryBands", key)}
        />
      </SheetSection>

      {facets.experiences.length > 0 ? (
        <SheetSection title="经验" hint="可多选">
          <ChipGroup
            multiple
            wrap
            options={facets.experiences}
            selected={draft.experiences}
            onToggle={(key) => onToggle("experiences", key)}
          />
        </SheetSection>
      ) : null}

      {facets.educations.length > 0 ? (
        <SheetSection title="学历" hint="可多选">
          <ChipGroup
            multiple
            wrap
            options={facets.educations}
            selected={draft.educations}
            onToggle={(key) => onToggle("educations", key)}
          />
        </SheetSection>
      ) : null}

      <SheetSection title="来源" hint="岗位抓取渠道" last>
        {facets.sources.length > 0 ? (
          <ChipGroup
            multiple
            wrap
            options={facets.sources}
            selected={draft.sources}
            onToggle={(key) => onToggle("sources", key)}
          />
        ) : (
          <Text style={styles.distEmpty} numberOfLines={2}>
            当前候选集还没有来源信息
          </Text>
        )}
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },

    /* 页头（弱化大标题） */
    pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    pageHeadText: { flex: 1, minWidth: 0, gap: 2 },
    pageTitle: { ...typography.title2, color: colors.text },
    pageSubtitle: { ...typography.caption, color: colors.textMuted },

    /* 概览卡 */
    overviewSkeleton: { height: 168 },
    overviewCard: { gap: 10, padding: 14 },
    overviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    overviewTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    overviewTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    overviewUpdated: { ...typography.caption, color: colors.textMuted },
    statRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statItem: {
      flexGrow: 1,
      flexBasis: "22%",
      minWidth: 72,
      alignItems: "center",
      gap: 2,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    statValue: { ...typography.title2, color: colors.text },
    statValueHighlight: { color: colors.primary },
    statLabel: { ...typography.caption, color: colors.textMuted },
    distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    distLabel: { ...typography.caption, color: colors.textMuted, flexShrink: 0 },
    distChips: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: 6 },
    distChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.primarySoft,
    },
    distChipText: { ...typography.caption, color: colors.primary },
    distEmpty: { ...typography.caption, color: colors.textMuted },
    overviewNote: { ...typography.caption, color: colors.textMuted },

    /* 排序 + 筛选 */
    controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", rowGap: 8 },
    sortGroup: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    sortPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sortPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    sortTextActive: { color: colors.canvas },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    filterBtnText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    filterBadge: {
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBadgeText: { ...typography.micro, color: colors.canvas },

    resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    resultText: { ...typography.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
    resultHint: { ...typography.caption, color: colors.textMuted },
    resetText: { ...typography.caption, fontWeight: "800", color: colors.primary },

    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chipActive: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    chipActiveText: { ...typography.micro, color: colors.primary, maxWidth: 160 },

    /* 岗位卡 */
    jobCard: { gap: 8, padding: 14 },
    jobHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    jobHeadInfo: { flex: 1, minWidth: 0, gap: 2 },
    jobTitle: { ...typography.headline, color: colors.text },
    jobMeta: { ...typography.caption, color: colors.textMuted },
    matchPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    matchPillText: { ...typography.callout, fontWeight: "800" },
    salaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    salaryText: { ...typography.callout, fontWeight: "700", color: colors.text, flex: 1, minWidth: 0 },
    deadlineText: { ...typography.caption, fontWeight: "700", color: colors.accentStrong },
    matchBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    matchTrack: {
      flex: 1,
      minWidth: 0,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    matchFill: { height: "100%", borderRadius: 999 },
    matchBarLabel: { ...typography.caption, color: colors.textMuted },
    reasonRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    reasonText: { ...typography.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      maxWidth: 180,
    },
    tagHit: { backgroundColor: colors.successSoft },
    tagGap: { backgroundColor: colors.surfaceMuted },
    tagText: { ...typography.micro, color: colors.textSecondary, flexShrink: 1 },
    tagTextHit: { color: colors.text },
    tagMore: { backgroundColor: colors.primarySoft },
    tagMoreText: { ...typography.micro, color: colors.primary },
    jobFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
      rowGap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    footText: { ...typography.caption, color: colors.textMuted, flex: 1, minWidth: 0 },
    footRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, flexWrap: "wrap", justifyContent: "flex-end" },
    flagText: { ...typography.caption, fontWeight: "700", color: colors.success },
    gapText: { ...typography.caption, color: colors.textMuted },
    sourceLink: { ...typography.caption, fontWeight: "700", color: colors.primary },

    loadMore: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
    },
    loadMoreText: { ...typography.callout, fontWeight: "700", color: colors.primary },
    endText: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },

    /* 弹层 */
    sheetReset: { ...typography.caption, fontWeight: "800", color: colors.primary },
    groupLabel: { ...typography.caption, fontWeight: "700", color: colors.textMuted, marginTop: 4 },
  });
