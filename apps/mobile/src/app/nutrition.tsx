import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { AnimatedNumber } from "@/components/animated-number";
import { ProgressBar } from "@/components/stat";
import { KcalBadge } from "@/components/kcal-badge";
import { FoodSticker } from "@/components/food-sticker";
import { DayStrip, DAY_STRIP_MAX_WEEKS } from "@/components/day-strip";
import { MonthCalendar } from "@/components/month-calendar";
import { MacroMiniRings, type MacroRingItem } from "@/components/macro-mini-rings";
import { MealEditSheet, type MealUpdate } from "@/components/meal-edit-sheet";
import { StickerBookSheet } from "@/components/sticker-book";
import { SwipeRow } from "@/components/swipe-row";
import { WaterCard } from "@/components/water-card";
import { WaterCupSheet } from "@/components/water-cup";
import { isDateKey } from "@/lib/nutrition-stats";
import { MealCardGrid, type MealCardData } from "@/components/meal-card-grid";
import { RecipeShelf } from "@/components/recipe-shelf";
import { LiveLogSheet } from "@/components/live-log-sheet";
import { WeightCard } from "@/components/weight-card";
import { TargetSheet, type TargetProfileInput } from "@/components/target-sheet";
import { scaleNutrition } from "@/lib/portion";
import { dailyRecipes } from "@/lib/recipes";
import {
  addHydration,
  addWeight,
  fetchHydration,
  fetchNutritionTarget,
  fetchWeight,
  removeHydration,
  saveNutritionTarget,
  type NutritionProfileDto,
  type NutritionTargetDto,
  type WeightPointDto,
} from "@/lib/wellbeing-client";
import { PressableScale } from "@/components/pressable-scale";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { haptics } from "@/lib/haptics";
import {
  EMPTY_OUTBOX,
  enqueue,
  flushOutbox,
  hasPendingFor,
  loadOutbox,
  makeCreateOp,
  makeDeleteOp,
  makeUpdateOp,
  mergePendingEntries,
  nextLocalId,
  pendingCount,
  saveOutbox,
  toLocalEntry,
  type MealEntryInput,
  type OutboxOp,
  type OutboxState,
} from "@/lib/nutrition-outbox";
import { isRetryable, sendNutritionOp, toFlushOutcome } from "@/lib/nutrition-sync";
import { monthRange } from "@/lib/month-grid";
import { mealForNow } from "@/lib/meal-time";
import {
  compactKcal,
  dayLabel,
  summarizeRange,
  pickWindowSummary,
  toDaySummaryMap,
  todayAndYesterday,
  weeksAgo,
  weekKeysOf,
  weekEndKey,
  weekRangeLabel,
  isCurrentWeek,
  WEEK_TILE_LABELS,
  type DaySummaryRow,
} from "@/lib/nutrition-views";
import { spacing, tabularNums, typography, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  DEFAULT_NUTRITION_TARGETS,
  MEAL_KCAL_SHARES,
  buildNutritionTargetView,
  formatEntryTime,
  fromDateKey,
  mealKindLabels,
  nutritionTargetRange,
  recentDateKeys,
  remainingKcal,
  toDateKey,
  kcalEquivalentText,
  sumNutrition,
  scaleFoodByAmount,
  formatBasisLabel,
  type FoodItemHit,
  type Food,
  type MealEntry,
  type MealKind,
} from "@learn-workbench/shared";

/** 窗口不匹配时的占位（引用恒定，避免 useMemo 抖动） */
const EMPTY_SUMMARY_MAP: Record<string, DaySummaryRow> = {};

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

/** v4 P4-a：日期视图（日 / 周 / 月） */
type ViewMode = "day" | "week" | "month";

/** 三大营养素环的配色（借 吃一点：绿=达标、橙=碳水、青=脂肪） */
const MACRO_COLORS = { proteinG: "#3DA35D", carbsG: "#F28C28", fatG: "#2FB3A6" } as const;

/** 餐次语义色（与 meal-card-grid 同一套口径；那里没导出，饮食页的推荐卡复用同一色系） */
function mealAccentColor(meal: MealKind, colors: ThemeColors): string {
  switch (meal) {
    case "breakfast":
      return colors.accent;
    case "lunch":
      return colors.primary;
    case "dinner":
      return colors.lavender;
    case "snack":
      return colors.success;
  }
}

/**
 * 本机「上次分量」记忆（需求 3）。
 *
 * 为什么放在本机：`/api/nutrition/foods?sort=recent` 只回名称/单位/单位营养与使用频次，
 * **没有「上次分量」字段**；那个接口是 Web 与 App 共用的，本次不动。于是由客户端在每次
 * 添加成功后顺手记住一份，键 = 食物名（与 `foods` 的口径一致），读不到就按 1 份。
 */
const PORTION_MEMO_KEY = "lwb.nutrition.last-portion.v1";

interface PortionMemoEntry {
  amount: number;
  unit: string;
}

/** 带使用频次的常用食物（recent 排序接口会多回 times/lastUsed，Food 类型里没有） */
type RecentFood = Food & { times?: number; lastUsed?: string | null };

/**
 * 份量选项（需求 1）：质量单位按 50/100/150/200 走，其余按 0.5/1/1.5/2 份。
 * 单位原样带在标签上（份 / 碗 / 个 / g / ml），避免"1"看不出是什么单位。
 */
function portionOptions(food: { unit: string }): { value: number; label: string }[] {
  const unit = (food.unit ?? "份").trim() || "份";
  if (/^(g|ml|克|毫升)$/i.test(unit)) {
    return [50, 100, 150, 200].map((grams) => ({ value: grams, label: `${grams} ${unit}` }));
  }
  return [0.5, 1, 1.5, 2].map((multiplier) => ({ value: multiplier, label: `${multiplier} ${unit}` }));
}

/**
 * 添加弹层的折叠收纳栏（需求 1）。
 *
 * 为什么做成组件而不是就地写四份：四个分组（常用 / 按分量 / 以往 / 手动）的标题、条目数、
 * 展开态与动效完全一致，抽出来才能保证"点标题展开/收起 + 折叠时显示条目数"只有一处实现。
 */
function AccordionGroup({
  id,
  title,
  hint,
  count,
  open,
  onToggle,
  styles,
  colors,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  /** 折叠标题上的条目数（undefined = 这组不是列表，不显示数字） */
  count?: number;
  open: boolean;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  children: ReactNode;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.group}>
      <Pressable
        onPress={() => onToggle(id)}
        style={styles.groupHead}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${typeof count === "number" ? `，${count} 项` : ""}，${open ? "点击收起" : "点击展开"}`}
      >
        <View style={styles.groupTitleWrap}>
          <Text style={styles.groupTitle}>{title}</Text>
          {hint ? (
            <Text style={styles.groupHint} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {typeof count === "number" ? (
          <View style={styles.groupCount}>
            <Text style={styles.groupCountText}>{count}</Text>
          </View>
        ) : null}
        <ThemedIcon name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeInUp.duration(180)} style={styles.groupBody}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** 折叠栏展开态的初始值：只有第一组（常用食物）默认展开，其余收起（需求 1） */
const INITIAL_OPEN_GROUPS: Record<string, boolean> = { common: true };

export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ stats?: string; date?: string }>();
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);

  const { today: todayKey, yesterday: yesterdayKey } = useMemo(() => todayAndYesterday(), []);
  /** v1.45：`?date=YYYY-MM-DD` 从趋势页的 Food Calendar 跳进来（非法值回落今天） */
  const [date, setDate] = useState(() => (isDateKey(params.date) ? params.date : todayKey));
  const [weekOffset, setWeekOffset] = useState(0);
  /** v4 P4-a：日 / 周 / 月 日期视图（默认「日」） */
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  /** 月视图当前翻到的月份（切到「月」时对齐所选日期的月份，避免停在今天的月份；从趋势页带 date 进来时也跟随） */
  const [monthView, setMonthView] = useState(() => ({
    y: Number(date.slice(0, 4)),
    m: Number(date.slice(5, 7)) - 1,
  }));
  const [entries, setEntries] = useState<MealEntry[]>([]);
  /** 逐日汇总（**保留 kcal 等完整字段**，月历徽标与周/月汇总都靠它；不再只存条数） */
  /**
   * 区间汇总与**取数窗口绑定**：`key` 是当前请求用的窗口标识，`map` 是该窗口的结果。
   * 二者不匹配时消费方按"还没有数据"处理 —— 否则切视图/翻月的过渡期会拿旧窗口的数字
   * 去渲染新窗口（例如月历一个徽标都没有、却显示"本月记录了 1 天"，审查发现）。
   */
  const [summaryState, setSummaryState] = useState<{ key: string; map: Record<string, DaySummaryRow> }>({
    key: "",
    map: {},
  });
  /** 日视图里的「选择日期」弹层 */
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** recent 排序接口会多带 times/lastUsed，用来区分「以往添加过的」与「食物库里的」 */
  const [foods, setFoods] = useState<RecentFood[]>([]);
  const [meal, setMeal] = useState<MealKind>("lunch");
  /**
   * v1.33.0：「添加 <餐次>」按钮的文案随**当前时间段**自动变化（早餐/午餐/晚餐/加餐）。
   * 只在"跨段"时 setState —— 每 30s 校准一次，不跨段就不触发重渲染。
   * 边界口径与 lib/meal-time.ts 的 mealForNow 完全一致（<10 早餐 / <15 午餐 / <21 晚餐 / 其余加餐）。
   */
  const [mealNow, setMealNow] = useState<MealKind>(() => mealForNow());
  useEffect(() => {
    const id = setInterval(() => {
      const next = mealForNow();
      setMealNow((prev) => (prev === next ? prev : next));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  const [saving, setSaving] = useState(false);
  /**
   * 需求 1：添加弹层的分组收纳态 —— 默认只展开「常用食物」（INITIAL_OPEN_GROUPS），
   * 其余三组折叠后标题上只留条目数，弹层首屏不再一眼铺开几十行。
   */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(INITIAL_OPEN_GROUPS);
  /** 需求 1：按分量添加时，每种食物当前选中的分量（键 = food.id；缺省 = 选项里的 1 倍） */
  const [portionById, setPortionById] = useState<Record<number, number>>({});
  /** 需求 3：「+ 今日」/「按分量」成功后让按钮短暂变成「已加入」，给一次明确的成功反馈 */
  const [justAdded, setJustAdded] = useState<Record<number, boolean>>({});
  /** 需求 3：本机记住的「上次分量」（名称 → 分量），服务端接口没有这个字段（见 PORTION_MEMO_KEY 注释） */
  const [portionMemo, setPortionMemo] = useState<Record<string, PortionMemoEntry>>({});
  const portionMemoRef = useRef<Record<string, PortionMemoEntry>>({});
  // 手动录入（v2 Bug 7a 保留）
  const [manual, setManual] = useState({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
  const [saveAsCommon, setSaveAsCommon] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  // v6 P1-3：营养基准库（food_items）搜索 → 选一条 → 输入实际摄入量 → 服务端换算
  const [dbItems, setDbItems] = useState<FoodItemHit[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [pickedItem, setPickedItem] = useState<FoodItemHit | null>(null);
  const [itemGrams, setItemGrams] = useState("100");
  // P2：编辑面板 + 离线发件箱
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [outbox, setOutbox] = useState<OutboxState>(EMPTY_OUTBOX);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  // P3：目标 / 饮水 / 体重
  const [profile, setProfile] = useState<NutritionProfileDto | null>(null);
  const [serverTarget, setServerTarget] = useState<NutritionTargetDto | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [hydration, setHydration] = useState<{ totalMl: number; targetMl: number; lastId: number | null; lastTime: string | null }>({
    totalMl: 0,
    targetMl: 2000,
    lastId: null,
    lastTime: null,
  });
  const [weightPoints, setWeightPoints] = useState<WeightPointDto[]>([]);
  const [wellnessBusy, setWellnessBusy] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  // M9 深化：收集册弹层
  const [bookOpen, setBookOpen] = useState(false);
  /**
   * v1.45：原「饮食趋势」底部弹层已升级为独立全屏页 `/trends`。
   * 保留 `?stats=1` 的重定向，兼容旧链接/深链（不再从饮食页弹抽屉）。
   */
  useEffect(() => {
    if (params.stats === "1") router.replace("/trends" as never);
  }, [params.stats]);
  // 水杯、LiveLog
  const [cupOpen, setCupOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);

  /** 有效目标：身体数据算出来（或手动覆盖），失败回落 shared 默认值 */
  const target = useMemo(() => {
    const base = buildNutritionTargetView(
      {
        weightKg: profile?.weightKg ?? 60,
        heightCm: profile?.heightCm ?? null,
        birthYear: profile?.birthYear ?? null,
        sex: profile?.sex ?? null,
        activityLevel: profile?.activityLevel ?? null,
      },
      serverTarget
        ? {
            kcal: serverTarget.computed || serverTarget.kcal !== DEFAULT_NUTRITION_TARGETS.kcal ? serverTarget.kcal : null,
            proteinG: serverTarget.proteinG,
            carbsG: serverTarget.carbsG,
            fatG: serverTarget.fatG,
          }
        : null
    );
    return { kcal: base.kcal, proteinG: base.proteinG, carbsG: base.carbsG, fatG: base.fatG, computed: base.computed, note: base.note };
  }, [profile, serverTarget]);

  /**
   * v4 P4-a：按视图决定 summary 的取数窗口
   *  - 日：只需要当天（✓ 标记只在周视图用，避免每次切日期都拉 28 天）
   *  - 周：日期条最多回看 4 周 → 一次取 28 天覆盖整个可翻页窗口（保持既有行为）
   *  - 月：`days` = 该月天数、`end` = 该月最后一天 → 翻历史月时不会把上个月的尾巴算进来
   *    （后端 `MAX_DAYS = 31`，正好覆盖整月；不需要任何后端改动）
   */
  const summaryWindow = useMemo(() => {
    if (viewMode === "month") return monthRange(monthView.y, monthView.m);
    if (viewMode === "week") {
      const end = fromDateKey(todayKey);
      end.setDate(end.getDate() - weekOffset * 7);
      return { days: 28, end: toDateKey(end) };
    }
    // v1.22：日视图取**该自然周**（周一~周日）——end 取本周周日，这样点周内任一天都不用重新拉数
    return { days: 7, end: weekEndKey(date) };
  }, [viewMode, monthView, weekOffset, date, todayKey]);

  const summaryWindowKey = `${summaryWindow.days}:${summaryWindow.end}`;
  /** 只有"当前窗口"的数据才参与渲染；切换窗口的过渡期一律当空（宁可不显示，也不显示错窗口的数字） */
  const daySummary = useMemo(
    () => pickWindowSummary(summaryState, summaryWindowKey) ?? EMPTY_SUMMARY_MAP,
    [summaryState, summaryWindowKey]
  );

  /** v11 P2：餐次卡组（本餐 kcal + 条目数）与近 7 天热量条 */
  const mealCards = useMemo<MealCardData[]>(
    () =>
      MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m);
        return { meal: m, kcal: Math.round(list.reduce((sum, e) => sum + (e.kcal ?? 0), 0)), count: list.length };
      }),
    [entries]
  );

  /**
   * v1.22：迷你柱固定为**自然周（周一 → 周日）**。
   * 旧版是"以所选日期为终点往前滚 7 天"，所以点周六时整条柱会往前挪一格、把前面的数据顶出去
   * （真机反馈 2026-09-22）。现在点某天只换高亮与详情，柱状图始终是这一周。
   */
  const weekStrip = useMemo(
    () =>
      weekKeysOf(date).map((key, i) => ({
        key,
        label: WEEK_TILE_LABELS[i],
        kcal: Math.round(daySummary[key]?.kcal ?? 0),
        active: key === date,
      })),
    [date, daySummary]
  );

  /** 上一周 / 下一周：保持同一星期几；不能翻到未来周 */
  const shiftWeek = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentWeek(date, todayKey)) return;
    const d = fromDateKey(date);
    d.setDate(d.getDate() + dir * 7);
    const next = toDateKey(d);
    if (next > todayKey) return;
    haptics.soft();
    setDate(next);
  };

  /** 日期条的 ✓ 仍按"当天有记录"判定，所以从富结构里派生一份 entryCount map（DayStrip 的 API 不变） */
  const doneMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [key, row] of Object.entries(daySummary)) map[key] = row.entryCount;
    return map;
  }, [daySummary]);

  /** 周视图的 7 天窗口（与 DayStrip 内部窗口一致：今天往前 weekOffset 周，取 7 天） */
  const weekKeys = useMemo(() => {
    const end = fromDateKey(todayKey);
    end.setDate(end.getDate() - weekOffset * 7);
    return recentDateKeys(7, end);
  }, [todayKey, weekOffset]);

  /** 周 / 月视图顶部的区间汇总 */
  const weekRows = useMemo(
    () => weekKeys.map((k) => daySummary[k]).filter((r): r is DaySummaryRow => Boolean(r)),
    [weekKeys, daySummary]
  );
  const rangeRows = useMemo(() => Object.values(daySummary), [daySummary]);
  const weekSummary = useMemo(() => summarizeRange(weekRows), [weekRows]);
  const monthSummary = useMemo(() => summarizeRange(rangeRows), [rangeRows]);

  const isToday = date === todayKey;
  const totals = useMemo(() => sumNutrition(entries), [entries]);
  const remaining = remainingKcal(totals.kcal, target.kcal);
  const overBudget = remaining < 0;
  const ringProgress = target.kcal > 0 ? Math.min(1, totals.kcal / target.kcal) : 0;

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /**
   * 发货实现（v4 P1-4）：能力已抽到 `lib/nutrition-sync.ts`，这里只做两件事：
   *  - `submitOp`：单条提交，返回四分类结果（离线/服务端/校验/未登录），由调用方决定提示与入队
   *  - `sendOp`  ：发件箱适配层，把结果翻译成 ok/retry/drop（4xx 直接丢弃，避免毒丸堵队首）
   */
  const submitOp = useCallback((op: OutboxOp) => sendNutritionOp(op, token), [token]);
  const sendOp = useCallback(
    async (op: OutboxOp) => toFlushOutcome(await sendNutritionOp(op, token)),
    [token]
  );

  /** 先补发离线积压，再拉取明细（保证顺序与幂等） */
  const flushPending = useCallback(async () => {
    const state = await loadOutbox();
    setOutbox(state);
    setPendingIds(state.ops.map((o) => (o.kind === "create" ? o.localId : o.id)));
    if (pendingCount(state) === 0) return;
    const result = await flushOutbox(sendOp);
    if (result.sent > 0 || result.dropped > 0) {
      const after = await loadOutbox();
      setOutbox(after);
      setPendingIds(after.ops.map((o) => (o.kind === "create" ? o.localId : o.id)));
    }
  }, [sendOp]);

  /**
   * 请求序号：`load()` 里先 `await flushPending()`（可能含网络重试），
   * 因此**后触发的 load 可能先返回**；没有守卫时旧响应会覆盖新数据
   * （切换到月视图后仍显示上一天的数字，且不会自愈）——审查发现。
   */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const my = ++loadSeq.current;
    await flushPending();
    if (my !== loadSeq.current) return;
    try {
      const [entriesRes, summaryRes, targetRes, waterRes, weightRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/nutrition?date=${date}`, { headers: headers() }),
        // 日期条的 ✓ / 月历徽标 / 区间汇总一起取（一次请求覆盖当前视图窗口，避免连打 N 次明细）
        fetch(`${getApiUrl()}/api/nutrition/summary?days=${summaryWindow.days}&end=${summaryWindow.end}`, { headers: headers() }),
        fetchNutritionTarget(token).catch(() => null),
        fetchHydration(token).catch(() => null),
        fetchWeight(token, 30).catch(() => null),
      ]);
      if (my !== loadSeq.current) return;
      const d = await entriesRes.json();
      if (entriesRes.ok) {
        const server: MealEntry[] = Array.isArray(d.entries) ? d.entries : [];
        /**
         * 合并发件箱里还没上传成功的条目（v6 P0-3）：否则这次 load 会把乐观入账抹掉。
         * 只合并**当天**的 create —— 需求 3 的「+ 今日」允许在翻看历史日期时把条目记到今天，
         * 若不过滤，那条待补发的记录会被并进"昨天"的列表里（看起来像记错了日子）。
         */
        const outboxNow = await loadOutbox();
        const forThisDate: OutboxState = {
          ops: outboxNow.ops.filter((op) => op.kind !== "create" || op.body.date === date),
        };
        setEntries(mergePendingEntries(server, forThisDate));
      }
      const s = await summaryRes.json();
      // 与窗口一起落库：窗口不匹配时消费方按空处理，宁可不显示也不显示错的月份数字
      if (summaryRes.ok) setSummaryState({ key: summaryWindowKey, map: toDaySummaryMap(s.summary) });
      if (targetRes) {
        setProfile(targetRes.profile);
        setServerTarget(targetRes.target);
      }
      if (waterRes) {
        const last = waterRes.logs.length > 0 ? waterRes.logs[waterRes.logs.length - 1] : null;
        setHydration({
          totalMl: waterRes.totalMl,
          targetMl: waterRes.targetMl,
          lastId: last ? last.id : null,
          // 水杯弹层要显示"最近一次饮水时间"（参考图 8 的时间戳）
          lastTime: last ? last.recordedAt : null,
        });
      }
      if (weightRes) setWeightPoints(weightRes.points);
    } catch {
      // 离线保留现状
    } finally {
      if (my === loadSeq.current) setLoading(false);
    }
  }, [date, flushPending, headers, summaryWindow, summaryWindowKey, token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /** v18：统一走 usePullRefresh（本页有吸顶紧凑栏 → stickyHeader: true） */
  const { control } = usePullRefresh(load, { stickyHeader: true });

  /** v6 P0-3：「N 条待同步」状态条的重试入口 —— 先补发，再刷新列表 */
  const retryPending = useCallback(async () => {
    await flushPending();
    await load();
  }, [flushPending, load]);

  /** v6 P1-3：营养库条目的实时换算预览（服务端会独立重算一次） */
  const itemScaled = useMemo(
    () => (pickedItem ? scaleFoodByAmount(pickedItem, Number(itemGrams) || 0) : null),
    [pickedItem, itemGrams]
  );

  /**
   * v6 P1-3：从营养基准库按实际摄入量添加。
   * 与 addManual 同一条规则（P0-3）：**只有真正落库成功才 load()**，
   * 否则服务端列表会把刚插入的乐观入账覆盖掉。
   */
  const addFromItem = async () => {
    if (!pickedItem) return;
    const gramsNum = Number(itemGrams);
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
      Alert.alert("请填写摄入量", "输入实际吃了多少（克，或与基准单位相同的量）。");
      return;
    }
    setSaving(true);
    try {
      const localId = nextLocalId();
      const scaled = scaleFoodByAmount(pickedItem, gramsNum);
      const isMass = pickedItem.basisUnit === "g" || pickedItem.basisUnit === "ml";
      const body: MealEntryInput = {
        date,
        meal,
        name: pickedItem.name,
        amount: isMass
          ? Math.min(1000, gramsNum)
          : Math.round((gramsNum / pickedItem.basisAmount) * 100) / 100,
        unit: pickedItem.basisUnit,
        ...scaled,
        foodItemId: pickedItem.id,
        grams: gramsNum,
      };
      const op = makeCreateOp(body, localId);
      const outcome = await submitOp(op);
      if (!outcome.ok && !isRetryable(outcome)) {
        Alert.alert("这条没有记上", outcome.message ?? "服务端拒绝了这条记录。");
        return;
      }
      if (!outcome.ok) {
        setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
        setPendingIds((prev) => [...prev, localId]);
        const next = enqueue(outbox, op);
        setOutbox(next);
        await saveOutbox(next);
        haptics.success();
        closeSheet();
        if (outcome.kind === "auth") Alert.alert("已记在本机", "登录后会自动同步到云端。");
        return;
      }
      haptics.success();
      closeSheet();
      await load();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!sheetOpen) return;
    void (async () => {
      try {
        // 优先按「最近使用/频次」排序（v3 M4）；v6 P1-2 再叠加当前餐次：
        // 先看「本人这个餐次」吃过的（早餐常吃的包子不会因为中午也吃过被淹没）
        const r = await fetch(
          getApiUrl() + `/api/nutrition/foods?sort=recent&limit=24&meal=${meal}`,
          { headers: headers() }
        );
        const d = await r.json();
        if (r.ok) setFoods(Array.isArray(d.foods) ? d.foods : []);
      } catch {
        // 忽略
      }
    })();
  }, [sheetOpen, meal, headers]);

  /**
   * v6 P1-3：营养基准库模糊搜索（300ms 防抖 + 只认最新一次响应）。
   * 输入为空时清空结果；失败静默（下方还有常用食物与手动添加两条兜底路径）。
   */
  useEffect(() => {
    const q = foodQuery.trim();
    let alive = true;
    if (!sheetOpen || q.length === 0) {
      // 清空放到异步回调里：effect 体内同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）
      const idle = setTimeout(() => {
        if (alive) setDbItems([]);
      }, 0);
      return () => {
        alive = false;
        clearTimeout(idle);
      };
    }
    const timer = setTimeout(() => {
      void (async () => {
        setDbLoading(true);
        try {
          const r = await fetch(
            getApiUrl() + `/api/foods/search?q=${encodeURIComponent(q)}&meal=${meal}&limit=12`,
            { headers: headers() }
          );
          const d = await r.json();
          if (alive && r.ok) setDbItems(Array.isArray(d.items) ? d.items : []);
        } catch {
          if (alive) setDbItems([]);
        } finally {
          if (alive) setDbLoading(false);
        }
      })();
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [foodQuery, sheetOpen, meal, headers]);

  /** 贴纸墙数据（v3 M9）：近 30 天记录里出现过的食物 + 次数 */
  const stickers = useMemo(() => {
    const map = new Map<string, { name: string; times: number; kcal: number }>();
    for (const e of entries) {
      const key = e.name.trim();
      if (!key) continue;
      const prev = map.get(key);
      if (prev) prev.times += 1;
      else map.set(key, { name: key, times: 1, kcal: e.kcal });
    }
    return [...map.values()].sort((a, b) => b.times - a.times).slice(0, 18);
  }, [entries]);

  /**
   * v4 P4-c LiveLog 的贴纸候选：今天的记录 + 常用食物（去重、最多 12 个）。
   * 顺序优先"今天吃过的"——手摆贴纸时最常见的诉求就是"把今天吃的摆出来"。
   */
  const liveNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      const name = e.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    for (const f of foods) {
      const name = f.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out.slice(0, 12);
  }, [entries, foods]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setPickedItem(null);
    setItemGrams("100");
    setManual({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
    setSaveAsCommon(false);
    setFoodQuery("");
    // 收纳态归零：下次打开仍是「只展开第一组」，不会记住上次随手点开的组
    setOpenGroups(INITIAL_OPEN_GROUPS);
  }, []);

  /** v6 P1-2：打开「添加饮食」时按当前时间预选餐次（用户仍可手动切） */
  const openSheet = useCallback(() => {
    setMeal(mealForNow());
    setSheetOpen(true);
  }, []);

  /** 折叠栏开关（需求 1）：收纳是浏览动作，用最轻的一档触感 */
  const toggleGroup = useCallback((id: string) => {
    haptics.soft();
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /** 选中某种食物的分量（需求 1）：只改选择，热量/三大营养素在渲染时按「单位营养 × 分量」实时算 */
  const choosePortion = useCallback((foodId: number, value: number) => {
    haptics.light();
    setPortionById((prev) => ({ ...prev, [foodId]: value }));
  }, []);

  /** 记住「上次用的分量」（需求 3）：写内存 + 本机存储；失败静默，不能因为存储失败挡住记录 */
  const rememberPortion = useCallback((name: string, amount: number, unit: string) => {
    const key = name.trim();
    if (!key || !Number.isFinite(amount) || amount <= 0) return;
    const next = { ...portionMemoRef.current, [key]: { amount, unit: unit.trim() || "份" } };
    portionMemoRef.current = next;
    setPortionMemo(next);
    void AsyncStorage.setItem(PORTION_MEMO_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /** 成功反馈：按钮短暂显示「已加入」（需求 3 的「成功给反馈」） */
  const flashAdded = useCallback((foodId: number) => {
    setJustAdded((prev) => ({ ...prev, [foodId]: true }));
    setTimeout(() => {
      setJustAdded((prev) => {
        if (!prev[foodId]) return prev;
        const next = { ...prev };
        delete next[foodId];
        return next;
      });
    }, 1600);
  }, []);

  /** 网格长按 → 展开「按分量添加」组（原来长按是弹滑杆，现在收进折叠组里，行为等价） */
  const focusPortionRow = useCallback((food: RecentFood) => {
    haptics.soft();
    setOpenGroups((prev) => ({ ...prev, portion: true }));
    const options = portionOptions(food);
    setPortionById((prev) => ({ ...prev, [food.id]: prev[food.id] ?? options[1]?.value ?? 1 }));
  }, []);

  /**
   * 按指定分量入账（需求 1 的「按分量添加」与需求 3 的「+ 今日」共用）。
   *
   * 与 quickAdd 的差别：**先乐观入账**再上传 —— 按钮点下去立刻能在时间线里看到这条；
   * 服务端 4xx 明确拒绝时撤回（失败回滚）并说明原因；离线/5xx/未登录则进发件箱等补发。
   */
  const addFoodByPortion = useCallback(
    async (food: Food, amount: number, targetDate: string): Promise<boolean> => {
      if (!Number.isFinite(amount) || amount <= 0) return false;
      const scaled = scaleNutrition(food, amount);
      const localId = nextLocalId();
      const body: MealEntryInput = {
        date: targetDate,
        meal,
        name: food.name,
        amount,
        unit: food.unit,
        ...scaled,
        foodId: food.id,
      };
      const op = makeCreateOp(body, localId);
      /**
       * 只在"记的就是当前正在看的那天"时做乐观入账：
       * 「+ 今日」允许在翻看历史日期时记到今天，这时把条目塞进当前列表会闪一下错日期的行。
       */
      if (targetDate === date) {
        setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
        setPendingIds((prev) => [...prev, localId]);
      }
      const outcome = await submitOp(op);
      if (outcome.ok) {
        // 只有真的记上了才记「上次分量」，否则用户下次会被一次失败的尝试带偏
        rememberPortion(food.name, amount, food.unit);
        haptics.success();
        flashAdded(food.id);
        await load();
        return true;
      }
      if (!isRetryable(outcome)) {
        // 失败回滚：撤回乐观入账，别让用户以为已经记上了
        setEntries((prev) => prev.filter((e) => e.id !== localId));
        setPendingIds((prev) => prev.filter((id) => id !== localId));
        Alert.alert("这条没有记上", outcome.message ?? "服务端拒绝了这条记录，请稍后重试。");
        return false;
      }
      // 离线 / 5xx / 未登录：先落本机（发件箱），分量记忆也随之更新
      rememberPortion(food.name, amount, food.unit);
      const next = enqueue(outbox, op);
      setOutbox(next);
      await saveOutbox(next);
      haptics.success();
      flashAdded(food.id);
      if (outcome.kind === "auth") Alert.alert("已记在本机", "登录后会自动同步到云端。");
      return true;
    },
    [date, flashAdded, load, meal, outbox, rememberPortion, submitOp]
  );

  /** 「以往添加的食物」：recent 接口已按「最近使用」排序，这里只保留真的吃过的（times > 0） */
  const recentFoods = useMemo(() => {
    const eaten = foods.filter((f) => (f.times ?? 0) > 0);
    // 接口没回频次时（旧数据/异常）退回前几个，至少别让这组空着
    return (eaten.length > 0 ? eaten : foods).slice(0, 8);
  }, [foods]);

  /** 某种食物「上次分量」：本机记忆优先，没有就按 1 个默认单位（需求 3 的「含上次分量」） */
  const lastPortionOf = useCallback(
    (food: Food): PortionMemoEntry => portionMemo[food.name.trim()] ?? { amount: 1, unit: food.unit },
    [portionMemo]
  );

  /** 每日推荐（需求 2）：同一天稳定、跨天轮换（见 lib/recipes.ts 的日期种子） */
  const dailyPicks = useMemo(() => dailyRecipes(date), [date]);

  /** 启动时读回本机「上次分量」（需求 3）；读不到/损坏一律按空处理，等价于「都按 1 份」 */
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PORTION_MEMO_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return;
        const memo: Record<string, PortionMemoEntry> = {};
        for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
          const v = value as Partial<PortionMemoEntry> | null;
          const amount = Number(v?.amount);
          if (!name.trim() || !Number.isFinite(amount) || amount <= 0) continue;
          memo[name] = { amount, unit: typeof v?.unit === "string" && v.unit.trim() ? v.unit : "份" };
        }
        portionMemoRef.current = memo;
        setPortionMemo(memo);
      } catch {
        // 读不到就当作没有记忆（默认 1 份）
      }
    })();
  }, []);

  /** 从常用食物添加：默认 1 份，立即入账（v3 M4 一点即记）；离线时进发件箱 */
  const quickAdd = async (food: Food) => {
    const localId = nextLocalId();
    const body: MealEntryInput = {
      date,
      meal,
      name: food.name,
      amount: 1,
      unit: food.unit,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      foodId: food.id,
    };
    const op = makeCreateOp(body, localId);
    // 顺手记住这次用的分量（1 份），下次「以往添加的食物」里的「+ 今日」按它入账
    rememberPortion(food.name, 1, food.unit);
    // 乐观入账：先显示，再上传
    setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
    setPendingIds((prev) => [...prev, localId]);
    haptics.success();

    const outcome = await submitOp(op);
    if (outcome.ok) {
      await load();
      return;
    }
    if (!isRetryable(outcome)) {
      // 服务端明确拒绝（4xx 校验/参数问题）：重试永远不会成功 → 撤回乐观入账并说明原因
      setEntries((prev) => prev.filter((e) => e.id !== localId));
      setPendingIds((prev) => prev.filter((id) => id !== localId));
      Alert.alert("这条没有记上", outcome.message ?? "服务端拒绝了这条记录，请稍后重试。");
      return;
    }
    // 离线 / 服务端错误 / 未登录：静默进发件箱，列表里的「待同步」标记就是唯一提示
    setOutbox((prev) => {
      const next = enqueue(prev, op);
      void saveOutbox(next);
      return next;
    });
    if (outcome.kind === "auth") {
      Alert.alert("已记在本机", "登录后会自动同步到云端。");
    }
  };

  /** 手动录入一条 */
  const addManual = async () => {
    const name = manual.name.trim();
    if (!name) {
      Alert.alert("请填写食物名称");
      return;
    }
    setSaving(true);
    try {
      const localId = nextLocalId();
      const body: MealEntryInput = {
        date,
        meal,
        name,
        unit: manual.unit.trim() || "份",
        amount: 1,
        kcal: Number(manual.kcal) || 0,
        proteinG: Number(manual.proteinG) || 0,
        carbsG: Number(manual.carbsG) || 0,
        fatG: Number(manual.fatG) || 0,
      };
      const op = makeCreateOp(body, localId);
      const outcome = await submitOp(op);
      if (!outcome.ok && !isRetryable(outcome)) {
        Alert.alert("这条没有记上", outcome.message ?? "服务端拒绝了这条记录。");
        return;
      }
      if (!outcome.ok) {
        // 离线 / 服务端错误 / 未登录：先落本机再补发。
        // ⚠️ 这条分支**不能**调 load()：服务端列表里没有它，load 会把乐观入账覆盖掉
        //（真机「提示成功但页面没有、数据仍 0」的根因，见看板踩坑 80）。
        setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
        setPendingIds((prev) => [...prev, localId]);
        const next = enqueue(outbox, op);
        setOutbox(next);
        await saveOutbox(next);
        haptics.success();
        closeSheet();
        if (outcome.kind === "auth") Alert.alert("已记在本机", "登录后会自动同步到云端。");
        return;
      }
      if (saveAsCommon) {
        const fr = await fetch(getApiUrl() + "/api/nutrition/foods", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            name,
            unit: body.unit,
            kcal: body.kcal,
            proteinG: body.proteinG,
            carbsG: body.carbsG,
            fatG: body.fatG,
          }),
        });
        if (!fr.ok) Alert.alert("已记录，但保存常用食物失败", "请登录后再保存常用食物");
      }
      haptics.success();
      closeSheet();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    // 尚未上传的本地记录：直接从发件箱撤掉
    if (id < 0) {
      const next = enqueue(outbox, makeDeleteOp(id));
      setOutbox(next);
      await saveOutbox(next);
      setEntries((prev) => prev.filter((x) => x.id !== id));
      setPendingIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    setEntries((prev) => prev.filter((x) => x.id !== id));
    const outcome = await submitOp(makeDeleteOp(id));
    // 404 = 服务端本来就没有这条（可能已被别处删掉），按成功处理
    if (outcome.ok || (!outcome.ok && outcome.status === 404)) {
      haptics.warning();
      await load();
      return;
    }
    if (!isRetryable(outcome)) {
      Alert.alert("删除失败", outcome.message ?? "服务端拒绝了这次删除。");
      await load();
      return;
    }
    const next = enqueue(outbox, makeDeleteOp(id));
    setOutbox(next);
    await saveOutbox(next);
    if (outcome.kind === "auth") Alert.alert("已在本机删除", "登录后会自动同步到云端。");
  };

  /** 保存编辑（食物型条目只改份量 → 服务端重算营养） */
  const saveEdit = async (update: MealUpdate) => {
    const id = update.id;
    setSaving(true);
    // 乐观更新本地列表
    const food = foods.find((f) => f.id === (editing?.foodId ?? -1)) ?? null;
    const scaled = food && update.amount !== undefined
      ? {
          kcal: Math.round(food.kcal * update.amount * 10) / 10,
          proteinG: Math.round(food.proteinG * update.amount * 10) / 10,
          carbsG: Math.round(food.carbsG * update.amount * 10) / 10,
          fatG: Math.round(food.fatG * update.amount * 10) / 10,
        }
      : {};
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...update, ...scaled } : e))
    );
    setEditing(null);
    try {
      if (id < 0) {
        // 本地未上传：合并进发件箱的 create
        const { id: _drop, ...body } = update;
        void _drop;
        const next = enqueue(outbox, makeUpdateOp(id, body));
        setOutbox(next);
        await saveOutbox(next);
        haptics.success();
        return;
      }
      const { id: _drop2, ...body } = update;
      void _drop2;
      const outcome = await submitOp(makeUpdateOp(id, body));
      if (outcome.ok) {
        haptics.success();
        await load();
        return;
      }
      if (!isRetryable(outcome)) {
        Alert.alert("保存失败", outcome.message ?? "服务端拒绝了这次修改。");
        await load();
        return;
      }
      const next = enqueue(outbox, makeUpdateOp(id, body));
      setOutbox(next);
      await saveOutbox(next);
      if (outcome.kind === "auth") Alert.alert("已在本机保存", "登录后会自动同步到云端。");
    } finally {
      setSaving(false);
    }
  };

  const visibleFoods = foods.filter(
    (f) => !foodQuery.trim() || f.name.toLowerCase().includes(foodQuery.trim().toLowerCase())
  );

  /* ---------- P3：饮水 / 体重 / 目标 ---------- */

  const onAddWater = async (amountMl: number) => {
    haptics.light();
    setHydration((prev) => ({ ...prev, totalMl: prev.totalMl + amountMl }));
    setWellnessBusy(true);
    try {
      await addHydration(token, amountMl);
      const fresh = await fetchHydration(token);
      const lastLog = fresh.logs.length > 0 ? fresh.logs[fresh.logs.length - 1] : null;
      setHydration({
        totalMl: fresh.totalMl,
        targetMl: fresh.targetMl,
        lastId: lastLog ? lastLog.id : null,
        lastTime: lastLog ? lastLog.recordedAt : null,
      });
    } catch {
      Alert.alert("记录失败", "联网后再试一次");
      await load();
    } finally {
      setWellnessBusy(false);
    }
  };

  const onUndoWater = async () => {
    if (!hydration.lastId) return;
    setWellnessBusy(true);
    try {
      await removeHydration(token, hydration.lastId);
      const fresh = await fetchHydration(token);
      const lastLog = fresh.logs.length > 0 ? fresh.logs[fresh.logs.length - 1] : null;
      setHydration({
        totalMl: fresh.totalMl,
        targetMl: fresh.targetMl,
        lastId: lastLog ? lastLog.id : null,
        lastTime: lastLog ? lastLog.recordedAt : null,
      });
    } catch {
      Alert.alert("撤销失败");
    } finally {
      setWellnessBusy(false);
    }
  };

  const onAddWeight = async (weightKg: number) => {
    setWellnessBusy(true);
    try {
      await addWeight(token, weightKg);
      const fresh = await fetchWeight(token, 30);
      setWeightPoints(fresh.points);
      haptics.success();
    } catch {
      Alert.alert("记录失败", "联网后再试一次");
    } finally {
      setWellnessBusy(false);
    }
  };

  const onSaveTarget = async (next: TargetProfileInput) => {
    setSaving(true);
    try {
      const { profile: p, target: t } = await saveNutritionTarget(token, {
        weightKg: next.weightKg ?? undefined,
        heightCm: next.heightCm,
        birthYear: next.birthYear,
        sex: next.sex,
        activityLevel: next.activityLevel,
        kcal: next.kcal,
      });
      setProfile(p);
      setServerTarget(t);
      setTargetOpen(false);
      haptics.success();
    } catch {
      Alert.alert("保存失败", "请确认网络可用");
    } finally {
      setSaving(false);
    }
  };

  const macroItems: MacroRingItem[] = useMemo(
    () => [
      {
        key: "proteinG",
        label: "蛋白",
        value: totals.proteinG,
        target: target.proteinG,
        range: nutritionTargetRange(target.proteinG),
        color: MACRO_COLORS.proteinG,
      },
      {
        key: "carbsG",
        label: "碳水",
        value: totals.carbsG,
        target: target.carbsG,
        range: nutritionTargetRange(target.carbsG),
        color: MACRO_COLORS.carbsG,
      },
      {
        key: "fatG",
        label: "脂肪",
        value: totals.fatG,
        target: target.fatG,
        range: nutritionTargetRange(target.fatG),
        color: MACRO_COLORS.fatG,
      },
    ],
    [target.carbsG, target.fatG, target.proteinG, totals.carbsG, totals.fatG, totals.proteinG]
  );

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title={isToday ? "今日饮食" : "饮食记录"} scrollY={headerScroll.scrollY} />
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl {...control} />}
    >
      <ScreenHeaderLargeTitle
        title={isToday ? "今日饮食" : "饮食记录"}
        subtitle={isToday ? `已记录 ${entries.length} 条 · 目标 ${target.kcal} kcal` : `${date} · ${entries.length} 条`} />

      {/* v11 P2（参考图 4）：餐次彩色卡组 + 近 7 天热量条 */}
      <MealCardGrid
        cards={mealCards}
        week={weekStrip}
        weekRange={weekRangeLabel(date)}
        onAdd={(nextMeal) => {
          setMeal(nextMeal);
          setSheetOpen(true);
        }}
        onPickDay={(key) => setDate(key)}
        onPrevWeek={() => shiftWeek(-1)}
        onNextWeek={isCurrentWeek(date, todayKey) ? undefined : () => shiftWeek(1)}
      />

      {/* 需求 2：每日推荐 —— 按日期确定性轮换（同一天稳定、跨天变化），
          与下方「精选食谱」分工：这里回答"今天吃什么"，那里看配料与做法 */}
      {dailyPicks.length > 0 ? (
        <View style={styles.dailyWrap}>
          <SectionHeader
            title="每日推荐"
            subtitle={`按日期确定性轮换 · ${isToday ? "今天" : dayLabel(date, todayKey)}内不变`}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dailyRow}
            nestedScrollEnabled
          >
            {dailyPicks.map(({ meal: pickMeal, recipe }) => {
              const accent = mealAccentColor(pickMeal, colors);
              return (
                <View
                  key={`${pickMeal}-${recipe.id}`}
                  accessible
                  accessibilityLabel={`${mealKindLabels[pickMeal]}推荐：${recipe.name}，${recipe.kcal} 千卡`}
                  style={styles.dailyCard}
                >
                  <View style={styles.dailyTop}>
                    <Text style={[styles.dailyMeal, { color: accent }]}>{mealKindLabels[pickMeal]}</Text>
                    <View style={[styles.dailyTag, { backgroundColor: accent + "1A" }]}>
                      <Text style={[styles.dailyTagText, { color: accent }]}>{recipe.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.dailyName} numberOfLines={2}>{recipe.name}</Text>
                  <Text style={styles.dailyKcal}>{recipe.kcal} kcal</Text>
                  <Text style={styles.dailyMacro}>
                    P{recipe.proteinG} C{recipe.carbsG} F{recipe.fatG} · {recipe.minutes} 分钟
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 2026-10 扩充：与 Web 共用的精选食谱 */}
      <RecipeShelf />

      {/* v4 P4-a：日 / 周 / 月 视图切换（圆角胶囊分段控件，参考「吃一点」顶部那条） */}
      <View style={styles.segment}>
        {(
          [
            { key: "day", label: "日" },
            { key: "week", label: "周" },
            { key: "month", label: "月" },
          ] as const
        ).map((o) => {
          const active = viewMode === o.key;
          return (
            <Pressable
              key={o.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => {
                haptics.soft();
                // 切到「月」时对齐当前所选日期的月份，符合"我正在看哪天就展开哪个月"的预期
                if (o.key === "month") {
                  setMonthView({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
                }
                // 切到「周」时把日期条翻到包含所选日期的那一周（否则会停在今天那周且没有格子高亮）
                if (o.key === "week") {
                  setWeekOffset(weeksAgo(date, todayKey, DAY_STRIP_MAX_WEEKS));
                }
                setViewMode(o.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 日视图：今天 / 昨天 快捷胶囊 + 自定义日期（复用月历弹层） */}
      {viewMode === "day" ? (
        <View style={styles.dayPills}>
          {[
            { key: todayKey, label: "今天" },
            { key: yesterdayKey, label: "昨天" },
          ].map((o) => {
            const active = date === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => {
                  haptics.soft();
                  setDate(o.key);
                }}
              >
                <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.dayPill}
            onPress={() => {
              haptics.soft();
              setDateSheetOpen(true);
            }}
          >
            <Text style={styles.dayPillText}>{date === todayKey || date === yesterdayKey ? "选择日期" : dayLabel(date, todayKey)}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* v4 P4-b 顶部摘要胶囊：把「摄入 / 剩余（或日均）/ 饮水或记录天数」收敛成一行，
          首屏只保留一个强视觉块（下面的热量 Hero），避免多个 hero 互相抢焦点 */}
      <View style={styles.summaryPill}>
        <View style={styles.summaryItem}>
          {/* v19-M2：摘要数字滚动（400ms），切日/周/月时平滑过渡 */}
          <AnimatedNumber
            style={styles.summaryValue}
            value={viewMode === "day" ? Math.round(totals.kcal) : viewMode === "week" ? weekSummary.kcal : monthSummary.kcal}
          />
          <Text style={styles.summaryLabel}>
            {viewMode === "day" ? "已摄入 kcal" : viewMode === "week" ? "本周 kcal" : "本月 kcal"}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <AnimatedNumber
            style={[styles.summaryValue, viewMode === "day" && overBudget && { color: colors.danger }]}
            value={
              viewMode === "day"
                ? Math.abs(remaining)
                : viewMode === "week"
                  ? weekSummary.avgKcal
                  : monthSummary.avgKcal
            }
          />
          <Text style={styles.summaryLabel}>
            {viewMode === "day" ? (overBudget ? "已超出 kcal" : "还能吃 kcal") : "日均 kcal"}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <AnimatedNumber
            style={styles.summaryValue}
            value={
              viewMode === "day"
                ? hydration.totalMl
                : viewMode === "week"
                  ? weekSummary.daysLogged
                  : monthSummary.daysLogged
            }
          />
          <Text style={styles.summaryLabel}>{viewMode === "day" ? "饮水 ml" : "记录天数"}</Text>
        </View>
        <Pressable
          style={styles.summaryAdd}
          onPress={() => {
            haptics.soft();
            openSheet();
          }}
          accessibilityLabel={`添加${mealKindLabels[mealNow]}`}
        >
          <ThemedIcon name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* v1.45 进阶入口：趋势（升级为独立全屏页 /trends）、水杯、LiveLog。
          做成一行**低权重胶囊**而不是卡片：既让功能可发现，又不会在首屏和热量 Hero 抢焦点。 */}
      <View style={styles.advancedRow}>
        <Pressable
          style={styles.advancedChip}
          onPress={() => {
            haptics.soft();
            router.push("/trends" as never);
          }}
          accessibilityLabel="打开趋势分析"
        >
          <ThemedIcon name="stats-chart-outline" size={15} color={colors.primary} />
          <Text style={styles.advancedText}>趋势</Text>
        </Pressable>
        {viewMode === "day" && isToday ? (
          <Pressable
            style={styles.advancedChip}
            onPress={() => {
              haptics.soft();
              setCupOpen(true);
            }}
            accessibilityLabel="打开水杯"
          >
            <ThemedIcon name="water-outline" size={15} color={colors.teal} />
            <Text style={styles.advancedText}>水杯</Text>
            <Text style={styles.advancedMeta}>{hydration.totalMl}</Text>
          </Pressable>
        ) : null}
        {viewMode === "day" ? (
          <Pressable
            style={styles.advancedChip}
            onPress={() => {
              haptics.soft();
              setLiveOpen(true);
            }}
            accessibilityLabel="打开 LiveLog 贴纸画布"
          >
            <ThemedIcon name="sparkles-outline" size={15} color={colors.accent} />
            <Text style={styles.advancedText}>LiveLog</Text>
          </Pressable>
        ) : null}
      </View>

      {/* M2 日期条：周视图的一排（可回看 4 周，今天用能量橙描边） */}
      {viewMode === "week" ? (
        <DayStrip
          selected={date}
          onSelect={setDate}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          doneMap={doneMap}
          todayKey={todayKey}
        />
      ) : null}

      {/* 周视图：这一周的区间汇总 */}
      {viewMode === "week" ? (
        <Card style={styles.rangeCard}>
          <Text style={styles.rangeTitle}>
            {weekSummary.daysLogged > 0 ? `这一周记录了 ${weekSummary.daysLogged} 天` : "这一周还没有记录"}
          </Text>
          <Text style={styles.rangeMeta}>
            {weekSummary.kcal} kcal · 日均 {weekSummary.avgKcal} kcal
            {weekSummary.daysLogged > 0
              ? ` · P${weekSummary.proteinG} C${weekSummary.carbsG} F${weekSummary.fatG}`
              : ""}
          </Text>
        </Card>
      ) : null}

      {/* 月视图：整月日历 + 每格当天 kcal 汇总（点某天 → 回日视图看那天） */}
      {viewMode === "month" ? (
        <>
          <Card style={styles.monthCard}>
            <MonthCalendar
              key={`${monthView.y}-${monthView.m}`}
              selected={fromDateKey(date)}
              initialView={monthView}
              onViewChange={setMonthView}
              onSelect={(d) => {
                haptics.soft();
                setDate(toDateKey(d));
                setViewMode("day");
              }}
              onClose={() => {
                // 月视图是内联的日历，选中即切日视图，无需关闭动作
              }}
              renderDayBadge={(key) => {
                const row = daySummary[key];
                if (!row) return null;
                return <Text style={styles.calBadgeText}>{compactKcal(row.kcal)}</Text>;
              }}
            />
          </Card>
          <Card style={styles.rangeCard}>
            <Text style={styles.rangeTitle}>
              {monthSummary.daysLogged > 0
                ? `${monthView.y} 年 ${monthView.m + 1} 月：记录了 ${monthSummary.daysLogged} 天`
                : `${monthView.y} 年 ${monthView.m + 1} 月还没有记录`}
            </Text>
            <Text style={styles.rangeMeta}>
              {monthSummary.kcal} kcal · 日均 {monthSummary.avgKcal} kcal
              {monthSummary.daysLogged > 0
                ? ` · P${monthSummary.proteinG} C${monthSummary.carbsG} F${monthSummary.fatG}`
                : ""}
            </Text>
            <Text style={styles.rangeHint}>点日期格子可以查看那一天的记录</Text>
          </Card>
        </>
      ) : null}

      {/* M1 热量 Hero：主角是「今天还能吃多少」——只在日视图出现（每屏唯一 hero） */}
      {viewMode === "day" ? (
      <>
      <GlassSurface corner={24} style={styles.hero}>
        <ProgressArc
          progress={ringProgress}
          size={132}
          strokeWidth={12}
          overBudget={overBudget}
          beatOnChange
          pulseKey={date}
          value={`${Math.round(ringProgress * 100)}%`}
          label="已完成"
        />
        <View style={styles.heroRight}>
          <Text style={styles.heroCaption}>
            {overBudget ? "已超出" : isToday ? "今天还能吃" : `${dayLabel(date, todayKey)}还能吃`}
          </Text>
          <View style={styles.heroValueRow}>
            <AnimatedNumber
              value={Math.abs(remaining)}
              style={[styles.heroValue, overBudget && { color: colors.danger }]}
              accessibilityLabel={`${overBudget ? "已超出" : "今天还能吃"} ${Math.abs(remaining)} 千卡`}
            />
            <Text style={styles.heroUnit}>kcal</Text>
          </View>
          <Text style={styles.heroHint} numberOfLines={2}>
            {overBudget
              ? "超一点没关系，明天正常吃就好"
              : remaining > 0
                ? kcalEquivalentText(remaining)
                : "刚好达标，收工"}
          </Text>
          <Pressable
            onPress={() => {
              haptics.soft();
              setTargetOpen(true);
            }}
            hitSlop={6}
            style={styles.targetRow}
          >
            <Text style={styles.targetText}>
              已吃 {totals.kcal} · 目标 {target.kcal}
              {target.computed ? "（按身体数据）" : ""}
            </Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
          </Pressable>
        </View>
      </GlassSurface>
      </>
      ) : null}

      {/* v6 P0-3：待同步状态条 —— 未上传的条目始终可见，且可一键重试 */}
      {pendingCount(outbox) > 0 ? (
        <Pressable
          onPress={() => void retryPending()}
          style={styles.syncBar}
          accessibilityLabel="重试同步待上传的饮食记录"
        >
          <ThemedIcon name="refresh" size={15} color={colors.accentStrong} />
          <Text style={styles.syncBarText}>{pendingCount(outbox)} 条待同步 · 点此重试</Text>
        </Pressable>
      ) : null}

      {viewMode === "month" ? null : (
        <PressableScale haptic style={styles.addBtn} onPress={openSheet}>
          <ThemedIcon name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>添加{mealKindLabels[mealNow]}</Text>
        </PressableScale>
      )}

      {/* M3 餐次时间线（月视图只看日历与汇总，不铺明细） */}
      {viewMode === "month" ? null : loading && entries.length === 0 ? (
        <SkeletonList count={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title={isToday ? "今天还没有记录" : "这天没有记录"}
          hint="从常用食物一点即记，或手动填写营养"
        />
      ) : (
        MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m);
          if (list.length === 0) return null;
          const mealKcal = sumNutrition(list).kcal;
          const share = MEAL_KCAL_SHARES[m];
          const mealTarget = Math.round(target.kcal * share);
          const mealPct = mealTarget > 0 ? Math.min(1, mealKcal / mealTarget) : 0;
          return (
            <View key={m} style={styles.mealBlock}>
              <View style={styles.mealHead}>
                <Text style={styles.mealTitle}>{mealKindLabels[m]}</Text>
                <Text style={styles.mealMeta}>
                  {mealKcal} / {mealTarget} kcal · {Math.round(share * 100)}%
                </Text>
              </View>
              {/* v19-M2：餐次进度条动画化（240ms 缓动），随记录增减平滑变化 */}
              <ProgressBar
                progress={Math.min(1, Number.isFinite(mealPct) ? mealPct : 0)}
                height={5}
                color={mealPct >= 1 ? colors.success : colors.accent}
                style={styles.mealTrack}
              />
              <View style={styles.timeline}>
                {list.map((e, i) => {
                  const time = formatEntryTime(e.createdAt);
                  const isPending = e.id < 0 || hasPendingFor(outbox, e.id) || pendingIds.includes(e.id);
                  return (
                    <Animated.View key={e.id} entering={FadeInUp.duration(180)} layout={LinearTransition.duration(180)}>
                      <SwipeRow
                        onDelete={() => {
                          void remove(e.id);
                        }}
                        deleteLabel="删除"
                      >
                        <Pressable
                          onPress={() => {
                            haptics.soft();
                            setEditing(e);
                          }}
                          style={styles.entryRow}
                          accessibilityLabel={`修改 ${e.name}`}
                        >
                          <View style={styles.rail}>
                            <View style={[styles.node, isPending && { backgroundColor: colors.textFaint }]} />
                            {i !== list.length - 1 ? <View style={styles.line} /> : null}
                          </View>
                          {/* 「吃一点」式行结构：左侧「日期 时间」品牌绿 → 食物名 → 单位/营养素，
                              贴纸与 kcal 放到右侧（贴纸角上的橙色数字） */}
                          <View style={styles.entryBody}>
                            <Text style={styles.entryWhen} numberOfLines={1}>
                              {dayLabel(date, todayKey)}
                              {time ? ` ${time}` : ""}
                              {isPending ? " · 待同步" : ""}
                            </Text>
                            <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                            <Text style={styles.entryMeta} numberOfLines={1}>
                              {e.amount} {e.unit} · P{Math.round(e.proteinG)} C{Math.round(e.carbsG)} F{Math.round(e.fatG)}
                            </Text>
                          </View>
                          <View style={styles.entrySticker}>
                            <FoodSticker name={e.name} size={52} outlined rotate={i % 2 === 0 ? -6 : 5} />
                            <View style={styles.entryKcal}>
                              <KcalBadge kcal={e.kcal} size="sm" bare />
                            </View>
                          </View>
                        </Pressable>
                      </SwipeRow>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}

      {/* 日视图的次要卡片（三大营养素 / 饮水 / 体重）**放在时间线之后**：
          首屏先给"还能吃 + 吃了什么"（借「吃一点」的信息优先级），这些日常打卡往下排一行，
          既满足"每屏唯一强视觉块"，也避免首屏被四张卡挤满。 */}
      {viewMode === "day" ? (
        <>
          <Card style={styles.macroCard}>
            <MacroMiniRings items={macroItems} />
          </Card>
          {isToday ? (
            <>
              <WaterCard
                totalMl={hydration.totalMl}
                targetMl={hydration.targetMl}
                lastLogId={hydration.lastId}
                busy={wellnessBusy}
                onAdd={(ml) => void onAddWater(ml)}
                onUndo={() => void onUndoWater()}
              />
              <WeightCard
                points={weightPoints.map((p) => ({ date: p.date, weightKg: p.weightKg }))}
                heightCm={profile?.heightCm ?? null}
                busy={wellnessBusy}
                onAdd={() => {
                  const latest = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].weightKg : (profile?.weightKg ?? 60);
                  setWeightDraft(String(Math.round(latest * 10) / 10));
                  setWeightOpen(true);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* M9 我的饮食日记：当天贴纸（点一下 = 再记一份），完整收集册在弹层里；月视图不显示 */}
      {viewMode !== "month" && stickers.length > 0 ? (
        <Card style={styles.stickerCard}>
          <SectionHeader
            title="我的饮食日记"
            subtitle={`今天收集了 ${stickers.length} 种食物`}
            actionLabel="收集册"
            onAction={() => {
              haptics.soft();
              setBookOpen(true);
            }}
          />
          <View style={styles.stickerGrid}>
            {stickers.map((s) => (
              <Pressable
                key={s.name}
                onPress={() => {
                  const food = foods.find((f) => f.name === s.name);
                  if (food) {
                    void quickAdd(food);
                    return;
                  }
                  haptics.soft();
                  setManual((prev) => ({ ...prev, name: s.name, kcal: String(Math.round(s.kcal)) }));
                  openSheet();
                }}
                style={styles.stickerCell}
                accessibilityLabel={`再记一份 ${s.name}`}
              >
                <FoodSticker name={s.name} size={44} />
                <Text style={styles.stickerName} numberOfLines={1}>{s.name}</Text>
                {s.times > 1 ? <Text style={styles.stickerTimes}>×{s.times}</Text> : null}
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {/* 日视图的「选择日期」：复用同一个 MonthCalendar（与学习统计页行为一致） */}
      <BottomSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        title="选择日期"
        height="60%"
      >
        <MonthCalendar
          selected={fromDateKey(date)}
          onSelect={(d) => setDate(toDateKey(d))}
          onClose={() => setDateSheetOpen(false)}
        />
      </BottomSheet>

      <StickerBookSheet
        visible={bookOpen}
        reloadKey={entries.length}
        onClose={() => setBookOpen(false)}
        onPick={(name, avgKcal) => {
          const food = foods.find((f) => f.name === name);
          if (food) {
            void quickAdd(food);
            return;
          }
          // 不在常用库里：带着名字与平均热量打开手动表单（今天先落账）
          setManual((prev) => ({ ...prev, name, kcal: String(Math.round(avgKcal)) }));
          setBookOpen(false);
          openSheet();
        }}
      />

      {/* v4 P4-c：水杯（液面动画 + 快捷水量） */}
      <BottomSheet
        visible={cupOpen}
        onClose={() => setCupOpen(false)}
        title="今日饮水"
        height="86%"
        scroll={false}
      >
        <WaterCupSheet
          visible={cupOpen}
          totalMl={hydration.totalMl}
          targetMl={hydration.targetMl}
          lastLogId={hydration.lastId}
          lastTime={hydration.lastTime}
          busy={wellnessBusy}
          onAdd={(ml) => void onAddWater(ml)}
          onUndo={() => void onUndoWater()}
        />
      </BottomSheet>

      {/* v4 P4-c：LiveLog 贴纸画布（本机保存） */}
      <LiveLogSheet visible={liveOpen} onClose={() => setLiveOpen(false)} names={liveNames} />

      <BottomSheet visible={sheetOpen} onClose={closeSheet} title="添加饮食" height="86%" expandable>
        <View style={styles.form}>
          <Text style={styles.label}>餐次</Text>
          <View style={styles.kindRow}>
            {MEALS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMeal(m)}
                style={[styles.kindChip, meal === m && styles.kindChipActive]}
              >
                <Text style={[styles.kindChipText, meal === m && styles.kindChipTextActive]}>{mealKindLabels[m]}</Text>
              </Pressable>
            ))}
          </View>

          {/* v6 P1-3：搜索提到最前 —— 先查营养基准库（模糊匹配 → 输入克数换算），再是常用食物网格 */}
          <Field
            value={foodQuery}
            onChangeText={setFoodQuery}
            placeholder="搜索食物（如 番茄鸡蛋面 / 鸡旦）"
            returnKeyType="search"
            autoCapitalize="none"
          />

          {foodQuery.trim().length > 0 ? (
            <View style={styles.dbBlock}>
              <SectionHeader
                title="营养库匹配"
                subtitle={dbLoading ? "搜索中…" : "选一条 → 填实际摄入量"}
                style={styles.sheetSection}
              />
              {pickedItem ? (
                <View style={styles.itemCard}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemName} numberOfLines={1}>{pickedItem.name}</Text>
                    <Pressable hitSlop={8} onPress={() => setPickedItem(null)} accessibilityLabel="返回搜索结果">
                      <ThemedIcon name="close-circle" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                  <Text style={styles.itemMeta}>
                    {formatBasisLabel(pickedItem)} · {Math.round(pickedItem.kcal)} kcal
                    {pickedItem.category ? ` · ${pickedItem.category}` : ""}
                  </Text>
                  <View style={styles.gramsRow}>
                    <Field
                      label="实际摄入量"
                      value={itemGrams}
                      onChangeText={setItemGrams}
                      keyboardType="numeric"
                      placeholder={String(pickedItem.basisAmount)}
                      containerStyle={styles.gramsField}
                    />
                    <Text style={styles.gramsUnit}>{pickedItem.basisUnit}</Text>
                  </View>
                  {/* 需求 1：按「基准量（如每 100g）」的倍数选分量，点一下下面那行预览立刻重算 */}
                  <View style={styles.gramsQuick}>
                    {[0.5, 1, 1.5, 2].map((multiplier) => {
                      const base = Number(pickedItem.basisAmount) > 0 ? Number(pickedItem.basisAmount) : 100;
                      const grams = Math.round(base * multiplier * 10) / 10;
                      const active = Math.abs((Number(itemGrams) || 0) - grams) < 0.01;
                      return (
                        <Pressable
                          key={multiplier}
                          onPress={() => {
                            haptics.light();
                            setItemGrams(String(grams));
                          }}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${grams} ${pickedItem.basisUnit}`}
                          style={[styles.gramsChip, active && styles.gramsChipActive]}
                        >
                          <Text style={[styles.gramsChipText, active && styles.gramsChipTextActive]}>
                            {grams} {pickedItem.basisUnit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {itemScaled ? (
                    <Text style={styles.itemPreview}>
                      ≈ {Math.round(itemScaled.kcal)} kcal · P{itemScaled.proteinG} C{itemScaled.carbsG} F{itemScaled.fatG}
                    </Text>
                  ) : null}
                  <Button label={`添加到${mealKindLabels[meal]}`} icon="add" loading={saving} onPress={() => void addFromItem()} />
                </View>
              ) : (
                <>
                  {dbItems.map((it) => (
                    <PressableScale
                      key={it.id}
                      haptic
                      scaleTo={0.98}
                      style={styles.dbRow}
                      onPress={() => {
                        setPickedItem(it);
                        setItemGrams(String(it.basisAmount));
                      }}
                    >
                      <View style={styles.dbRowBody}>
                        <Text style={styles.dbName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.dbMeta} numberOfLines={1}>
                          {formatBasisLabel(it)} · {Math.round(it.kcal)} kcal
                          {it.category ? ` · ${it.category}` : ""}
                        </Text>
                      </View>
                      <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                    </PressableScale>
                  ))}
                  {!dbLoading && dbItems.length === 0 ? (
                    <Text style={styles.muted}>营养库没有匹配，可试试下方手动添加</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* 需求 1：分组收纳栏 —— 默认只展开「常用食物」，其余折叠；折叠标题上带条目数 */}
          <AccordionGroup
            id="common"
            title="常用食物"
            hint="点一下记 1 份 · 长按选分量"
            count={visibleFoods.length}
            open={!!openGroups.common}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {/* v6 P1-1：两列大图标网格（原来一食物一行太占地方） */}
            <View style={styles.foodGrid}>
              {visibleFoods.slice(0, 12).map((f) => (
                <PressableScale
                  key={f.id}
                  haptic
                  scaleTo={0.96}
                  onPress={() => void quickAdd(f)}
                  onLongPress={() => focusPortionRow(f)}
                  style={styles.foodCard}
                  accessibilityLabel={`记一份 ${f.name}`}
                >
                  <View style={styles.foodCardTop}>
                    <FoodSticker name={f.name} size={46} />
                    <ThemedIcon name="add-circle" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={styles.foodCardName} numberOfLines={2}>{f.name}</Text>
                  <Text style={styles.foodCardMeta} numberOfLines={1}>
                    {Math.round(f.kcal)} kcal · {f.unit}
                  </Text>
                </PressableScale>
              ))}
              {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试手动添加</Text> : null}
            </View>
            {visibleFoods.length > 12 ? (
              <Text style={styles.muted}>还有 {visibleFoods.length - 12} 种没铺出来：用上方搜索能直接找到</Text>
            ) : null}
          </AccordionGroup>

          {/* 需求 1：按分量添加 —— 选中分量时该行的热量与 P/C/F 立刻按「单位营养 × 分量」重算 */}
          <AccordionGroup
            id="portion"
            title="按分量添加"
            hint="选分量后热量与三大营养素实时重算"
            count={visibleFoods.length}
            open={!!openGroups.portion}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {visibleFoods.slice(0, 12).map((f) => {
              const options = portionOptions(f);
              const amountValue = portionById[f.id] ?? options[1]?.value ?? 1;
              const scaled = scaleNutrition(f, amountValue);
              const added = !!justAdded[f.id];
              return (
                <View key={f.id} style={styles.portionRow}>
                  <View style={styles.portionHead}>
                    <FoodSticker name={f.name} size={34} />
                    <View style={styles.portionBody}>
                      <Text style={styles.portionName} numberOfLines={1}>{f.name}</Text>
                      <Text style={styles.portionMeta} numberOfLines={1}>
                        每 {f.unit}：{Math.round(f.kcal)} kcal · P{f.proteinG} C{f.carbsG} F{f.fatG}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void addFoodByPortion(f, amountValue, date)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`添加 ${amountValue} ${f.unit} ${f.name} 到${mealKindLabels[meal]}`}
                      style={[styles.portionAdd, added && styles.portionAddDone]}
                    >
                      <ThemedIcon name={added ? "checkmark" : "add"} size={13} color={added ? colors.success : "#ffffff"} />
                      <Text style={[styles.portionAddText, added && styles.portionAddTextDone]}>
                        {added ? "已加入" : "添加"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.portionChips}>
                    {options.map((o) => {
                      const active = o.value === amountValue;
                      return (
                        <Pressable
                          key={o.value}
                          onPress={() => choosePortion(f.id, o.value)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${f.name} 选 ${o.label}`}
                          style={[styles.portionChip, active && styles.portionChipActive]}
                        >
                          <Text style={[styles.portionChipText, active && styles.portionChipTextActive]}>
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* 实时联动：每份营养 × 当前分量（scaleNutrition），不是只改标签 */}
                  <Text style={styles.portionPreview}>
                    ≈ {Math.round(scaled.kcal)} kcal · P{scaled.proteinG} C{scaled.carbsG} F{scaled.fatG}
                  </Text>
                </View>
              );
            })}
            {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试手动添加</Text> : null}
            {visibleFoods.length > 12 ? (
              <Text style={styles.muted}>还有 {visibleFoods.length - 12} 种没列出来：用上方搜索能直接找到</Text>
            ) : null}
          </AccordionGroup>

          {/* 需求 3：以往添加的食物 —— 右侧「+ 今日」按上次分量一键入账 */}
          <AccordionGroup
            id="history"
            title="以往添加的食物"
            hint={
              isToday
                ? `按上次分量，一键记到${mealKindLabels[meal]}`
                : `「+ 今日」始终记到今天；当前在看 ${dayLabel(date, todayKey)}`
            }
            count={recentFoods.length}
            open={!!openGroups.history}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {recentFoods.map((f) => {
              const last = lastPortionOf(f);
              const added = !!justAdded[f.id];
              return (
                <View key={f.id} style={styles.historyRow}>
                  <FoodSticker name={f.name} size={32} />
                  <View style={styles.historyBody}>
                    <Text style={styles.historyName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      上次 {last.amount} {last.unit}
                      {typeof f.times === "number" && f.times > 0 ? ` · 吃过 ${f.times} 次` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void addFoodByPortion(f, last.amount, todayKey)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`把 ${f.name} 加入今天记录`}
                    style={[styles.historyAdd, added && styles.historyAddDone]}
                  >
                    <ThemedIcon
                      name={added ? "checkmark" : "add"}
                      size={13}
                      color={added ? colors.success : colors.accentStrong}
                    />
                    <Text style={[styles.historyAddText, added && styles.historyAddTextDone]}>
                      {added ? "已加入" : "+ 今日"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {recentFoods.length === 0 ? (
              <Text style={styles.muted}>还没有吃过的记录：从上方常用食物开始记一条吧</Text>
            ) : null}
          </AccordionGroup>

          <AccordionGroup
            id="manual"
            title="手动添加"
            hint="只填名称与热量也能记一条"
            open={!!openGroups.manual}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            <Field
              label="名称"
              value={manual.name}
              onChangeText={(v) => setManual((s) => ({ ...s, name: v }))}
              placeholder="例如：食堂番茄鸡蛋面"
            />
            <View style={styles.macroInputRow}>
              <Field
                label="单位"
                value={manual.unit}
                onChangeText={(v) => setManual((s) => ({ ...s, unit: v }))}
                placeholder="份"
                containerStyle={styles.macroInput}
              />
              <Field
                label="热量 kcal"
                value={manual.kcal}
                onChangeText={(v) => setManual((s) => ({ ...s, kcal: v }))}
                keyboardType="numeric"
                placeholder="520"
                containerStyle={styles.macroInput}
              />
            </View>
            <View style={styles.macroInputRow}>
              <Field
                label="蛋白 g"
                value={manual.proteinG}
                onChangeText={(v) => setManual((s) => ({ ...s, proteinG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
              <Field
                label="碳水 g"
                value={manual.carbsG}
                onChangeText={(v) => setManual((s) => ({ ...s, carbsG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
              <Field
                label="脂肪 g"
                value={manual.fatG}
                onChangeText={(v) => setManual((s) => ({ ...s, fatG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
            </View>
            <Pressable style={styles.switchRow} onPress={() => setSaveAsCommon((v) => !v)}>
              <Switch value={saveAsCommon} onValueChange={setSaveAsCommon} trackColor={{ true: colors.primary }} />
              <Text style={styles.switchLabel}>存入常用食物（下次可直接选）</Text>
            </Pressable>
            <Button
              label="手动添加到这天"
              icon="create-outline"
              variant="secondary"
              loading={saving}
              onPress={() => void addManual()}
            />
          </AccordionGroup>
        </View>
      </BottomSheet>

      <MealEditSheet
        entry={editing}
        food={foods.find((f) => f.id === (editing?.foodId ?? -1)) ?? null}
        visible={!!editing}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={(u) => void saveEdit(u)}
        onDelete={(id) => {
          setEditing(null);
          void remove(id);
        }}
      />

      {/* 体重记录（Android 没有 Alert.prompt，用自研弹层） */}
      <BottomSheet visible={weightOpen} onClose={() => setWeightOpen(false)} title="记录体重" height="52%">
        <View style={styles.form}>
          <Text style={styles.label}>今日体重</Text>
          <View style={styles.weightRow}>
            <Pressable
              style={styles.weightStep}
              hitSlop={8}
              accessibilityLabel="减少 0.1kg"
              onPress={() => {
                haptics.light();
                setWeightDraft((v) => (Math.round((Number(v) - 0.1) * 10) / 10).toFixed(1));
              }}
            >
              <ThemedIcon name="remove" size={18} color={colors.primary} />
            </Pressable>
            <Field
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="numeric"
              placeholder="62.4"
              containerStyle={styles.weightField}
            />
            <Pressable
              style={styles.weightStep}
              hitSlop={8}
              accessibilityLabel="增加 0.1kg"
              onPress={() => {
                haptics.light();
                setWeightDraft((v) => (Math.round((Number(v) + 0.1) * 10) / 10).toFixed(1));
              }}
            >
              <ThemedIcon name="add" size={18} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.muted}>同一天重复记录会覆盖；写入后同步为卡路里估算用的体重。</Text>
          <Button
            label="保存体重"
            icon="checkmark"
            loading={wellnessBusy}
            onPress={() => {
              const n = Number(weightDraft);
              if (!Number.isFinite(n) || n <= 0) {
                Alert.alert("请输入有效体重");
                return;
              }
              setWeightOpen(false);
              void onAddWeight(n);
            }}
          />
        </View>
      </BottomSheet>

      <TargetSheet
        visible={targetOpen}
        profile={{
          weightKg: profile?.weightKg ?? null,
          heightCm: profile?.heightCm ?? null,
          birthYear: profile?.birthYear ?? null,
          sex: profile?.sex ?? null,
          activityLevel: profile?.activityLevel ?? null,
          kcal: null,
        }}
        note={target.note}
        computed={target.computed}
        preview={{ kcal: target.kcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG }}
        saving={saving}
        onClose={() => setTargetOpen(false)}
        onSave={(next) => void onSaveTarget(next)}
      />
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing.lg, gap: spacing.md },
    /* ---- v4 P4-a：日 / 周 / 月 视图控件 ---- */
    segment: {
      flexDirection: "row",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      padding: 3,
      gap: 2,
    },
    segmentItem: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 999 },
    /** 选中段用实底 + 轻投影，做出「滑块」的层次（参考图中日周月年那条） */
    segmentItemActive: { backgroundColor: colors.surfaceStrong, ...shadows.card },
    segmentText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    segmentTextActive: { color: colors.text, fontWeight: "800" },
    dayPills: { flexDirection: "row", gap: spacing.sm },
    dayPill: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dayPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayPillText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    dayPillTextActive: { color: "#ffffff" },
    /* ---- v4 P4-b：顶部摘要胶囊 ---- */
    summaryPill: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 999,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
      gap: spacing.md,
      ...shadows.card,
    },
    summaryItem: { flex: 1, minWidth: 0 },
    summaryValue: { ...typography.headline, fontWeight: "800", color: colors.text, ...tabularNums },
    summaryLabel: { ...typography.micro, color: colors.textMuted },
    summaryDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: colors.border },
    summaryAdd: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentStrong,
    },
    /* ---- v4 P4-c 进阶入口（低权重胶囊行） ---- */
    advancedRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    advancedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    advancedText: { ...typography.caption, color: colors.text, fontWeight: "700" },
    advancedMeta: { ...typography.micro, color: colors.teal, fontWeight: "800", ...tabularNums },
    /* ---- 周 / 月 区间汇总卡 ---- */
    rangeCard: { gap: 2 },
    rangeTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    rangeMeta: { ...typography.caption, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    rangeHint: { ...typography.micro, color: colors.textFaint, marginTop: 2 },
    monthCard: { paddingVertical: spacing.md },
    /** 月历格子下的当天热量汇总（有记录才显示） */
    calBadgeText: { ...typography.micro, fontSize: 10, fontWeight: "800", color: colors.accentStrong, ...tabularNums },
    hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.lg },
    heroRight: { flex: 1, minWidth: 0, gap: 2 },
    heroCaption: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    heroValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
    heroValue: {
      ...typography.display,
      fontSize: 38,
      lineHeight: 44,
      fontStyle: "italic",
      fontWeight: "800",
      letterSpacing: -1,
      color: colors.accent,
      ...tabularNums,
    },
    heroUnit: { ...typography.micro, color: colors.textMuted, marginBottom: 6 },
    heroHint: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    targetRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
    targetText: { ...typography.micro, color: colors.textFaint, ...tabularNums },
    macroCard: { paddingVertical: spacing.md },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      paddingVertical: 13,
    },
    addBtnText: { color: "#fff", ...typography.headline, fontWeight: "800" },
    /* v6 P0-3：待同步状态条 */
    syncBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      paddingVertical: 9,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    syncBarText: { ...typography.caption, fontWeight: "700", color: colors.accentStrong },
    mealBlock: { gap: 6 },
    mealHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    mealTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    mealMeta: { ...typography.micro, color: colors.textMuted, ...tabularNums },
    mealTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    mealFill: { height: 5, borderRadius: 999 },
    timeline: { marginTop: 6 },
    entryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    rail: { width: 10, alignItems: "center", alignSelf: "stretch" },
    node: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 16 },
    line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    entryBody: { flex: 1, minWidth: 0, gap: 2 },
    /** 行首「今天 18:42」：品牌绿（借「吃一点」的时间戳配色） */
    entryWhen: { ...typography.micro, fontWeight: "700", color: colors.success, ...tabularNums },
    entryName: { ...typography.headline, fontWeight: "700", color: colors.text },
    entryMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    /** 贴纸列：贴纸右下角挂 kcal 裸数字 */
    entrySticker: { width: 58, alignItems: "center", justifyContent: "center" },
    entryKcal: { position: "absolute", right: -2, bottom: -2 },
    form: { gap: 10, paddingTop: 6 },
    sheetSection: { marginTop: 6 },
    label: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: {
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    muted: { ...typography.micro, color: colors.textMuted },
    /* v6 P1-1：两列大图标网格（卡片约 48% 宽，图标 46，名称 2 行） */
    foodGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    foodCard: {
      width: "48%",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    foodCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    foodCardName: { ...typography.callout, fontWeight: "700", color: colors.text },
    foodCardMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    /* v6 P1-3：营养基准库搜索 + 克数录入 */
    dbBlock: { gap: 8 },
    dbRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dbRowBody: { flex: 1, minWidth: 0, gap: 2 },
    dbName: { ...typography.callout, fontWeight: "700", color: colors.text },
    dbMeta: { ...typography.micro, color: colors.textMuted, ...tabularNums },
    itemCard: {
      gap: 8,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    itemName: { flex: 1, minWidth: 0, ...typography.headline, fontWeight: "800", color: colors.text },
    itemMeta: { ...typography.caption, color: colors.textMuted, ...tabularNums },
    gramsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    gramsField: { flex: 1, minWidth: 0 },
    gramsUnit: { ...typography.callout, color: colors.textMuted, paddingBottom: 10 },
    gramsQuick: { flexDirection: "row", gap: 8 },
    gramsChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceStrong },
    gramsChipText: { ...typography.caption, fontWeight: "700", color: colors.primary, ...tabularNums },
    itemPreview: { ...typography.caption, fontWeight: "700", color: colors.accentStrong, ...tabularNums },
    macroInputRow: { flexDirection: "row", gap: 8 },
    macroInput: { flex: 1, minWidth: 0 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    switchLabel: { flex: 1, ...typography.callout, fontWeight: "600", color: colors.text },
    weightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    weightStep: {
      width: 40,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    weightField: { flex: 1, minWidth: 0 },
    stickerCard: { gap: spacing.sm },
    stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stickerCell: { alignItems: "center", gap: 2, width: 64 },
    stickerName: { ...typography.micro, fontSize: 10, color: colors.textMuted },
    stickerTimes: { ...typography.micro, fontSize: 10, fontWeight: "800", color: colors.accentStrong },
    /* ---- 需求 2：每日推荐（横向卡片，与「精选食谱」同色系但不抢焦点） ---- */
    dailyWrap: { gap: spacing.sm },
    dailyRow: { gap: spacing.sm, paddingRight: 4 },
    dailyCard: {
      width: 168,
      minHeight: 126,
      gap: 4,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    dailyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    dailyMeal: { ...typography.micro, fontWeight: "800" },
    dailyTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    dailyTagText: { ...typography.micro, fontWeight: "800" },
    dailyName: { ...typography.callout, fontWeight: "800", color: colors.text, lineHeight: 19 },
    dailyKcal: { ...typography.caption, fontWeight: "800", color: colors.accentStrong, ...tabularNums },
    dailyMacro: { ...typography.micro, fontWeight: "500", color: colors.textMuted, ...tabularNums },
    /* ---- 需求 1：折叠收纳栏（标题 + 条目数 + 展开态） ---- */
    group: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      overflow: "hidden",
    },
    groupHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 44,
    },
    groupTitleWrap: { flex: 1, minWidth: 0, gap: 1 },
    groupTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    groupHint: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    /** 折叠标题上的条目数：小圆角胶囊，读起来像"这组有多少条"而不是按钮 */
    groupCount: {
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
    },
    groupCountText: { ...typography.micro, fontWeight: "800", color: colors.textMuted, ...tabularNums },
    groupBody: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
    /* ---- 需求 1：按分量添加（行内选分量，热量与 P/C/F 实时联动） ---- */
    portionRow: {
      gap: 6,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    portionHead: { flexDirection: "row", alignItems: "center", gap: 9 },
    portionBody: { flex: 1, minWidth: 0, gap: 1 },
    portionName: { ...typography.callout, fontWeight: "700", color: colors.text },
    portionMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    portionChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    portionChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    portionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    portionChipText: { ...typography.micro, fontWeight: "700", color: colors.textMuted, ...tabularNums },
    portionChipTextActive: { color: "#ffffff" },
    portionAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 11,
      paddingVertical: 7,
      minHeight: 32,
      borderRadius: 999,
      backgroundColor: colors.accentStrong,
    },
    portionAddDone: { backgroundColor: colors.successSoft },
    portionAddText: { ...typography.micro, fontWeight: "800", color: "#ffffff" },
    portionAddTextDone: { color: colors.success },
    portionPreview: { ...typography.micro, fontWeight: "700", color: colors.accentStrong, ...tabularNums },
    /* ---- 需求 3：以往添加的食物（右侧「+ 今日」） ---- */
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    historyBody: { flex: 1, minWidth: 0, gap: 1 },
    historyName: { ...typography.callout, fontWeight: "700", color: colors.text },
    historyMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    historyAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accentStrong + "66",
      backgroundColor: colors.accentSoft,
    },
    historyAddDone: { borderColor: colors.success + "66", backgroundColor: colors.successSoft },
    historyAddText: { ...typography.micro, fontWeight: "800", color: colors.accentStrong },
    historyAddTextDone: { color: colors.success },
    /* 需求 1：营养基准库的「基准量倍数」胶囊选中态 */
    gramsChipActive: { backgroundColor: colors.primary },
    gramsChipTextActive: { color: "#ffffff" },
  });
