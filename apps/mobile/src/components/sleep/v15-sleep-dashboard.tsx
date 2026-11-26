import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { typography } from "@/theme/tokens";
import { addDaysKey } from "@/lib/v15/dates";
import { bedtimeWindow, buildSleepInsights, formatSleepDuration, sleepAchievementPct, sleepDebtMinutes } from "@/lib/v15/sleep-model";
import { sleepApi, SLEEP_SOURCE_LABEL, type SleepHealthRead, type SleepHealthStatus, type SleepNight } from "@/lib/sleep-api";
import { bedtimeOffsetMin, bedtimeStdMin, regularityLabelOf, shiftSleepDate, sleepMonthDay, sleepWeekColumns } from "@/lib/sleep-view";
import { V15Bars, V15RingStack, V15StageRows } from "@/components/v15/v15-charts";
import { V15Button, V15Card, V15Header, V15IconButton, V15Note, V15Pill, V15ProgressBar, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";
import type { V15Palette } from "@/components/v15/v15-theme";

const HERO_INK = "#F4F1FF";
const HERO_SUB = "rgba(244,241,255,0.62)";
const HERO_LINE = "rgba(255,255,255,0.12)";
const GOAL_MIN = 450;
const STAGE_ORDER = ["deep", "light", "rem", "awake"] as const;

const SOURCE_SHORT: Record<string, string> = { health: "系统健康", manual: "手动记录" };

/**
 * 睡眠分析 · V15（对齐 demo renderSleep）。
 *
 * 只展示真实字段：时长 / 分期 / 效率 / 夜醒 / 规律性。设备不提供逐段时序时，
 * 用「整晚结构比例条」替代 hypnogram，不伪造时间轴。
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/wellness" as never);
}

export function V15SleepDashboard({
  nights,
  todayKey,
  loading,
  selectedDate,
  onSelectDate,
  onAdd,
  onEdit,
  onShare,
  healthStatus,
  healthCount,
  healthDiagnostics,
  healthMessage,
  reading,
  onAuthorize,
  onReRead,
  onOpenHealthSettings,
}: {
  nights: SleepNight[];
  todayKey: string;
  loading: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAdd: () => void;
  onEdit: (night: SleepNight) => void;
  onShare: () => void;
  healthStatus: SleepHealthStatus | null;
  healthCount: number;
  healthDiagnostics?: SleepHealthRead["diagnostics"] | null;
  healthMessage?: string | null;
  reading: boolean;
  onAuthorize: () => void;
  onReRead: () => void;
  onOpenHealthSettings: () => void;
}) {
  const p = useV15();
  const layout = useV15Layout();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [scoreDetailOpen, setScoreDetailOpen] = useState(false);

  const detailDate = selectedDate ?? nights[0]?.date ?? todayKey;
  const detailNight = nights.find((night) => night.date === detailDate) ?? null;
  const score = detailNight ? sleepApi.sleepScore(detailNight) : null;
  const rating = score !== null ? sleepApi.qualityLabel(score) : "—";
  const metrics = useMemo(() => sleepApi.sleepMetrics(detailNight), [detailNight]);
  const slices = useMemo(() => (detailNight ? sleepApi.sleepStageSlices(detailNight) : []), [detailNight]);
  const scoreBreakdown = useMemo(() => (detailNight ? sleepApi.sleepScoreBreakdown(detailNight) : null), [detailNight]);

  const weekColumns = useMemo(() => sleepWeekColumns(nights, todayKey, 7), [nights, todayKey]);
  const weekNights = useMemo(() => nights.filter((night) => night.date >= shiftSleepDate(todayKey, -6) && night.date <= todayKey), [nights, todayKey]);
  const weekStats = useMemo(() => sleepApi.sleepStats(weekNights, 7), [weekNights]);
  const weekAverageScore = useMemo(() => {
    const scored = weekNights.map((night) => sleepApi.sleepScore(night)).filter((value) => value > 0);
    if (scored.length < 2) return null;
    return Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length);
  }, [weekNights]);
  const scoreDelta = weekAverageScore !== null && score !== null ? score - weekAverageScore : null;

  const bedtimePoints = useMemo(
    () =>
      weekColumns
        .filter((column) => column.night !== null)
        .map((column) => ({ label: sleepMonthDay(column.key), offset: bedtimeOffsetMin(column.night) }))
        .filter((point): point is { label: string; offset: number } => point.offset !== null),
    [weekColumns]
  );
  const weekBedtimeStd = useMemo(() => bedtimeStdMin(bedtimePoints.map((point) => point.offset)), [bedtimePoints]);
  const wakeStd = useMemo(() => {
    const offsets = weekColumns.flatMap((column) => {
      const night = column.night;
      if (!night || !night.wakeTime) return [];
      const time = Date.parse(night.wakeTime);
      if (!Number.isFinite(time)) return [];
      const d = new Date(time);
      return [d.getHours() * 60 + d.getMinutes()];
    });
    return bedtimeStdMin(offsets);
  }, [weekColumns]);

  const metNights = weekNights.filter((night) => night.durationMin >= GOAL_MIN).length;
  const debt = sleepDebtMinutes(weekStats.avgDurationMin, GOAL_MIN, 7);
  const achievement = sleepAchievementPct(weekStats.avgDurationMin, GOAL_MIN);
  const insights = buildSleepInsights({
    avgDurationMin: weekStats.avgDurationMin,
    deepPct: weekStats.avgDeepPct,
    regularityStdMin: weekBedtimeStd,
    awakeAvg: weekStats.avgAwakeCount,
    metNights,
  });
  const window = bedtimeWindow(bedtimePoints.map((point) => point.offset));

  const stageRows = useMemo(() => {
    const colorOf = (key: string): string => {
      if (key === "deep") return p.lilac;
      if (key === "light") return p.blue;
      if (key === "rem") return "#9AA0FF";
      return p.amber;
    };
    return STAGE_ORDER.map((key) => {
      const slice = slices.find((item) => item.key === key);
      return {
        key,
        label: slice?.label ?? (key === "deep" ? "深睡" : key === "light" ? "浅睡" : key === "rem" ? "REM" : "清醒"),
        minutes: slice?.minutes ?? 0,
        pct: slice?.pct ?? 0,
        color: colorOf(key),
      };
    });
  }, [p.amber, p.blue, p.lilac, slices]);

  const quality = metrics.quality;
  const dataLabel = !detailNight ? "数据不足" : quality === "measured" ? "设备分期" : detailNight.source === "manual" ? "手动记录 · 估算" : "按时长估算";
  const durationMin = detailNight?.durationMin ?? 0;
  const hours = Math.floor(durationMin / 60);
  const minutes = Math.round(durationMin % 60);

  const avgLabel = weekStats.avgDurationMin !== null ? formatSleepDuration(weekStats.avgDurationMin) : "—";
  const debtLabel = debt !== null ? formatSleepDuration(debt) : "—";

  const stabilityLabel = regularityLabelOf(weekBedtimeStd);
  const sourceLabel = detailNight ? SLEEP_SOURCE_LABEL[detailNight.source] : "未记录";
  const ratioText = detailDate.slice(5, 7) + "/" + detailDate.slice(8, 10);
  const prevText = addDaysKey(detailDate, -1).slice(5, 7) + "/" + addDaysKey(detailDate, -1).slice(8, 10);

  return (
    <>
      <V15Header
        p={p}
        onBack={goBack}
        kicker="SLEEP ANALYSIS"
        title="睡眠分析"
        subtitle={sleepMonthDay(detailDate) + " · " + sourceLabel + (loading ? " · 读取中" : "")}
        actions={
          <>
            <V15IconButton p={p} icon="plus" label="添加睡眠记录" onPress={onAdd} weight="bold" size={17} />
            <V15IconButton p={p} icon="share" label="分享睡眠分析" onPress={onShare} />
          </>
        }
      />

      {detailNight ? (
        <View style={styles.heroWrap}>
          <View style={styles.hero}>
            <View pointerEvents="none" style={[styles.heroOrb, { borderColor: "rgba(255,255,255,0.10)" }]} />
            <View pointerEvents="none" style={[styles.heroOrbInner, { borderColor: "rgba(255,255,255,0.08)" }]} />
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>LAST NIGHT · {prevText} → {ratioText}</Text>
              <View style={[styles.heroPill, { borderColor: HERO_LINE }]}>
                <Icon name="moon" size={10} weight="fill" color="#C9CDFF" />
                <Text style={styles.heroPillText}>{detailNight.source === "health" ? "系统健康" : "手动记录"}</Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <V15RingStack
                size={layout.width < 360 ? 100 : layout.width < 400 ? 112 : 122}
                stroke={10}
                track="rgba(255,255,255,0.12)"
                rings={[{ pct: score ?? 0, color: p.lilac }]}
              >
                <Text style={styles.heroScore} numberOfLines={1} adjustsFontSizeToFit>{score ?? "—"}</Text>
                <Text style={styles.heroScoreLabel}>睡眠分</Text>
              </V15RingStack>

              <View style={styles.heroCopy}>
                <View style={styles.heroRatingRow}>
                  <Text style={styles.heroRating}>{rating}</Text>
                  {scoreDelta !== null && scoreDelta !== 0 ? (
                    <View style={[styles.deltaPill, { backgroundColor: "rgba(159,165,255,0.22)" }]}>
                      <Text style={styles.deltaText}>{scoreDelta > 0 ? "+" : ""}{scoreDelta}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.heroDurationRow}>
                  <Text style={styles.heroDuration} numberOfLines={1} adjustsFontSizeToFit>{hours}</Text>
                  <Text style={styles.heroDurationUnit}>h</Text>
                  <Text style={styles.heroDuration} numberOfLines={1}>{String(minutes).padStart(2, "0")}</Text>
                  <Text style={styles.heroDurationUnit}>m</Text>
                </View>
                <Text style={styles.heroLine}>深睡 <Text style={styles.heroStrong}>{formatSleepDuration(metrics.stages?.deep ?? null)}</Text> · REM <Text style={styles.heroStrong}>{formatSleepDuration(metrics.stages?.rem ?? null)}</Text></Text>
                <Text style={styles.heroLine} numberOfLines={1}>
                  {weekBedtimeStd !== null ? "入睡波动 ±" + Math.round(weekBedtimeStd) + " 分钟 · " + stabilityLabel : dataLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.heroStats, { borderTopColor: HERO_LINE }]}>
              <HeroStat label="入睡" value={detailNight.bedtime ? sleepApi.formatClockTime(detailNight.bedtime) : "—"} align="left" styles={styles} />
              <HeroStat label="起床" value={detailNight.wakeTime ? sleepApi.formatClockTime(detailNight.wakeTime) : "—"} styles={styles} />
              <HeroStat label="卧床" value={formatSleepDuration(detailNight.timeInBedMin)} align="right" styles={styles} />
            </View>

            <Pressable
              onPress={() => setScoreDetailOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="查看评分明细"
              style={styles.scoreToggle}
            >
              <Text style={styles.scoreToggleText}>{dataLabel} · {scoreDetailOpen ? "收起评分明细" : "查看评分明细"}</Text>
              <Icon name="chevron" size={12} weight="bold" color={HERO_SUB} />
            </Pressable>
          </View>
        </View>
      ) : (
        <V15Card p={p} style={{ marginTop: 16 }}>
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: p.lilacSoft }]}>
              <Icon name="moon" size={24} weight="duotone" color={p.lilac} />
            </View>
            <Text style={[styles.emptyTitle, { color: p.ink }]}>{sleepMonthDay(detailDate)} 还没有睡眠记录</Text>
            <Text style={[styles.emptyBody, { color: p.sub }]}>手动补录一晚，或授权读取系统健康数据；有记录后这里会显示评分、分期与 7 晚趋势。</Text>
            <V15Button p={p} label="记录睡眠" icon="plus" onPress={onAdd} style={{ marginTop: 12, alignSelf: "stretch" }} />
          </View>
        </V15Card>
      )}

      {scoreDetailOpen && scoreBreakdown ? (
        <V15Card p={p} style={{ marginTop: 10 }}>
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, { color: p.ink }]}>评分拆解</Text>
            <V15Pill p={p} tone="lilac" label={(scoreBreakdown.quality === "measured" ? "设备分期" : "按时长估算")} />
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            {scoreBreakdown.parts.map((part) => (
              <View key={part.key} style={styles.partRow}>
                <Text style={[styles.partLabel, { color: p.ink }]} numberOfLines={1}>{part.label}</Text>
                <View style={{ flex: 1 }}>
                  <V15ProgressBar p={p} pct={part.score} color={p.lilac} height={6} />
                </View>
                <Text style={[styles.partScore, { color: p.ink }]}>{part.score}</Text>
                <Text style={[styles.partWeight, { color: p.sub }]}>{part.weightPct}%</Text>
              </View>
            ))}
          </View>
        </V15Card>
      ) : null}

      {detailNight ? (
        <>
          <V15Section p={p} title="睡眠分期" right={(detailNight.bedtime ? sleepApi.formatClockTime(detailNight.bedtime) : "—") + " → " + (detailNight.wakeTime ? sleepApi.formatClockTime(detailNight.wakeTime) : "—")} />
          <V15Card p={p}>
            <View style={styles.stageHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.stageTitle, { color: p.ink }]}>整晚结构</Text>
                <Text style={[styles.stageSub, { color: p.sub }]} numberOfLines={2}>
                  {quality === "measured" ? "按设备分期汇总 · 不含逐段时序" : "设备未提供分期，按时长估算占比"}
                </Text>
              </View>
              <V15Pill p={p} tone="lilac" label={formatSleepDuration(durationMin)} />
            </View>
            <View style={{ marginTop: 13 }}>
              <V15StageRows p={p} slices={stageRows} />
            </View>
            <View style={[styles.stageLegend, { borderTopColor: p.line }]}>
              {stageRows.map((row) => (
                <View key={row.key} style={styles.legendCell}>
                  <View style={styles.legendHead}>
                    <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: row.color }} />
                    <Text style={[styles.legendLabel, { color: p.sub }]} numberOfLines={1}>{row.label}</Text>
                  </View>
                  <Text style={[styles.legendValue, { color: p.ink }]} numberOfLines={1}>{formatSleepDuration(row.minutes)}</Text>
                  <Text style={[styles.legendPct, { color: p.sub }]} numberOfLines={1}>{Math.round(row.pct)}%</Text>
                </View>
              ))}
            </View>
          </V15Card>
        </>
      ) : null}

      <V15Section p={p} title="关键指标" right="6 项" />
      <View style={styles.metricGrid}>
        <MetricTile p={p} styles={styles} icon="bed" tone={p.lilac} soft={p.lilacSoft} label="睡眠评分" value={score !== null ? String(score) : "—"} unit="分" />
        <MetricTile p={p} styles={styles} icon="pulse" tone={p.green} soft={p.greenSoft} label="睡眠效率" value={metrics.efficiencyPct !== null ? String(Math.round(metrics.efficiencyPct)) : "—"} unit="%" />
        <MetricTile p={p} styles={styles} icon="moon" tone={p.lilac} soft={p.lilacSoft} label="深睡占比" value={weekStats.avgDeepPct !== null ? String(Math.round(weekStats.avgDeepPct)) : "—"} unit="%" />
        <MetricTile p={p} styles={styles} icon="sparkle" tone={p.blue} soft={p.blueSoft} label="REM 占比" value={weekStats.avgRemPct !== null ? String(Math.round(weekStats.avgRemPct)) : "—"} unit="%" />
        <MetricTile p={p} styles={styles} icon="clock" tone={p.orange} soft={p.orangeSoft} label="夜醒" value={metrics.awakeCount !== null ? String(Math.round(metrics.awakeCount)) : "—"} unit="次" />
        <MetricTile p={p} styles={styles} icon="timer" tone={p.amber} soft={p.amberSoft} label="卧床" value={detailNight && detailNight.timeInBedMin > 0 ? (detailNight.timeInBedMin / 60).toFixed(1) : "—"} unit="h" />
      </View>

      <V15Section p={p} title="近 7 晚" right={weekNights.length + "/7 晚"} />
      <V15Card p={p}>
        <View style={styles.chartHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.chartTitle, { color: p.ink }]}>睡眠时长</Text>
            <Text style={[styles.chartSub, { color: p.sub }]} numberOfLines={1}>
              平均 {avgLabel} · 达标 {metNights}/7 晚
            </Text>
          </View>
          <V15Pill p={p} tone="lilac" label="目标 7.5h" />
        </View>
        <View style={{ marginTop: 14 }}>
          <V15Bars
            p={p}
            max={9}
            goal={7.5}
            goalColor={p.lilac}
            height={118}
            color={p.lilac}
            items={weekColumns.map((column) => ({
              key: column.key,
              label: column.label,
              value: column.minutes / 60,
              valueLabel: column.minutes > 0 ? (column.minutes / 60).toFixed(1) : "",
              active: column.highlight,
            }))}
          />
        </View>
        <View style={[styles.chartStats, { borderTopColor: p.line }]}>
          <ChartStat value={avgLabel} label="平均睡眠" p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat value={metNights + "/7"} label="达标夜晚" p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat value={weekBedtimeStd !== null ? "±" + Math.round(weekBedtimeStd) + "m" : "—"} label="入睡波动" p={p} styles={styles} />
        </View>
      </V15Card>

      <V15Section p={p} title="规律性" right={stabilityLabel} />
      <V15Card p={p}>
        <View style={styles.regularHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.chartTitle, { color: p.ink }]}>作息稳定度</Text>
            <Text style={[styles.chartSub, { color: p.sub }]} numberOfLines={2}>
              近 7 晚入睡时间分布 · 绿带为理想窗口
            </Text>
          </View>
          {window ? <V15Pill p={p} tone={stabilityLabel === "规律" ? "green" : "amber"} label={"建议 " + window.label} /> : null}
        </View>
        <BedtimeDots p={p} styles={styles} points={bedtimePoints} />
        <View style={[styles.regularStats, { borderTopColor: p.line }]}>
          <View style={styles.regularStat}>
            <Text style={[styles.regularStatLabel, { color: p.sub }]}>入睡波动</Text>
            <Text style={[styles.regularStatValue, { color: p.ink }]}>{weekBedtimeStd !== null ? "± " + Math.round(weekBedtimeStd) + " 分钟" : "记录不足"}</Text>
          </View>
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <View style={styles.regularStat}>
            <Text style={[styles.regularStatLabel, { color: p.sub }]}>起床波动</Text>
            <Text style={[styles.regularStatValue, { color: p.ink }]}>{wakeStd !== null ? "± " + Math.round(wakeStd) + " 分钟" : "记录不足"}</Text>
          </View>
        </View>
      </V15Card>

      <V15Card p={p} style={{ marginTop: 10 }}>
        <View style={styles.debtRow}>
          <View style={[styles.debtIcon, { backgroundColor: p.lilacSoft }]}>
            <Icon name="moon" size={18} weight="duotone" color={p.lilac} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.debtTitle, { color: p.ink }]}>本周睡眠债</Text>
            <Text style={[styles.debtSub, { color: p.sub }]} numberOfLines={2}>
              目标 7h 30m · 实际 {avgLabel}{window ? " · 今晚建议 " + window.label.split(" – ")[0] + " 前入睡" : ""}
            </Text>
            <View style={{ marginTop: 7 }}>
              <V15ProgressBar p={p} pct={achievement} color={achievement >= 100 ? p.green : p.lilac} height={6} />
            </View>
          </View>
          <View style={styles.debtValueWrap}>
            <Text style={[styles.debtValue, { color: debt !== null && debt > 0 ? p.orange : p.green }]} numberOfLines={1}>{debt !== null && debt > 0 ? "−" + debtLabel : "0"}</Text>
            <Text style={[styles.debtLabel, { color: p.sub }]}>{debt !== null && debt > 0 ? "待补" : "达标"}</Text>
          </View>
        </View>
      </V15Card>

      {insights.length > 0 ? (
        <>
          <V15Section p={p} title="值得留意" right={insights.length + " 条"} />
          <V15Card p={p} padded={false}>
            {insights.map((insight, index) => {
              const tone = insight.tone === "green" ? p.green : insight.tone === "amber" ? p.amber : insight.tone === "orange" ? p.orange : insight.tone === "red" ? p.red : insight.tone === "blue" ? p.blue : p.lilac;
              const soft = insight.tone === "green" ? p.greenSoft : insight.tone === "amber" ? p.amberSoft : insight.tone === "orange" ? p.orangeSoft : insight.tone === "red" ? p.redSoft : insight.tone === "blue" ? p.blueSoft : p.lilacSoft;
              return (
                <View key={insight.key} style={[styles.insightRow, index > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}>
                  <View style={[styles.insightIcon, { backgroundColor: soft }]}>
                    <Icon name={insight.tone === "red" ? "pulse" : insight.tone === "amber" ? "clock" : "sparkle"} size={15} weight="fill" color={tone} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.insightTitle, { color: p.ink }]}>{insight.title}</Text>
                    <Text style={[styles.insightBody, { color: p.sub }]}>{insight.body}</Text>
                  </View>
                </View>
              );
            })}
          </V15Card>
        </>
      ) : null}

      <V15Section p={p} title="最近记录" right={nights.length > 0 ? nights.length + " 晚" : "暂无"} onRight={onAdd} />
      {nights.length === 0 ? (
        <V15Note p={p}>还没有睡眠记录。手动补录一晚，或在下方授权系统健康数据。</V15Note>
      ) : (
        <V15Card p={p} padded={false}>
          {nights.slice(0, 5).map((night, index) => {
            const nightScore = sleepApi.sleepScore(night);
            const active = night.date === detailDate;
            return (
              <Pressable
                key={night.date}
                onPress={() => {
                  setScoreDetailOpen(false);
                  onSelectDate(night.date);
                }}
                accessibilityRole="button"
                accessibilityLabel={"查看 " + sleepMonthDay(night.date) + " 的睡眠"}
                style={({ pressed }) => [
                  styles.recordRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: p.line },
                  active && { backgroundColor: p.lilacSoft },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <View style={[styles.recordIcon, { backgroundColor: active ? p.card : p.card2 }]}>
                  <Icon name={night.source === "health" ? "moon" : "clock"} size={15} weight="duotone" color={night.source === "health" ? p.lilac : p.orange} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.recordTitle, { color: p.ink }]} numberOfLines={1}>
                    {sleepMonthDay(night.date)} · {night.bedtime ? sleepApi.formatClockTime(night.bedtime) : "—"} → {night.wakeTime ? sleepApi.formatClockTime(night.wakeTime) : "—"}
                  </Text>
                  <Text style={[styles.recordSub, { color: p.sub }]} numberOfLines={1}>
                    {formatSleepDuration(night.durationMin)} · {sleepApi.qualityLabel(nightScore)} · {SOURCE_SHORT[night.source] ?? night.source}
                  </Text>
                </View>
                <Text style={[styles.recordScore, { color: p.ink }]}>
                  {nightScore}
                  <Text style={{ color: p.sub }}> 分</Text>
                </Text>
                <Pressable
                  onPress={() => onEdit(night)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={"编辑 " + sleepMonthDay(night.date) + " 的睡眠记录"}
                  style={styles.recordEdit}
                >
                  <Icon name="clock" size={14} weight="regular" color={p.faint} />
                </Pressable>
              </Pressable>
            );
          })}
        </V15Card>
      )}

      <V15Section p={p} title="数据源" right={healthStatus ? (SLEEP_SOURCE_LABEL.health) : "未读取"} />
      <V15Card p={p}>
        <View style={styles.sourceHead}>
          <View style={[styles.statusDot, { backgroundColor: healthStatus === "ok" ? p.green : p.amber }]} />
          <Text style={[styles.sourceTitle, { color: p.ink }]}>Health Connect</Text>
          <View style={{ flex: 1 }} />
          {reading ? <ActivityIndicator size="small" color={p.lilac} /> : (
            <Text style={[styles.sourceStatus, { color: healthStatus === "ok" ? p.green : p.amber }]}>
              {healthStatus === "ok" ? "已连接" : healthStatus === null ? "未读取" : healthStatus === "denied" ? "未授权" : "不可用"}
            </Text>
          )}
        </View>
        <Text style={[styles.sourceHint, { color: p.sub }]} numberOfLines={3}>
          {reading ? "正在读取系统健康数据…" : sleepApi.statusHint(healthStatus)}
          {healthStatus === "ok" ? " · 已读到 " + healthCount + " 晚（同日以系统数据为准）" : ""}
        </Text>
        {healthDiagnostics ? (
          <Text style={[styles.sourceHint, { color: p.sub }]} numberOfLines={2}>
            原始会话 {healthDiagnostics.recordCount} 条 · 含分期 {healthDiagnostics.stageRecordCount} 条
            {healthDiagnostics.stageRecordCount === 0 ? " · 小米只同步总时长，深睡/REM 按估算显示" : ""}
          </Text>
        ) : null}
        {healthMessage ? <Text style={[styles.sourceHint, { color: p.orange }]}>{healthMessage}</Text> : null}
        <View style={styles.sourceActions}>
          <PressableScale haptic scaleTo={0.97} onPress={onAuthorize} accessibilityRole="button" accessibilityLabel="去系统授权健康数据" style={[styles.sourceButton, { backgroundColor: p.lilacSoft }]}>
            <Icon name="target" size={15} weight="regular" color={p.lilac} />
            <Text style={[styles.sourceButtonText, { color: p.lilac }]}>去授权</Text>
          </PressableScale>
          <PressableScale haptic scaleTo={0.97} disabled={reading} onPress={onReRead} accessibilityRole="button" accessibilityLabel="重新读取系统健康数据" style={[styles.sourceButton, { backgroundColor: p.card2 }]}>
            <Icon name="sparkle" size={15} weight="regular" color={p.sub} />
            <Text style={[styles.sourceButtonText, { color: p.sub }]}>重新读取</Text>
          </PressableScale>
          <PressableScale haptic scaleTo={0.97} onPress={onOpenHealthSettings} accessibilityRole="button" accessibilityLabel="打开系统健康设置" style={[styles.sourceButton, { backgroundColor: p.card2 }]}>
            <Icon name="clock" size={15} weight="regular" color={p.sub} />
            <Text style={[styles.sourceButtonText, { color: p.sub }]}>系统设置</Text>
          </PressableScale>
        </View>
      </V15Card>

      <V15Note p={p}>睡眠分期为设备记录；未穿戴设备的夜晚按时长估算，不生成逐段时序。</V15Note>
      <Text style={[styles.quote, { color: p.faint }]}>睡得好，不是为了更努力，而是为了更清醒地生活。</Text>
    </>
  );
}

function HeroStat({ label, value, align = "center", styles }: { label: string; value: string; align?: "left" | "center" | "right"; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={{ flex: 1, alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" }}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function MetricTile({ p, styles, icon, tone, soft, label, value, unit }: { p: V15Palette; styles: ReturnType<typeof makeStyles>; icon: "bed" | "pulse" | "moon" | "sparkle" | "clock" | "timer"; tone: string; soft: string; label: string; value: string; unit: string }) {
  return (
    <View style={[styles.metricTile, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={[styles.metricIcon, { backgroundColor: soft }]}>
        <Icon name={icon} size={13} weight="fill" color={tone} />
      </View>
      <Text style={[styles.metricValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        <Text style={[styles.metricUnit, { color: p.sub }]}> {unit}</Text>
      </Text>
      <Text style={[styles.metricLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ChartStat({ value, label, p, styles }: { value: string; label: string; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.chartStat}>
      <Text style={[styles.chartStatValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.chartStatLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function BedtimeDots({ p, styles, points }: { p: V15Palette; styles: ReturnType<typeof makeStyles>; points: { label: string; offset: number }[] }) {
  if (points.length < 2) {
    return <Text style={[styles.chartSub, { color: p.sub, marginTop: 12 }]}>至少要有 2 晚的入睡时刻才能算规律性。</Text>;
  }
  const min = Math.min(-90, ...points.map((point) => point.offset)) - 15;
  const max = Math.max(-15, ...points.map((point) => point.offset)) + 15;
  const height = 96;
  const pos = (offset: number) => ((max - offset) / Math.max(1, max - min)) * height;
  const bandTop = pos(-30);
  const bandBottom = pos(-60);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ height, borderRadius: 12, backgroundColor: p.card2, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: bandTop, height: Math.max(2, bandBottom - bandTop), backgroundColor: p.greenSoft }} />
        <View style={{ flexDirection: "row", flex: 1, paddingHorizontal: 8 }}>
          {points.map((point) => (
            <View key={point.label} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ position: "absolute", top: Math.max(3, Math.min(height - 11, pos(point.offset) - 5)), width: 9, height: 9, borderRadius: 5, backgroundColor: p.lilac, borderWidth: 2, borderColor: p.card }} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bedAxis}>
        <Text style={[styles.bedAxisText, { color: p.faint }]}>23:00</Text>
        <Text style={[styles.bedAxisText, { color: p.faint }]}>00:00</Text>
        <Text style={[styles.bedAxisText, { color: p.faint }]}>01:00</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: V15Palette) =>
  StyleSheet.create({
    heroWrap: { marginTop: 14, borderRadius: 24, shadowColor: "#161632", shadowOpacity: p.dark ? 0 : 0.26, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: p.dark ? 0 : 5 },
    hero: { borderRadius: 24, overflow: "hidden", padding: 15, backgroundColor: "#1E1E3C", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
    heroOrb: { position: "absolute", right: -66, bottom: -96, width: 226, height: 226, borderRadius: 113, borderWidth: 1 },
    heroOrbInner: { position: "absolute", right: -32, bottom: -62, width: 158, height: 158, borderRadius: 79, borderWidth: 1 },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    heroKicker: { ...typography.micro, fontWeight: "800", letterSpacing: 1.2, color: HERO_SUB, flexShrink: 1 },
    heroPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    heroPillText: { ...typography.micro, fontWeight: "700", color: "#C9CDFF" },
    heroBody: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    heroCopy: { flex: 1, minWidth: 0 },
    heroRatingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroRating: { ...typography.callout, fontWeight: "800", color: "#C9CDFF" },
    deltaPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
    deltaText: { ...typography.micro, fontWeight: "800", color: "#C9CDFF" },
    heroDurationRow: { flexDirection: "row", alignItems: "baseline", gap: 1, marginTop: 3 },
    heroDuration: { ...typography.numXl, fontWeight: "900", color: HERO_INK, fontVariant: ["tabular-nums"] },
    heroDurationUnit: { ...typography.caption, fontWeight: "700", color: HERO_SUB, marginRight: 2 },
    heroLine: { ...typography.meta, color: HERO_SUB, marginTop: 3 },
    heroStrong: { color: HERO_INK, fontWeight: "700" },
    heroScore: { ...typography.numXl, fontWeight: "900", color: HERO_INK, fontVariant: ["tabular-nums"] },
    heroScoreLabel: { ...typography.micro, fontWeight: "600", color: HERO_SUB },
    heroStats: { flexDirection: "row", marginTop: 13, paddingTop: 11, borderTopWidth: 1 },
    heroStatLabel: { ...typography.micro, fontWeight: "500", color: HERO_SUB },
    heroStatValue: { ...typography.headline, fontWeight: "800", color: HERO_INK, marginTop: 1, fontVariant: ["tabular-nums"] },
    scoreToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: HERO_LINE },
    scoreToggleText: { ...typography.micro, fontWeight: "600", color: HERO_SUB },
    empty: { alignItems: "center", paddingVertical: 8 },
    emptyIcon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    emptyTitle: { ...typography.headline, fontWeight: "800", marginTop: 9, textAlign: "center" },
    emptyBody: { ...typography.meta, textAlign: "center", marginTop: 4, lineHeight: 19, maxWidth: 280 },
    detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    detailTitle: { ...typography.headline, fontWeight: "800" },
    partRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    partLabel: { ...typography.caption, width: 44 },
    partScore: { ...typography.caption, fontWeight: "800", width: 26, textAlign: "right", fontVariant: ["tabular-nums"] },
    partWeight: { ...typography.micro, width: 34, textAlign: "right", fontVariant: ["tabular-nums"] },
    stageHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    stageTitle: { ...typography.headline, fontWeight: "800" },
    stageSub: { ...typography.meta, marginTop: 2 },
    stageLegend: { flexDirection: "row", marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    legendCell: { flex: 1, minWidth: 0, gap: 1 },
    legendHead: { flexDirection: "row", alignItems: "center", gap: 3 },
    legendLabel: { ...typography.micro, fontWeight: "600" },
    legendValue: { ...typography.caption, fontWeight: "800", fontVariant: ["tabular-nums"] },
    legendPct: { ...typography.micro, fontWeight: "500" },
    metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    metricTile: { width: "31.8%", flexGrow: 1, borderRadius: 17, borderWidth: 1, padding: 10, gap: 2 },
    metricIcon: { width: 25, height: 25, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    metricValue: { ...typography.num, fontWeight: "800", fontVariant: ["tabular-nums"] },
    metricUnit: { ...typography.micro, fontWeight: "600" },
    metricLabel: { ...typography.micro, fontWeight: "500" },
    chartHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    chartTitle: { ...typography.headline, fontWeight: "800" },
    chartSub: { ...typography.meta, marginTop: 2 },
    chartStats: { flexDirection: "row", alignItems: "center", paddingTop: 11, marginTop: 12, borderTopWidth: 1 },
    chartStat: { flex: 1, alignItems: "center", gap: 1 },
    chartStatValue: { ...typography.headline, fontWeight: "800", fontVariant: ["tabular-nums"] },
    chartStatLabel: { ...typography.micro, fontWeight: "500" },
    chartDivider: { width: 1, height: 26 },
    regularHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    regularStats: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    regularStat: { flex: 1, alignItems: "center", gap: 2 },
    regularStatLabel: { ...typography.micro, fontWeight: "500" },
    regularStatValue: { ...typography.caption, fontWeight: "800" },
    bedAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
    bedAxisText: { ...typography.micro, fontWeight: "500" },
    debtRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    debtIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    debtTitle: { ...typography.callout, fontWeight: "800" },
    debtSub: { ...typography.meta, marginTop: 2, lineHeight: 18 },
    debtValueWrap: { alignItems: "flex-end" },
    debtValue: { ...typography.headline, fontWeight: "900", fontVariant: ["tabular-nums"] },
    debtLabel: { ...typography.micro, fontWeight: "500" },
    insightRow: { flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
    insightIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    insightTitle: { ...typography.callout, fontWeight: "700" },
    insightBody: { ...typography.meta, marginTop: 2, lineHeight: 18 },
    recordRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 9 },
    recordIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    recordTitle: { ...typography.caption, fontWeight: "700" },
    recordSub: { ...typography.micro, fontWeight: "500", marginTop: 1 },
    recordScore: { ...typography.headline, fontWeight: "800", fontVariant: ["tabular-nums"] },
    recordEdit: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
    sourceHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    sourceTitle: { ...typography.callout, fontWeight: "800" },
    sourceStatus: { ...typography.micro, fontWeight: "700" },
    sourceHint: { ...typography.meta, marginTop: 6, lineHeight: 18 },
    sourceActions: { flexDirection: "row", gap: 6, marginTop: 10 },
    sourceButton: { flex: 1, minHeight: 40, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
    sourceButtonText: { ...typography.micro, fontWeight: "700" },
    quote: { ...typography.meta, textAlign: "center", marginTop: 20, marginBottom: 8 },
  });
