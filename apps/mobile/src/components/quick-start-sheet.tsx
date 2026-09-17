import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import {
  ContentPicker,
  EMPTY_CONTENT,
  contentLabelOf,
  type ContentChoice,
  type ContentSource,
} from "@/components/content-picker";
import { useTheme } from "@/theme";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { SPORT_CATALOG, exerciseTypeOptions, type SportItem } from "@learn-workbench/shared";

/** 一键开始的会话类型（由 App 决定，随后直接进入计时） */
export interface QuickStartChoice {
  /** focus=学习专注（写专注 sessions）；exercise=运动（写运动记录） */
  kind: "focus" | "exercise";
  /** countdown=倒计时；stopwatch=正向秒表 */
  timerMode: "countdown" | "stopwatch";
  minutes?: number;
  sportKey?: string;
  sportName?: string;
  /** v5 P2-1：本次绑定的学习内容（写进 focus_sessions.tag） */
  contentLabel?: string;
  contentSource?: ContentSource;
  /** 本轮仅用于拼 label，不落库（为将来结构化列预留） */
  phaseId?: number;
  topicId?: number;
}

/**
 * 「一键开始」弹层。
 *
 * 交互（v1.4.2 修正）：**选择 ≠ 开始**。
 * 用户在这里只做选择（学什么 / 时长 / 倒计时还是秒表 / 运动项目），
 * **只有点底部的「开始计时」按钮才真正进入计时**；
 * 侧滑返回、点空白、返回键一律只是关闭弹层、退回首页（不启动任何计时）。
 * 之前"选完立即开始"会让"想退出的人"被动进入计时（真机反馈）。
 */
export function QuickStartSheet({
  visible,
  onClose,
  onPick,
  onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (choice: QuickStartChoice) => void;
  /** 退场动画结束、Modal 卸载后回调（父级用它延后打开全屏计时器） */
  onClosed?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<"learning" | "exercise">("learning");
  const [sportType, setSportType] = useState<string>(exerciseTypeOptions[0]?.type ?? "AEROBIC");
  const [sport, setSport] = useState<SportItem | null>(null);
  const [sportMinutes, setSportMinutes] = useState(30);
  /** v5 P2-1：这次学什么（默认不指定；不做"记住上次"——D4） */
  const [content, setContent] = useState<ContentChoice>(EMPTY_CONTENT);
  /** 学习：时长与模式的**选择态**（不再直接开始） */
  const [learningMinutes, setLearningMinutes] = useState(25);
  const [learningMode, setLearningMode] = useState<"countdown" | "stopwatch">("countdown");
  /** 运动：模式的选择态 */
  const [exerciseMode, setExerciseMode] = useState<"countdown" | "stopwatch">("countdown");

  const sports = useMemo(
    () => SPORT_CATALOG.filter((s) => s.type === sportType),
    [sportType]
  );

  /** 每次关闭都回到默认选择（D4：不记住上次）——所有关闭路径（含侧滑/点空白）都会走它 */
  const reset = () => {
    setContent(EMPTY_CONTENT);
    setLearningMinutes(25);
    setLearningMode("countdown");
    setExerciseMode("countdown");
    setSport(null);
    setSportMinutes(30);
    setTab("learning");
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickedSport = sport ?? sports[0] ?? null;
  /** 底部按钮文案：把当前选择说清楚，避免"点错才知道会开始" */
  const startLabel =
    tab === "learning"
      ? learningMode === "stopwatch"
        ? "开始计时 · 学习（正向计时）"
        : `开始计时 · 学习 ${learningMinutes} 分钟`
      : exerciseMode === "stopwatch"
        ? `开始计时 · ${pickedSport?.name ?? "运动"}（正向计时）`
        : `开始计时 · ${pickedSport?.name ?? "运动"} ${sportMinutes} 分钟`;

  const start = () => {
    if (tab === "learning") {
      const label = contentLabelOf(content);
      onPick({
        kind: "focus",
        timerMode: learningMode,
        minutes: learningMode === "countdown" ? learningMinutes : undefined,
        contentLabel: label ?? undefined,
        // 没填内容时明确记为 none（而不是留下一个可能会被误读的 source）
        contentSource: label ? content.source : "none",
        phaseId: label ? content.phaseId : undefined,
        topicId: label ? content.topicId : undefined,
      });
      close();
      return;
    }
    // 只接受"当前分类下真实存在"的项目：否则会静默回落到目录第一项，
    // 出现"选的是拉伸、记的是篮球"这种错配
    if (!pickedSport) return;
    onPick({
      kind: "exercise",
      timerMode: exerciseMode,
      minutes: exerciseMode === "countdown" ? sportMinutes : undefined,
      sportKey: pickedSport.key,
      sportName: pickedSport.name,
    });
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="一键开始" height="62%" onClosed={onClosed}>
      <View style={styles.tabs}>
        {(
          [
            { key: "learning", label: "学习", icon: "book-outline" },
            { key: "exercise", label: "运动", icon: "barbell-outline" },
          ] as const
        ).map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              accessibilityRole="button"
            >
              <ThemedIcon name={t.icon} size={16} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "learning" ? (
        <View style={styles.body}>
          {/* v5 P2-1：先定"这次学什么"，再选时长/模式；不选就是自由专注 */}
          <ContentPicker value={content} onChange={setContent} />

          <View style={styles.thisTime}>
            <Text style={styles.thisTimeLabel}>本次学习</Text>
            <Text style={styles.thisTimeValue} numberOfLines={1}>
              {contentLabelOf(content) ?? "自由专注（不绑定内容）"}
            </Text>
          </View>

          {/* 时长 / 模式：**只是选择**，不会开始计时（开始统一走底部按钮） */}
          <View style={styles.minuteRow}>
            {[15, 25, 45].map((m) => {
              const active = learningMode === "countdown" && learningMinutes === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.minuteChip, active && styles.minuteChipActive]}
                  onPress={() => {
                    setLearningMode("countdown");
                    setLearningMinutes(m);
                  }}
                >
                  <Text style={[styles.minuteChipText, active && styles.minuteChipTextActive]}>{m} 分钟</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.minuteRow}>
            {(
              [
                { key: "countdown", label: "倒计时", icon: "timer-outline" },
                { key: "stopwatch", label: "正向计时", icon: "play-forward-outline" },
              ] as const
            ).map((o) => {
              const active = learningMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setLearningMode(o.key)}
                >
                  <ThemedIcon name={o.icon} size={16} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.typeRow}>
            {exerciseTypeOptions.map((t) => {
              const active = sportType === t.type;
              return (
                <Pressable
                  key={t.type}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => {
                    setSportType(t.type);
                    setSport(null);
                  }}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sportGrid}>
            {sports.map((s) => {
              const active = (sport ?? sports[0])?.key === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.sportChip, active && styles.sportChipActive]}
                  onPress={() => setSport(s)}
                >
                  <Text style={[styles.sportChipText, active && styles.sportChipTextActive]} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.minuteRow}>
            {[15, 30, 45, 60].map((m) => {
              const active = sportMinutes === m;
              return (
                <Pressable key={m} style={[styles.minuteChip, active && styles.minuteChipActive]} onPress={() => setSportMinutes(m)}>
                  <Text style={[styles.minuteChipText, active && styles.minuteChipTextActive]}>{m} 分钟</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.minuteRow}>
            {[15, 30, 45, 60].map((m) => {
              const active = exerciseMode === "countdown" && sportMinutes === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.minuteChip, active && styles.minuteChipActive]}
                  onPress={() => {
                    setExerciseMode("countdown");
                    setSportMinutes(m);
                  }}
                >
                  <Text style={[styles.minuteChipText, active && styles.minuteChipTextActive]}>{m} 分钟</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.minuteRow}>
            {(
              [
                { key: "countdown", label: "倒计时", icon: "timer-outline" },
                { key: "stopwatch", label: "正向计时", icon: "play-forward-outline" },
              ] as const
            ).map((o) => {
              const active = exerciseMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setExerciseMode(o.key)}
                >
                  <ThemedIcon name={o.icon} size={16} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/*
        唯一的启动入口（v1.4.2）：上面所有的点选都只改选择态，
        只有这个按钮会调用 `onPick` 真正开始计时。
        侧滑返回 / 点空白 / 返回键走 `close()`，只关闭弹层、退回首页。
      */}
      <View style={styles.startBar}>
        <PressableScale haptic style={styles.startBtn} onPress={start}>
          <ThemedIcon name="play" size={18} color="#fff" />
          <Text style={styles.startBtnText} numberOfLines={1}>
            {startLabel}
          </Text>
        </PressableScale>
        <Text style={styles.startHint}>选好后点这里开始；返回或点空白处只会退出，不会开始计时</Text>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabs: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    tabActive: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.borderStrong },
    tabText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    body: { gap: spacing.md, paddingBottom: spacing.md },
    thisTime: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 2,
    },
    thisTimeLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
    thisTimeValue: { flex: 1, ...typography.body, fontWeight: "700", color: colors.text },
    bigCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bigIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    bigBody: { flex: 1, gap: 2 },
    bigTitle: { ...typography.headline, color: colors.text },
    bigSub: { ...typography.caption, color: colors.textMuted },
    lineCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    lineTitle: { ...typography.body, fontWeight: "700", color: colors.text },
    minuteRow: { flexDirection: "row", gap: 8 },
    minuteChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
    },
    minuteChipActive: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.primary },
    minuteChipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    minuteChipTextActive: { color: colors.primary },
    /** 模式选择（倒计时 / 正向计时） */
    modeChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    modeChipActive: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.primary },
    modeChipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    modeChipTextActive: { color: colors.primary },
    /** 唯一的启动入口 */
    startBar: { gap: 6, paddingTop: spacing.sm, paddingBottom: spacing.sm },
    startBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    startBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    startHint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    typeChipActive: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.primary },
    typeChipText: { fontSize: 12, color: colors.textMuted },
    typeChipTextActive: { color: colors.primary, fontWeight: "700" },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    sportChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      maxWidth: "47%",
    },
    sportChipActive: { backgroundColor: colors.primary },
    sportChipText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
    sportChipTextActive: { color: "#fff" },
  });
