import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import {
  EXERCISE_CATALOG,
  exerciseByKey,
  exerciseTypeOptions,
  filterExercises,
  type ExerciseFilterable,
} from "@learn-workbench/shared";
import {
  DEFAULT_REPS,
  DEFAULT_SETS,
  REPS_MAX,
  REPS_MIN,
  SETS_MAX,
  SETS_MIN,
  WEIGHT_MAX,
  WEIGHT_STEP,
  stepNumber,
  stepWeight,
  type DraftItem,
} from "@/lib/workout-draft";

/** `/api/exercises` 返回项（内置目录回退时 id 为 null） */
interface ApiExercise extends ExerciseFilterable {
  id?: number | null;
}

export interface ExercisePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * 退场动画结束、Modal 真正卸载后调用。
   * 本组件与"记录训练"弹层都是 Modal，BottomSheet 约束「一次只 present 一个 sheet」，
   * 所以调用方用它做串行切换（选完动作 → 回到记录弹层）。
   */
  onClosed?: () => void;
  /** 确认后回传一条完整的动作草稿（由调用方决定是"追加一行"还是"替换某一行"） */
  onConfirm: (item: DraftItem) => void;
  /** 从某一行进入时带入该行当前值；新增时为 null → 用默认 4 组 8 次 */
  initial?: DraftItem | null;
}

const ALL = "ALL";

/**
 * 选择动作弹层（v4 P3）——"添加动作时弹小弹窗选择动作 / 组数 / 每组次数"的落地。
 *
 * 两步走（同一个 sheet 内切换，避免"一次只 present 一个 sheet"的约束）：
 *   ① 选动作：分类 Tab（与 `exerciseTypeOptions` 对齐）+ 搜索 + 列表
 *   ② 填组次：组数 / 次数 / 重量步进器 → 确认
 *
 * 数据源：`GET /api/exercises?limit=200`（无需鉴权），**失败/未迁移时回退内置 `EXERCISE_CATALOG`**；
 * 拉到列表后过滤在本地做（`filterExercises`），所以搜索与切分类是瞬时的、离线也能用。
 *
 * 状态初始化全部走 `useState(initial… )`：调用方每次打开时换 `key` 让它重新挂载
 * （比"visible 变 true 时在 effect 里 setState 重置"更干净 —— 后者会触发级联渲染，
 * 也是 eslint `react-hooks/set-state-in-effect` 明确要拦的写法）。
 */
export function ExercisePickerSheet({ visible, onClose, onClosed, onConfirm, initial }: ExercisePickerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const token = useAppStore((s) => s.token);

  const [catalog, setCatalog] = useState<ApiExercise[]>(EXERCISE_CATALOG);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  /** 编辑已有动作时直接停在第二步（用户目的明确：改组次） */
  const [picked, setPicked] = useState<ApiExercise | null>(() => {
    if (!initial?.exerciseLabel) return null;
    // 用真实字典条目反查，避免把"卧推"显示成"全身"（查不到才退化为自定义动作）
    const known = exerciseByKey(initial.exerciseKey ?? "");
    if (known) return known;
    return {
      key: initial.exerciseKey ?? "",
      name: initial.exerciseLabel,
      muscleGroup: "全身",
      category: "STRENGTH",
      equipment: null,
    };
  });
  const [sets, setSets] = useState(initial?.sets || DEFAULT_SETS);
  const [reps, setReps] = useState(initial?.reps || DEFAULT_REPS);
  const [weight, setWeight] = useState(initial?.weightKg ?? "");

  /** 拉一次字典（打开时）；失败保持内置目录，不打断用户 */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      // setState 放在 async 函数体内：既满足 eslint 规则，也保证第一次 await 之前不产生同步级联渲染
      setLoading(true);
      try {
        const res = await fetch(`${getApiUrl()}/api/exercises?limit=200`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = (await res.json()) as { exercises?: ApiExercise[] };
        if (alive && res.ok && Array.isArray(data.exercises) && data.exercises.length > 0) {
          setCatalog(data.exercises);
        }
      } catch {
        // 离线 / 接口不可用：继续用内置目录
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, token]);

  const tabs = useMemo(() => [{ type: ALL, label: "全部" }, ...exerciseTypeOptions], []);
  const list = useMemo(
    () => filterExercises(catalog, { q: query, category: category === ALL ? "" : category }),
    [catalog, query, category]
  );

  const pick = useCallback((item: ApiExercise) => {
    setPicked(item);
  }, []);

  const confirm = useCallback(() => {
    if (!picked) return;
    onConfirm({
      exerciseKey: picked.key || null,
      exerciseLabel: picked.name,
      sets,
      reps,
      weightKg: weight,
    });
  }, [onConfirm, picked, reps, sets, weight]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title={picked ? "填写组次" : "选择动作"}
      height="82%"
      scroll={false}
    >
      <View style={styles.root}>
        {!picked ? (
          <>
            <View style={styles.searchBar}>
              <ThemedIcon name="search" size={17} color={colors.textFaint} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="搜索动作 / 部位 / 器械（如 卧推、胸、哑铃）"
                placeholderTextColor={colors.textFaint}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="清空搜索">
                  <ThemedIcon name="close-circle" size={16} color={colors.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
              keyboardShouldPersistTaps="handled"
            >
              {tabs.map((t) => {
                const active = category === t.type;
                return (
                  <Pressable
                    key={t.type}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setCategory(t.type)}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.listHead}>
              <Text style={styles.listHeadText}>
                {loading ? "正在同步动作库…" : `${list.length} 个动作`}
              </Text>
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {list.length === 0 ? (
                <Text style={styles.empty}>没有匹配的动作，换个关键词试试</Text>
              ) : (
                list.map((e) => (
                  <Pressable key={e.key} style={styles.row} onPress={() => pick(e)}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName}>{e.name}</Text>
                      <Text style={styles.rowMeta}>
                        {e.muscleGroup}
                        {e.equipment ? ` · ${e.equipment}` : ""}
                      </Text>
                    </View>
                    <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable style={styles.freeRow} onPress={() => setPicked({ key: "", name: query.trim() || "自定义动作", muscleGroup: "全身", category: "STRENGTH", equipment: null })}>
              <ThemedIcon name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.freeText}>没有？手动输入动作名</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* 第二步内容用可滚动容器包裹：键盘弹出时 BottomSheet 会收缩高度，
                小屏机型上「加入训练」按钮会被裁掉且无处可滚（审查发现） */}
            <ScrollView
              style={styles.flexOne}
              contentContainerStyle={styles.stepBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.pickedCard}>
                <Text style={styles.pickedName}>{picked.name}</Text>
                <Text style={styles.pickedMeta}>
                  {picked.key ? `${picked.muscleGroup}${picked.equipment ? ` · ${picked.equipment}` : ""}` : "自定义动作"}
                </Text>
              </View>

            {picked.key === "" ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.blockLabel}>动作名</Text>
                <TextInput
                  style={styles.input}
                  value={picked.name}
                  onChangeText={(t) => setPicked({ ...picked, name: t })}
                  placeholder="例如：史密斯机卧推"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                />
              </View>
            ) : null}

            <View style={styles.fieldBlock}>
              <Text style={styles.blockLabel}>组数</Text>
              <Stepper
                colors={colors}
                value={sets}
                onMinus={() => setSets((v) => stepNumber(v, -1, SETS_MIN, SETS_MAX, Number(DEFAULT_SETS)))}
                onPlus={() => setSets((v) => stepNumber(v, 1, SETS_MIN, SETS_MAX, Number(DEFAULT_SETS)))}
                onChange={setSets}
                suffix="组"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.blockLabel}>每组次数</Text>
              <Stepper
                colors={colors}
                value={reps}
                onMinus={() => setReps((v) => stepNumber(v, -1, REPS_MIN, REPS_MAX, Number(DEFAULT_REPS)))}
                onPlus={() => setReps((v) => stepNumber(v, 1, REPS_MIN, REPS_MAX, Number(DEFAULT_REPS)))}
                onChange={setReps}
                suffix="次"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.blockLabel}>重量（kg，自重可留空）</Text>
              <Stepper
                colors={colors}
                value={weight}
                placeholder="自重"
                onMinus={() => setWeight((v) => stepWeight(v, -WEIGHT_STEP))}
                onPlus={() => setWeight((v) => stepWeight(v, WEIGHT_STEP))}
                onChange={setWeight}
                suffix="kg"
                max={WEIGHT_MAX}
              />
            </View>

            </ScrollView>

            {/* 操作区固定在滚动区之外，任何屏幕高度下都能点到 */}
            <View style={styles.actions}>
              <Pressable style={styles.ghostBtn} onPress={() => setPicked(null)}>
                <Text style={styles.ghostBtnText}>返回列表</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, !picked.name.trim() && styles.btnDisabled]}
                disabled={!picked.name.trim()}
                onPress={confirm}
              >
                <Text style={styles.primaryBtnText}>加入训练</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/** 数值步进器：− [输入] + ，输入框始终可手打（键盘弹出由 BottomSheet 统一避让） */
function Stepper({
  colors,
  value,
  onChange,
  onMinus,
  onPlus,
  suffix,
  placeholder,
  max = 9999,
}: {
  colors: ThemeColors;
  value: string;
  onChange: (v: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  suffix: string;
  placeholder?: string;
  max?: number;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onMinus} accessibilityLabel={`减少${suffix}`}>
        <ThemedIcon name="remove" size={16} color={colors.primary} />
      </Pressable>
      <TextInput
        style={styles.stepInput}
        value={value}
        onChangeText={(t) => {
          // 只允许数字与一个小数点（键盘类型在不同输入法下不保证）
          const cleaned = t.replace(/[^0-9.]/g, "").slice(0, 7);
          const n = Number(cleaned);
          if (cleaned !== "" && Number.isFinite(n) && n > max) return;
          onChange(cleaned);
        }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
      />
      <Pressable style={styles.stepBtn} onPress={onPlus} accessibilityLabel={`增加${suffix}`}>
        <ThemedIcon name="add" size={16} color={colors.primary} />
      </Pressable>
      <Text style={styles.stepSuffix}>{suffix}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flexOne: { flex: 1 },
    stepBody: { gap: 12, paddingBottom: 8 },
    root: { flex: 1, gap: 10 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
    // alignItems:"center"：横向 ScrollView 的内容容器默认 alignItems:"stretch"，
    // 会把 pill 纵向拉满 → 表现为"长条椭圆 + 文字下方留白"（v1.4.0 反馈）。
    // 不要给 chip 加 flex:1（那会让 6 个分类平分宽度，又变回长条）。
    tabRow: { gap: 8, paddingVertical: 2, alignItems: "center" },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    tabActive: { backgroundColor: colors.primarySoft },
    tabText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    tabTextActive: { color: colors.primary, fontWeight: "800" },
    listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    listHeadText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    list: { flex: 1 },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 24 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowMain: { flex: 1, gap: 2 },
    rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
    rowMeta: { fontSize: 11, color: colors.textMuted },
    freeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    freeText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    pickedCard: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14, gap: 3 },
    pickedName: { fontSize: 18, fontWeight: "800", color: colors.text },
    pickedMeta: { fontSize: 12, color: colors.textMuted },
    fieldBlock: { gap: 6 },
    blockLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    stepInput: {
      flex: 1,
      textAlign: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    stepSuffix: { fontSize: 12, color: colors.textMuted, width: 22 },
    actions: { flexDirection: "row", gap: 10, marginTop: 4 },
    ghostBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center", backgroundColor: colors.surfaceMuted },
    ghostBtnText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
    primaryBtn: { flex: 1.4, borderRadius: 14, paddingVertical: 13, alignItems: "center", backgroundColor: colors.primary },
    primaryBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
    btnDisabled: { opacity: 0.45 },
  });
