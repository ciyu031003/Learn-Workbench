import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenHeader, useLargeTitleHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton";
import { Card } from "@/components/card";
import { ThemedIcon } from "@/components/themed-icon";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
import { radius } from "@/theme/tokens";
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
  const headerScroll = useLargeTitleHeader();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`${getApiUrl()}/api/jobs/radar?limit=${FETCH_LIMIT}`, { headers });
      if (r.ok) setData(await r.json());
    } catch {
      // 离线保持空态
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const { refreshing, onRefresh } = useRefreshable(load);

  const top = data?.top ?? [];
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

  return (
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceStrong} />
      }
    >
      <ScreenHeader large scrollY={headerScroll.scrollY}
        title="就业雷达"
        subtitle={data?.targetRole ? `目标：${data.targetRole}${data.profileCity ? ` · ${data.profileCity}` : ""}` : "今日适合你的岗位信号"} />

      {data && data.mode === "batch" ? (
        <Text style={styles.meta}>
          已扫描 {data.counts.candidates} 个候选岗位 · 匹配 {data.counts.matched} 个（收藏 {data.counts.favorites} / 投递 {data.counts.applications}）
        </Text>
      ) : null}

      {/* ── 筛选区：领域 / 城市 / 岗位方向 + 匹配度排序 ───────────────── */}
      {top.length > 0 ? (
        <Card style={styles.filterCard}>
          <View style={styles.filterHead}>
            <View style={styles.filterTitleRow}>
              <ThemedIcon name="options-outline" size={16} color={colors.primary} />
              <Text style={styles.filterTitle}>筛选</Text>
              {activeFilters > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                </View>
              ) : null}
            </View>
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
        </Card>
      ) : null}

      {loading && top.length === 0 ? (
        <SkeletonCard count={3} />
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
          {shown.map((j) => (
            <Card key={j.jobId} style={styles.item}>
              <View style={styles.head}>
                <View style={styles.scoreWrap}>
                  <Text style={[styles.score, j.overall >= 75 && { color: colors.success ?? colors.primary }]}>{j.overall}%</Text>
                </View>
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
                  <Text key={`m-${s.skill}`} style={[styles.chipTag, styles.chipHit]}>✓ {s.skill}</Text>
                ))}
                {j.missingSkills.slice(0, 3).map((s) => (
                  <Text key={`x-${s.skill}`} style={styles.chipTag}>○ {s.skill}</Text>
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
          ))}

          <View style={styles.pager}>
            <Pressable
              disabled={safePage <= 0}
              onPress={() => gotoPage(safePage - 1)}
              style={[styles.pagerBtn, safePage <= 0 && styles.pagerBtnOff]}
              accessibilityRole="button"
              accessibilityLabel="上一页"
            >
              <ThemedIcon name="chevron-back" size={16} color={safePage <= 0 ? colors.textFaint : colors.primary} />
              <Text style={[styles.pagerBtnText, safePage <= 0 && styles.pagerTextOff]}>上一页</Text>
            </Pressable>

            <View style={styles.pagerMid}>
              <Text style={styles.pagerPage}>第 {safePage + 1} / {pageCount} 页</Text>
              <Text style={styles.pagerCount}>已显示 {from}–{to} / 共 {filtered.length} 个</Text>
            </View>

            <Pressable
              disabled={safePage >= pageCount - 1}
              onPress={() => gotoPage(safePage + 1)}
              style={[styles.pagerBtn, safePage >= pageCount - 1 && styles.pagerBtnOff]}
              accessibilityRole="button"
              accessibilityLabel="下一页"
            >
              <Text style={[styles.pagerBtnText, safePage >= pageCount - 1 && styles.pagerTextOff]}>下一页</Text>
              <ThemedIcon name="chevron-forward" size={16} color={safePage >= pageCount - 1 ? colors.textFaint : colors.primary} />
            </Pressable>
          </View>
        </>
      )}
    </Animated.ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    meta: { fontSize: 11, color: colors.textMuted },

    /* 筛选区 */
    filterCard: { gap: 8, padding: 14 },
    filterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    filterTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
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
    chipRow: { gap: 6, paddingVertical: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    chipTextActive: { color: colors.canvas },
    filterFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    filterCount: { fontSize: 11, color: colors.textMuted },
    resetText: { fontSize: 12, fontWeight: "800", color: colors.primary },

    /* 卡片 */
    item: { gap: 8 },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    scoreWrap: { minWidth: 46, alignItems: "center", justifyContent: "center" },
    score: { fontSize: 18, fontWeight: "800", color: colors.primary },
    headInfo: { flex: 1, minWidth: 0, gap: 1 },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    muted: { fontSize: 11, color: colors.textMuted },
    salary: { fontSize: 12, fontWeight: "700", color: colors.text },
    deadline: { fontSize: 11, fontWeight: "700", color: colors.accentStrong },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chipTag: {
      fontSize: 11,
      color: colors.textMuted,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    chipHit: { color: colors.text },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { fontSize: 12, color: colors.primary, fontWeight: "700" },
    /* v1.26 分页条 */
    pager: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingTop: 4,
    },
    pagerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    pagerBtnOff: { backgroundColor: colors.surfaceMuted },
    pagerBtnText: { fontSize: 12, fontWeight: "800", color: colors.primary },
    pagerTextOff: { color: colors.textFaint },
    pagerMid: { alignItems: "center", gap: 1 },
    pagerPage: { fontSize: 12, fontWeight: "800", color: colors.text },
    pagerCount: { fontSize: 10, color: colors.textMuted },
    moreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
    },
    moreText: { fontSize: 13, fontWeight: "800", color: colors.primary },
    endText: { fontSize: 11, color: colors.textFaint, textAlign: "center", paddingVertical: 8 },
  });
