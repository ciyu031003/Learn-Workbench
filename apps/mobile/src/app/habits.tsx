import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { typography } from "@/theme/tokens";
import {
  RefreshControl,
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { PressButton } from "@/components/press-button";
import { FloatField } from "@/components/float-field";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { readableAccent } from "@/lib/habit-accent";
import { useTheme } from "@/theme";
import { useRefreshable } from "@/lib/use-refresh";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  HABIT_TEMPLATES, HABIT_WEEKDAY_LABELS, computeHabitStats, habitTimeLabel, isHabitDone, isScheduled, normalizeHabitTime, toDateKey,
  type Habit, type HabitLog,
} from "@learn-workbench/shared";

/** 内置习惯图标（约 24 个，覆盖常见健康 / 学习 / 生活场景） */
const HABIT_ICONS = [
  "💧", "🌙", "🧘", "📖", "👟", "✍️", "🥗", "🏃",
  "💪", "🧠", "☀️", "🎯", "🛏️", "🦷", "🧴", "🍵",
  "🚭", "📵", "🎧", "🧹", "💊", "🐶", "💰", "🙏",
];

type HabitRow = Habit;

/** V3 习惯打卡（移动端）：今日 One-Tap + streak + 近 7 天条 */
export default function HabitsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 正在编辑的习惯 id（null = 新建） */
  const [editingId, setEditingId] = useState<number | null>(null);
  /** 长按卡片后的动作小窗（编辑 / 删除） */
  const [actionHabit, setActionHabit] = useState<HabitRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✅");
  const [isBoolean, setIsBoolean] = useState(true);
  const [targetValue, setTargetValue] = useState("");
  // Bug 7c：可选时间段（HH:MM，留空 = 不限定）+ 自定义 emoji 入口
  const [remindStart, setRemindStart] = useState("");
  const [remindEnd, setRemindEnd] = useState("");
  const [customIcon, setCustomIcon] = useState("");

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/habits", { headers: headers() });
      const d = await r.json();
      if (r.ok) {
        setHabits(Array.isArray(d.habits) ? d.habits : []);
        setLogs(Array.isArray(d.logs) ? d.logs : []);
      }
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const { refreshing, onRefresh } = useRefreshable(load);

  const logMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) m.set(`${l.habitId}|${l.logDate.slice(0, 10)}`, Number(l.value));
    return m;
  }, [logs]);

  /** 7 天条下面的星期缩写（日→六） */
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;

const last7 = useMemo(() => {
    const out: { key: string; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - i);
      out.push({ key: toDateKey(d), date: d });
    }
    return out;
  }, [today]);

  const toggle = async (h: HabitRow) => {
    const done = logMap.get(`${h.id}|${todayKey}`) !== undefined;
    setBusy(h.id);
    try {
      const r = done
        ? await fetch(`${getApiUrl()}/api/habits/logs?habitId=${h.id}&date=${todayKey}`, { method: "DELETE", headers: headers() })
        : await fetch(getApiUrl() + "/api/habits/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers() },
            body: JSON.stringify({ habitId: h.id, date: todayKey, value: 1 }),
          });
      if (r.ok) await load();
    } catch {
      Alert.alert("操作失败", "请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("请填写习惯名称");
      return;
    }
    // 时间段：要么两端都合法，要么都不传（避免半个区间）
    const s = normalizeHabitTime(remindStart);
    const e = normalizeHabitTime(remindEnd);
    if ((remindStart.trim() || remindEnd.trim()) && !(s && e)) {
      Alert.alert("时间段格式不对", "请按 07:00 / 08:00 的 24 小时制填写，或两端都留空");
      return;
    }
    setSaving(true);
    try {
      // 有 editingId 就是编辑（PATCH），否则新建（POST）
      // 编辑走 /api/habits/{id}（PATCH），新建走集合（POST）
      const r = await fetch(getApiUrl() + "/api/habits" + (editingId === null ? "" : "/" + editingId), {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          name: name.trim(),
          icon,
          isBoolean,
          targetValue: isBoolean ? null : Number(targetValue) || null,
          remindStart: s,
          remindEnd: e,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "保存失败");
      }
      // 新建习惯时**同时**在「每日任务」里建一条同名任务（v12 P1-2「两者都要」）。
      // 首页任务列表会按标题去重，不会出现两条。
      if (editingId === null) {
        const today = toDateKey(new Date());
        await fetch(getApiUrl() + "/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({ title: "[习惯] " + name.trim(), taskDate: today, taskType: "review" }),
        }).catch(() => null);
      }
      closeSheet();
      await load();
    } catch (err) {
      Alert.alert("保存失败", err instanceof Error ? err.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  /** 打开「编辑习惯」：把现有值灌进表单 */
  const openEdit = (h: HabitRow) => {
    setEditingId(h.id);
    setName(h.name);
    setIcon(h.icon ?? "✅");
    setCustomIcon(h.icon && !HABIT_ICONS.includes(h.icon) ? h.icon : "");
    setIsBoolean(h.isBoolean);
    setTargetValue(h.targetValue === null || h.targetValue === undefined ? "" : String(h.targetValue));
    setRemindStart(h.remindStart ?? "");
    setRemindEnd(h.remindEnd ?? "");
    setSheetOpen(true);
  };

  /** 删除习惯（软删除：打卡历史保留） */
  const removeHabit = (h: HabitRow) => {
    Alert.alert("删除习惯", `确定删除「${h.name}」吗？历史打卡会保留，但不再计入统计。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const r = await fetch(getApiUrl() + "/api/habits/" + h.id, { method: "DELETE", headers: headers() });
              if (!r.ok) throw new Error("删除失败");
              await load();
            } catch (e) {
              Alert.alert("删除失败", e instanceof Error ? e.message : "请稍后重试");
            }
          })();
        },
      },
    ]);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingId(null);
    setName("");
    setIcon("✅");
    setIsBoolean(true);
    setTargetValue("");
    setRemindStart("");
    setRemindEnd("");
    setCustomIcon("");
  };

  const scheduledToday = habits.filter((h) => isScheduled(h.schedule, today)).length;
  const doneToday = habits.filter((h) => {
    const v = logMap.get(`${h.id}|${todayKey}`);
    return v !== undefined && isHabitDone(h, v);
  }).length;

  return (
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceStrong} />
      }>
      <ScreenHeader large scrollY={headerScroll.scrollY} title="习惯" subtitle={`今日 ${doneToday}/${scheduledToday} 已完成`} />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>新建习惯</Text>
      </PressableScale>

      {loading ? (
        <SkeletonList count={4} />
      ) : habits.length === 0 ? (
        <>
          {/* v13 U12：空状态加暖色几何底纹（3%–7% 不透明度） */}
          <EmptyState
            icon="repeat-outline"
            title="还没有习惯"
            hint="从下方模板快速开始，或自定义一个"
            pattern="bauhaus"
          />
          <View style={styles.tplRow}>
            {HABIT_TEMPLATES.map((t) => (
              <Pressable
                key={t.name}
                style={styles.tplChip}
                onPress={() => {
                  setName(t.name);
                  setIcon(t.icon);
                  setIsBoolean(t.isBoolean);
                  setTargetValue(t.targetValue === null ? "" : String(t.targetValue));
                  setSheetOpen(true);
                }}
              >
                <Text style={styles.tplText}>{t.icon} {t.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          {/* 全部完成态：当天有排期且全部打卡时给一次明确的正反馈 */}
          {scheduledToday > 0 && doneToday === scheduledToday ? (
            <View style={styles.allDone}>
              <ThemedIcon name="trophy-outline" size={18} color={colors.accentStrong} />
              <View style={styles.allDoneBody}>
                <Text style={styles.allDoneTitle}>今天的习惯全部完成</Text>
                <Text style={styles.allDoneHint}>保持节奏，明天同一时间继续</Text>
              </View>
            </View>
          ) : null}
          {habits.map((h) => {
          const v = logMap.get(`${h.id}|${todayKey}`);
          const done = v !== undefined && isHabitDone(h, v);
          const st = computeHabitStats(h, logs, today);
          const scheduled = isScheduled(h.schedule, today);
          /** 守门后的强调色：老数据的空串/近白色不会再把卡片刷成白条 */
          const accent = readableAccent(h.color, colors.primary);
          return (
            <Pressable
              key={h.id}
              onLongPress={() => setActionHabit(h)}
              delayLongPress={280}
              accessibilityLabel={`${h.name}，长按可编辑或删除`}
            >
            <Card style={[styles.item, styles.itemCanvas, !scheduled && { opacity: 0.6 }]}>
              {/*
                强调色只表达状态：未打卡时左轨保持中性，今日打卡后才点亮。
                原来整张卡用 accent 铺底 + 描边 + 厚涂块 + 柔光，四层大面积上色是"丑"的主因。
              */}
              <View pointerEvents="none" style={[styles.itemRail, done && { backgroundColor: accent }]} />
              <View style={styles.itemRow}>
                <Pressable
                  onPress={() => void toggle(h)}
                  disabled={busy === h.id}
                  style={[styles.check, done && { backgroundColor: accent, borderColor: accent }]}
                >
                  {busy === h.id ? (
                    <ActivityIndicator color={done ? "#fff" : colors.primary} />
                  ) : done ? (
                    <ThemedIcon name="checkmark" size={18} color="#fff" />
                  ) : (
                    <Text style={styles.checkIcon}>{h.icon ?? "○"}</Text>
                  )}
                </Pressable>

                <View style={styles.itemBody}>
                  <View style={styles.itemHeadRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{h.name}</Text>
                    {st.currentStreak > 0 ? <Text style={styles.streak}>🔥 {st.currentStreak}</Text> : null}
                    {habitTimeLabel(h) ? <Text style={styles.timeBadge}>{habitTimeLabel(h)}</Text> : null}
                    {!scheduled ? <Text style={styles.muted}>今日不排期</Text> : null}
                    {done ? <Text style={[styles.doneTag, { color: accent }]}>已完成</Text> : null}
                  </View>
                  {/* 统计行改「标签 + 数值」，层次比一整句更清楚 */}
                  <View style={styles.statRow}>
                    <Text style={styles.statItem}>
                      近 7 天 <Text style={styles.statValue}>{st.weekRate}%</Text>
                    </Text>
                    <Text style={styles.statItem}>
                      近 30 天 <Text style={styles.statValue}>{st.monthRate}%</Text>
                    </Text>
                  </View>
                  {/* 7 天条做成一条有意的"轨道"：底槽 + 圆点，避免看起来像随机白条 */}
                  <View style={styles.stripTrack}>
                    <View style={styles.strip}>
                      {last7.map((d) => {
                        const dv = logMap.get(`${h.id}|${d.key}`);
                        const dDone = dv !== undefined && isHabitDone(h, dv);
                        const dSched = isScheduled(h.schedule, d.date);
                        return (
                          <View
                            key={d.key}
                            style={[
                              styles.stripDot,
                              dDone ? { backgroundColor: accent } : dSched ? styles.stripDotOff : styles.stripDotSkip,
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                  {/* 星期标签：让 7 天条能被读懂，而不是一排无意义的小点 */}
                  <View style={styles.stripLabels}>
                    {last7.map((d) => (
                      <Text key={d.key} style={styles.stripLabel}>
                        {WEEKDAY_SHORT[d.date.getDay()]}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            </Card>
            </Pressable>
          );
          })}
        </>
      )}

      {/* 长按卡片：编辑 / 删除（v12 P1-2） */}
      <BottomSheet
        visible={actionHabit !== null}
        onClose={() => setActionHabit(null)}
        title={actionHabit?.name ?? "习惯"}
      >
        <View style={styles.actionSheet}>
          <Pressable
            style={styles.actionRow}
            accessibilityLabel="编辑习惯"
            onPress={() => {
              const h = actionHabit;
              setActionHabit(null);
              if (h) openEdit(h);
            }}
          >
            <ThemedIcon name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.actionText}>编辑</Text>
            <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
          <Pressable
            style={styles.actionRow}
            accessibilityLabel="删除习惯"
            onPress={() => {
              const h = actionHabit;
              setActionHabit(null);
              if (h) removeHabit(h);
            }}
          >
            <ThemedIcon name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>删除</Text>
            <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheetOpen} onClose={closeSheet} title={editingId === null ? "新建习惯" : "编辑习惯"} height="86%">
        <View style={styles.form}>
          {/* 图标选择器：内置 ~24 个常用图标，点选高亮；也可自定义 emoji */}
          <Text style={styles.label}>图标</Text>
          <View style={styles.iconGrid}>
            {HABIT_ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => {
                  setIcon(ic);
                  setCustomIcon("");
                }}
                style={[styles.iconCell, icon === ic && customIcon === "" && styles.iconCellActive]}
              >
                <Text style={styles.iconGlyph}>{ic}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="自定义 emoji（可选）"
            value={customIcon}
            onChangeText={(v) => {
              const t = v.slice(0, 2);
              setCustomIcon(t);
              if (t.trim()) setIcon(t.trim());
            }}
            placeholder="例如 🌱"
          />

          {/* v13 U6：浮动标签输入框（技法参考 uiverse.io/Li-Deheng/tiny-chicken-50, MIT） */}
          <FloatField label="名称" value={name} onChangeText={setName} placeholder="例如：饮水 / 早睡" />

          <Text style={styles.label}>类型</Text>
          <View style={styles.kindRow}>
            <Pressable onPress={() => setIsBoolean(true)} style={[styles.kindChip, isBoolean && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, isBoolean && styles.kindChipTextActive]}>打卡型</Text>
            </Pressable>
            <Pressable onPress={() => setIsBoolean(false)} style={[styles.kindChip, !isBoolean && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, !isBoolean && styles.kindChipTextActive]}>量化型</Text>
            </Pressable>
          </View>
          {!isBoolean ? (
            <Field label="目标值" value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" placeholder="8" />
          ) : null}

          {/* 可选时间段：只存 + 展示（决策 D5：本期不发本地通知） */}
          <Text style={styles.label}>时间段（可选）</Text>
          <View style={styles.timeRow}>
            <Field
              value={remindStart}
              onChangeText={setRemindStart}
              placeholder="07:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              containerStyle={styles.timeField}
            />
            <Text style={styles.timeDash}>–</Text>
            <Field
              value={remindEnd}
              onChangeText={setRemindEnd}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              containerStyle={styles.timeField}
            />
          </View>
          <Text style={styles.muted}>留空表示不限定时间；本期只做记录与展示，不会触发提醒。</Text>

          {/* v13 U5：主 CTA 用按压反馈按钮（按下 0.97 + loading 文案切换） */}
          <PressButton
            label="保存习惯"
            loadingLabel="保存中…"
            loading={saving}
            icon="checkmark-circle-outline"
            onPress={() => void submit()}
          />
        </View>
      </BottomSheet>
    </Animated.ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    tplRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tplChip: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
    tplText: { fontSize: 12, color: colors.text },
    item: { gap: 10 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    // 中性卡面 + 仅状态用的左侧细轨（强调色不做大面积铺色）
    itemCanvas: { overflow: "hidden", paddingLeft: 14 },
    itemRail: {
      position: "absolute",
      left: 0,
      top: 14,
      bottom: 14,
      width: 3,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
      backgroundColor: colors.border,
    },
    doneTag: { fontSize: 11, fontWeight: "800" },
    actionSheet: { gap: 10 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    actionText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
    check: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    checkIcon: { fontSize: 18 },
    itemBody: { flex: 1, minWidth: 0, gap: 2 },
    itemHeadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      flexShrink: 1,
    },
    streak: { fontSize: 12, fontWeight: "800", color: colors.accentStrong },
    timeBadge: { fontSize: 11, fontWeight: "700", color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    muted: { fontSize: 11, color: colors.textMuted },
    statRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
    statItem: { fontSize: 11, color: colors.textMuted },
    statValue: { fontSize: 12, fontWeight: "800", color: colors.text },
    stripTrack: {
      alignSelf: "flex-start",
      marginTop: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    strip: { flexDirection: "row", gap: 4 },
    stripLabels: { flexDirection: "row", gap: 4, paddingHorizontal: 8, marginTop: 3 },
    allDone: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accentSoft,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    allDoneBody: { flex: 1, minWidth: 0, gap: 2 },
    allDoneTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
    allDoneHint: { fontSize: 11, color: colors.textMuted },
    stripLabel: { width: 16, textAlign: "center", fontSize: 9, color: colors.textFaint },
    stripDot: { height: 6, width: 16, borderRadius: 999, backgroundColor: colors.border },
    stripDotOff: { backgroundColor: colors.borderStrong },
    stripDotSkip: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    iconCell: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconCellActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
    iconGlyph: { fontSize: 20 },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    timeField: { flex: 1, minWidth: 0 },
    timeDash: { fontSize: 16, color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });