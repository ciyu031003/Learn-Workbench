import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { PressButton } from "@/components/press-button";
import { ExercisePickerSheet } from "@/components/exercise-picker-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
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
  const insets = useSafeAreaInsets();
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

  /**
   * 选择动作弹层。它与记录弹层都是 `Modal`，而 BottomSheet 明确「一次只 present 一个 sheet」，
   * 所以这里用 `onClosed` 串行切换：关闭记录弹层 → 动画结束 → 打开选择弹层（反之亦然）。
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerPending, setPickerPending] = useState(false);
  /**
   * 「用户是**确认选了动作**才关掉选择弹层」的意图标记（v5 P1-4）。
   * 没有它时：`onPickerClosed` 无条件重开记录弹层 → 用户点空白只关一层又自动弹回，弹窗关不掉。
   * 只有 `applyPicked`（用户点了「加入训练」）才置位；关闭出口一律清零。
   */
  const [pickerReturn, setPickerReturn] = useState(false);
  /** 每次打开选择弹层自增 → 换 key 让它重新挂载，状态天然重置（不在 effect 里 setState） */
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

  const { refreshing, onRefresh } = useRefreshable(load);

  /* ---------- 弹层开关 ---------- */

  const openCreate = () => {
    setEditingId(null);
    setName("训练");
    setDate(today);
    setItems([newDraftItem()]);
    setSheetOpen(true);
  };

  const openEdit = (w: Workout) => {
    const draft = draftFromWorkout(w);
    setEditingId(w.id);
    setName(draft.name);
    setDate(draft.date);
    setItems(draft.items);
    setSheetOpen(true);
  };

  /** 打开动作选择（index = null → 追加一行；数字 → 替换该行） */
  const openPicker = (index: number | null) => {
    // 已在等待串行切换（记录弹层正在退场）时忽略重复点击：
    // 否则第二次点击会被第一次的 onClosed 清掉 pending，表现为"点了没反应"（审查发现）
    if (pickerPending) return;
    setPickerIndex(index);
    setPickerPending(true);
    // 新一轮开始：清掉上一轮可能残留的"确认返回"意图
    setPickerReturn(false);
    setPickerSession((s) => s + 1);
    if (!sheetOpen) {
      // 记录弹层本来就没开：直接开选择弹层。
      // 之前这里无条件 setSheetOpen(false) —— 状态没变化 → onRecordSheetClosed 永不触发 →
      // pickerPending 永久残留，之后**每次**关闭记录弹层都会把选择弹层弹回来（真机"关不掉"的另一半原因）。
      setPickerPending(false);
      setPickerOpen(true);
      return;
    }
    setSheetOpen(false);
  };

  /** 记录弹层退场结束后，若用户刚才是去选动作，则接着打开选择弹层 */
  const onRecordSheetClosed = () => {
    // 防御：只有这轮确实是"为选动作而关"，且选择弹层尚未打开时才开
    if (!pickerPending || pickerOpen) return;
    setPickerPending(false); // 消费掉意图：即使这次没开成，也不能留到下次关闭时再触发
    setPickerOpen(true);
  };

  /**
   * 选择弹层退场结束后：**只有用户确认选了动作**才回到记录弹层；
   * 点空白/返回键关闭一律不回（P1-4：否则"关一层又弹回来"，弹窗关不掉）。
   */
  const onPickerClosed = () => {
    setPickerPending(false);
    if (pickerReturn) setSheetOpen(true);
    setPickerReturn(false);
  };

  /** 记录弹层被用户关闭（点空白/关闭钮/返回键）：无条件清零两个标记 */
  const closeRecordSheet = () => {
    setPickerPending(false);
    setPickerReturn(false);
    setSheetOpen(false);
  };

  /** 选择弹层被用户关闭：清掉"等待串行"标记，但保留 return（确认路径由 onClosed 消费） */
  const closePickerSheet = () => {
    setPickerPending(false);
    setPickerOpen(false);
  };

  const applyPicked = (item: DraftItem) => {
    // 退场动画期间 Modal 仍可点：不做守卫会 append 两行（审查发现）
    if (!pickerOpen) return;
    setItems((prev) => {
      if (pickerIndex === null) return [...prev, item];
      return prev.map((x, i) => (i === pickerIndex ? item : x));
    });
    // 置位"确认返回"意图：onPickerClosed 才会把记录弹层接回来
    setPickerReturn(true);
    // 串行意图已消费，避免"记录弹层关闭时又去开选择弹层"的乒乓
    setPickerPending(false);
    setPickerOpen(false);
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
      // 必须走 closeRecordSheet：直接 setSheetOpen(false) 会留下 pickerPending/pickerReturn，
      // 于是 onRecordSheetClosed 又把选择弹层/记录弹层弹回来 —— 真机表现为"保存后抽屉一直弹出来关不掉"
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceStrong} />
      }
    >
      <ScreenHeader title="训练记录" subtitle={`近 60 天 ${workouts.length} 次 · 总容量 ${totals.volumeKg} kg`} compact />

      <PressableScale style={styles.addBtn} haptic onPress={openCreate}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>记录训练</Text>
      </PressableScale>

      {loading ? (
        <SkeletonList count={4} />
      ) : workouts.length === 0 ? (
        <EmptyState icon="barbell-outline" title="还没有训练记录" hint="从动作库里选动作、填组次，自动汇总训练容量" />
      ) : (
        workouts.map((w) => {
          const v = workoutVolume(w.items);
          return (
            <Card key={w.id} style={styles.item}>
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
          );
        })
      )}

      {/* 记录训练（新建 / 编辑共用） */}
      <BottomSheet
        visible={sheetOpen}
        onClose={closeRecordSheet}
        onClosed={onRecordSheetClosed}
        title={editingId === null ? "记录训练" : "编辑训练"}
        height="80%"
        expandable
      >
        <View style={styles.form}>
          <Text style={styles.sectionLabel}>训练信息</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="训练名称，例如：胸 + 三头"
            placeholderTextColor={colors.textFaint}
          />
          <View style={styles.dateRow}>
            {dateChoices.map((d) => {
              const active = d.key === date;
              return (
                <Pressable
                  key={d.key}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => setDate(d.key)}
                >
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.dateHint}>记录日期：{date}</Text>

          <View style={styles.itemsHead}>
            <Text style={styles.sectionLabel}>动作明细（{items.length}）</Text>
            <Text style={styles.muted}>点动作名可更换</Text>
          </View>

          {items.map((it, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={styles.itemCardHead}>
                <Pressable style={styles.exercisePick} onPress={() => openPicker(i)}>
                  <Text style={[styles.exercisePickText, !it.exerciseLabel && styles.exercisePickPlaceholder]} numberOfLines={1}>
                    {it.exerciseLabel || "选择动作"}
                  </Text>
                  <ThemedIcon name="chevron-down" size={14} color={colors.textFaint} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  style={styles.iconBtn}
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

          <Pressable style={styles.ghostBtn} onPress={() => openPicker(null)}>
            <Text style={styles.ghostBtnText}>＋ 添加动作</Text>
          </Pressable>

          {/* v13 U5：主 CTA 用按压反馈按钮（按下 0.97 + loading 文案切换） */}
          <PressButton
            label={editingId === null ? "保存训练" : "保存修改"}
            loadingLabel="保存中…"
            loading={saving}
            icon="save-outline"
            style={styles.primaryBtnPressed}
            onPress={() => void save()}
          />
        </View>
      </BottomSheet>

      {/* 选择动作（两步：选动作 → 填组次）。key=pickerSession → 每次打开都是干净状态 */}
      <ExercisePickerSheet
        key={pickerSession}
        visible={pickerOpen}
        onClose={closePickerSheet}
        onClosed={onPickerClosed}
        onConfirm={applyPicked}
        initial={pickerInitial}
      />
    </ScrollView>
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
      <Pressable style={styles.miniBtn} onPress={() => onStep(-1)} accessibilityLabel={`减少${title}`}>
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
      <Pressable style={styles.miniBtn} onPress={() => onStep(1)} accessibilityLabel={`增加${title}`}>
        <ThemedIcon name="add" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
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
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    item: { gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      flexShrink: 1,
    },
    itemActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    iconBtn: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    muted: { fontSize: 11, color: colors.textMuted },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    entryName: { fontSize: 13, color: colors.text, flexShrink: 1 },
    volume: { fontSize: 11, fontWeight: "700", color: colors.primary },

    form: { gap: 10, paddingTop: 2 },
    sectionLabel: { fontSize: 12, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.3 },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    dateChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    dateChipActive: { backgroundColor: colors.primarySoft },
    dateChipText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    dateChipTextActive: { color: colors.primary, fontWeight: "800" },
    dateHint: { fontSize: 11, color: colors.textMuted },
    itemsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
    itemCard: {
      gap: 8,
      borderRadius: 14,
      padding: 10,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    itemCardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    exercisePick: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    exercisePickText: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
    exercisePickPlaceholder: { color: colors.textFaint, fontWeight: "600" },
    /* v6 P2-1：字段独占一行，± 分离 */
    stepperStack: { gap: 12 },
    miniStepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    miniTitle: { width: 36, fontSize: 12, fontWeight: "700", color: colors.textMuted },
    miniBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    miniInput: {
      flex: 1,
      minWidth: 44,
      textAlign: "center",
      paddingVertical: 9,
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      backgroundColor: colors.surfaceStrong,
      borderRadius: 10,
    },
    miniUnit: { width: 20, fontSize: 12, color: colors.textMuted },
    ghostBtn: { borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: colors.surfaceMuted },
    ghostBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 2 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    // v13 U5：PressButton 的形态微调（高度/圆角由组件按 token 负责，这里只留间距）
    primaryBtnPressed: { marginTop: 2 },
    btnDisabled: { opacity: 0.5 },
  });
