import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { AnimatedNumber } from "@/components/animated-number";
import { KcalBadge } from "@/components/kcal-badge";
import { FoodSticker } from "@/components/food-sticker";
import { DayStrip } from "@/components/day-strip";
import { MacroMiniRings, type MacroRingItem } from "@/components/macro-mini-rings";
import { MealEditSheet, type MealUpdate } from "@/components/meal-edit-sheet";
import { PortionSlider } from "@/components/portion-slider";
import { SwipeRow } from "@/components/swipe-row";
import { portionPreviewText } from "@/lib/portion";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
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
  nextLocalId,
  pendingCount,
  saveOutbox,
  toLocalEntry,
  type MealEntryInput,
  type OutboxState,
} from "@/lib/nutrition-outbox";
import { spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  DEFAULT_NUTRITION_TARGETS,
  MEAL_KCAL_SHARES,
  formatEntryTime,
  mealKindLabels,
  nutritionTargetRange,
  remainingKcal,
  toDateKey,
  kcalEquivalentText,
  sumNutrition,
  type Food,
  type MealEntry,
  type MealKind,
} from "@learn-workbench/shared";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

/** 三大营养素环的配色（借 吃一点：绿=达标、橙=碳水、青=脂肪） */
const MACRO_COLORS = { proteinG: "#3DA35D", carbsG: "#F28C28", fatG: "#2FB3A6" } as const;

export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [date, setDate] = useState(todayKey);
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [daySummary, setDaySummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meal, setMeal] = useState<MealKind>("lunch");
  const [picked, setPicked] = useState<Food | null>(null);
  const [amount, setAmount] = useState("1");
  const [saving, setSaving] = useState(false);
  // 手动录入（v2 Bug 7a 保留）
  const [manual, setManual] = useState({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
  const [saveAsCommon, setSaveAsCommon] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  // P2：编辑面板 + 离线发件箱
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [outbox, setOutbox] = useState<OutboxState>(EMPTY_OUTBOX);
  const [pendingIds, setPendingIds] = useState<number[]>([]);

  const target = DEFAULT_NUTRITION_TARGETS;
  const isToday = date === todayKey;
  const totals = useMemo(() => sumNutrition(entries), [entries]);
  const remaining = remainingKcal(totals.kcal, target.kcal);
  const overBudget = remaining < 0;
  const ringProgress = target.kcal > 0 ? Math.min(1, totals.kcal / target.kcal) : 0;

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /** 把发件箱里的一条操作发给服务端（成功 true） */
  const sendOp = useCallback(
    async (op: ReturnType<typeof makeCreateOp> | ReturnType<typeof makeDeleteOp> | ReturnType<typeof makeUpdateOp>) => {
      try {
        if (op.kind === "create") {
          const r = await fetch(getApiUrl() + "/api/nutrition", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers() },
            body: JSON.stringify({ ...op.body, clientId: op.clientId }),
          });
          return r.ok;
        }
        if (op.kind === "update") {
          const r = await fetch(getApiUrl() + "/api/nutrition", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...headers() },
            body: JSON.stringify({ ...op.body, id: op.id }),
          });
          return r.ok;
        }
        const r = await fetch(`${getApiUrl()}/api/nutrition?id=${op.id}`, { method: "DELETE", headers: headers() });
        return r.ok;
      } catch {
        return false;
      }
    },
    [headers]
  );

  /** 先补发离线积压，再拉取明细（保证顺序与幂等） */
  const flushPending = useCallback(async () => {
    const state = await loadOutbox();
    setOutbox(state);
    setPendingIds(state.ops.map((o) => (o.kind === "create" ? o.localId : o.id)));
    if (pendingCount(state) === 0) return;
    const result = await flushOutbox(sendOp);
    if (result.sent > 0) {
      const after = await loadOutbox();
      setOutbox(after);
      setPendingIds(after.ops.map((o) => (o.kind === "create" ? o.localId : o.id)));
    }
  }, [sendOp]);

  const load = useCallback(async () => {
    await flushPending();
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/nutrition?date=${date}`, { headers: headers() }),
        // 日期条的 ✓ 与窗口一起取（一次请求覆盖最多 4 周窗口，避免连打 28 次明细）
        fetch(`${getApiUrl()}/api/nutrition/summary?days=28`, { headers: headers() }),
      ]);
      const d = await entriesRes.json();
      if (entriesRes.ok) setEntries(Array.isArray(d.entries) ? d.entries : []);
      const s = await summaryRes.json();
      if (summaryRes.ok && Array.isArray(s.summary)) {
        const map: Record<string, number> = {};
        for (const row of s.summary as { date: string; entryCount: number }[]) {
          if (row.entryCount > 0) map[row.date.slice(0, 10)] = row.entryCount;
        }
        setDaySummary(map);
      }
    } catch {
      // 离线保留现状
    } finally {
      setLoading(false);
    }
  }, [date, flushPending, headers]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const { refreshing, onRefresh } = useRefreshable(load);

  useEffect(() => {
    if (!sheetOpen) return;
    void (async () => {
      try {
        const r = await fetch(getApiUrl() + "/api/nutrition/foods", { headers: headers() });
        const d = await r.json();
        if (r.ok) setFoods(Array.isArray(d.foods) ? d.foods : []);
      } catch {
        // 忽略
      }
    })();
  }, [sheetOpen, headers]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setPicked(null);
    setAmount("1");
    setManual({ name: "", unit: "份", kcal: "", proteinG: "", carbsG: "", fatG: "" });
    setSaveAsCommon(false);
    setFoodQuery("");
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
    // 乐观入账：先显示，再上传
    setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
    setPendingIds((prev) => [...prev, localId]);
    haptics.success();

    const ok = await sendOp(op);
    if (ok) {
      await load();
      return;
    }
    // 离线/失败：进发件箱，等下次刷新补发
    setOutbox((prev) => {
      const next = enqueue(prev, op);
      void saveOutbox(next);
      return next;
    });
    Alert.alert("已记在本机", "当前网络不可用，联网后会自动补发。");
  };

  /** 从常用食物按指定份量添加（编辑面板里改份量后保存时走 PATCH） */
  const addPicked = async () => {
    if (!picked) {
      Alert.alert("请选择食物");
      return;
    }
    const amountNum = Number(amount) || 1;
    if (amountNum === 1) {
      await quickAdd(picked);
      closeSheet();
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(getApiUrl() + "/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ date, meal, name: picked.name, foodId: picked.id, amount: amountNum }),
      });
      if (!r.ok) throw new Error("添加失败");
      haptics.success();
      closeSheet();
      await load();
    } catch (e) {
      // 离线：手写一条本地记录 + 进发件箱
      const scaled = {
        kcal: Math.round(picked.kcal * amountNum * 10) / 10,
        proteinG: Math.round(picked.proteinG * amountNum * 10) / 10,
        carbsG: Math.round(picked.carbsG * amountNum * 10) / 10,
        fatG: Math.round(picked.fatG * amountNum * 10) / 10,
      };
      const localId = nextLocalId();
      const body: MealEntryInput = {
        date,
        meal,
        name: picked.name,
        amount: amountNum,
        unit: picked.unit,
        ...scaled,
        foodId: picked.id,
      };
      setEntries((prev) => [...prev, toLocalEntry(body, localId)]);
      setPendingIds((prev) => [...prev, localId]);
      const next = enqueue(outbox, makeCreateOp(body, localId));
      setOutbox(next);
      await saveOutbox(next);
      closeSheet();
      Alert.alert("已记在本机", e instanceof Error ? e.message : "联网后会自动补发。");
    } finally {
      setSaving(false);
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
      const body = {
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
      const r = await fetch(getApiUrl() + "/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "添加失败");
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
    } catch (e) {
      Alert.alert("添加失败", e instanceof Error ? e.message : "请稍后重试");
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
    try {
      const r = await fetch(`${getApiUrl()}/api/nutrition?id=${id}`, { method: "DELETE", headers: headers() });
      if (!r.ok) throw new Error();
      haptics.warning();
      await load();
    } catch {
      const next = enqueue(outbox, makeDeleteOp(id));
      setOutbox(next);
      await saveOutbox(next);
      Alert.alert("已在本机删除", "联网后会自动同步删除。");
    }
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
      const r = await fetch(getApiUrl() + "/api/nutrition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(update),
      });
      if (!r.ok) throw new Error("保存失败");
      haptics.success();
      await load();
    } catch {
      const { id: _drop2, ...body } = update;
      void _drop2;
      const next = enqueue(outbox, makeUpdateOp(id, body));
      setOutbox(next);
      await saveOutbox(next);
      Alert.alert("已在本机保存", "联网后会自动补发这条修改。");
    } finally {
      setSaving(false);
    }
  };

  const visibleFoods = foods.filter(
    (f) => !foodQuery.trim() || f.name.toLowerCase().includes(foodQuery.trim().toLowerCase())
  );

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ScreenHeader
        title={isToday ? "今日饮食" : "饮食记录"}
        subtitle={isToday ? `已记录 ${entries.length} 条 · 目标 ${target.kcal} kcal` : `${date} · ${entries.length} 条`}
        compact
      />

      {/* M2 日期条：可回看历史（今天用能量橙描边） */}
      <DayStrip
        selected={date}
        onSelect={setDate}
        weekOffset={weekOffset}
        onWeekOffsetChange={setWeekOffset}
        doneMap={daySummary}
        todayKey={todayKey}
      />

      {/* M1 热量 Hero：主角是「今天还能吃多少」 */}
      <GlassSurface corner={24} style={styles.hero}>
        <ProgressArc
          progress={ringProgress}
          size={132}
          strokeWidth={12}
          overBudget={overBudget}
          beatOnChange
          value={`${Math.round(ringProgress * 100)}%`}
          label="已完成"
        />
        <View style={styles.heroRight}>
          <Text style={styles.heroCaption}>{overBudget ? "已超出" : "今天还能吃"}</Text>
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
            onPress={() => Alert.alert("每日目标", `当前目标 ${target.kcal} kcal\n（v3 P3 会支持按身体数据自动计算）`)}
            hitSlop={6}
            style={styles.targetRow}
          >
            <Text style={styles.targetText}>
              已吃 {totals.kcal} · 目标 {target.kcal}
            </Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
          </Pressable>
        </View>
      </GlassSurface>

      {/* M5 三大营养素：区间目标 + 达标绿 */}
      <Card style={styles.macroCard}>
        <MacroMiniRings items={macroItems} />
      </Card>

      <PressableScale haptic style={styles.addBtn} onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>添加{mealKindLabels[meal]}</Text>
      </PressableScale>

      {/* M3 餐次时间线 */}
      {loading && entries.length === 0 ? (
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
              <View style={styles.mealTrack}>
                <View
                  style={[
                    styles.mealFill,
                    {
                      width: `${Math.round(mealPct * 100)}%`,
                      backgroundColor: mealPct >= 1 ? colors.success : colors.accent,
                    },
                  ]}
                />
              </View>
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
                          <FoodSticker name={e.name} size={40} />
                          <View style={styles.entryBody}>
                            <View style={styles.entryTitleRow}>
                              <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                              <KcalBadge kcal={e.kcal} size="sm" />
                            </View>
                            <Text style={styles.entryMeta} numberOfLines={1}>
                              {isPending ? "待同步 · " : time ? `${time} · ` : ""}
                              {e.amount} {e.unit} · P{Math.round(e.proteinG)} C{Math.round(e.carbsG)} F{Math.round(e.fatG)}
                            </Text>
                          </View>
                          <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
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

      <BottomSheet visible={sheetOpen} onClose={closeSheet} title="添加饮食" height="86%">
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

          <SectionHeader title="常用食物" subtitle="点一下就记 1 份（0 输入）" style={styles.sheetSection} />
          {/* 一点即记：贴纸网格，无需输入数量 */}
          <View style={styles.chipGrid}>
            {visibleFoods.slice(0, 12).map((f) => (
              <PressableScale
                key={f.id}
                haptic
                scaleTo={0.96}
                onPress={() => void quickAdd(f)}
                style={styles.foodChip}
              >
                <FoodSticker name={f.name} size={34} />
                <View style={styles.foodChipBody}>
                  <Text style={styles.foodChipName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.foodChipMeta}>{Math.round(f.kcal)} kcal / {f.unit}</Text>
                </View>
                <ThemedIcon name="add-circle" size={18} color={colors.accentStrong} />
              </PressableScale>
            ))}
            {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试下方手动添加</Text> : null}
          </View>

          <Field
            value={foodQuery}
            onChangeText={setFoodQuery}
            placeholder="搜索常用食物"
            returnKeyType="search"
            autoCapitalize="none"
          />

          <SectionHeader title="按份量添加" subtitle="需要精确份量时选一个再拖滑杆" style={styles.sheetSection} />
          <View style={styles.kindRow}>
            {visibleFoods.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setPicked(f)}
                style={[styles.kindChip, picked?.id === f.id && styles.kindChipActive]}
              >
                <Text style={[styles.kindChipText, picked?.id === f.id && styles.kindChipTextActive]}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {picked ? (
            <>
              <PortionSlider
                value={Number(amount) || 1}
                onChange={(v) => setAmount(String(v))}
                min={0.5}
                max={3}
                step={0.5}
                unitLabel={picked.unit}
                hint={portionPreviewText(picked, Number(amount) || 1)}
              />
              <Button label={`添加到${mealKindLabels[meal]}`} icon="add" loading={saving} onPress={() => void addPicked()} />
            </>
          ) : null}

          <SectionHeader title="手动添加" subtitle="只填名称与热量也能记一条" style={styles.sheetSection} />
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
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing.lg, gap: spacing.md },
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
    mealBlock: { gap: 6 },
    mealHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    mealTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    mealMeta: { ...typography.micro, color: colors.textMuted, ...tabularNums },
    mealTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    mealFill: { height: 5, borderRadius: 999 },
    timeline: { marginTop: 6 },
    entryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 4 },
    rail: { width: 10, alignItems: "center", alignSelf: "stretch" },
    node: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 16 },
    line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    entryBody: { flex: 1, minWidth: 0, gap: 2 },
    entryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    entryName: { flex: 1, minWidth: 0, ...typography.body, fontWeight: "600", color: colors.text },
    entryMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
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
    chipGrid: { gap: 8 },
    foodChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    foodChipBody: { flex: 1, minWidth: 0, gap: 1 },
    foodChipName: { ...typography.callout, fontWeight: "700", color: colors.text },
    foodChipMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted, ...tabularNums },
    macroInputRow: { flexDirection: "row", gap: 8 },
    macroInput: { flex: 1, minWidth: 0 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    switchLabel: { flex: 1, ...typography.callout, fontWeight: "600", color: colors.text },
  });
