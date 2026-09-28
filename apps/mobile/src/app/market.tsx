/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { AuthSheet } from "@/components/auth-sheet";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSearchField, SheetSection, SheetSegmented, type SegmentOption } from "@/components/sheet";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { InlineToast, TOAST_DEFAULT_LIFE_MS, type ToastKind } from "@/components/toast";
import { AnimatedNumber } from "@/components/animated-number";
import { ProgressBar } from "@/components/stat";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { staggerDelay } from "@/lib/stagger";
import { haptics } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useAppStore } from "@/store/app-store";
import {
  enrollMarketGaps,
  fetchMarketDecision,
  fetchMarketIntelligence,
  fetchMarketPersonal,
  type MarketDecisionPayload,
  type MarketFacetItem,
  type MarketIntelligenceFilters,
  type MarketIntelligencePayload,
  type MarketIntelligenceRange,
  type MarketPersonalInsights,
  type MarketRankItem,
} from "@/lib/market";
import { aggregateTimeSeries, labelPositions } from "@/lib/market-series";
import type { MarketGapItem } from "@learn-workbench/shared";

type MarketStyles = ReturnType<typeof makeStyles>;
type FilterKey = "city" | "function" | "industry" | "seniority" | "source";

/** v16：筛选键的中文名（弹层标题/摘要共用一份，避免两处漂移） */
const FILTER_LABEL: Record<FilterKey, string> = {
  city: "城市",
  function: "职能",
  industry: "行业",
  seniority: "资历",
  source: "来源",
};

/** v16：时间范围换成滑动分段（原 RangeTabs 的等权胶囊） */
const RANGE_OPTIONS: SegmentOption[] = [
  { key: "7", label: "7天" },
  { key: "30", label: "30天" },
  { key: "90", label: "90天" },
];

function maxOf(values: number[], fallback = 1) {
  return Math.max(fallback, ...values);
}

/** v20-C1：筛选刷新细进度条（与 jobs 同款：换 range/搜索时保留旧内容） */
function FilterRefreshBar() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.35, { duration: 380 })), -1, true);
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);
  const bar = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(150)}
      style={[{ height: 2, borderRadius: 1, backgroundColor: colors.primary, marginBottom: 8 }, bar]}
    />
  );
}

/** v20-C2：KPI 数字滚动（AnimatedNumber）；卡片去描边、tabular 对齐 */
function KpiCard({
  styles,
  colors,
  icon,
  label,
  value,
  color,
}: {
  styles: MarketStyles;
  colors: ThemeColors;
  icon: Parameters<typeof ThemedIcon>[0]["name"];
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: color + "22" }]}>
          <ThemedIcon name={icon} size={18} color={color} />
        </View>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      {typeof value === "number" ? (
        <AnimatedNumber value={value} style={styles.kpiValue} />
      ) : (
        <Text style={styles.kpiValue}>{value}</Text>
      )}
    </View>
  );
}

/** v20-C2：分布条动画化（stat.tsx 的 ProgressBar，240ms 缓动），替代静态 width% */
function BarRow({
  styles,
  label,
  value,
  max,
  color,
  suffix,
}: {
  styles: MarketStyles;
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const safeMax = maxOf([max]);
  const clamped = Math.max(0.06, value / safeMax);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <ProgressBar progress={clamped} height={10} color={color} style={styles.rowFillTrack} />
      <Text style={styles.rowValue}>{suffix ? suffix : value}</Text>
    </View>
  );
}

/** v20-C6：筛选 chip 统一按压反馈 + 触觉（原先裸 Pressable） */
function Chip({
  styles,
  label,
  active,
  onPress,
}: {
  styles: MarketStyles;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.94}
      style={[styles.chip, active && styles.chipActive]}
      onPress={
        onPress
          ? () => {
              haptics.soft();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  );
}

/**
 * v20-C2：趋势柱状图——入场错峰 + 换 range 时高度过渡（LinearTransition）；
 * 90 天档按周采样（≤31 根）防拥挤；末节点柱用 accent 高亮。
 */
function TrendChart({ styles, series }: { styles: MarketStyles; series: MarketIntelligencePayload["timeSeries"] }) {
  /**
   * v1.31：真机反馈「胶囊柱状图与数字重合」—— 原来按 31 根柱采样，每根只有几 dp，
   * 日期标签必然互相压住。现在改为**按时间间隔聚合**（每 3 小时 / 每天 / 每 3 天…，
   * 柱数上限 10），并且只在前 5 个均匀位置渲染标签。
   * 聚合口径标在图表上方（用户要求"要标明"）；数据来源与接口口径未改，只做前端聚合。
   */
  const { buckets, intervalLabel, aggregated, rawCount } = aggregateTimeSeries(series ?? []);
  if (buckets.length === 0) {
    return <Text style={styles.trendEmpty}>还没有足够的样本，抓取几次后就能看到趋势。</Text>;
  }
  const max = Math.max(1, ...buckets.map((point) => point.value));
  const labels = labelPositions(buckets.length);
  const lastIndex = buckets.length - 1;
  return (
    <View>
      <Text style={styles.trendCaption}>
        {aggregated ? "按" + intervalLabel + "聚合" : "按原始时间粒度"} · {buckets.length} 柱 / {rawCount} 条记录
      </Text>
      <View style={styles.trendBars}>
        {buckets.map((point, index) => (
          <Animated.View
            key={point.key}
            style={styles.trendBarWrap}
            layout={LinearTransition}
            entering={FadeInDown.duration(240).delay(staggerDelay(index))}
          >
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBar,
                  index === lastIndex ? styles.trendBarLast : null,
                  { height: Math.max(4, Math.round((point.value / max) * 82)) },
                ]}
              />
            </View>
            <Text style={styles.trendDate} numberOfLines={1}>
              {labels.has(index) ? point.label : ""}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function MoveList({ styles, items }: { styles: MarketStyles; items: MarketDecisionPayload["hotspots"] }) {
  return (
    <View style={styles.moveList}>
      {items.slice(0, 4).map((item) => (
        <View key={`${item.reason}-${item.key}`} style={styles.moveRow}>
          <View style={styles.moveMain}>
            <Text style={styles.moveName} numberOfLines={1}>{item.label}</Text>
            <Text style={styles.moveMeta}>{item.reason} · {item.count} 岗{item.medianSalary != null ? ` · ${item.medianSalary}K` : ""}</Text>
          </View>
          <Text style={styles.moveScore}>{Math.round(item.score)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MarketScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v20-C2：四张数据卡入场错峰 */
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);

  const [filters, setFilters] = useState<MarketIntelligenceFilters>({ range: 90 });
  const [data, setData] = useState<MarketIntelligencePayload | null>(null);
  const [personal, setPersonal] = useState<MarketPersonalInsights>({ loggedIn: false });
  const [decision, setDecision] = useState<MarketDecisionPayload | null>(null);
  const [decisionTarget, setDecisionTarget] = useState({ city: "", functionKey: "" });
  const [loading, setLoading] = useState(true);
  /** v20-C1：换 range/搜索时保留旧内容，只显示细进度条（不再整页闪 spinner） */
  const [filterRefreshing, setFilterRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState<FilterKey | null>(null);
  const [decisionPicker, setDecisionPicker] = useState<"city" | "function" | null>(null);
  /** v20-C3：What If 的重算中/失败态独立（失败不再伪装成"正在计算"） */
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(false);
  const [decisionNonce, setDecisionNonce] = useState(0);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<ToastKind>("success");
  const [search, setSearch] = useState("");

  const showToast = useCallback((message: string, kind: ToastKind = "success", lifeMs = TOAST_DEFAULT_LIFE_MS) => {
    setToast(message);
    setToastKind(kind);
    setTimeout(() => setToast((current) => (current === message ? null : current)), lifeMs);
  }, []);

  const loadedOnceRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) {
      // v20-C1：首载走骨架；之后的筛选变化保留旧内容 + 细进度条
      if (loadedOnceRef.current) setFilterRefreshing(true);
      else setLoading(true);
    }
    setError(null);
    try {
      const [nextData, nextPersonal] = await Promise.all([
        fetchMarketIntelligence(filters),
        fetchMarketPersonal(),
      ]);
      setData(nextData);
      setPersonal(nextPersonal);
      loadedOnceRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "市场数据加载失败");
    } finally {
      setLoading(false);
      setFilterRefreshing(false);
    }
  }, [filters]);

  // v17/v18 收尾：下拉刷新统一走 usePullRefresh（吸顶栏存在 → 偏移自动 = insets.top + 44）
  const { control: pullControl } = usePullRefresh(() => load(true), { stickyHeader: true });

  useEffect(() => {
    void load();
  }, [load, token]);

  // v20-C3：What If 重算带 loading/失败态（请求序号守卫防旧响应覆盖新响应）
  const decisionSeq = useRef(0);
  useEffect(() => {
    let seq = ++decisionSeq.current;
    let alive = true;
    setDecisionLoading(true);
    setDecisionError(false);
    fetchMarketDecision(decisionTarget.city || undefined, decisionTarget.functionKey || undefined)
      .then((payload) => {
        if (alive && seq === decisionSeq.current) setDecision(payload);
      })
      .catch(() => {
        if (alive && seq === decisionSeq.current) setDecisionError(true);
      })
      .finally(() => {
        if (alive && seq === decisionSeq.current) setDecisionLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [decisionTarget, decisionNonce]);

  const patchFilters = (patch: Partial<MarketIntelligenceFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const handleAuthed = (nextToken: string, username: string) => {
    setAuth(nextToken, username);
    setAuthOpen(false);
  };

  const enroll = async (gap: MarketGapItem) => {
    if (!gap || enrolling) return;
    setEnrolling(gap.skill);
    try {
      const created = await enrollMarketGaps([gap]);
      haptics.success();
      // v20-C4：反馈统一走页内 toast（不再 Alert 打断）
      showToast(`已创建 ${created} 项学习任务到今日计划`, "success");
      setPersonal(await fetchMarketPersonal());
    } catch (e) {
      haptics.error();
      showToast(e instanceof Error ? e.message : "加入失败，请稍后重试", "error");
    } finally {
      setEnrolling(null);
    }
  };

  const pickFilterOptions = (key: FilterKey): MarketFacetItem[] => {
    if (!data) return [];
    if (key === "industry") {
      return data.facets.industries.map((item) => ({
        key: `${item.key}`,
        label: item.label,
        count: item.count,
      }));
    }
    if (key === "city") return data.facets.cities;
    if (key === "function") return data.facets.functions;
    if (key === "seniority") return data.facets.seniorities;
    return data.facets.sources;
  };

  const setFilterOption = (key: FilterKey, value: string) => {
    if (key === "industry") {
      const [sector, subsector] = value.split(" / ");
      patchFilters({
        industrySector: value ? sector : undefined,
        industrySubsector: value && subsector ? subsector : undefined,
      });
    } else if (key === "city") {
      patchFilters({ city: value || undefined });
    } else if (key === "function") {
      patchFilters({ functionKey: value || undefined });
    } else if (key === "seniority") {
      patchFilters({ seniorityBucket: value || undefined });
    } else {
      patchFilters({ source: value || undefined });
    }
  };

  const industryValue = filters.industrySector
    ? filters.industrySubsector
      ? `${filters.industrySector} / ${filters.industrySubsector}`
      : filters.industrySector
    : "";
  const summary = data?.summary;
  const dist = data?.distributions;

  /** 某个筛选键当前选中的值（弹层里用来点亮对应胶囊） */
  const filterValueOf = (key: FilterKey): string => {
    if (key === "city") return filters.city ?? "";
    if (key === "function") return filters.functionKey ?? "";
    if (key === "industry") return industryValue;
    if (key === "seniority") return filters.seniorityBucket ?? "";
    return filters.source ?? "";
  };

  const filterLabels: { key: FilterKey; label: string; value: string }[] = (
    ["city", "function", "industry", "seniority", "source"] as FilterKey[]
  ).map((key) => ({ key, label: FILTER_LABEL[key], value: filterValueOf(key) }));

  const pickDecisionOptions = decisionPicker === "city"
    ? data?.facets.cities ?? []
    : data?.facets.functions ?? [];

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title="招聘市场工作台" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView
      onScroll={headerScroll.onScroll}
      scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      refreshControl={<RefreshControl {...pullControl} />}
    >
      <ScreenHeaderLargeTitle
        title="招聘市场工作台"
        subtitle={`筛选 · 趋势 · 个人位置${summary ? ` · ${summary.total} 个样本` : ""}`} />

      <SheetSegmented
        options={RANGE_OPTIONS}
        value={String(filters.range ?? 90)}
        onChange={(key) => patchFilters({ range: Number(key) as MarketIntelligenceRange })}
      />

      {/* v20-J4：搜索框收单源（SheetSearchField，内嵌清空）；清除时同步清掉 q 筛选 */}
      <View style={styles.searchRow}>
        <SheetSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="搜索职位 / 公司 / 技能"
          autoCapitalize="none"
          onSubmit={() => patchFilters({ q: search.trim() || undefined })}
          onClear={() => patchFilters({ q: undefined })}
          style={{ flex: 1 }}
        />
        <PressableScale haptic scaleTo={0.92} style={styles.searchButton} onPress={() => patchFilters({ q: search.trim() || undefined })}>
          <ThemedIcon name="search-outline" size={19} color="#FFFFFF" />
        </PressableScale>
      </View>

      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filterLabels.map((item) => (
          <Chip
            key={item.key}
            styles={styles}
            label={item.value ? `${item.label}: ${item.value}` : item.label}
            active={!!item.value}
            onPress={() => setFilterOpen(item.key)}
          />
        ))}
        <Chip
          styles={styles}
          label="重置筛选"
          onPress={() => {
            setSearch("");
            setFilters({ range: filters.range ?? 90 });
          }}
        />
      </Animated.ScrollView>

      {toast ? <InlineToast message={toast} kind={toastKind} style={styles.toast} /> : null}
      {filterRefreshing ? <FilterRefreshBar /> : null}

      {loading ? (
        /* v20-C1：首载骨架（与全 App 等待语言一致） */
        <View style={styles.body}>
          <SkeletonCard count={3} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="市场数据加载失败"
          hint={error}
          actionLabel="重新加载"
          onAction={() => void load()}
        />
      ) : !data || !summary || summary.total === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="暂无招聘数据"
          hint="先抓取一些职位，市场趋势与个人位置才会出现。"
        />
      ) : (
        <View style={styles.body}>
          {/* v20-C2：四张卡入场错峰（useScreenEntrance 统一节奏） */}
          <Animated.View entering={entrance(0)}>
          <View style={styles.kpiGrid}>
            <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="职位样本" value={summary.total} color={colors.primary} />
            <KpiCard styles={styles} colors={colors} icon="layers-outline" label="7天新增" value={summary.last7DaysJobs} color={colors.teal} />
            <KpiCard styles={styles} colors={colors} icon="cash-outline" label="薪资中位" value={summary.medianSalary != null ? `${summary.medianSalary}K` : "—"} color={colors.accent} />
            <KpiCard styles={styles} colors={colors} icon="location-outline" label="覆盖城市" value={summary.cityCount} color={colors.lavender} />
          </View>
          </Animated.View>

          <Animated.View entering={entrance(1)}>
          <Card title="市场时间趋势" subtitle="新增岗位数，7/30/90 天切换">
            <TrendChart styles={styles} series={data.timeSeries ?? []} />
            <Text style={styles.mutedText}>
              最近节点：{data.timeSeries?.at(-1)?.newJobs ?? 0} 个新岗位
            </Text>
          </Card>
          </Animated.View>

          <Animated.View entering={entrance(2)}>
          <Card title="需求分布" subtitle="城市、职能、行业、资历和薪资">
            <Text style={styles.groupTitle}>城市机会 TOP</Text>
            {(dist?.byCity ?? []).slice(0, 5).map((item: MarketRankItem) => (
              <BarRow
                key={item.key}
                styles={styles}
                label={item.label}
                value={item.count}
                max={maxOf((dist?.byCity ?? []).map((x) => x.count))}
                color={colors.primary}
              />
            ))}
            <Text style={styles.groupTitle}>职能需求</Text>
            <View style={styles.chipGrid}>
              {(dist?.byFunction ?? []).slice(0, 8).map((item) => (
                <Chip key={item.key} styles={styles} label={`${item.label} ${item.count}`} />
              ))}
            </View>
            <Text style={styles.groupTitle}>薪资区间</Text>
            {(dist?.bySalary ?? []).slice(0, 4).map((item) => (
              <BarRow
                key={item.label}
                styles={styles}
                label={item.label}
                value={item.count}
                max={maxOf((dist?.bySalary ?? []).map((x) => x.count))}
                color={colors.accent}
              />
            ))}
          </Card>
          </Animated.View>

          <Animated.View entering={entrance(3)}>
          <Card title="我的市场位置" subtitle="技能覆盖、可触达岗位和推荐">
            {personal.loggedIn ? (
              <View style={styles.personalBody}>
                <View style={styles.kpiGrid}>
                  <KpiCard styles={styles} colors={colors} icon="git-branch-outline" label="技能覆盖" value={`${personal.profile.skillCoveragePct}%`} color={colors.lavender} />
                  <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="可触达" value={personal.reachableJobs} color={colors.primary} />
                </View>
                <Text style={styles.groupTitle}>优先补什么</Text>
                {personal.gaps.slice(0, 5).map((gap) => (
                  <View key={gap.skill} style={styles.gapRow}>
                    <View style={styles.moveMain}>
                      <Text style={styles.skillName} numberOfLines={1}>{gap.skill}</Text>
                      <Text style={styles.skillMeta}>{gap.topicTitle ?? "技能主题"} · 约 {gap.estimateHours ?? 8}h</Text>
                    </View>
                    <PressableScale
                      haptic
                      disabled={enrolling === gap.skill || !gap.enrollable}
                      style={[styles.gapButton, (!gap.enrollable || enrolling === gap.skill) && styles.gapButtonDisabled]}
                      onPress={() => void enroll(gap)}
                    >
                      <Text style={styles.gapButtonText}>{enrolling === gap.skill ? "加入中" : "加入"}</Text>
                    </PressableScale>
                  </View>
                ))}
                {!personal.gaps.length ? <Text style={styles.mutedText}>当前能力画像已覆盖主要热门技能</Text> : null}
                <Text style={styles.groupTitle}>推荐岗位</Text>
                {personal.recommendations.slice(0, 4).map((job) => (
                  <View key={job.id} style={styles.recommendRow}>
                    <View style={styles.moveMain}>
                      <Text style={styles.skillName} numberOfLines={1}>{job.title}</Text>
                      <Text style={styles.skillMeta}>{job.company} · {job.city} · {job.salaryText}</Text>
                      {job.missingSkills.length ? <Text style={styles.skillMeta}>还缺 {job.missingSkills.slice(0, 3).join(" / ")}</Text> : null}
                    </View>
                    <Text style={styles.matchText}>{job.match}%</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.loginBox}>
                <Text style={styles.loginText}>登录后查看技能覆盖、可触达岗位和推荐职位。</Text>
                <PressableScale haptic style={styles.gapButton} onPress={() => setAuthOpen(true)}>
                  <Text style={styles.gapButtonText}>去登录</Text>
                </PressableScale>
              </View>
            )}
          </Card>
          </Animated.View>

          <Animated.View entering={entrance(4)}>
          <Card title="What If 决策" subtitle="城市迁移、职能热度与升温预警">
            <View style={styles.decisionPickers}>
              <PressableScale scaleTo={0.97} style={styles.pickerButton} onPress={() => setDecisionPicker("city")}>
                <Text style={styles.pickerText}>{decisionTarget.city || "目标城市"}</Text>
                <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
              </PressableScale>
              <PressableScale scaleTo={0.97} style={styles.pickerButton} onPress={() => setDecisionPicker("function")}>
                <Text style={styles.pickerText}>{decisionTarget.functionKey || "目标职能"}</Text>
                <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
              </PressableScale>
            </View>
            {decisionError && !decision ? (
              /* v20-C3：失败给明确错误 + 重试（原先永远伪装成"正在计算"） */
              <View style={styles.centeredBox}>
                <ThemedIcon name="warning-outline" size={24} color={colors.textFaint} />
                <Text style={styles.mutedText}>场景计算失败</Text>
                <PressableScale style={styles.retryButton} onPress={() => setDecisionNonce((n) => n + 1)}>
                  <Text style={styles.retryText}>重新计算</Text>
                </PressableScale>
              </View>
            ) : decision ? (
              <>
                <View style={styles.kpiGrid}>
                  <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="目标岗位" value={String(decision.scenario.totalJobs)} color={colors.primary} />
                  <KpiCard styles={styles} colors={colors} icon="cash-outline" label="薪资中位" value={decision.scenario.medianSalary != null ? `${decision.scenario.medianSalary}K` : "—"} color={colors.accent} />
                </View>
                <Text style={styles.groupTitle}>建议</Text>
                {decision.scenario.suggestions.slice(0, 4).map((suggestion) => (
                  <Text key={suggestion.slice(0, 80)} style={styles.skillMeta}>{suggestion}</Text>
                ))}
                <Text style={styles.groupTitle}>职能热度</Text>
                <MoveList styles={styles} items={decision.hotspots} />
                <Text style={styles.groupTitle}>城市机会</Text>
                <MoveList styles={styles} items={decision.migrations} />
                <Text style={styles.groupTitle}>升温预警</Text>
                <MoveList styles={styles} items={decision.alerts} />
              </>
            ) : (
              <Text style={styles.mutedText}>
                {decisionLoading ? "正在计算决策场景…" : "选择目标城市 / 职能后开始计算"}
              </Text>
            )}
          </Card>
          </Animated.View>
        </View>
      )}

      <BottomSheet
        visible={!!filterOpen}
        onClose={() => setFilterOpen(null)}
        title="选择筛选项"
        subtitle={filterOpen ? `点一下「${FILTER_LABEL[filterOpen]}」即应用并关闭` : undefined}
        icon="options-outline"
        height="62%"
      >
        {filterOpen ? (
          <SheetSection title={FILTER_LABEL[filterOpen]} hint="可横滑 / 换行查看全部选项" last>
            <ChipGroup
              options={pickFilterOptions(filterOpen).map((option) => ({ key: option.key, label: option.label, badge: option.count }))}
              selected={[filterValueOf(filterOpen)]}
              multiple={false}
              allKey=""
              allLabel="全部"
              wrap
              onToggle={(key) => {
                setFilterOption(filterOpen, key);
                setFilterOpen(null);
              }}
            />
          </SheetSection>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={!!decisionPicker}
        onClose={() => setDecisionPicker(null)}
        title={decisionPicker === "city" ? "选择目标城市" : "选择目标职能"}
        subtitle="选择后立即重算 What If 场景"
        icon="git-branch-outline"
        height="62%"
      >
        <SheetSection title={decisionPicker === "city" ? "城市" : "职能"} last>
          <ChipGroup
            options={pickDecisionOptions.map((option) => ({ key: option.key, label: option.label, badge: option.count }))}
            selected={decisionPicker === "city" ? [decisionTarget.city] : [decisionTarget.functionKey]}
            multiple={false}
            wrap
            onToggle={(key) => {
              if (decisionPicker === "city") setDecisionTarget((current) => ({ ...current, city: key }));
              else setDecisionTarget((current) => ({ ...current, functionKey: key }));
              setDecisionPicker(null);
            }}
          />
        </SheetSection>
      </BottomSheet>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    body: { gap: 12 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    filterRow: { gap: 7, paddingRight: 8 },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: colors.primary + "22", borderColor: colors.primary },
    chipText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    chipTextActive: { color: colors.primary },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kpiCard: {
      flexBasis: "47%",
      flexGrow: 1,
      minWidth: 140,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
      gap: 12,
    },
    kpiTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    kpiIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    // v20-C2：KPI 数字走 AnimatedNumber，tabular-nums 保证滚动时宽度稳定
    kpiValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    trendBars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 112, paddingTop: 8 },
    trendBarWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 5 },
    trendBarTrack: { width: "100%", height: 82, alignItems: "center", justifyContent: "flex-end" },
    trendBar: {
      width: "70%",
      minWidth: 5,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    // v20-C2：末节点高亮（accent）
    trendBarLast: { backgroundColor: colors.accent },
    trendDate: { ...typography.micro, fontWeight: "500", color: colors.textFaint },
    // v1.31：聚合口径说明（用户要求把"每 N 小时/每天"标在 UI 上）
    trendCaption: { ...typography.micro, color: colors.textMuted, marginBottom: 2 },
    trendEmpty: { ...typography.callout, color: colors.textSecondary, paddingVertical: 12 },
    groupTitle: { ...typography.caption, fontWeight: "800", color: colors.text, marginTop: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowLabel: { flexShrink: 1, minWidth: 0, width: 76, ...typography.caption, fontWeight: "700", color: colors.textSecondary, textAlign: "right" },
    rowTrack: { flex: 1, borderRadius: 5 },
    rowFillTrack: { flex: 1 },
    // v20-C5：定宽 34 会截断 4 位数值，改最小宽自适应
    rowValue: { minWidth: 34, ...typography.caption, fontWeight: "800", color: colors.text, textAlign: "right" },
    personalBody: { gap: 10 },
    gapRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    recommendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    moveMain: { flex: 1, minWidth: 0 },
    skillName: { ...typography.callout, fontWeight: "800", color: colors.text },
    skillMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
    matchText: { ...typography.headline, fontWeight: "900", color: colors.primary },
    gapButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignSelf: "center",
    },
    gapButtonDisabled: { opacity: 0.55 },
    gapButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    loginBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 4,
    },
    loginText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    decisionPickers: { flexDirection: "row", gap: 8 },
    pickerButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pickerText: { fontSize: 13, fontWeight: "700", color: colors.text },
    moveList: { gap: 0 },
    moveRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    moveName: { fontSize: 13, fontWeight: "800", color: colors.text },
    moveMeta: { ...typography.micro, fontWeight: "500", color: colors.textMuted, marginTop: 3 },
    moveScore: { ...typography.callout, fontWeight: "900", color: colors.accent },
    // v20-C4：页内 toast（enroll 反馈统一走 toast，不再 Alert）
    toast: { marginBottom: 4 },
    centeredBox: { alignItems: "center", gap: 10, paddingVertical: 36 },
    mutedText: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
    errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  });
