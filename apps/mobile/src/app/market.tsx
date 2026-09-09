/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  fetchMarket,
  fetchMarketGaps,
  fetchMarketProfile,
  marketKpis,
  marketSkillRows,
} from "@/lib/market";
import type { MarketSkillRow } from "@/lib/market";
import type { MarketAnalysis, MarketGapItem, UserSkillView } from "@learn-workbench/shared";

const LEVEL_LABELS = ["未掌握", "了解", "入门", "熟练", "精通", "专家"] as const;

type MarketStyles = ReturnType<typeof makeStyles>;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function levelLabel(level: number | null) {
  if (level == null || level < 0 || level >= LEVEL_LABELS.length) return "未记录";
  return LEVEL_LABELS[level];
}

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
}: {
  styles: MarketStyles;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const width = `${maxOf([max]) > 0 ? Math.max(6, Math.round((value / maxOf([max])) * 100)) : 6}%` as DimensionValue;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowTrack}>
        <View style={[styles.rowFill, { width, backgroundColor: color }]} />
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Chip({ styles, label }: { styles: MarketStyles; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export default function MarketScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);

  const [data, setData] = useState<MarketAnalysis | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [gaps, setGaps] = useState<MarketGapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<MarketSkillRow | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const nextData = await fetchMarket();
      const profile = await fetchMarketProfile().catch(() => ({ loggedIn: false, skills: [] as UserSkillView[] }));
      let nextGaps: MarketGapItem[] = [];

      if (profile.loggedIn) {
        nextGaps = await fetchMarketGaps().catch(() => []);
      }

      setData(nextData);
      setLoggedIn(profile.loggedIn);
      setSkills(profile.skills);
      setGaps(nextGaps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "市场数据加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, token]);

  const kpis = useMemo(() => (data ? marketKpis(data) : null), [data]);
  const skillRows = useMemo(
    () => (data ? marketSkillRows(data, skills, gaps) : []),
    [data, gaps, skills]
  );
  const selectedGap = useMemo(
    () =>
      selectedSkill
        ? gaps.find((gap) => normalize(gap.skill) === normalize(selectedSkill.skill))
        : undefined,
    [gaps, selectedSkill]
  );

  const enroll = async (gap: MarketGapItem) => {
    if (!gap || enrolling) return;
    setEnrolling(true);
    try {
      const created = await enrollMarketGaps([gap]);
      haptics.success();
      Alert.alert("已加入学习路线", `已创建 ${created} 项学习任务到今日计划。`);
      const nextGaps = await fetchMarketGaps().catch(() => []);
      setGaps(nextGaps);
    } catch (e) {
      haptics.error();
      Alert.alert("加入失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setEnrolling(false);
    }
  };

  const handleAuthed = (nextToken: string, username: string) => {
    setAuth(nextToken, username);
    setAuthOpen(false);
  };

  const cityMax = maxOf(data?.byCity.map((c) => c.count) ?? []);
  const salaryMax = maxOf(data?.salaryDist.map((s) => s.count) ?? []);
  const educationMax = maxOf(data?.byEducation.map((e) => e.count) ?? []);
  const experienceMax = maxOf(data?.byExperience.map((e) => e.count) ?? []);

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
        title="招聘市场分析"
        subtitle={`市场到底需要什么？样本 ${data?.total ?? "—"} 个职位`}
        compact
      />

      {loading ? (
        <View style={styles.centeredBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>正在聚合职位数据</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredBox}>
          <ThemedIcon name="cloud-offline-outline" size={30} color={colors.textFaint} />
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>重新加载</Text>
          </PressableScale>
        </View>
      ) : !data || !kpis ? (
        <View style={styles.centeredBox}>
          <ThemedIcon name="trending-up-outline" size={30} color={colors.textFaint} />
          <Text style={styles.mutedText}>暂无招聘数据，先抓取一些职位</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.kpiGrid}>
            <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="职位样本" value={String(kpis.total)} color={colors.primary} />
            <KpiCard styles={styles} colors={colors} icon="layers-outline" label="覆盖城市" value={String(kpis.cityCount)} color={colors.teal} />
            <KpiCard styles={styles} colors={colors} icon="git-branch-outline" label="热门技能" value={String(kpis.skillCount)} color={colors.lavender} />
            <KpiCard styles={styles} colors={colors} icon="trending-up-outline" label="平均薪资" value={kpis.avgSalary != null ? `${kpis.avgSalary}K` : "—"} color={colors.accent} />
          </View>

          {data.trend?.has ? (
            <View style={styles.trendStrip}>
              <Text style={styles.trendText}>
                较 {data.trend.prevDate} 岗位总量{" "}
                {data.trend.totalDeltaPct != null
                  ? `${data.trend.totalDeltaPct >= 0 ? "+" : ""}${data.trend.totalDeltaPct}%`
                  : "—"}
              </Text>
              {data.trend.topSkill ? (
                <Text style={styles.trendText}>TOP 技能「{data.trend.topSkill}」</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.trendStrip}>
              <Text style={styles.trendText}>市场趋势：数据积累中</Text>
            </View>
          )}

          <Card title="市场需求" subtitle="城市、方向和薪资一起看">
            <Text style={styles.groupTitle}>城市机会 TOP 5</Text>
            {data.byCity.slice(0, 5).map((city) => (
              <BarRow
                key={city.city}
                styles={styles}
                label={city.city}
                value={city.count}
                max={cityMax}
                color={colors.primary}
              />
            ))}
            <Text style={styles.groupTitle}>薪资区间</Text>
            {data.salaryDist.slice(0, 4).map((salary) => (
              <BarRow
                key={salary.label}
                styles={styles}
                label={salary.label}
                value={salary.count}
                max={salaryMax}
                color={colors.accent}
              />
            ))}
            <Text style={styles.groupTitle}>岗位职能</Text>
            <View style={styles.chipGrid}>
              {data.byFunction.slice(0, 8).map((item) => (
                <Chip key={item.label} styles={styles} label={`${item.label} ${item.count}`} />
              ))}
            </View>
          </Card>

          <Card title="技能机会" subtitle="热度与平均薪资">
            {skillRows.length ? (
              skillRows.slice(0, 6).map((row) => (
                <PressableScale
                  key={row.skill}
                  haptic
                  style={styles.skillRow}
                  onPress={() => setSelectedSkill(row)}
                >
                  <View style={styles.skillMain}>
                    <Text style={styles.skillName} numberOfLines={1}>
                      {row.skill}
                    </Text>
                    <Text style={styles.skillMeta}>
                      {row.avgSalary}K · {row.count} 岗位
                    </Text>
                  </View>
                  {loggedIn ? (
                    <Text style={styles.levelText}>{levelLabel(row.myLevel)}</Text>
                  ) : (
                    <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                  )}
                </PressableScale>
              ))
            ) : (
              <Text style={styles.mutedText}>暂无可计算的技能薪资数据</Text>
            )}
          </Card>

          <Card title="人才画像" subtitle="招聘方学历与经验要求">
            <Text style={styles.groupTitle}>学历需求</Text>
            {data.byEducation.slice(0, 4).map((item) => (
              <BarRow
                key={item.label}
                styles={styles}
                label={item.label}
                value={item.count}
                max={educationMax}
                color={colors.lavender}
              />
            ))}
            <Text style={styles.groupTitle}>经验要求</Text>
            {data.byExperience.slice(0, 4).map((item) => (
              <BarRow
                key={item.label}
                styles={styles}
                label={item.label}
                value={item.count}
                max={experienceMax}
                color={colors.coral}
              />
            ))}
          </Card>

          <Card title="我的学习机会" subtitle="登录后把市场缺口变成学习路线">
            {loggedIn ? (
              gaps.length ? (
                <View style={styles.gapList}>
                  {gaps.slice(0, 6).map((gap) => (
                    <View key={gap.skill} style={styles.gapRow}>
                      <View style={styles.skillMain}>
                        <Text style={styles.skillName} numberOfLines={1}>
                          {gap.skill}
                        </Text>
                        <Text style={styles.skillMeta}>
                          {gap.topicTitle ?? "技能主题"} · 约 {gap.estimateHours ?? 8}h
                        </Text>
                      </View>
                      <PressableScale
                        haptic
                        disabled={enrolling || !gap.enrollable}
                        style={[styles.gapButton, (!gap.enrollable || enrolling) && styles.gapButtonDisabled]}
                        onPress={() => void enroll(gap)}
                      >
                        <Text style={styles.gapButtonText}>{enrolling ? "加入中" : "加入学习"}</Text>
                      </PressableScale>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedText}>当前能力画像已覆盖主要热门技能</Text>
              )
            ) : (
              <View style={styles.loginBox}>
                <View style={styles.skillMain}>
                  <Text style={styles.loginText}>登录后查看你的能力缺口，并一键加入学习路线。</Text>
                </View>
                <PressableScale haptic style={styles.gapButton} onPress={() => setAuthOpen(true)}>
                  <Text style={styles.gapButtonText}>去登录</Text>
                </PressableScale>
              </View>
            )}
          </Card>
        </View>
      )}

      <BottomSheet
        visible={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        title={selectedSkill?.skill ?? ""}
        height="58%"
      >
        {selectedSkill ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetStatRow}>
              <Text style={styles.sheetStatLabel}>市场热度</Text>
              <Text style={styles.sheetStatValue}>{selectedSkill.count} 岗位</Text>
            </View>
            <View style={styles.sheetStatRow}>
              <Text style={styles.sheetStatLabel}>平均薪资</Text>
              <Text style={styles.sheetStatValue}>{selectedSkill.avgSalary}K/月</Text>
            </View>
            <View style={styles.sheetStatRow}>
              <Text style={styles.sheetStatLabel}>我的掌握</Text>
              <Text style={styles.sheetStatValue}>{loggedIn ? levelLabel(selectedSkill.myLevel) : "登录后可见"}</Text>
            </View>
            {loggedIn ? (
              selectedGap ? (
                <PressableScale
                  haptic
                  style={[styles.gapButton, styles.sheetButton]}
                  disabled={enrolling || !selectedGap.enrollable}
                  onPress={() => void enroll(selectedGap)}
                >
                  <Text style={styles.gapButtonText}>{enrolling ? "加入中…" : "加入学习路线"}</Text>
                </PressableScale>
              ) : (
                <Text style={styles.sheetHint}>当前技能已经纳入你的学习画像</Text>
              )
            ) : (
              <PressableScale
                haptic
                style={[styles.gapButton, styles.sheetButton]}
                onPress={() => {
                  setSelectedSkill(null);
                  setAuthOpen(true);
                }}
              >
                <Text style={styles.gapButtonText}>登录后加入</Text>
              </PressableScale>
            )}
          </View>
        ) : null}
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
    trendStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 2,
    },
    trendText: { fontSize: 12, color: colors.textMuted },
    groupTitle: { fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowLabel: { flexShrink: 1, minWidth: 0, width: 76, fontSize: 12, fontWeight: "700", color: colors.textMuted, textAlign: "right" },
    rowTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    rowFill: { height: 10, borderRadius: 5 },
    rowValue: { width: 30, fontSize: 12, fontWeight: "800", color: colors.text, textAlign: "right" },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    skillRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    skillMain: { flex: 1, minWidth: 0 },
    skillName: { fontSize: 14, fontWeight: "800", color: colors.text },
    skillMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
    levelText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    gapList: { gap: 0 },
    gapRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
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
    loginText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
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
    sheetBody: { gap: 12 },
    sheetStatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetStatLabel: { fontSize: 13, color: colors.textMuted },
    sheetStatValue: { fontSize: 14, fontWeight: "800", color: colors.text },
    sheetButton: { alignSelf: "stretch", alignItems: "center" },
    sheetHint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  });
