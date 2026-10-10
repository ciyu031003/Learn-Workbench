import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { PressButton } from "@/components/press-button";
import { ExercisePickerPanel } from "@/components/exercise-picker-panel";
import { SheetSection } from "@/components/sheet";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { toDateKey, workoutVolume, type Workout } from "@learn-workbench/shared";
import { typography } from "@/theme/tokens";
import {
  REPS_MAX,
  REPS_MIN,
  SETS_MAX,
  SETS_MIN,
  WEIGHT_MAX,
  WEIGHT_STEP,
  dateOptions,
  draftFromWorkout,
  newDraftItem,
  stepNumber,
  stepWeight,
  toPayloadItems,
  type DraftItem,
} from "@/lib/workout-draft";

/** V3 训练记录（移动端）→ v4 P3 重做：动作可选择/可删除、支持编辑与删除整次训练、日期可选 */
export default function WorkoutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** 记录训练弹层 */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** null = 新建；数字 = 正在编辑这条记录 */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("训练");
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);

  /** 动作选择改为当前 BottomSheet 内的内联面板，不再创建第二个 Modal。 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  /** 每次进入动作面板自增 → 换 key 重新挂载，状态天然重置。 */
  const [pickerSession, setPickerSession] = useState(0);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );
  const totals = useMemo(() => workoutVolume(workouts.flatMap((w) => w.items)), [workouts]);
  const today = toDateKey(new Date());

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/workouts?days=60", { headers: headers() });
      const d = await r.json();
      if (r.ok) setWorkouts(Array.isArray(d.workouts) ? d.workouts : []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /** v18：统一走 usePullRefresh（本页有吸顶紧凑栏 → stickyHeader: true），偏移与配色由 hook 集中计算 */
  const { control } = usePullRefresh(load, { stickyHeader: true });
  /** v17-D：减弱动态时不做入场错峰与 Layout 转场 */
  const reduced = useReducedMotion();

  /* ---------- 弹层开关 ---------- */

  const openCreate = () => {
    setEditingId(null);
    setName("训练");
    setDate(today);
    setItems([newDraftItem()]);
    setPickerOpen(false);
    setSheetOpen(true);
  };

  const openEdit = (w: Workout) => {
    const draft = draftFromWorkout(w);
    setEditingId(w.id);
    setName(draft.name);
    setDate(draft.date);
    setItems(draft.items);
    setPickerOpen(false);
    setSheetOpen(true);
  };

  /** 打开动作选择（index = null → 追加一行；数字 → 替换该行） */
  const openPicker = (index: number | null) => {
    setPickerIndex(index);
    setPickerSession((s) => s + 1);
    setPickerOpen(true);
  };

  /** 新建动作优先复用第一个空行，避免默认空卡被永久留在表单里。 */
  const openNewAction = () => {
    const emptyIndex = items.findIndex((item) => !item.exerciseLabel.trim());
    openPicker(emptyIndex >= 0 ? emptyIndex : null);
  };

  /** 记录弹层被用户关闭（点空白/关闭钮/返回键）。 */
  const closeRecordSheet = () => {
    setPickerOpen(false);
    setSheetOpen(false);
  };

  const applyPicked = (item: DraftItem) => {
    if (!pickerOpen) return;
    setItems((prev) => {
      if (pickerIndex === null) return [...prev, item];
      return prev.map((x, i) => (i === pickerIndex ? item : x));
    });
    setPickerOpen(false);
    setPickerIndex(null);
  };

  const cancelPicked = () => {
    setPickerOpen(false);
    setPickerIndex(null);
  };

  /* ---------- 动作行编辑 ---------- */

  const patchItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      // 至少保留一行，否则面板会变成空白（用户会以为卡住了）
      if (prev.length <= 1) return [newDraftItem()];
      return prev.filter((_, i) => i !== index);
    });
  };

  /* ---------- 保存 / 删除 ---------- */

  const save = async () => {
    const payloadItems = toPayloadItems(items);
    if (payloadItems.length === 0) {
      Alert.alert("至少填写一个动作", "点「添加动作」从动作库里选一个，或手动输入动作名。");
      return;
    }
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const r = await fetch(isEdit ? `${getApiUrl()}/api/workouts/${editingId}` : getApiUrl() + "/api/workouts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ name: name.trim() || "训练", exercisedOn: date, items: payloadItems }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}) as { error?: string });
        throw new Error((d as { error?: string }).error ?? "保存失败");
      }
      // 单 Modal 结构下直接关闭即可；这里仍统一走 closeRecordSheet 复位动作面板状态。
      closeRecordSheet();
      setEditingId(null);
      setItems([newDraftItem()]);
      setName("训练");
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const removeWorkout = (w: Workout) => {
    Alert.alert("删除训练记录", `确定删除「${w.name}」（${w.exercisedOn}）吗？删除后不可恢复。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const r = await fetch(`${getApiUrl()}/api/workouts/${w.id}`, { method: "DELETE", headers: headers() });
            if (!r.ok) throw new Error("删除失败");
            await load();
          } catch (e) {
            Alert.alert("删除失败", e instanceof Error ? e.message : "请稍后重试");
          }
        },
      },
    ]);
  };

  const pickerInitial = pickerIndex === null ? null : items[pickerIndex] ?? null;
  const dateChoices = dateOptions(today, date);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="训练记录" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl {...control} />}
    >
      <ScreenHeaderLargeTitle title="训练记录" subtitle={`近 60 天 ${workouts.length} 次 · 总容量 ${totals.volumeKg} kg`} />

      <PressableScale style={styles.addBtn} haptic onPress={openCreate}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>记录训练</Text>
      </PressableScale>

      {loading ? (
        <SkeletonList count={4} />
      ) : workouts.length === 0 ? (
        <EmptyState icon="barbell-outline" title="还没有训练记录" hint="从动作库里选动作、填组次，自动汇总训练容量" />
      ) : (
        workouts.map((w, index) => {
          const v = workoutVolume(w.items);
          return (
            /* v17-D：列表入场错峰（每屏封顶 12 项，滚动复现不做；减弱动态下不参与） */
            <Animated.View
              key={w.id}
              entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(index))}
              layout={reduced ? undefined : LinearTransition}
            >
            <Card style={styles.item}>
              <View style={styles.itemHead}>
                <Text style={styles.itemTitle} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.muted}>{w.exercisedOn}</Text>
                <View style={styles.itemActions}>
                  <Pressable
                    hitSlop={8}
                    style={styles.iconBtn}
                    onPress={() => openEdit(w)}
                    accessibilityLabel={`编辑 ${w.name}`}
                  >
                    <ThemedIcon name="create-outline" size={15} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    style={styles.iconBtn}
                    onPress={() => removeWorkout(w)}
                    accessibilityLabel={`删除 ${w.name}`}
                  >
                    <ThemedIcon name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              {w.items.map((it, i) => (
                <View key={it.id ?? i} style={styles.entryRow}>
                  <Text style={styles.entryName} numberOfLines={1}>{it.exerciseLabel}</Text>
                  <Text style={styles.muted}>
                    {it.sets} × {it.reps}{it.weightKg !== null ? ` · ${it.weightKg}kg` : ""}
                  </Text>
                </View>
              ))}
              <Text style={styles.volume}>{v.sets} 组 · {v.reps} 次{v.volumeKg > 0 ? ` · ${v.volumeKg} kg` : ""}</Text>
            </Card>
            </Animated.View>
          );
        })
      )}

      {/* 记录训练（新建 / 编辑共用） */}
      <BottomSheet
        visible={sheetOpen}
        onClose={closeRecordSheet}
        title={pickerOpen ? "添加动作" : editingId === null ? "记录训练" : "编辑训练"}
        subtitle={
          pickerOpen
            ? "选择动作并填写组次，确认后会回到当前训练草稿"
            : editingId === null
              ? "记录动作、组次与重量，训练容量会自动汇总"
              : "修改后会覆盖这次训练的原记录"
        }
        icon="barbell-outline"
        height="86%"
        scroll={false}
        footer={
          pickerOpen ? undefined : (
            <PressButton
              label={editingId === null ? "保存训练" : "保存修改"}
              loadingLabel="保存中…"
              loading={saving}
              icon="save-outline"
              onPress={() => void save()}
            />
          )
        }
      >
        {pickerOpen ? (
          <ExercisePickerPanel
            key={pickerSession}
            initial={pickerInitial}
            onCancel={cancelPicked}
            onConfirm={applyPicked}
          />
        ) : (
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formHero}>
              <View style={styles.formHeroIcon}>
                <ThemedIcon name="trending-up-outline" size={21} color={colors.primary} />
              </View>
              <View style={styles.formHeroText}>
                <Text style={styles.formHeroTitle}>训练草稿</Text>
                <Text style={styles.formHeroHint}>
                  {items.length} 个动作 · {dateChoices.find((d) => d.key === date)?.label ?? date}
                </Text>
              </View>
              <View style={styles.formHeroBadge}>
                <Text style={styles.formHeroBadgeText}>{items.length}</Text>
              </View>
            </View>

            <SheetSection title="训练信息" hint="名称与日期会显示在训练历史中">
              <View style={styles.inputShell}>
                <ThemedIcon name="create-outline" size={17} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="训练名称，例如：胸 + 三头"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              <View style={styles.dateRow}>
                {dateChoices.map((d) => {
                  const active = d.key === date;
                  return (
          <Pressable
            key={d.key}
            // 组一 · 阶段 2：chip 视觉高 34，只补纵向热区到 44（横向留给相邻 chip 的 gap）
            hitSlop={{ top: 5, bottom: 5 }}
            style={[styles.dateChip, active && styles.dateChipActive]}
            onPress={() => setDate(d.key)}
          >
                      {active ? <ThemedIcon name="checkmark" size={12} color={colors.primary} /> : null}
                      <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.dateFoot}>
                <ThemedIcon name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.dateHint}>记录日期：{date}</Text>
              </View>
            </SheetSection>

            <SheetSection
              title={`动作明细 · ${items.length}`}
              hint="点动作名称可以更换，数值支持手动输入"
              last
            >
              {items.map((it, i) => (
                <View key={`${i}-${it.exerciseKey ?? "custom"}`} style={styles.itemCard}>
                  <View style={styles.itemCardHead}>
                    <View style={styles.itemIndex}>
                      <Text style={styles.itemIndexText}>{i + 1}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.exercisePick, pressed && styles.exercisePickPressed]}
                      onPress={() => openPicker(i)}
                      accessibilityLabel={`更换动作 ${it.exerciseLabel || i + 1}`}
                    >
                      <View style={styles.exercisePickTextWrap}>
                        <Text
                          style={[styles.exercisePickText, !it.exerciseLabel && styles.exercisePickPlaceholder]}
                          numberOfLines={1}
                        >
                          {it.exerciseLabel || "选择动作"}
                        </Text>
                        <Text style={styles.exercisePickMeta}>
                          {it.sets || "0"} 组 × {it.reps || "0"} 次
                          {it.weightKg ? ` · ${it.weightKg} kg` : " · 自重"}
                        </Text>
                      </View>
                      <ThemedIcon name="chevron-down" size={15} color={colors.textFaint} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      style={styles.removeBtn}
                      onPress={() => removeItem(i)}
                      accessibilityLabel="移除动作"
                    >
                      <ThemedIcon name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                  <View style={styles.stepperStack}>
                    <MiniStepper
                      colors={colors}
                      title="组数"
                      label="组"
                      value={it.sets}
                      onChange={(v) => patchItem(i, { sets: v })}
                      onStep={(d) => patchItem(i, { sets: stepNumber(it.sets, d, SETS_MIN, SETS_MAX, 4) })}
                    />
                    <MiniStepper
                      colors={colors}
                      title="次数"
                      label="次"
                      value={it.reps}
                      onChange={(v) => patchItem(i, { reps: v })}
                      onStep={(d) => patchItem(i, { reps: stepNumber(it.reps, d, REPS_MIN, REPS_MAX, 8) })}
                    />
                    <MiniStepper
                      colors={colors}
                      title="重量"
                      label="kg"
                      value={it.weightKg}
                      placeholder="自重"
                      onChange={(v) => patchItem(i, { weightKg: v })}
                      onStep={(d) => patchItem(i, { weightKg: stepWeight(it.weightKg, d * WEIGHT_STEP) })}
                      max={WEIGHT_MAX}
                    />
                  </View>
                </View>
              ))}

              <PressableScale style={styles.addActionCard} haptic onPress={openNewAction}>
                <View style={styles.addActionIcon}>
                  <ThemedIcon name="add" size={18} color={colors.primary} />
                </View>
                <View style={styles.addActionText}>
                  <Text style={styles.addActionTitle}>添加动作</Text>
                  <Text style={styles.addActionHint}>从动作库选择，或创建自定义动作</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
              </PressableScale>

            </SheetSection>
          </ScrollView>
        )}
      </BottomSheet>
    </Animated.ScrollView>
    </View>
  );
}

/**
 * 表单里的字段块（v6 P2-1）：`标题  − [输入] 单位 +`。
 * 每个字段独占一行（竖向堆叠），± 按钮 36×36、间距 10 —— 原来三列并排时
 * 「组 的 +」与「次 的 −」只隔 8pt，看起来像一对加减号（用户反馈）。
 */
function MiniStepper({
  colors,
  title,
  label,
  value,
  onChange,
  onStep,
  placeholder,
  max = 9999,
}: {
  colors: ThemeColors;
  /** 字段名（组数 / 次数 / 重量） */
  title: string;
  /** 单位（组 / 次 / kg） */
  label: string;
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  placeholder?: string;
  max?: number;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.miniStepper}>
      <Text style={styles.miniTitle}>{title}</Text>
        <Pressable
          style={styles.miniBtn}
          hitSlop={{ top: 5, bottom: 5 }}
          onPress={() => onStep(-1)}
          accessibilityLabel={`减少${title}`}
        >
          <ThemedIcon name="remove" size={16} color={colors.primary} />
        </Pressable>
      <TextInput
        style={styles.miniInput}
        value={value}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9.]/g, "").slice(0, 7);
          const n = Number(cleaned);
          if (cleaned !== "" && Number.isFinite(n) && n > max) return;
          onChange(cleaned);
        }}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? "0"}
        placeholderTextColor={colors.textFaint}
      />
      <Text style={styles.miniUnit}>{label}</Text>
        <Pressable
          style={styles.miniBtn}
          hitSlop={{ top: 5, bottom: 5 }}
          onPress={() => onStep(1)}
          accessibilityLabel={`增加${title}`}
        >
          <ThemedIcon name="add" size={16} color={colors.primary} />
        </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  /**
   * 真机过渡修复（v1.31）：推入页必须自己铺**不透明**底色。
   * 栈的 contentStyle 是 transparent（为了露出全局 DailyBackground），因此每个被推入的页面
   * 都要自己兜底背景；此前这里只有 flex:1 —— 推入动画期间整页透明，上一屏（健康首页）会透出来，
   * 再叠加本页训练卡的 entering 错峰入场（首帧卡片不可见），就出现了
   * 「两页重合约 200ms、随后又自己好了」的现象。与同类推入页 sports-card 的约定保持一致。
   */
  root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    addBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: colors.primary, fontSize: typography.callout.fontSize, fontWeight: "800" },
    item: { gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      flexShrink: 1,
    },
    itemActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    iconBtn: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    muted: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    entryName: { fontSize: typography.callout.fontSize, color: colors.text, flexShrink: 1 },
    volume: { fontSize: typography.caption.fontSize, fontWeight: "700", color: colors.primary },

    formScroll: { flex: 1 },
    form: { gap: 16, paddingTop: 2, paddingBottom: 8 },
    formHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    formHeroIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    formHeroText: { flex: 1, minWidth: 0, gap: 2 },
    formHeroTitle: { fontSize: typography.callout.fontSize, fontWeight: "800", color: colors.text },
    formHeroHint: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    formHeroBadge: {
      minWidth: 36,
      height: 36,
      paddingHorizontal: 9,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    formHeroBadgeText: {
      fontSize: typography.body.fontSize,
      fontWeight: "900",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    inputShell: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 13,
      borderRadius: 15,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 11,
      fontSize: typography.callout.fontSize,
      color: colors.text,
    },
    dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    dateChip: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    dateChipText: { fontSize: typography.caption.fontSize, color: colors.textMuted, fontWeight: "700" },
    dateChipTextActive: { color: colors.primary, fontWeight: "800" },
    dateFoot: { flexDirection: "row", alignItems: "center", gap: 6 },
    dateHint: { fontSize: typography.caption.fontSize, color: colors.textMuted, fontVariant: ["tabular-nums"] },
    itemCard: {
      gap: 11,
      borderRadius: 18,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    itemCardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
    itemIndex: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    itemIndexText: { fontSize: typography.caption.fontSize, fontWeight: "900", color: colors.primary, fontVariant: ["tabular-nums"] },
    exercisePick: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 2,
    },
    exercisePickPressed: { opacity: 0.65 },
    exercisePickTextWrap: { flex: 1, minWidth: 0, gap: 1 },
    exercisePickText: { fontSize: typography.callout.fontSize, fontWeight: "800", color: colors.text },
    exercisePickMeta: { fontSize: typography.caption.fontSize, color: colors.textMuted, fontVariant: ["tabular-nums"] },
    exercisePickPlaceholder: { color: colors.textFaint, fontWeight: "700" },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.dangerSoft,
    },
    stepperStack: { gap: 8 },
    miniStepper: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 15,
      backgroundColor: colors.surfaceStrong,
    },
    miniTitle: { width: 34, fontSize: typography.caption.fontSize, fontWeight: "800", color: colors.textSecondary },
    miniBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    miniInput: {
      flex: 1,
      minWidth: 44,
      textAlign: "center",
      paddingVertical: 8,
      fontSize: typography.callout.fontSize,
      fontWeight: "900",
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 11,
      fontVariant: ["tabular-nums"],
    },
    miniUnit: { width: 20, fontSize: typography.caption.fontSize, color: colors.textMuted, fontWeight: "700" },
    addActionCard: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 17,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      borderStyle: "dashed",
    },
    addActionIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    addActionText: { flex: 1, minWidth: 0, gap: 1 },
    addActionTitle: { fontSize: typography.callout.fontSize, fontWeight: "800", color: colors.primary },
    addActionHint: { fontSize: typography.caption.fontSize, color: colors.textMuted },
  });
