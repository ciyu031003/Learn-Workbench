import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SheetSearchField, SheetSection, SheetStickyCta } from "@/components/sheet";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
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

interface ApiExercise extends ExerciseFilterable {
  id?: number | null;
}

export interface ExercisePickerPanelProps {
  /** 返回记录表单，丢弃本次动作选择。 */
  onCancel: () => void;
  /** 确认后把完整动作草稿交回记录表单。 */
  onConfirm: (item: DraftItem) => void;
  /** 编辑已有动作时带入当前值；新增时为 null。 */
  initial?: DraftItem | null;
}

const ALL = "ALL";

const CATEGORY_ICONS: Record<string, string> = {
  ALL: "apps-outline",
  STRENGTH: "barbell-outline",
  AEROBIC: "walk-outline",
  STRETCH: "body-outline",
  BALL: "basketball-outline",
  MOVE: "footsteps-outline",
  OTHER: "ellipsis-horizontal",
};

/**
 * 动作选择面板（内联版）。
 *
 * 训练记录表单与动作选择器过去是两个同时存在的 Modal，需要靠 onClosed 回调串行
 * 切换；任一回调乱序都会形成“关掉又弹回来”。这里改为同一个 BottomSheet 内切换
 * 表单/面板，只保留一个 Modal 生命周期，结构上不再存在双弹窗竞争。
 */
export function ExercisePickerPanel({ onCancel, onConfirm, initial }: ExercisePickerPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const token = useAppStore((s) => s.token);

  const [catalog, setCatalog] = useState<ApiExercise[]>(EXERCISE_CATALOG);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [picked, setPicked] = useState<ApiExercise | null>(() => {
    if (!initial?.exerciseLabel) return null;
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

  useEffect(() => {
    let alive = true;
    void (async () => {
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
        // 离线时继续使用内置动作目录。
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const tabs = useMemo(() => [{ type: ALL, label: "全部" }, ...exerciseTypeOptions], []);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tabs) {
      map[t.type] = filterExercises(catalog, { q: "", category: t.type === ALL ? "" : t.type }).length;
    }
    return map;
  }, [catalog, tabs]);
  const gridTabs = useMemo(
    () => tabs.filter((t) => t.type === ALL || t.type === category || (counts[t.type] ?? 0) > 0),
    [tabs, counts, category]
  );
  const list = useMemo(
    () => filterExercises(catalog, { q: query, category: category === ALL ? "" : category }),
    [catalog, query, category]
  );

  const pick = useCallback((item: ApiExercise) => {
    setPicked(item);
  }, []);

  const confirm = useCallback(() => {
    if (!picked?.name.trim()) return;
    onConfirm({
      exerciseKey: picked.key || null,
      exerciseLabel: picked.name.trim(),
      sets,
      reps,
      weightKg: weight,
    });
  }, [onConfirm, picked, reps, sets, weight]);

  const totalVolume = useMemo(() => {
    const n = Number(weight);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(Number(sets) * Number(reps) * n * 10) / 10;
  }, [reps, sets, weight]);

  return (
    <View style={styles.root}>
      <View style={styles.panelHead}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="返回训练记录"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <ThemedIcon name="arrow-back" size={18} color={colors.primary} />
          <View style={styles.backText}>
            <Text style={styles.backTitle}>返回训练记录</Text>
            <Text style={styles.backHint}>{picked ? "第 2 步 · 填写组次" : "第 1 步 · 选择动作"}</Text>
          </View>
        </Pressable>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>{picked ? "2 / 2" : "1 / 2"}</Text>
        </View>
      </View>

      {!picked ? (
        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SheetSection title="按分类浏览" hint={`动作库同步了 ${catalog.length} 个动作`}>
            <View style={styles.catGrid}>
              {gridTabs.map((t) => {
                const active = category === t.type;
                const count = counts[t.type] ?? 0;
                return (
                  <PressableScale
                    key={t.type}
                    haptic
                    scaleTo={0.96}
                    onPress={() => setCategory(t.type)}
                    style={[styles.catCard, active && styles.catCardActive]}
                    accessibilityLabel={`筛选 ${t.label}（${count} 个动作）`}
                  >
                    <View style={[styles.catIcon, active && styles.catIconActive]}>
                      <ThemedIcon
                        name={(CATEGORY_ICONS[t.type] ?? "ellipsis-horizontal") as never}
                        size={20}
                        color={active ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.catText}>
                      <Text style={[styles.catName, active && styles.catNameActive]} numberOfLines={1}>
                        {t.label}
                      </Text>
                      <Text style={styles.catCount}>{count} 个动作</Text>
                    </View>
                    {active ? <ThemedIcon name="checkmark-circle" size={17} color={colors.primary} /> : null}
                  </PressableScale>
                );
              })}
            </View>
          </SheetSection>

          <SheetSection title="全部动作" hint="可以搜索名称、部位或器械" last>
            <SheetSearchField
              value={query}
              onChangeText={setQuery}
              placeholder="搜索：卧推、胸、哑铃…"
              autoCorrect={false}
            />
            <View style={styles.listHead}>
              <Text style={styles.listHeadText}>{loading ? "正在同步动作库…" : `${list.length} 个匹配`}</Text>
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            <View style={styles.list}>
              {list.length === 0 ? (
                <View style={styles.empty}>
                  <ThemedIcon name="search-outline" size={24} color={colors.textFaint} />
                  <Text style={styles.emptyTitle}>没有匹配的动作</Text>
                  <Text style={styles.emptyHint}>换个关键词，或在下面直接创建自定义动作</Text>
                </View>
              ) : (
                list.map((e) => (
                  <Pressable
                    key={e.key}
                    onPress={() => pick(e)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowIcon}>
                      <ThemedIcon
                        name={(CATEGORY_ICONS[e.category] ?? "barbell-outline") as never}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName}>{e.name}</Text>
                      <Text style={styles.rowMeta}>
                        {e.muscleGroup}
                        {e.equipment ? ` · ${e.equipment}` : ""}
                      </Text>
                    </View>
                    <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
                  </Pressable>
                ))
              )}
            </View>

            <Pressable
              onPress={() =>
                pick({
                  key: "",
                  name: query.trim() || "自定义动作",
                  muscleGroup: "全身",
                  category: "STRENGTH",
                  equipment: null,
                })
              }
              style={({ pressed }) => [styles.freeRow, pressed && styles.freeRowPressed]}
              accessibilityRole="button"
            >
              <ThemedIcon name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.freeText}>没有合适的？创建自定义动作</Text>
            </Pressable>
          </SheetSection>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            style={styles.flexOne}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.selectedCard}>
              <View style={styles.selectedIcon}>
                <ThemedIcon
                  name={(CATEGORY_ICONS[picked.category] ?? "barbell-outline") as never}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.selectedText}>
                <Text style={styles.selectedLabel}>已选择动作</Text>
                <Text style={styles.selectedName} numberOfLines={1}>{picked.name}</Text>
                <Text style={styles.selectedMeta}>
                  {picked.muscleGroup}
                  {picked.equipment ? ` · ${picked.equipment}` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setPicked(null)}
                hitSlop={8}
                accessibilityLabel="重新选择动作"
                style={styles.replaceBtn}
              >
                <Text style={styles.replaceText}>更换</Text>
              </Pressable>
            </View>

            {picked.key === "" ? (
              <SheetSection title="动作名称" hint="自定义动作会保存在这条训练记录里">
                <TextInput
                  style={styles.input}
                  value={picked.name}
                  onChangeText={(t) => setPicked({ ...picked, name: t })}
                  placeholder="例如：史密斯机卧推"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                />
              </SheetSection>
            ) : null}

            <SheetSection title="组数与次数" hint="可以直接输入，也可以用两侧按钮微调">
              <NumberField
                colors={colors}
                label="组数"
                suffix="组"
                value={sets}
                onMinus={() => setSets((v) => stepNumber(v, -1, SETS_MIN, SETS_MAX, Number(DEFAULT_SETS)))}
                onPlus={() => setSets((v) => stepNumber(v, 1, SETS_MIN, SETS_MAX, Number(DEFAULT_SETS)))}
                onChange={setSets}
              />
              <NumberField
                colors={colors}
                label="每组次数"
                suffix="次"
                value={reps}
                onMinus={() => setReps((v) => stepNumber(v, -1, REPS_MIN, REPS_MAX, Number(DEFAULT_REPS)))}
                onPlus={() => setReps((v) => stepNumber(v, 1, REPS_MIN, REPS_MAX, Number(DEFAULT_REPS)))}
                onChange={setReps}
              />
            </SheetSection>

            <SheetSection title="负重" hint="自重动作可以留空" last>
              <NumberField
                colors={colors}
                label="重量"
                suffix="kg"
                value={weight}
                placeholder="自重"
                onMinus={() => setWeight((v) => stepWeight(v, -WEIGHT_STEP))}
                onPlus={() => setWeight((v) => stepWeight(v, WEIGHT_STEP))}
                onChange={setWeight}
                max={WEIGHT_MAX}
              />
              <View style={styles.volumeHint}>
                <ThemedIcon name="analytics-outline" size={16} color={colors.primary} />
                <Text style={styles.volumeHintText}>
                  {totalVolume === null
                    ? `预计完成 ${sets || 0} 组 × ${reps || 0} 次`
                    : `预计训练容量 ${totalVolume.toLocaleString("zh-CN")} kg`}
                </Text>
              </View>
            </SheetSection>
          </ScrollView>

          <View style={styles.footer}>
            <SheetStickyCta
              label="加入训练"
              icon="checkmark"
              onPress={confirm}
              disabled={!picked.name.trim()}
              secondaryLabel="返回动作列表"
              onSecondary={() => setPicked(null)}
            />
          </View>
        </>
      )}
    </View>
  );
}

function NumberField({
  colors,
  label,
  value,
  onChange,
  onMinus,
  onPlus,
  suffix,
  placeholder,
  max = 9999,
}: {
  colors: ThemeColors;
  label: string;
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
    <View style={styles.numberField}>
      <View style={styles.numberFieldHead}>
        <Text style={styles.numberLabel}>{label}</Text>
        <Text style={styles.numberSuffix}>{suffix}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={onMinus} accessibilityLabel={`减少${label}`}>
          <ThemedIcon name="remove" size={17} color={colors.primary} />
        </Pressable>
        <TextInput
          style={styles.stepInput}
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
        <Pressable style={styles.stepBtn} onPress={onPlus} accessibilityLabel={`增加${label}`}>
          <ThemedIcon name="add" size={17} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, gap: 10 },
    flexOne: { flex: 1 },
    paper: { backgroundColor: colors.surface, borderRadius: 18 },
    panelHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    backBtn: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    backBtnPressed: { opacity: 0.68 },
    backText: { flex: 1, minWidth: 0, gap: 1 },
    backTitle: { fontSize: typography.callout.fontSize, fontWeight: "800", color: colors.text },
    backHint: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    stepPill: {
      minWidth: 52,
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    stepPillText: { fontSize: typography.caption.fontSize, fontWeight: "800", color: colors.primary, fontVariant: ["tabular-nums"] },
    scrollBody: { gap: 12, paddingTop: 2, paddingBottom: 8 },
    catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    catCard: {
      width: "48%",
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    catCardActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    catIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    catIconActive: { backgroundColor: colors.surfaceStrong },
    catText: { flex: 1, minWidth: 0, gap: 1 },
    catName: { fontSize: typography.callout.fontSize, fontWeight: "700", color: colors.text },
    catNameActive: { color: colors.primary, fontWeight: "800" },
    catCount: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 },
    listHeadText: { fontSize: typography.caption.fontSize, color: colors.textMuted, fontWeight: "600" },
    list: {
      overflow: "hidden",
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: { backgroundColor: colors.primarySoft },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    rowMain: { flex: 1, minWidth: 0, gap: 2 },
    rowName: { fontSize: typography.callout.fontSize, fontWeight: "700", color: colors.text },
    rowMeta: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    empty: { alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 26 },
    emptyTitle: { fontSize: typography.callout.fontSize, fontWeight: "700", color: colors.text },
    emptyHint: { fontSize: typography.caption.fontSize, color: colors.textMuted, textAlign: "center" },
    freeRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      borderStyle: "dashed",
    },
    freeRowPressed: { opacity: 0.76 },
    freeText: { fontSize: typography.callout.fontSize, fontWeight: "800", color: colors.primary },
    selectedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 13,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    selectedIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    selectedText: { flex: 1, minWidth: 0, gap: 1 },
    selectedLabel: { fontSize: typography.micro.fontSize, fontWeight: "800", color: colors.primary, letterSpacing: 0.5 },
    selectedName: { fontSize: typography.body.fontSize, fontWeight: "800", color: colors.text },
    selectedMeta: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    replaceBtn: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    replaceText: { fontSize: typography.caption.fontSize, fontWeight: "800", color: colors.primary },
    input: {
      minHeight: 46,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      fontSize: typography.callout.fontSize,
      color: colors.text,
    },
    numberField: { gap: 7, padding: 11, borderRadius: 16, backgroundColor: colors.surfaceMuted },
    numberFieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    numberLabel: { fontSize: typography.caption.fontSize, fontWeight: "800", color: colors.textSecondary },
    numberSuffix: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    stepInput: {
      flex: 1,
      minWidth: 52,
      textAlign: "center",
      backgroundColor: colors.surfaceStrong,
      borderRadius: 14,
      paddingVertical: 10,
      fontSize: typography.headline.fontSize,
      fontWeight: "800",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    volumeHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
    },
    volumeHintText: { flex: 1, fontSize: typography.caption.fontSize, fontWeight: "700", color: colors.primary },
    footer: { paddingTop: 2 },
  });
