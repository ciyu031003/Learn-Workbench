/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { AuthSheet } from "@/components/auth-sheet";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import type { MarketGapItem } from "@learn-workbench/shared";

type MarketStyles = ReturnType<typeof makeStyles>;
type FilterKey = "city" | "function" | "industry" | "seniority" | "source";

function maxOf(values: number[], fallback = 1) {
  return Math.max(fallback, ...values);
}

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
  value: string;
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
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

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
  const width = `${Math.max(6, Math.round((value / safeMax) * 100))}%` as DimensionValue;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowTrack}>
        <View style={[styles.rowFill, { width, backgroundColor: color }]} />
      </View>
      <Text style={styles.rowValue}>{suffix ? suffix : value}</Text>
    </View>
  );
}

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
  const Component = onPress ? Pressable : View;
  return (
    <Component
      style={[styles.chip, active && styles.chipActive]}
      disabled={!onPress}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Component>
  );
}

function RangeTabs({
  styles,
  range,
  onChange,
}: {
  styles: MarketStyles;
  range: MarketIntelligenceRange;
  onChange: (range: MarketIntelligenceRange) => void;
}) {
  const tabs: Array<{ value: MarketIntelligenceRange; label: string }> = [
    { value: 7, label: "7天" },
    { value: 30, label: "30天" },
    { value: 90, label: "90天" },
  ];
  return (
    <View style={styles.rangeRow}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.value}
          onPress={() => onChange(tab.value)}
          style={[styles.rangeTab, range === tab.value && styles.rangeTabActive]}
        >
          <Text style={[styles.rangeText, range === tab.value && styles.rangeTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TrendChart({ styles, series }: { styles: MarketStyles; series: MarketIntelligencePayload["timeSeries"] }) {
  const max = maxOf(series.map((point) => point.newJobs));
  return (
    <View style={styles.trendBars}>
      {series.map((point, index) => (
        <View key={point.date} style={styles.trendBarWrap}>
          <View style={[styles.trendBar, { height: Math.max(4, Math.round((point.newJobs / max) * 82)) }]} />
          <Text style={styles.trendDate}>{index % Math.max(1, Math.ceil(series.length / 7)) === 0 ? point.date.slice(5) : ""}</Text>
        </View>
      ))}
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
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);

  const [filters, setFilters] = useState<MarketIntelligenceFilters>({ range: 90 });
  const [data, setData] = useState<MarketIntelligencePayload | null>(null);
  const [personal, setPersonal] = useState<MarketPersonalInsights>({ loggedIn: false });
  const [decision, setDecision] = useState<MarketDecisionPayload | null>(null);
  const [decisionTarget, setDecisionTarget] = useState({ city: "", functionKey: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState<FilterKey | null>(null);
  const [decisionPicker, setDecisionPicker] = useState<"city" | "function" | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [nextData, nextPersonal] = await Promise.all([
        fetchMarketIntelligence(filters),
        fetchMarketPersonal(),
      ]);
      setData(nextData);
      setPersonal(nextPersonal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "市场数据加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, token]);

  useEffect(() => {
    let alive = true;
    fetchMarketDecision(decisionTarget.city || undefined, decisionTarget.functionKey || undefined)
      .then((payload) => {
        if (alive) setDecision(payload);
      })
      .catch(() => {
        if (alive) setDecision(null);
      });
    return () => {
      alive = false;
    };
  }, [decisionTarget]);

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
      Alert.alert("已加入学习路线", `已创建 ${created} 项学习任务到今日计划。`);
      setPersonal(await fetchMarketPersonal());
    } catch (e) {
      haptics.error();
      Alert.alert("加入失败", e instanceof Error ? e.message : "请稍后重试");
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

  const filterLabels: Array<{ key: FilterKey; label: string; value: string }> = [
    { key: "city", label: "城市", value: filters.city ?? "" },
    { key: "function", label: "职能", value: filters.functionKey ?? "" },
    { key: "industry", label: "行业", value: industryValue },
    { key: "seniority", label: "资历", value: filters.seniorityBucket ?? "" },
    { key: "source", label: "来源", value: filters.source ?? "" },
  ];

  const pickDecisionOptions = decisionPicker === "city"
    ? data?.facets.cities ?? []
    : data?.facets.functions ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <ScreenHeader
        title="招聘市场工作台"
        subtitle={`筛选 · 趋势 · 个人位置${summary ? ` · ${summary.total} 个样本` : ""}`}
        compact
      />

      <RangeTabs
        styles={styles}
        range={filters.range ?? 90}
        onChange={(range) => patchFilters({ range })}
      />

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => patchFilters({ q: search.trim() || undefined })}
          placeholder="搜索职位 / 公司 / 技能"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
        <PressableScale haptic style={styles.searchButton} onPress={() => patchFilters({ q: search.trim() || undefined })}>
          <ThemedIcon name="search-outline" size={19} color="#FFFFFF" />
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
      </ScrollView>

      {loading ? (
        <View style={styles.centeredBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>正在聚合市场数据</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredBox}>
          <ThemedIcon name="cloud-offline-outline" size={30} color={colors.textFaint} />
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>重新加载</Text>
          </PressableScale>
        </View>
      ) : !data || !summary || summary.total === 0 ? (
        <View style={styles.centeredBox}>
          <ThemedIcon name="trending-up-outline" size={30} color={colors.textFaint} />
          <Text style={styles.mutedText}>暂无招聘数据，先抓取一些职位</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.kpiGrid}>
            <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="职位样本" value={String(summary.total)} color={colors.primary} />
            <KpiCard styles={styles} colors={colors} icon="layers-outline" label="7天新增" value={String(summary.last7DaysJobs)} color={colors.teal} />
            <KpiCard styles={styles} colors={colors} icon="cash-outline" label="薪资中位" value={summary.medianSalary != null ? `${summary.medianSalary}K` : "—"} color={colors.accent} />
            <KpiCard styles={styles} colors={colors} icon="location-outline" label="覆盖城市" value={String(summary.cityCount)} color={colors.lavender} />
          </View>

          <Card title="市场时间趋势" subtitle="新增岗位数，7/30/90 天切换">
            <TrendChart styles={styles} series={data.timeSeries ?? []} />
            <Text style={styles.mutedText}>
              最近节点：{data.timeSeries?.at(-1)?.newJobs ?? 0} 个新岗位
            </Text>
          </Card>

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

          <Card title="我的市场位置" subtitle="技能覆盖、可触达岗位和推荐">
            {personal.loggedIn ? (
              <View style={styles.personalBody}>
                <View style={styles.kpiGrid}>
                  <KpiCard styles={styles} colors={colors} icon="git-branch-outline" label="技能覆盖" value={`${personal.profile.skillCoveragePct}%`} color={colors.lavender} />
                  <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="可触达" value={String(personal.reachableJobs)} color={colors.primary} />
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

          <Card title="What If 决策" subtitle="城市迁移、职能热度与升温预警">
            <View style={styles.decisionPickers}>
              <Pressable style={styles.pickerButton} onPress={() => setDecisionPicker("city")}>
                <Text style={styles.pickerText}>{decisionTarget.city || "目标城市"}</Text>
                <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable style={styles.pickerButton} onPress={() => setDecisionPicker("function")}>
                <Text style={styles.pickerText}>{decisionTarget.functionKey || "目标职能"}</Text>
                <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            {decision ? (
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
              <Text style={styles.mutedText}>正在计算决策场景</Text>
            )}
          </Card>
        </View>
      )}

      <BottomSheet
        visible={!!filterOpen}
        onClose={() => setFilterOpen(null)}
        title="选择筛选项"
        height="62%"
      >
        {filterOpen ? (
          <View style={styles.sheetBody}>
            <PressableScale
              haptic
              style={styles.optionRow}
              onPress={() => {
                setFilterOption(filterOpen, "");
                setFilterOpen(null);
              }}
            >
              <Text style={styles.optionText}>全部</Text>
            </PressableScale>
            {pickFilterOptions(filterOpen).map((option) => (
              <PressableScale
                key={option.key}
                haptic
                style={styles.optionRow}
                onPress={() => {
                  setFilterOption(filterOpen, option.key);
                  setFilterOpen(null);
                }}
              >
                <Text style={styles.optionText}>{option.label} ({option.count})</Text>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
              </PressableScale>
            ))}
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={!!decisionPicker}
        onClose={() => setDecisionPicker(null)}
        title={decisionPicker === "city" ? "选择目标城市" : "选择目标职能"}
        height="62%"
      >
        <View style={styles.sheetBody}>
          {pickDecisionOptions.map((option) => (
            <PressableScale
              key={option.key}
              haptic
              style={styles.optionRow}
              onPress={() => {
                if (decisionPicker === "city") setDecisionTarget((current) => ({ ...current, city: option.key }));
                else setDecisionTarget((current) => ({ ...current, functionKey: option.key }));
                setDecisionPicker(null);
              }}
            >
              <Text style={styles.optionText}>{option.label} ({option.count})</Text>
              <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
            </PressableScale>
          ))}
        </View>
      </BottomSheet>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    body: { gap: 12 },
    rangeRow: { flexDirection: "row", gap: 8 },
    rangeTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rangeTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rangeText: { fontSize: 12, fontWeight: "800", color: colors.textMuted },
    rangeTextActive: { color: "#FFFFFF" },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchInput: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      paddingHorizontal: 12,
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      fontSize: 13,
    },
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
    chipText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    chipTextActive: { color: colors.primary },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kpiCard: {
      flexBasis: "47%",
      flexGrow: 1,
      minWidth: 140,
      backgroundColor: colors.surfaceStrong,
      borderWidth: 1,
      borderColor: colors.borderStrong,
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
    kpiLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    kpiValue: { fontSize: 24, fontWeight: "900", letterSpacing: 0 },
    trendBars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 112, paddingTop: 8 },
    trendBarWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 5 },
    trendBar: {
      width: "70%",
      minWidth: 5,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    trendDate: { fontSize: 8, color: colors.textFaint },
    groupTitle: { fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowLabel: { flexShrink: 1, minWidth: 0, width: 76, fontSize: 12, fontWeight: "700", color: colors.textMuted, textAlign: "right" },
    rowTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    rowFill: { height: 10, borderRadius: 5 },
    rowValue: { width: 34, fontSize: 12, fontWeight: "800", color: colors.text, textAlign: "right" },
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
    skillName: { fontSize: 14, fontWeight: "800", color: colors.text },
    skillMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
    matchText: { fontSize: 16, fontWeight: "900", color: colors.primary },
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
    moveMeta: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
    moveScore: { fontSize: 14, fontWeight: "900", color: colors.accent },
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
    sheetBody: { gap: 2 },
    optionRow: {
      minHeight: 46,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionText: { fontSize: 14, fontWeight: "700", color: colors.text },
  });
