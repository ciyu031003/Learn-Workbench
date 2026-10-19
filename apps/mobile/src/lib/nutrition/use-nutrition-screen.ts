import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DayStrip } from "@/components/day-strip";
import { type MacroRingItem } from "@/components/macro-mini-rings";
import { type MealUpdate } from "@/components/meal-edit-sheet";
import { type MealCardData } from "@/components/meal-card-grid";
import { type TargetProfileInput } from "@/components/target-sheet";
import { scaleNutrition } from "@/lib/portion";
import { dailyRecipes } from "@/lib/recipes";
import { addHydration, addWeight, fetchHydration, fetchNutritionTarget, fetchWeight, removeHydration, saveNutritionTarget, type NutritionProfileDto, type NutritionTargetDto, type WeightPointDto } from "@/lib/wellbeing-client";
import { haptics } from "@/lib/haptics";
import { EMPTY_OUTBOX, enqueue, flushOutbox, loadOutbox, makeCreateOp, makeDeleteOp, makeUpdateOp, mergePendingEntries, nextLocalId, pendingCount, saveOutbox, toLocalEntry, type MealEntryInput, type OutboxOp, type OutboxState } from "@/lib/nutrition-outbox";
import { isRetryable, sendNutritionOp, toFlushOutcome } from "@/lib/nutrition-sync";
import { monthRange } from "@/lib/month-grid";
import { mealForNow } from "@/lib/meal-time";
import { summarizeRange, pickWindowSummary, toDaySummaryMap, todayAndYesterday, weekKeysOf, weekEndKey, isCurrentWeek, WEEK_TILE_LABELS, type DaySummaryRow } from "@/lib/nutrition-views";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { type Food, type MealEntry, type MealKind } from "@learn-workbench/shared/schemas";
import { type FoodItemHit } from "@learn-workbench/shared/types";
import { fromDateKey, recentDateKeys, toDateKey } from "@learn-workbench/shared/dates";
import { remainingKcal, sumNutrition, scaleFoodByAmount } from "@learn-workbench/shared/pure";
import { computeMacroItems, computeTarget } from "./derive";
import { lastPortionOf as lastPortionFor, parsePortionMemo, portionOptions, PORTION_MEMO_KEY, type PortionMemoEntry } from "./portion-memo";
import { INITIAL_OPEN_GROUPS, MEALS, type ViewMode } from "./constants";

export interface NutritionScreenInput {
  /** 初始日期（从趋势页 ?date= 带进来；非法值由屏幕层回落今天） */
  initialDate: string;
}

/**
 * nutrition 屏的数据层（S6-4 从单文件里抽出）：state / effect / 派生值 / 提交与发件箱逻辑都在这里，
 * 展示组件只读返回值，屏幕文件只做主题与组合。
 */
/** 窗口不匹配时的占位（引用恒定，避免 useMemo 抖动） */
const EMPTY_SUMMARY_MAP: Record<string, DaySummaryRow> = {};
/** 带使用频次的常用食物（recent 排序接口会多回 times/lastUsed，Food 类型里没有） */
type RecentFood = Food & { times?: number; lastUsed?: string | null };

export function useNutritionScreen({ initialDate }: NutritionScreenInput) {
  const token = useAppStore((s) => s.token);

  const { today: todayKey, yesterday: yesterdayKey } = useMemo(() => todayAndYesterday(), []);
  /** v1.45：`?date=YYYY-MM-DD` 从趋势页的 Food Calendar 跳进来（非法值回落今天） */
  const [date, setDate] = useState(() => initialDate);
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
  // 水杯、LiveLog
  const [cupOpen, setCupOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);

  /** 有效目标：身体数据算出来（或手动覆盖），失败回落 shared 默认值（纯函数在 lib/nutrition/derive） */
  const target = useMemo(() => computeTarget(profile, serverTarget), [profile, serverTarget]);

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
  const lastPortionOf = useCallback((food: Food): PortionMemoEntry => lastPortionFor(portionMemo, food), [portionMemo]);

  /** 每日推荐（需求 2）：同一天稳定、跨天轮换（见 lib/recipes.ts 的日期种子） */
  const dailyPicks = useMemo(() => dailyRecipes(date), [date]);

  /** 启动时读回本机「上次分量」（需求 3）；读不到/损坏一律按空处理，等价于「都按 1 份」 */
  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PORTION_MEMO_KEY);
        if (!raw) return;
        const memo = parsePortionMemo(raw);
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

  const macroItems: MacroRingItem[] = useMemo(() => computeMacroItems(totals, target), [totals, target]);

  return {
    token,
    todayKey,
    yesterdayKey,
    date,
    setDate,
    weekOffset,
    setWeekOffset,
    viewMode,
    setViewMode,
    monthView,
    setMonthView,
    entries,
    setEntries,
    summaryState,
    setSummaryState,
    dateSheetOpen,
    setDateSheetOpen,
    loading,
    setLoading,
    sheetOpen,
    setSheetOpen,
    foods,
    setFoods,
    meal,
    setMeal,
    mealNow,
    setMealNow,
    saving,
    setSaving,
    openGroups,
    setOpenGroups,
    portionById,
    setPortionById,
    justAdded,
    setJustAdded,
    portionMemo,
    setPortionMemo,
    portionMemoRef,
    manual,
    setManual,
    saveAsCommon,
    setSaveAsCommon,
    foodQuery,
    setFoodQuery,
    dbItems,
    setDbItems,
    dbLoading,
    setDbLoading,
    pickedItem,
    setPickedItem,
    itemGrams,
    setItemGrams,
    editing,
    setEditing,
    outbox,
    setOutbox,
    pendingIds,
    setPendingIds,
    profile,
    setProfile,
    serverTarget,
    setServerTarget,
    targetOpen,
    setTargetOpen,
    hydration,
    setHydration,
    weightPoints,
    setWeightPoints,
    wellnessBusy,
    setWellnessBusy,
    weightOpen,
    setWeightOpen,
    weightDraft,
    setWeightDraft,
    bookOpen,
    setBookOpen,
    cupOpen,
    setCupOpen,
    liveOpen,
    setLiveOpen,
    target,
    summaryWindow,
    summaryWindowKey,
    daySummary,
    mealCards,
    weekStrip,
    shiftWeek,
    doneMap,
    weekKeys,
    weekRows,
    rangeRows,
    weekSummary,
    monthSummary,
    isToday,
    totals,
    remaining,
    overBudget,
    ringProgress,
    headers,
    submitOp,
    sendOp,
    flushPending,
    loadSeq,
    load,
    retryPending,
    itemScaled,
    addFromItem,
    stickers,
    liveNames,
    closeSheet,
    openSheet,
    toggleGroup,
    choosePortion,
    rememberPortion,
    flashAdded,
    focusPortionRow,
    addFoodByPortion,
    recentFoods,
    lastPortionOf,
    dailyPicks,
    quickAdd,
    addManual,
    remove,
    saveEdit,
    visibleFoods,
    onAddWater,
    onUndoWater,
    onAddWeight,
    onSaveTarget,
    macroItems,
  };
}

export type NutritionModel = ReturnType<typeof useNutritionScreen>;
