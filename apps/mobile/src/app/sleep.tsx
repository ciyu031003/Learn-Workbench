import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ListGroup, ListRow } from "@/components/list-row";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { SkeletonCard } from "@/components/skeleton";
import { SegmentRing, type SegmentRingItem } from "@/components/v2/charts/segment-ring";
import { StatTileRow, type StatTileProps } from "@/components/v2/charts/stat-tile";
import { StepsBar } from "@/components/v2/charts/steps-bar";
import { AreaChart } from "@/components/v2/charts/area-chart";
import { BottomSheet } from "@/components/bottom-sheet";
import { Field } from "@/components/field";
import { SheetSection, SheetStickyCta } from "@/components/sheet";
import { haptics } from "@/lib/haptics";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import {
  mergeHealthNights,
  normalizeSleepNights,
  sleepApi,
  SLEEP_SOURCE_LABEL,
  SLEEP_STATUS_LABEL,
  XIAOMI_SYNC_HINT,
  type SleepHealthStatus,
  type SleepNight,
  type SleepStageSlice,
} from "@/lib/sleep-api";
import {
  bedtimeOffsetMin,
  bedtimeStdMin,
  isSleepDateKey,
  parseSleepDurationInput,
  regularityLabelOf,
  shiftSleepDate,
  sleepClockToIso,
  sleepHeatWeeks,
  sleepKeyRange,
  sleepMonthDay,
  sleepWeekColumns,
  sortSleepNights,
  stageReferenceText,
  type SleepStatsLike,
} from "@/lib/sleep-view";
import { clamp01, formatMonthDayRange, heatAlpha, withAlpha } from "@/lib/chart-math";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { todayISO } from "@learn-workbench/shared/dates";

/**
 * 睡眠详情（v2.3）
 *
 * 参考「小米运动健康 → 睡眠」的分区（评分环 / 指标格 / 分期时间轴 / 分期占比 / 规律性 /
 * 7 天趋势 / 手动补录 / 健康数据源状态），用 v2 设计语言重做：
 *
 * ① 顶栏（返回 + 睡眠 + 「+」补录）→ 页头 → 日 / 周 / 月 三段切换
 * ② 日：评分环（SegmentRing）+ 六格指标（StatTileRow）+ 分期时间轴 + 分期占比（含参考区间与徽标）
 * ③ 周：7 晚时长柱（StepsBar）+ 平均指标 + 就寝规律性（AreaChart）
 * ④ 月：30 天时长热力 + 平均指标 + 记录天数
 * ⑤ 数据源卡（Health Connect 状态 + 去授权 / 重新读取 + 小米运动健康同步路径）
 * ⑥ 最近记录（点击进入该晚详情）
 *
 * 数据：lib/sleep-api.ts（按契约转发 lib/sleep.ts；数据层未落地时兜底旧版单条存档）。
 * 动效：**0 新增**（不写任何补间 / 循环动画 / 动画样式 API；只复用卡片自身的按压反馈）。
 */
type RangeKey = "day" | "week" | "month";

const RANGE_OPTIONS: { key: RangeKey; label: string; icon: "sunny-outline" | "calendar-outline" | "grid-outline" }[] = [
  { key: "day", label: "日", icon: "sunny-outline" },
  { key: "week", label: "周", icon: "calendar-outline" },
  { key: "month", label: "月", icon: "grid-outline" },
];

/** 柱状图满格口径：8 小时（不是"目标"，只是坐标上限） */
const BAR_FULL_MIN = 8 * 60;
/** 分期色（语义 token，深色自动跟随） */
const TONE_TOKENS: Record<string, keyof ThemeColors> = {
  lavender: "lavender",
  primary: "primary",
  teal: "teal",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  deep: "lavender",
  light: "primary",
  rem: "teal",
  awake: "accent",
};

function toneColor(colors: ThemeColors, tone: string, index: number): string {
  const key = TONE_TOKENS[tone];
  if (key) return colors[key] as string;
  return colors.chart[index % colors.chart.length] ?? colors.primary;
}

/** 日期标题：11 月 6 日 · 周五 */
function dayLabel(key: string): string {
  if (!isSleepDateKey(key)) return key;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Number(key.slice(5, 7)) + " 月 " + Number(key.slice(8, 10)) + " 日 · 周" + weekdays[date.getDay()];
}

/** 指标格一行三个（StatTileRow 会把卡片铺在画布上，避免卡中卡） */
function tileRows(items: StatTileProps[]): StatTileProps[][] {
  const rows: StatTileProps[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return rows;
}

function percentText(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits) + "%";
}

export default function SleepScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const todayKey = useMemo(() => todayISO(), []);

  const [localNights, setLocalNights] = useState<SleepNight[]>([]);
  const [healthNights, setHealthNights] = useState<SleepNight[]>([]);
  const [healthStatus, setHealthStatus] = useState<SleepHealthStatus | null>(null);
  const [healthCount, setHealthCount] = useState(0);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("day");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /** 补录弹层 */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayKey, duration: "", bedtime: "", wakeTime: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** 本机记录 + 系统健康记录合并（同日以 health 为准；手动订正会先从 health 列表里移除该日） */
  const nights = useMemo(() => mergeHealthNights(localNights, healthNights), [localNights, healthNights]);

  const loadLocal = useCallback(async () => {
    const local = await sleepApi.loadSleepNights();
    setLocalNights(normalizeSleepNights(local));
  }, []);

  const readHealth = useCallback(
    async (options: { requestPermission?: boolean } = {}) => {
      setReading(true);
      setHealthMessage(null);
      const result = await sleepApi.readSleepNightsFromHealth({
        days: 31,
        requestPermission: options.requestPermission === true,
      });
      setHealthStatus(result.status);
      setHealthCount(result.nights.length);
      setHealthNights(result.nights);
      setReading(false);
      return result;
    },
    []
  );

  const refresh = useCallback(async () => {
    await loadLocal();
    await readHealth();
  }, [loadLocal, readHealth]);

  /** 进入页面：本机记录先出（快），健康数据随后并行补上（慢；失败只影响状态卡） */
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        // 本机记录很快，先让它上屏；健康数据同时开跑（并行，最多等它 6s 超时）
        const healthTask = readHealth();
        await loadLocal();
        if (active) setLoading(false);
        await healthTask;
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadLocal, readHealth]);

  /** 从补录弹层 / 系统设置返回时刷新本机记录（不再重复读健康数据，避免每次都等 6s） */
  useFocusRefresh(loadLocal);

  const { control } = usePullRefresh(refresh, { stickyHeader: true });

  const detailDate = selectedDate ?? nights[0]?.date ?? todayKey;
  const detailNight = nights.find((night) => night.date === detailDate) ?? null;
  const detailIndex = nights.findIndex((night) => night.date === detailDate);
  const newerNight = detailIndex > 0 ? nights[detailIndex - 1] : null;
  const olderNight = detailIndex >= 0 && detailIndex < nights.length - 1 ? nights[detailIndex + 1] : null;

  /* ---------------------------- 日视图数据 ---------------------------- */
  const score = detailNight ? sleepApi.sleepScore(detailNight) : null;
  const rating = sleepApi.qualityLabel(score);
  const slices = useMemo(() => (detailNight ? sleepApi.sleepStageSlices(detailNight) : []), [detailNight]);
  /** 深睡占比与数据层同口径：直接取切片（pct 以卧床时长为分母） */
  const deepPct = useMemo(() => slices.find((slice) => slice.key === "deep")?.pct ?? null, [slices]);

  const ringSegments = useMemo<SegmentRingItem[]>(() => {
    if (!detailNight) return [];
    if (slices.length > 0) {
      return slices.map((slice, index) => ({
        key: slice.key,
        label: slice.label,
        value: slice.minutes,
        color: toneColor(colors, slice.tone, index),
        valueLabel: slice.pct + "%",
      }));
    }
    const fallbackScore = sleepApi.sleepScore(detailNight);
    return [
      {
        key: "score",
        label: "评分",
        value: fallbackScore,
        color: colors.primary,
        valueLabel: fallbackScore + " 分",
      },
      {
        key: "rest",
        label: "待提升",
        value: Math.max(0, 100 - fallbackScore),
        color: colors.surfaceMuted,
        valueLabel: "",
      },
    ];
  }, [colors, detailNight, slices]);

  const dayTiles = useMemo<StatTileProps[]>(() => {
    if (!detailNight) return [];
    return [
      {
        label: "总时长",
        value: sleepApi.formatSleepMinutesShort(detailNight.durationMin),
        icon: "time-outline",
        tone: "primary",
        hint: "7–9 小时",
      },
      {
        label: "入睡时间",
        value: sleepApi.formatClockTime(detailNight.bedtime),
        icon: "moon-outline",
        tone: "text",
        hint: "前一晚",
      },
      {
        label: "起床时间",
        value: sleepApi.formatClockTime(detailNight.wakeTime),
        icon: "sunny-outline",
        tone: "text",
        hint: "今早",
      },
      {
        label: "深睡占比",
        value: deepPct === null ? "—" : percentText(deepPct, 1),
        icon: "layers-outline",
        tone: "accent",
        hint: "参考 15–60%",
      },
      {
        label: "清醒次数",
        value:
          detailNight.awakeCount === null || !Number.isFinite(detailNight.awakeCount)
            ? "—"
            : String(Math.round(detailNight.awakeCount)),
        unit: detailNight.awakeCount === null ? undefined : "次",
        icon: "eye-outline",
        tone: "warning",
        hint: "≤2 次",
      },
      {
        label: "睡眠效率",
        value: percentText(detailNight.efficiencyPct, 0),
        icon: "pulse-outline",
        tone: "success",
        hint: "≥85%",
      },
    ];
  }, [deepPct, detailNight]);

  /* ---------------------------- 周 / 月数据 ---------------------------- */
  const weekStart = shiftSleepDate(todayKey, -6);
  const weekNights = useMemo(
    () => nights.filter((night) => night.date >= weekStart && night.date <= todayKey),
    [nights, todayKey, weekStart]
  );
  const weekColumns = useMemo(() => sleepWeekColumns(nights, todayKey, 7), [nights, todayKey]);
  const weekStats = useMemo(() => sleepApi.sleepStats(weekNights, 7), [weekNights]);

  const monthHeat = useMemo(() => sleepHeatWeeks(nights, todayKey, { days: 30, steps: 4 }), [nights, todayKey]);
  const monthNights = useMemo(() => {
    const start = shiftSleepDate(todayKey, -29);
    return nights.filter((night) => night.date >= start && night.date <= todayKey);
  }, [nights, todayKey]);
  const monthStats = useMemo(() => sleepApi.sleepStats(monthNights, 30), [monthNights]);

  /** 就寝规律性：只取有入睡时刻的晚数（手动只填时长时算不了） */
  const bedtimePoints = useMemo(() => {
    return weekColumns
      .filter((column) => column.night !== null)
      .map((column) => ({
        label: sleepMonthDay(column.key),
        offset: bedtimeOffsetMin(column.night),
      }))
      .filter((point): point is { label: string; offset: number } => point.offset !== null);
  }, [weekColumns]);

  const weekBedtimeStd = useMemo(
    () => bedtimeStdMin(bedtimePoints.map((point) => point.offset)),
    [bedtimePoints]
  );

  /* ---------------------------- 操作 ---------------------------- */
  const openCreate = useCallback(() => {
    haptics.light();
    setEditingDate(null);
    setForm({ date: todayKey, duration: "", bedtime: "", wakeTime: "" });
    setFormError(null);
    setSheetOpen(true);
  }, [todayKey]);

  const openEdit = useCallback((night: SleepNight) => {
    haptics.light();
    setEditingDate(night.date);
    const bedtimeText = night.bedtime ? sleepApi.formatClockTime(night.bedtime) : "";
    const wakeText = night.wakeTime ? sleepApi.formatClockTime(night.wakeTime) : "";
    setForm({
      date: night.date,
      duration: sleepApi.formatSleepMinutes(night.durationMin),
      bedtime: bedtimeText === "—" ? "" : bedtimeText,
      wakeTime: wakeText === "—" ? "" : wakeText,
    });
    setFormError(null);
    setSheetOpen(true);
  }, []);

  const save = useCallback(async () => {
    const durationMin = parseSleepDurationInput(form.duration);
    if (durationMin === null) {
      haptics.soft();
      setFormError("填 7.5 / 7h30m / 450 分钟这样的时长（0–24 小时）");
      return;
    }
    const bedtimeText = form.bedtime.trim();
    const wakeText = form.wakeTime.trim();
    const bedtime = bedtimeText ? sleepClockToIso(form.date, bedtimeText, "bedtime") : null;
    if (bedtimeText && !bedtime) {
      haptics.soft();
      setFormError("入睡时间写成 23:30 这样");
      return;
    }
    const wakeTime = wakeText ? sleepClockToIso(form.date, wakeText, "wakeTime") : null;
    if (wakeText && !wakeTime) {
      haptics.soft();
      setFormError("起床时间写成 07:10 这样");
      return;
    }
    setSaving(true);
    setFormError(null);
    const saved = await sleepApi.upsertManualSleepNight({
      date: form.date,
      durationMin,
      bedtime: bedtime ?? undefined,
      wakeTime: wakeTime ?? undefined,
    });
    setSaving(false);
    if (!saved) {
      haptics.soft();
      setFormError("保存到本机失败，再试一次");
      return;
    }
    haptics.success();
    // 改日期 = 把记录挪到另一天：新记录写成功后再删旧日期，写失败也不会丢原记录
    if (editingDate && editingDate !== form.date) {
      await sleepApi.deleteSleepNight(editingDate);
      setLocalNights((prev) => prev.filter((night) => night.date !== editingDate));
    }
    // 手动订正优先：同一天先从健康数据里撤下，否则合并时会被系统数据盖回去
    setHealthNights((prev) => prev.filter((night) => night.date !== saved.date));
    setLocalNights((prev) => sortSleepNights([saved, ...prev.filter((night) => night.date !== saved.date)]));
    setSelectedDate(saved.date);
    setRange("day");
    setSheetOpen(false);
    void loadLocal();
  }, [editingDate, form, loadLocal]);

  const removeNight = useCallback(async (night: SleepNight) => {
    await sleepApi.deleteSleepNight(night.date);
    setLocalNights((prev) => prev.filter((item) => item.date !== night.date));
    setHealthNights((prev) => prev.filter((item) => item.date !== night.date));
    setSelectedDate(null);
    void loadLocal();
  }, [loadLocal]);

  const confirmRemove = useCallback(
    (night: SleepNight) => {
      Alert.alert(
        "删除这一晚？",
        "本机记录会被删除；若系统健康数据里仍有这一晚，点「重新读取」会再次出现。",
        [
          { text: "取消", style: "cancel" },
          {
            text: "删除",
            style: "destructive",
            onPress: () => {
              haptics.soft();
              void removeNight(night);
            },
          },
        ]
      );
    },
    [removeNight]
  );

  /**
   * 去授权：先请求系统权限（Android 会弹系统授权框），仍被拒再打开 Health Connect 设置页。
   * 数据层不提供 requestPermission 时（旧包）退化为直接打开设置页。
   */
  const authorize = useCallback(async () => {
    haptics.light();
    const result = await readHealth({ requestPermission: true });
    if (result.status !== "denied" && result.nights.length > 0) {
      setSelectedDate(result.nights[0].date);
      return;
    }
    const opened = await sleepApi.openSleepSettings();
    setHealthMessage(
      opened
        ? "系统里还没放开睡眠读取权限，请在健康数据里打开「睡眠」"
        : "没找到系统健康数据设置，请在系统「健康数据 / Health Connect」里授权"
    );
  }, [readHealth]);

  const refreshHealth = useCallback(async () => {
    haptics.light();
    const result = await readHealth();
    if (result.nights.length > 0) setSelectedDate(result.nights[0].date);
  }, [readHealth]);

  /* ---------------------------- 渲染 ---------------------------- */
  const statusColor = (() => {
    switch (healthStatus) {
      case "ok":
        return colors.success;
      case "denied":
      case "no-data":
        return colors.warning;
      case "error":
        return colors.danger;
      default:
        return colors.textMuted;
    }
  })();

  const dayActions = detailNight ? (
    <View style={styles.actionRow}>
      <PressableScale
        haptic
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="编辑这一晚的睡眠记录"
        style={styles.ghostButton}
        onPress={() => openEdit(detailNight)}
      >
        <ThemedIcon name="create-outline" size={16} color={colors.primary} />
        <Text style={styles.ghostButtonText}>编辑</Text>
      </PressableScale>
      <PressableScale
        haptic
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="删除这一晚的睡眠记录"
        style={[styles.ghostButton, styles.ghostDanger]}
        onPress={() => confirmRemove(detailNight)}
      >
        <ThemedIcon name="trash-outline" size={16} color={colors.danger} />
        <Text style={[styles.ghostButtonText, { color: colors.danger }]}>删除</Text>
      </PressableScale>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title="睡眠"
        right={
          <Pressable
            onPress={openCreate}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="手动补录睡眠"
            style={styles.headerAdd}
          >
            <ThemedIcon name="add" size={22} color={colors.primary} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}
      >
        <PageHead
          eyebrow="SLEEP RECOVERY"
          title="睡眠详情"
          subtitle="评分、分期与规律性放在一屏；系统读不到就手动补一笔，一样能看趋势。"
          style={styles.pageHead}
        />

        <View style={styles.segmentTrack}>
          {RANGE_OPTIONS.map((option) => {
            const active = option.key === range;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  if (active) return;
                  haptics.soft();
                  setRange(option.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={"查看" + option.label + "视图"}
                style={[styles.segmentCell, active && styles.segmentCellActive]}
              >
                <ThemedIcon
                  name={option.icon}
                  size={15}
                  color={active ? colors.primaryStrong : colors.textMuted}
                />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <SkeletonCard count={3} /> : null}

        {!loading && range === "day" ? (
          <>
            <View style={styles.dayNav}>
              <Pressable
                onPress={() => {
                  if (!newerNight) return;
                  haptics.soft();
                  setSelectedDate(newerNight.date);
                }}
                disabled={!newerNight}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="更新的一晚"
                style={[styles.navButton, !newerNight && styles.navButtonOff]}
              >
                <ThemedIcon name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <View style={styles.dayNavText}>
                <Text style={styles.dayNavTitle} numberOfLines={2}>
                  {dayLabel(detailDate)}
                </Text>
                <Text style={styles.dayNavMeta} numberOfLines={2}>
                  {detailNight
                    ? SLEEP_SOURCE_LABEL[detailNight.source] + " · " + sleepApi.formatSleepMinutesShort(detailNight.durationMin)
                    : "这一晚还没有记录"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!olderNight) return;
                  haptics.soft();
                  setSelectedDate(olderNight.date);
                }}
                disabled={!olderNight}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="更早的一晚"
                style={[styles.navButton, !olderNight && styles.navButtonOff]}
              >
                <ThemedIcon name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>

            {detailNight ? (
              <>
                <Card style={styles.scoreCard}>
                  <SegmentRing
                    segments={ringSegments}
                    score={score ?? "—"}
                    scoreLabel="睡眠评分"
                    caption={rating}
                    title={null}
                    legend={false}
                    size={176}
                    thickness={13}
                    gapDeg={slices.length > 0 ? 14 : 0}
                  />
                  <View style={styles.scoreFoot}>
                    <View style={styles.scoreFootCell}>
                      <Text style={styles.scoreFootLabel}>入睡</Text>
                      <Text style={[styles.scoreFootValue, tabularNums]}>
                        {sleepApi.formatClockTime(detailNight.bedtime)}
                      </Text>
                    </View>
                    <View style={styles.scoreFootDivider} />
                    <View style={styles.scoreFootCell}>
                      <Text style={styles.scoreFootLabel}>起床</Text>
                      <Text style={[styles.scoreFootValue, tabularNums]}>
                        {sleepApi.formatClockTime(detailNight.wakeTime)}
                      </Text>
                    </View>
                    <View style={styles.scoreFootDivider} />
                    <View style={styles.scoreFootCell}>
                      <Text style={styles.scoreFootLabel}>卧床</Text>
                      <Text style={[styles.scoreFootValue, tabularNums]}>
                        {sleepApi.formatSleepMinutesShort(detailNight.timeInBedMin)}
                      </Text>
                    </View>
                  </View>
                </Card>

                <SectionTitle title="关键指标" right={<Text style={styles.sectionMeta}>6 项</Text>} />
                {tileRows(dayTiles).map((row, index) => (
                  <StatTileRow key={"day-tiles-" + index} items={row} columns={3} />
                ))}

                <SectionTitle title="睡眠分期" />
                <Card style={styles.stageCard}>
                  <StageTimeline night={detailNight} />
                  {slices.length > 0 ? (
                    <View style={styles.sliceList}>
                      {slices.map((slice, index) => (
                        <StageSliceRow key={slice.key} slice={slice} index={index} />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.stageEmptyHint}>
                      系统未提供分期：只有总时长，仍可记录与比较趋势；手动补录也不产生分期。
                    </Text>
                  )}
                </Card>

                {dayActions}
              </>
            ) : (
              <Card>
                <EmptyState
                  pattern="none"
                  icon="moon-outline"
                  title="这一晚还没有记录"
                  hint="可以手动补录时长；若手机系统里已有睡眠数据，点下面的「重新读取」同步一次。"
                  actionLabel="手动补录"
                  onAction={openCreate}
                />
              </Card>
            )}
          </>
        ) : null}

        {!loading && range === "week" ? (
          <>
            <SectionTitle title="近 7 晚" right={<Text style={styles.sectionMeta}>{weekNights.length + "/7 晚"}</Text>} />
            <Card style={styles.chartCard}>
              <StepsBar
                title={null}
                rangeLabel={formatMonthDayRange(weekStart, todayKey)}
                items={weekColumns.map((column) => ({
                  label: column.label,
                  value: clamp01(column.minutes / BAR_FULL_MIN),
                  highlight: column.highlight,
                  valueLabel: column.minutes > 0 ? sleepMonthDay(column.key) : undefined,
                }))}
                height={120}
              />
              <Text style={styles.chartFoot}>柱高按 8 小时满格计，今天高亮。</Text>
            </Card>

            <SectionTitle title="平均指标" />
            {tileRows(averageTiles(weekStats, weekNights.length)).map((row, index) => (
              <StatTileRow key={"week-tiles-" + index} items={row} columns={3} />
            ))}

            <SectionTitle title="就寝规律性" right={<RegularityBadge stdMin={weekBedtimeStd} />} />
            <Card style={styles.chartCard}>
              {bedtimePoints.length >= 2 ? (
                <AreaChart
                  title={null}
                  series={[{ key: "bedtime", label: "入睡时刻", values: bedtimePoints.map((point) => point.offset) }]}
                  labels={bedtimePoints.map((point) => point.label)}
                  height={132}
                  min={Math.min(...bedtimePoints.map((point) => point.offset)) - 30}
                  max={Math.max(...bedtimePoints.map((point) => point.offset)) + 30}
                  showEndDot
                />
              ) : (
                <Text style={styles.stageEmptyHint}>
                  至少要有 2 晚的入睡时刻才能算规律性。手动补录时填上入睡时间，或在系统健康数据里授权后「重新读取」。
                </Text>
              )}
              <Text style={styles.chartFoot}>
                纵轴是就寝时刻（跨零点后为正）；线越平越规律，波动 ±30 分钟内算「规律」。
              </Text>
            </Card>
          </>
        ) : null}

        {!loading && range === "month" ? (
          <>
            <SectionTitle
              title="近 30 天"
              right={<Text style={styles.sectionMeta}>{monthHeat.recordDays + "/30 晚"}</Text>}
            />
            <Card style={styles.chartCard}>
              <View style={styles.heatGrid}>
                {monthHeat.rows.map((row, rowIndex) => (
                  <View key={"heat-row-" + rowIndex} style={styles.heatRow}>
                    {row.map((cell, cellIndex) => {
                      if (!cell) return <View key={"heat-empty-" + rowIndex + "-" + cellIndex} style={styles.heatCellEmpty} />;
                      const alpha = heatAlpha(cell.level, 4);
                      const background = alpha > 0 ? withAlpha(colors.primary, alpha) : colors.surfaceMuted;
                      const strong = cell.level >= 3;
                      return (
                        <View
                          key={cell.key}
                          accessible
                          style={[styles.heatCell, { backgroundColor: background }]}
                          accessibilityLabel={
                            sleepMonthDay(cell.key) + " " + (cell.minutes > 0 ? sleepApi.formatSleepMinutes(cell.minutes) : "没有记录")
                          }
                        >
                          <Text style={[styles.heatDay, strong && { color: colors.canvas }]} numberOfLines={1}>
                            {cell.day}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
              <View style={styles.heatLegend}>
                <Text style={styles.heatLegendText}>少</Text>
                {[0.16, 0.44, 0.72, 1].map((alpha) => (
                  <View key={"legend-" + alpha} style={[styles.heatLegendCell, { backgroundColor: withAlpha(colors.primary, alpha) }]} />
                ))}
                <Text style={styles.heatLegendText}>多</Text>
                <View style={styles.heatLegendSpacer} />
                <Text style={styles.heatLegendText}>{monthHeat.recordDays > 0 ? "有色块 = 有记录" : "还没有记录"}</Text>
              </View>
            </Card>

            <SectionTitle title="平均指标" right={<Text style={styles.sectionMeta}>30 天</Text>} />
            {tileRows(averageTiles(monthStats, monthHeat.recordDays)).map((row, index) => (
              <StatTileRow key={"month-tiles-" + index} items={row} columns={3} />
            ))}
          </>
        ) : null}

        {/* 数据源卡：Health Connect 状态 + 授权/重读入口 + 小米运动健康同步路径 */}
        <SectionTitle title="数据源" />
        <Card style={styles.sourceCard}>
          <View style={styles.sourceHead}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.sourceTitle}>Health Connect</Text>
            <View style={styles.sourceSpacer} />
            {reading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.statusText, { color: statusColor }]}>
                {healthStatus ? SLEEP_STATUS_LABEL[healthStatus] : "未读取"}
              </Text>
            )}
          </View>
          <Text style={styles.sourceHint}>
            {reading ? "正在读取系统健康数据…" : sleepApi.statusHint(healthStatus)}
          </Text>
          {healthStatus === "ok" ? (
            <Text style={styles.sourceMeta}>已读到 {healthCount} 晚记录（同日以系统数据为准）</Text>
          ) : null}
          {healthMessage ? <Text style={styles.sourceError}>{healthMessage}</Text> : null}
          <View style={styles.sourceActions}>
            <PressableScale
              haptic
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel="去系统授权健康数据"
              style={styles.sourceButton}
              onPress={() => void authorize()}
            >
              <ThemedIcon name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={styles.sourceButtonText}>去授权</Text>
            </PressableScale>
            <PressableScale
              haptic
              scaleTo={0.97}
              disabled={reading}
              accessibilityRole="button"
              accessibilityLabel="重新读取系统健康数据"
              style={styles.sourceButton}
              onPress={() => void refreshHealth()}
            >
              <ThemedIcon name="refresh" size={16} color={colors.primary} />
              <Text style={styles.sourceButtonText}>重新读取</Text>
            </PressableScale>
          </View>
          <View style={styles.xiaomiBox}>
            <ThemedIcon name="information-circle-outline" size={15} color={colors.textMuted} />
            <Text style={styles.xiaomiText}>{XIAOMI_SYNC_HINT}</Text>
          </View>
        </Card>

        {/* 最近记录：点一行切到该晚详情 */}
        <SectionTitle
          title="最近记录"
          right={<Text style={styles.sectionMeta}>{nights.length > 0 ? nights.length + " 晚" : "暂无"}</Text>}
        />
        {nights.length > 0 ? (
          <ListGroup>
            {nights.slice(0, 14).map((night, index, list) => (
              <ListRow
                key={night.date}
                icon={night.source === "health" ? "watch-outline" : "create-outline"}
                iconColor={night.source === "health" ? colors.success : colors.primary}
                iconBg={night.source === "health" ? colors.successSoft : colors.primarySoft}
                title={dayLabel(night.date)}
                subtitle={sleepApi.formatSleepMinutesShort(night.durationMin) + " · " + sleepApi.qualityLabel(sleepApi.sleepScore(night))}
                value={String(sleepApi.sleepScore(night))}
                right={<SourceBadge source={night.source} />}
                showChevron
                last={index === list.length - 1}
                accessibilityLabel={dayLabel(night.date) + " " + sleepApi.formatSleepMinutesShort(night.durationMin) + " " + SLEEP_SOURCE_LABEL[night.source]}
                onPress={() => {
                  haptics.soft();
                  setSelectedDate(night.date);
                  setRange("day");
                }}
              />
            ))}
          </ListGroup>
        ) : (
          <Card>
            <EmptyState
              pattern="none"
              icon="moon-outline"
              title="还没有睡眠记录"
              hint="手动补录一晚，或授权读取系统健康数据；有记录后这里会按日期倒序列出每晚的时长与评分。"
              actionLabel="手动补录"
              onAction={openCreate}
            />
          </Card>
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingDate ? "编辑睡眠记录" : "手动补录睡眠"}
        subtitle={editingDate ? "同一天保存会覆盖原记录" : "任何设备都能记；日期可以选最近 30 天"}
        icon="moon-outline"
        height="86%"
        footer={
          <SheetStickyCta
            label={editingDate ? "保存修改" : "保存记录"}
            icon="checkmark"
            loading={saving}
            onPress={() => void save()}
          />
        }
        footerHint="记录存本机；同一天有系统数据时，重新读取会以系统数据为准"
      >
        <SheetSection title="日期" hint="最近 30 天；补录只能记今天或更早">
          <DateChips
            options={dateOptions(todayKey, editingDate)}
            value={form.date}
            onChange={(key) => {
              setForm((prev) => ({ ...prev, date: key }));
              setFormError(null);
            }}
          />
        </SheetSection>

        <SheetSection title="总时长" hint="7.5 / 7h30m / 450 分钟都能填">
          <Field
            label="睡了几小时"
            value={form.duration}
            onChangeText={(value) => {
              setForm((prev) => ({ ...prev, duration: value }));
              if (formError) setFormError(null);
            }}
            placeholder="7.5"
            error={formError}
            hint="也支持 7:30、7 小时 30 分"
            autoCorrect={false}
          />
        </SheetSection>

        <SheetSection title="入睡 / 起床（可选）" hint="填了时间才能算规律性与起卧床点" last>
          <View style={styles.formRow}>
            <View style={styles.formCell}>
              <Field
                label="入睡"
                value={form.bedtime}
                onChangeText={(value) => {
                  setForm((prev) => ({ ...prev, bedtime: value }));
                  setFormError(null);
                }}
                placeholder="23:30"
                hint="18:00 之后算前一晚"
                autoCorrect={false}
              />
            </View>
            <View style={styles.formCell}>
              <Field
                label="起床"
                value={form.wakeTime}
                onChangeText={(value) => {
                  setForm((prev) => ({ ...prev, wakeTime: value }));
                  setFormError(null);
                }}
                placeholder="07:10"
                hint="记在起床那天"
                autoCorrect={false}
              />
            </View>
          </View>
        </SheetSection>
      </BottomSheet>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 小组件（页面私有；全部无动效）
 * ------------------------------------------------------------------ */

/** 睡眠分期条：入睡 → 起床；有 stages 按占比铺开，没有就一条总时长条 */
function StageTimeline({ night }: { night: SleepNight }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slices = sleepApi.sleepStageSlices(night);
  const hasStages = slices.some((slice) => slice.minutes > 0);
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineBar}>
        {hasStages ? (
          slices.map((slice, index) => (
            <View
              key={slice.key}
              style={{
                flex: Math.max(1, slice.minutes),
                backgroundColor: toneColor(colors, slice.tone, index),
              }}
            />
          ))
        ) : (
          <View style={[styles.timelineBarFull, { backgroundColor: withAlpha(colors.primary, 0.55) }]} />
        )}
      </View>
      <View style={styles.timelineAxis}>
        <Text style={[styles.timelineTime, tabularNums]} numberOfLines={1}>
          {sleepApi.formatClockTime(night.bedtime)}
        </Text>
        <Text style={styles.timelineHint} numberOfLines={1}>
          {hasStages ? "按占比铺开" : "无分期数据"}
        </Text>
        <Text style={[styles.timelineTime, tabularNums]} numberOfLines={1}>
          {sleepApi.formatClockTime(night.wakeTime)}
        </Text>
      </View>
    </View>
  );
}

/** 参考区间文案：数据层给的是「15-20%」这种裸区间，这里统一补「参考」二字 */
function sliceReferenceText(slice: SleepStageSlice): string {
  const reference = slice.reference ?? "";
  if (!reference) return stageReferenceText(slice.key);
  return reference.startsWith("参考") ? reference : "参考 " + reference;
}

/** 分区间的判定：数据层的 isNormal 为准；不在区间时按区间边界给「偏低 / 偏高」 */
function sliceVerdict(slice: SleepStageSlice): string {
  if (slice.isNormal) return "正常";
  const range = /(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)/.exec(slice.reference ?? "");
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (slice.pct < min) return "偏低";
    if (slice.pct > max) return "偏高";
  }
  return "偏离参考";
}

/** 分期占比行：标签 / 分钟 / 百分比 + 参考区间 + 正常徽标 */
function StageSliceRow({ slice, index }: { slice: SleepStageSlice; index: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const normal = slice.isNormal;
  const verdict = sliceVerdict(slice);
  const badgeColor = normal ? colors.success : colors.warning;
  const badgeBg = normal ? colors.successSoft : colors.warningSoft;
  return (
    <View style={styles.sliceRow}>
      <View style={styles.sliceTop}>
        <View style={[styles.sliceDot, { backgroundColor: toneColor(colors, slice.tone, index) }]} />
        <Text style={styles.sliceLabel} numberOfLines={1}>
          {slice.label}
        </Text>
        <Text style={[styles.slicePct, tabularNums]} numberOfLines={1}>
          {percentText(slice.pct, 1)}
        </Text>
        <View style={[styles.sliceBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.sliceBadgeText, { color: badgeColor }]}>{verdict}</Text>
        </View>
      </View>
      <View style={styles.sliceBottom}>
        <Text style={[styles.sliceMinutes, tabularNums]} numberOfLines={1}>
          {sleepApi.formatSleepMinutesShort(slice.minutes)}
        </Text>
        <Text style={styles.sliceRef} numberOfLines={1}>
          {sliceReferenceText(slice)}
        </Text>
      </View>
    </View>
  );
}

/** 来源徽标：系统健康 / 手动记录 */
function SourceBadge({ source }: { source: SleepNight["source"] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const fromHealth = source === "health";
  return (
    <View style={[styles.sourceBadge, { backgroundColor: fromHealth ? colors.successSoft : colors.primarySoft }]}>
      <Text
        style={[styles.sourceBadgeText, { color: fromHealth ? colors.success : colors.primary }]}
        numberOfLines={1}
      >
        {SLEEP_SOURCE_LABEL[source]}
      </Text>
    </View>
  );
}

/** 规律性徽标：规律 / 一般 / 不规律 */
function RegularityBadge({ stdMin }: { stdMin: number | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = regularityLabelOf(stdMin);
  const tone = stdMin === null ? colors.textMuted : stdMin <= 30 ? colors.success : stdMin <= 60 ? colors.warning : colors.danger;
  const bg =
    stdMin === null ? colors.surfaceMuted : stdMin <= 30 ? colors.successSoft : stdMin <= 60 ? colors.warningSoft : colors.dangerSoft;
  return (
    <View style={[styles.regularBadge, { backgroundColor: bg }]}>
      <ThemedIcon name="analytics-outline" size={12} color={tone} />
      <Text style={[styles.regularBadgeText, { color: tone }]} numberOfLines={1}>
        {label + (stdMin === null ? "" : " · ±" + stdMin + " 分钟")}
      </Text>
    </View>
  );
}

/** 补录的日期选择（最近 30 天；6 列，每格 ≥44 命中区） */
function DateChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dateGrid}>
      {options.map((key) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => {
              if (active) return;
              haptics.soft();
              onChange(key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={dayLabel(key)}
            style={[styles.dateChip, active && styles.dateChipActive]}
          >
            <Text style={[styles.dateChipText, active && styles.dateChipTextActive]} numberOfLines={1}>
              {sleepMonthDay(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 最近 30 天（今天在前）；编辑一条更早的记录时，把它补进列表头 */
function dateOptions(todayKey: string, editingDate: string | null): string[] {
  const list = sleepKeyRange(todayKey, 30).reverse();
  if (editingDate && !list.includes(editingDate)) list.unshift(editingDate);
  return list;
}

/** 周 / 月平均指标（6 格） */
function averageTiles(stats: SleepStatsLike, recordedNights: number): StatTileProps[] {
  return [
    {
      label: "平均时长",
      value: stats.avgDurationMin === null ? "—" : sleepApi.formatSleepMinutesShort(stats.avgDurationMin),
      icon: "time-outline",
      tone: "primary",
      hint: recordedNights > 0 ? "按记录平均" : "暂无记录",
    },
    {
      label: "平均效率",
      value: percentText(stats.avgEfficiency, 0),
      icon: "pulse-outline",
      tone: "success",
      hint: "≥85%",
    },
    {
      label: "深睡占比",
      value: percentText(stats.avgDeepPct, 0),
      icon: "layers-outline",
      tone: "accent",
      hint: "参考 15–60%",
    },
    {
      label: "快速眼动",
      value: percentText(stats.avgRemPct, 0),
      icon: "analytics-outline",
      tone: "teal",
      hint: "15–25%",
    },
    {
      label: "清醒均值",
      value: stats.avgAwakeCount === null ? "—" : String(Math.round(stats.avgAwakeCount * 10) / 10),
      unit: stats.avgAwakeCount === null ? undefined : "次",
      icon: "eye-outline",
      tone: "warning",
      hint: "≤2 次",
    },
    {
      label: "记录晚数",
      value: String(recordedNights),
      unit: "晚",
      icon: "calendar-outline",
      tone: "text",
      hint: recordedNights > 0 ? "有记录才计" : "先补录一晚",
    },
  ];
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /** Stack 子页也要不透明底：避免转场时透出下层 Tab（与 Tab 页同一约定） */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    pageHead: { marginBottom: 2 },

    /* 顶栏「+」：40 命中区 + hitSlop 8 = 56 */
    headerAdd: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    /* 日 / 周 / 月 分段（每格 ≥44 命中区；不做滑块动效） */
    segmentTrack: {
      flexDirection: "row",
      padding: 4,
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    segmentCell: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.pill,
    },
    segmentCellActive: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      ...shadows.card,
      elevation: 0,
    },
    segmentText: { ...typography.callout, fontWeight: "700", color: colors.textMuted },
    segmentTextActive: { color: colors.primaryStrong },

    /* 日期导航 */
    dayNav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dayNavText: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
    dayNavTitle: { ...typography.hero, color: colors.text },
    dayNavMeta: { ...typography.meta, color: colors.textMuted },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    navButtonOff: { opacity: 0.35 },

    /* 评分环卡 */
    scoreCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
    scoreFoot: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
    scoreFootCell: { flex: 1, alignItems: "center", gap: 3 },
    scoreFootLabel: { ...typography.meta, color: colors.textMuted },
    scoreFootValue: { ...typography.headline, color: colors.text },
    scoreFootDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border },

    sectionMeta: { ...typography.meta, color: colors.textFaint },

    /* 分期 */
    stageCard: { gap: spacing.md },
    timeline: { gap: 8 },
    timelineBar: {
      flexDirection: "row",
      height: 14,
      borderRadius: radius.pill,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
    },
    timelineBarFull: { flex: 1 },
    timelineAxis: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    timelineTime: { ...typography.caption, fontWeight: "700", color: colors.text },
    timelineHint: { ...typography.caption, fontWeight: "400", color: colors.textFaint, flexShrink: 1, textAlign: "center" },
    stageEmptyHint: { ...typography.meta, color: colors.textMuted, lineHeight: 19 },
    sliceList: { gap: spacing.sm },
    sliceRow: {
      gap: 3,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    sliceTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    sliceDot: { width: 8, height: 8, borderRadius: 4 },
    sliceLabel: { ...typography.callout, fontWeight: "700", color: colors.text, flexShrink: 1 },
    slicePct: { ...typography.callout, fontWeight: "700", color: colors.text, marginLeft: "auto" },
    sliceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, minWidth: 40, alignItems: "center" },
    sliceBadgeText: { ...typography.micro, fontWeight: "700" },
    sliceBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingLeft: 16 },
    sliceMinutes: { ...typography.caption, color: colors.textMuted },
    sliceRef: { ...typography.caption, fontWeight: "400", color: colors.textFaint },

    /* 操作按钮（编辑 / 删除） */
    actionRow: { flexDirection: "row", gap: spacing.sm },
    ghostButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.control,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    ghostDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
    ghostButtonText: { ...typography.caption, fontWeight: "700", color: colors.primary },

    /* 图表卡 */
    chartCard: { gap: spacing.sm },
    chartFoot: { ...typography.meta, color: colors.textFaint, lineHeight: 18 },

    /* 月热力 */
    heatGrid: { gap: 6 },
    heatRow: { flexDirection: "row", gap: 6 },
    heatCell: { flex: 1, aspectRatio: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    heatCellEmpty: { flex: 1, aspectRatio: 1 },
    heatDay: { ...typography.micro, color: colors.textMuted, fontWeight: "700" },
    heatLegend: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 2 },
    heatLegendText: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    heatLegendCell: { width: 12, height: 12, borderRadius: 4 },
    heatLegendSpacer: { flex: 1 },
    regularBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    regularBadgeText: { ...typography.caption, fontWeight: "700" },

    /* 数据源卡 */
    sourceCard: { gap: spacing.sm },
    sourceHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    sourceTitle: { ...typography.headline, color: colors.text },
    sourceSpacer: { flex: 1 },
    statusText: { ...typography.caption, fontWeight: "700" },
    sourceHint: { ...typography.meta, color: colors.textMuted, lineHeight: 18 },
    sourceMeta: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    sourceError: { ...typography.caption, fontWeight: "600", color: colors.danger },
    sourceActions: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
    sourceButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.control,
      backgroundColor: colors.primarySoft,
    },
    sourceButtonText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    sourceBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
      maxWidth: 96,
    },
    sourceBadgeText: { ...typography.micro, fontWeight: "700" },
    xiaomiBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    xiaomiText: { flex: 1, minWidth: 0, ...typography.caption, fontWeight: "400", color: colors.textMuted, lineHeight: 18 },

    /* 补录弹层 */
    dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dateChip: {
      flexBasis: "15%",
      flexGrow: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.control,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateChipText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    dateChipTextActive: { color: colors.canvas },
    formRow: { flexDirection: "row", gap: spacing.sm },
    formCell: { flex: 1, minWidth: 0 },
  });
