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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ExercisePickerPanel } from "@/components/exercise-picker-panel";
import { PressableScale } from "@/components/pressable-scale";
import { PressButton } from "@/components/press-button";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { ThemedIcon } from "@/components/themed-icon";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { toDateKey, workoutVolume, type Workout } from "@learn-workbench/shared";
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const params = useLocalSearchParams<{ id?: string }>();

  /** 路由参数只认正整数 id；非法/缺省都按「新建」处理，避免把用户卡在错误页 */
  const editingId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [params.id]);
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
      setLoadError(e instanceof Error ? e.message : "读取失败，请稍后重试");
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
      // 父页 /workout 在 focus 时会 useFocusRefresh(load)，所以这里只负责返回
      goBack();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
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

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={isEdit ? "编辑训练" : "记录训练"} backTo="/workout" />
      {/*
        iOS 用 padding 把整个表单（含底部固定按钮）抬到键盘上方；
        Android 由 app.json 的 softwareKeyboardLayoutMode: "resize" 负责，重复处理会双顶。
      */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {pickerOpen ? (
          <View style={[styles.pickerWrap, { paddingBottom: footerPadding }]}>
            <ExercisePickerPanel
              key={pickerSession}
              initial={pickerInitial}
              onCancel={cancelPicked}
              onConfirm={applyPicked}
            />
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>正在读取这次训练…</Text>
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <EmptyState
              icon="cloud-offline-outline"
              title="读取训练失败"
              hint={loadError}
              actionLabel="重试"
              onAction={() => void loadExisting()}
              pattern="none"
            />
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                // 只在"从动作面板返回"时还原一次；首次挂载 restoreYRef 为 null
                const y = restoreYRef.current;
                if (y === null) return;
                restoreYRef.current = null;
                scrollRef.current?.scrollTo({ y, animated: false });
              }}
            >
              {/* 草稿总览：长表单里先告诉用户「在填什么、已经填了多少」 */}
              <View style={styles.hero}>
                <View style={styles.heroIcon}>
                  <ThemedIcon name="trending-up-outline" size={21} color={colors.primary} />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>{isEdit ? "修改训练" : "训练草稿"}</Text>
                  <Text style={styles.heroHint}>
                    {filledItems.length} 个动作 · {draftTotals.sets} 组 · {draftTotals.reps} 次
                    {draftTotals.volumeKg > 0 ? " · " + draftTotals.volumeKg + " kg" : ""}
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{filledItems.length}</Text>
                </View>
              </View>

              <Card title="训练信息" subtitle="名称与日期会显示在训练历史中">
                <View style={styles.inputShell}>
                  <ThemedIcon name="create-outline" size={17} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="训练名称，例如：胸 + 三头"
                    placeholderTextColor={colors.textFaint}
                    maxLength={60}
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.dateRow}>
                  {dateChoices.map((d) => {
                    const active = d.key === date;
                    return (
                      <Pressable
                        key={d.key}
                        // chip 视觉高 34，只补纵向热区到 44（横向留给相邻 chip 的 gap）
                        hitSlop={{ top: 5, bottom: 5 }}
                        style={[styles.dateChip, active && styles.dateChipActive]}
                        onPress={() => setDate(d.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
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
              </Card>

              <Card title="动作" subtitle="从动作库选择，或创建自定义动作">
                {items.map((it, i) => (
                  <View key={i + "-" + (it.exerciseKey ?? "custom")} style={styles.actionRow}>
                    <View style={styles.itemIndex}>
                      <Text style={styles.itemIndexText}>{i + 1}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.exercisePick, pressed && styles.exercisePickPressed]}
                      onPress={() => openPicker(i)}
                      accessibilityRole="button"
                      accessibilityLabel={"更换动作 " + (it.exerciseLabel || i + 1)}
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
                          {it.weightKg ? " · " + it.weightKg + " kg" : " · 自重"}
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
                ))}

                <PressableScale
                  style={styles.addActionCard}
                  haptic
                  onPress={openNewAction}
                  accessibilityRole="button"
                  accessibilityLabel="添加动作"
                >
                  <View style={styles.addActionIcon}>
                    <ThemedIcon name="add" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.addActionText}>
                    <Text style={styles.addActionTitle}>添加动作</Text>
                    <Text style={styles.addActionHint}>从动作库选择，或创建自定义动作</Text>
                  </View>
                  <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
                </PressableScale>
              </Card>

              <Card title="组数明细" subtitle="点「－ / ＋」或直接输入；重量留空表示自重">
                {items.map((it, i) => {
                  const volume = Math.round(
                    (Number(it.sets) || 0) * (Number(it.reps) || 0) * (Number(it.weightKg) || 0)
                  );
                  return (
                    <View key={"detail-" + i + "-" + (it.exerciseKey ?? "custom")} style={styles.detailBlock}>
                      <View style={styles.detailHead}>
                        <View style={styles.detailIndex}>
                          <Text style={styles.detailIndexText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.detailName} numberOfLines={1}>
                          {it.exerciseLabel || "未选择动作"}
                        </Text>
                        <Text style={styles.detailVolume}>
                          {volume > 0 ? volume + " kg" : (Number(it.sets) || 0) + " 组"}
                        </Text>
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
                  );
                })}
              </Card>

              <Card title="附加信息" subtitle="可选；时长与备注会和这条训练一起保存">
                <MiniStepper
                  colors={colors}
                  title="时长"
                  label="分"
                  value={durationMin}
                  placeholder="0"
                  onChange={setDurationMin}
                  onStep={(d) => setDurationMin((v) => stepNumber(v, d * 5, 0, DURATION_MAX_MIN, 0))}
                  max={DURATION_MAX_MIN}
                />
                <View style={styles.noteHead}>
                  <ThemedIcon name="document-text-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.noteLabel}>备注</Text>
                  <Text style={styles.noteCount}>
                    {note.length}/{NOTE_MAX}
                  </Text>
                </View>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="今天的状态、动作感受、下次要调整的重量…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  maxLength={NOTE_MAX}
                  textAlignVertical="top"
                />
              </Card>
            </ScrollView>

            {/* 底部固定保存：长表单滚到哪都能一键提交，且被 KeyboardAvoidingView 抬到键盘上方 */}
            <View style={[styles.footer, { paddingBottom: footerPadding }]}>
              <PressButton
                label={isEdit ? "保存修改" : "保存训练"}
                loadingLabel="保存中…"
                loading={saving}
                icon="save-outline"
                onPress={() => void save()}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * 表单里的字段块（沿用旧抽屉的规格）：「标题  − [输入] 单位 +」。
 * 每个字段独占一行 —— 三列并排时「组 的 +」与「次 的 −」只隔 8pt，看起来像一对加减号。
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
  /** 字段名（组数 / 次数 / 重量 / 时长） */
  title: string;
  /** 单位（组 / 次 / kg / 分） */
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
        accessibilityLabel={"减少" + title}
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
        accessibilityLabel={"增加" + title}
      >
        <ThemedIcon name="add" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /**
     * 真机过渡修复（同 workout.tsx / trends.tsx）：推入页 contentStyle 是透明，
     * 页面必须自己铺不透明底色，否则推入动画期间上一屏会透出来。
     */
    root: { flex: 1, backgroundColor: colors.canvas },
    body: { flex: 1 },
    scroll: { flex: 1 },
    content: { padding: 16, paddingTop: 6, gap: 12, paddingBottom: 20 },
    pickerWrap: { flex: 1, backgroundColor: colors.canvas },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    centerText: { ...typography.callout, color: colors.textMuted, marginTop: 10 },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroText: { flex: 1, minWidth: 0, gap: 2 },
    heroTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    heroHint: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
    heroBadge: {
      minWidth: 36,
      height: 36,
      paddingHorizontal: 9,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBadgeText: { ...typography.body, fontWeight: "900", color: colors.primary, fontVariant: ["tabular-nums"] },

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
    dateChipText: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
    dateChipTextActive: { color: colors.primary, fontWeight: "800" },
    dateFoot: { flexDirection: "row", alignItems: "center", gap: 6 },
    dateHint: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },

    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemIndex: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    itemIndexText: { ...typography.caption, fontWeight: "900", color: colors.primary, fontVariant: ["tabular-nums"] },
    exercisePick: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
    exercisePickPressed: { opacity: 0.65 },
    exercisePickTextWrap: { flex: 1, minWidth: 0, gap: 1 },
    exercisePickText: { ...typography.callout, fontWeight: "800", color: colors.text },
    exercisePickMeta: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
    exercisePickPlaceholder: { color: colors.textFaint, fontWeight: "700" },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.dangerSoft,
    },
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
    addActionTitle: { ...typography.callout, fontWeight: "800", color: colors.primary },
    addActionHint: { ...typography.caption, color: colors.textMuted },

    detailBlock: {
      gap: 9,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    detailIndex: {
      width: 22,
      height: 22,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    detailIndexText: { ...typography.micro, fontWeight: "900", color: colors.primary, fontVariant: ["tabular-nums"] },
    detailName: { flex: 1, minWidth: 0, ...typography.callout, fontWeight: "800", color: colors.text },
    detailVolume: { ...typography.caption, fontWeight: "700", color: colors.primary, fontVariant: ["tabular-nums"] },
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
    miniTitle: { width: 34, ...typography.caption, fontWeight: "800", color: colors.textSecondary },
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
      ...typography.callout,
      fontWeight: "900",
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 11,
      fontVariant: ["tabular-nums"],
    },
    miniUnit: { width: 20, ...typography.caption, color: colors.textMuted, fontWeight: "700" },

    noteHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
    noteLabel: { ...typography.callout, fontWeight: "800", color: colors.textSecondary },
    noteCount: { ...typography.micro, color: colors.textMuted, marginLeft: "auto", fontVariant: ["tabular-nums"] },
    noteInput: {
      minHeight: 104,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 15,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...typography.callout,
      color: colors.text,
    },

    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.canvas,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
