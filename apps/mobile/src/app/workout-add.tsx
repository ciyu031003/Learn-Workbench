import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExercisePickerPanel } from "@/components/exercise-picker-panel";
import { Icon } from "@/components/ui/icon";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { useV15 } from "@/components/v15/v15-theme";
import { V15Button, V15Card, V15Header, V15IconButton, V15Note, V15Scroll, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { typography, type ThemeColors } from "@/theme/tokens";
import type { Workout } from "@learn-workbench/shared/schemas";
import { toDateKey } from "@learn-workbench/shared/dates";
import { workoutVolume } from "@learn-workbench/shared/pure";
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
import { takeNavPendingParams } from "@/lib/nav-pending";
import { friendlyError } from "@/lib/friendly-error";

/**
 * 记录训练（全屏路由，v1.47）。
 *
 * 之前这段表单是 /workout 里的一个 86% 高 BottomSheet。真机上动作明细 + 组次步进器
 * 一多，弹层里要滚很久；键盘弹起后只剩半屏，改一个重量要来回滑。用户要求改成全屏。
 *
 * 现在：
 *  - 创建：/workout 的「记录训练」→ router.push("/workout-add")；
 *  - 编辑：列表里的铅笔 → router.push({ pathname: "/workout-add", params: { id } })；
 *  - 保存成功 → router.back() 回 /workout，列表页在 focus 时重新拉取（useFocusRefresh）。
 *
 * 没有用 Modal / BottomSheet：这是真正的栈页面，有原生转场、侧滑返回与完整的键盘避让。
 */

/** 服务端 duration 上限 86400 秒 = 24h */
const DURATION_MAX_MIN = 24 * 60;
const NOTE_MAX = 2000;

export default function WorkoutAddScreen() {
  const v15 = useV15();
  const styles = useMemo(() => makeStyles(v15), [v15]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const params = useLocalSearchParams<{ id?: string }>();
  // v1.51 防参数冻结：/workout-add 是静态路由 + ?id= 动态参数，同名路由复用实例时
  // params 冻结在首次值 → 会编辑到上一次的记录（数据事故级）。跳转方（/workout 的
  // 新建/编辑）push 前把 id（新建为空登记）写入场外通道（lib/nav-pending.ts），
  // 这里每次聚焦优先消费；params 只作深链兜底。
  const [override, setOverride] = useState<Record<string, string> | null>(null);
  useFocusEffect(
    useCallback(() => {
      const pending = takeNavPendingParams("workout-add");
      if (pending) setOverride(pending);
    }, [])
  );
  const effective = override ?? params;

  /** 路由参数只认正整数 id；非法/缺省都按「新建」处理，避免把用户卡在错误页 */
  const editingId = useMemo(() => {
    const raw = Array.isArray(effective.id) ? effective.id[0] : effective.id;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [effective.id]);
  const isEdit = editingId !== null;

  /** 页面可能跨零点停留：只在挂载时取一次「今天」，日期 chip 的语义由用户点击时决定 */
  const today = useMemo(() => toDateKey(new Date()), []);

  const [name, setName] = useState("训练");
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<DraftItem[]>(() => [newDraftItem()]);
  /** 时长输入保留字符串：用户清空时不能立刻变成 0，提交时再换算成秒 */
  const [durationMin, setDurationMin] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  /** 编辑场景要先从服务端回填，避免用户看到「新建」表单再突然被覆盖 */
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** 动作选择改为页内切换（不再新开 Modal），同一时刻只有一个滚动容器 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  /** 每次进入动作面板自增 → 换 key 重新挂载，搜索/分类/已选状态天然重置 */
  const [pickerSession, setPickerSession] = useState(0);

  /**
   * 打开动作面板时表单会被卸载（同一时刻只保留一个滚动容器），返回后从顶部重新挂载。
   * 长表单里用户往往在改第 5 个动作，跳回顶部等于"白滚"；这里记住打开前的偏移，
   * 表单重新布局完成（onContentSizeChange）后无动画还原。
   */
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const restoreYRef = useRef<number | null>(null);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {}),
    [token]
  );

  /** 保存/取消后的统一返回：有栈历史就 pop（保留原生转场），深链直达则回列表兜底 */
  const goBack = useCallback(() => {
    // 与 components/screen-header.tsx 的 useGoBack 同款守卫：某些平台/深链场景没有栈历史
    const canPop = typeof router.canGoBack === "function" && router.canGoBack();
    if (canPop) {
      router.back();
      return;
    }
    router.replace("/workout" as never);
  }, []);

  /**
   * 编辑回填：服务端没有「按 id 取单条训练」的接口，而编辑入口只出现在
   * /workout 最近 60 天的列表里，所以复用同一个列表接口按 id 过滤。
   * 这样不需要改 web API（超出本次前端改动范围）。
   */
  const loadExisting = useCallback(async () => {
    if (editingId === null) return;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(getApiUrl() + "/api/workouts?days=60", { headers: headers() });
      if (!r.ok) throw new Error("读取训练记录失败，请检查网络后重试");
      const d = (await r.json()) as { workouts?: Workout[] };
      const found = (Array.isArray(d.workouts) ? d.workouts : []).find((w) => w.id === editingId);
      if (!found) throw new Error("这条训练记录不在了，可能已被删除");
      const draft = draftFromWorkout(found);
      setName(draft.name);
      setDate(draft.date);
      setItems(draft.items);
      // 保留两位小数再回填：服务端存的是秒，若只按整分钟显示，编辑一次就会把 75s 改成 60/120s
      setDurationMin(
        found.durationSeconds > 0 ? String(Math.round((found.durationSeconds / 60) * 100) / 100) : ""
      );
      setNote(found.note ?? "");
    } catch (e) {
      setLoadError(friendlyError(e, "读取失败，请稍后重试"));
    } finally {
      setLoading(false);
    }
  }, [editingId, headers]);

  useEffect(() => {
    if (editingId === null) return;
    // 延后一拍：先在原生转场里把空表单/骨架画出来，再发请求，避免转场卡顿
    const t = setTimeout(() => void loadExisting(), 0);
    return () => clearTimeout(t);
  }, [editingId, loadExisting]);

  /**
   * v1.51 防冻结配套：同一实例被复用打开另一个目标（编辑↔编辑、编辑→新建）时，
   * 上一份草稿必须清掉——换 id 的回填由上面的 loadExisting 覆盖，这里兜住
   * 「编辑→新建」（editingId 变 null，loadExisting 不会跑）与换 id 的空窗期。
   */
  const prevTargetRef = useRef<number | null>(editingId);
  useEffect(() => {
    if (prevTargetRef.current === editingId) return;
    prevTargetRef.current = editingId;
    setName("训练");
    setDate(today);
    setItems([newDraftItem()]);
    setDurationMin("");
    setNote("");
    setLoadError(null);
  }, [editingId, today]);

  /* ---------- 动作选择 ---------- */

  const openPicker = (index: number | null) => {
    restoreYRef.current = scrollYRef.current;
    setPickerIndex(index);
    setPickerSession((s) => s + 1);
    setPickerOpen(true);
  };

  /** 新建动作优先复用第一个空行，避免默认空卡被永久留在表单里 */
  const openNewAction = () => {
    const emptyIndex = items.findIndex((item) => !item.exerciseLabel.trim());
    openPicker(emptyIndex >= 0 ? emptyIndex : null);
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
      // 至少保留一行，否则「组数明细」整段消失，用户会以为页面坏了
      if (prev.length <= 1) return [newDraftItem()];
      return prev.filter((_, i) => i !== index);
    });
  };

  /* ---------- 保存 ---------- */

  const save = async () => {
    if (saving) return;
    const payloadItems = toPayloadItems(items);
    if (payloadItems.length === 0) {
      Alert.alert("至少填写一个动作", "先点「添加动作」从动作库里选一个，或手动输入动作名。");
      return;
    }
    const minutes = Number(durationMin);
    const durationSeconds =
      Number.isFinite(minutes) && minutes > 0 ? Math.min(86400, Math.round(minutes * 60)) : 0;
    setSaving(true);
    try {
      const r = await fetch(
        isEdit ? getApiUrl() + "/api/workouts/" + editingId : getApiUrl() + "/api/workouts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            name: name.trim() || "训练",
            exercisedOn: date,
            durationSeconds,
            note: note.trim() || null,
            items: payloadItems,
          }),
        }
      );
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "保存失败");
      }
    } catch (e) {
      // 先把 loading 复位再弹窗：返回键/重试时按钮不能一直转圈
      setSaving(false);
      Alert.alert("保存失败", friendlyError(e, "请稍后重试"));
      return;
    }
    // 先复位再导航：避免 back() 之后还在已卸载组件上 setState
    setSaving(false);
    // 父页 /workout 在 focus 时会 useFocusRefresh(load)，所以这里只负责返回
    goBack();
  };

  /* ---------- 渲染数据 ---------- */

  const dateChoices = useMemo(() => dateOptions(today, date), [today, date]);
  /**
   * 草稿汇总：只统计已填动作名的行 —— 空白起始行也有默认 4 组 × 8 次，
   * 若一起计入，用户还没选动作就会看到「1 个动作 · 4 组」的假数据。
   */
  const filledItems = useMemo(() => items.filter((it) => it.exerciseLabel.trim().length > 0), [items]);
  const draftTotals = useMemo(
    () =>
      workoutVolume(
        filledItems.map((it) => ({
          sets: Number(it.sets) || 0,
          reps: Number(it.reps) || 0,
          weightKg: Number(it.weightKg) || null,
        }))
      ),
    [filledItems]
  );
  const pickerInitial = pickerIndex === null ? null : items[pickerIndex] ?? null;
  const footerPadding = Math.max(12, insets.bottom + 8);
  const layout = useV15Layout();

  if (pickerOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: v15.canvas, paddingTop: insets.top + 4, paddingHorizontal: layout.hPad }}>
        <V15Header
          p={v15}
          kicker="EXERCISE LIBRARY"
          title="选择动作"
          subtitle="搜索动作库，或按部位筛选"
          onBack={cancelPicked}
          actions={<V15IconButton p={v15} icon="close" label="关闭动作库" onPress={cancelPicked} size={16} weight="bold" />}
        />
        <View style={{ flex: 1, marginTop: 10, paddingBottom: footerPadding }}>
          <ExercisePickerPanel
            key={pickerSession}
            initial={pickerInitial}
            onCancel={cancelPicked}
            onConfirm={applyPicked}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: v15.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <V15Scroll p={v15}>
          <V15Header
            p={v15}
            kicker="LOG WORKOUT"
            title={isEdit ? "编辑训练" : "记录训练"}
            subtitle={
              (filledItems.length > 0 ? filledItems.length + " 个动作 · " + draftTotals.sets + " 组" : "先选动作，再填组次") +
              " · 今天"
            }
            onBack={goBack}
            actions={<V15IconButton p={v15} icon="close" label="关闭" onPress={goBack} size={16} weight="bold" />}
          />

          {loading ? (
            <V15Card p={v15} style={{ marginTop: 16 }}>
              <View style={styles.center}>
                <ActivityIndicator color={v15.orange} />
                <Text style={[styles.centerText, { color: v15.sub }]}>正在读取这次训练…</Text>
              </View>
            </V15Card>
          ) : loadError ? (
            <V15Card p={v15} style={{ marginTop: 16 }}>
              <View style={styles.center}>
                <Icon name="info" size={24} weight="duotone" color={v15.orange} />
                <Text style={[styles.centerTitle, { color: v15.ink }]}>读取训练失败</Text>
                <Text style={[styles.centerText, { color: v15.sub }]}>{loadError}</Text>
                <V15Button p={v15} label="重试" icon="sparkle" onPress={() => void loadExisting()} style={{ marginTop: 10, alignSelf: "stretch" }} />
              </View>
            </V15Card>
          ) : (
            <>
              <V15Card p={v15} style={{ marginTop: 16 }}>
                <Text style={[styles.label, { color: v15.sub }]}>训练名称</Text>
                <View style={[styles.nameInput, { backgroundColor: v15.card2, borderColor: v15.line }]}>
                  <Icon name="workout" size={17} weight="regular" color={v15.sub} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="例如：胸 + 三头"
                    placeholderTextColor={v15.faint}
                    maxLength={60}
                    returnKeyType="done"
                    style={[styles.nameText, { color: v15.ink }]}
                  />
                </View>
                <Text style={[styles.label, { color: v15.sub, marginTop: 14 }]}>日期</Text>
                <View style={styles.dateRow}>
                  {dateChoices.map((d) => {
                    const active = d.key === date;
                    return (
                      <Pressable
                        key={d.key}
                        hitSlop={{ top: 4, bottom: 4 }}
                        style={[styles.dateChip, { backgroundColor: active ? v15.ink : v15.card2, borderColor: active ? v15.ink : v15.line }]}
                        onPress={() => setDate(d.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={d.label}
                      >
                        <Text style={[styles.dateChipText, { color: active ? v15.canvasTop : v15.sub }]} numberOfLines={1}>
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </V15Card>

              <V15Section
                p={v15}
                title="训练内容"
                right={filledItems.length + " 个动作 · " + draftTotals.sets + " 组"}
              />

              {items.map((it, i) => {
                const volume = (Number(it.sets) || 0) * (Number(it.reps) || 0) * (Number(it.weightKg) || 0);
                return (
                  <View key={"detail-" + i + "-" + (it.exerciseKey ?? "custom")} style={[styles.itemCard, { backgroundColor: v15.card, borderColor: v15.line }]}>
                    <View style={styles.itemHead}>
                      <Pressable
                        onPress={() => openPicker(i)}
                        accessibilityRole="button"
                        accessibilityLabel={"选择第 " + (i + 1) + " 个动作"}
                        style={styles.itemPick}
                      >
                        <View style={[styles.itemIcon, { backgroundColor: v15.orangeSoft }]}>
                          <Icon name="workout" size={16} weight="duotone" color={v15.orange} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.itemName, { color: v15.ink }]} numberOfLines={1}>
                            {it.exerciseLabel.trim() || "选择动作"}
                          </Text>
                          <Text style={[styles.itemMeta, { color: v15.sub }]} numberOfLines={1}>
                            {volume > 0 ? volume + " kg 容量" : (Number(it.sets) || 0) + " 组 · " + (Number(it.reps) || 0) + " 次"}
                          </Text>
                        </View>
                        <Icon name="chevron" size={14} weight="bold" color={v15.faint} />
                      </Pressable>
                      <Pressable
                        onPress={() => removeItem(i)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={"移除第 " + (i + 1) + " 个动作"}
                        style={[styles.removeBtn, { backgroundColor: v15.redSoft }]}
                      >
                        <Icon name="close" size={13} weight="bold" color={v15.red} />
                      </Pressable>
                    </View>
                    <View style={styles.stepperStack}>
                      <MiniStepper
                        title="组数"
                        label="组"
                        value={it.sets}
                        onChange={(v) => patchItem(i, { sets: v })}
                        onStep={(d) => patchItem(i, { sets: stepNumber(it.sets, d, SETS_MIN, SETS_MAX, 4) })}
                      />
                      <MiniStepper
                        title="次数"
                        label="次"
                        value={it.reps}
                        onChange={(v) => patchItem(i, { reps: v })}
                        onStep={(d) => patchItem(i, { reps: stepNumber(it.reps, d, REPS_MIN, REPS_MAX, 8) })}
                      />
                      <MiniStepper
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
                );
              })}

              <V15Button p={v15} label="添加动作" icon="plus" variant="soft" onPress={openNewAction} style={{ marginTop: 10 }} />

              <V15Section p={v15} title="附加信息" right="可选" />
              <V15Card p={v15}>
                <MiniStepper
                  title="时长"
                  label="分"
                  value={durationMin}
                  placeholder="0"
                  onChange={setDurationMin}
                  onStep={(d) => setDurationMin((v) => stepNumber(v, d * 5, 0, DURATION_MAX_MIN, 0))}
                  max={DURATION_MAX_MIN}
                />
                <View style={styles.noteHead}>
                  <Icon name="clock" size={14} weight="regular" color={v15.sub} />
                  <Text style={[styles.noteLabel, { color: v15.ink2 }]}>备注</Text>
                  <Text style={[styles.noteCount, { color: v15.sub }]}>{note.length}/{NOTE_MAX}</Text>
                </View>
                <TextInput
                  style={[styles.noteInput, { backgroundColor: v15.card2, borderColor: v15.line, color: v15.ink }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="今天的状态、动作感受、下次要调整的重量…"
                  placeholderTextColor={v15.faint}
                  multiline
                  maxLength={NOTE_MAX}
                  textAlignVertical="top"
                />
              </V15Card>

              <V15Button
                p={v15}
                label={isEdit ? "保存修改" : "保存训练记录"}
                icon="check"
                loading={saving}
                onPress={() => void save()}
                style={{ marginTop: 16 }}
              />
              <V15Button p={v15} label="返回训练" variant="ghost" onPress={goBack} style={{ marginTop: 8 }} />

              <V15Note p={v15}>保存后会更新本周负荷、训练构成与最近训练；训练记录不产生 kcal。</V15Note>
            </>
          )}

          <View style={{ height: layout.wide ? 18 : 10 }} />
        </V15Scroll>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * 表单里的字段块（沿用旧抽屉的规格）：「标题  − [输入] 单位 +」。
 * 每个字段独占一行 —— 三列并排时「组 的 +」与「次 的 −」只隔 8pt，看起来像一对加减号。
 */
function MiniStepper({
  title,
  label,
  value,
  onChange,
  onStep,
  placeholder,
  max = 9999,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  placeholder?: string;
  max?: number;
}) {
  const p = useV15();
  return (
    <View style={[stepperStyles.row, { backgroundColor: p.card2 }]}>
      <Text style={[stepperStyles.title, { color: p.ink2 }]} numberOfLines={1}>{title}</Text>
      <Pressable
        style={[stepperStyles.btn, { backgroundColor: p.card, borderColor: p.line }]}
        hitSlop={{ top: 5, bottom: 5 }}
        onPress={() => onStep(-1)}
        accessibilityRole="button"
        accessibilityLabel={"减少" + title}
      >
        <Icon name="minus" size={15} weight="bold" color={p.orange} />
      </Pressable>
      <TextInput
        style={[stepperStyles.input, { color: p.ink }]}
        value={value}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9.]/g, "").slice(0, 7);
          const n = Number(cleaned);
          if (cleaned === "" || (Number.isFinite(n) && n <= max)) onChange(cleaned);
        }}
        placeholder={placeholder}
        placeholderTextColor={p.faint}
        keyboardType="decimal-pad"
        accessibilityLabel={title}
      />
      <Text style={[stepperStyles.unit, { color: p.sub }]}>{label}</Text>
      <Pressable
        style={[stepperStyles.btn, { backgroundColor: p.card, borderColor: p.line }]}
        hitSlop={{ top: 5, bottom: 5 }}
        onPress={() => onStep(1)}
        accessibilityRole="button"
        accessibilityLabel={"增加" + title}
      >
        <Icon name="plus" size={15} weight="bold" color={p.orange} />
      </Pressable>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 },
  title: { width: 34, ...typography.caption, fontWeight: "800" },
  btn: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 44, textAlign: "center", paddingVertical: 7, ...typography.callout, fontWeight: "900", borderRadius: 10, fontVariant: ["tabular-nums"] },
  unit: { width: 20, ...typography.caption, fontWeight: "700" },
});

const makeStyles = (p: ReturnType<typeof useV15>) =>
  StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 18 },
    centerTitle: { ...typography.headline, fontWeight: "800" },
    centerText: { ...typography.meta, textAlign: "center" },
    label: { ...typography.micro, fontWeight: "700", marginBottom: 6 },
    nameInput: { height: 52, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
    nameText: { flex: 1, ...typography.callout, fontWeight: "700", paddingVertical: 0 },
    dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dateChip: { minWidth: 50, minHeight: 36, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    dateChipText: { ...typography.micro, fontWeight: "700" },
    itemCard: { borderWidth: 1, borderRadius: 20, padding: 12, marginBottom: 9 },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemPick: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
    itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    itemName: { ...typography.callout, fontWeight: "800" },
    itemMeta: { ...typography.micro, fontWeight: "500", marginTop: 1 },
    removeBtn: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    stepperStack: { gap: 7, marginTop: 10 },
    noteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
    noteLabel: { ...typography.callout, fontWeight: "800" },
    noteCount: { ...typography.micro, marginLeft: "auto", fontVariant: ["tabular-nums"] },
    noteInput: { minHeight: 96, marginTop: 7, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, ...typography.callout },
  });
