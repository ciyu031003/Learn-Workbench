import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
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
}

/**
 * 「一键开始」弹层（v4 P2）。
 *
 * 交互：点首页大按钮 → 这里选「学习 25 分钟 / 运动 30 分钟 / 正向计时」→
 * **选完立即开始计时**（不再让用户进计时页后再点一次"开始"）。
 * 运动的可选项目复用 `SPORT_CATALOG`（与既有"添加运动记录"面板同一份数据源）。
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

  const sports = useMemo(
    () => SPORT_CATALOG.filter((s) => s.type === sportType),
    [sportType]
  );

  const pickLearning = (timerMode: "countdown" | "stopwatch", minutes?: number) => {
    onPick({ kind: "focus", timerMode, minutes });
    onClose();
  };

  const pickExercise = (timerMode: "countdown" | "stopwatch") => {
    // 只接受"当前分类下真实存在"的项目：否则会静默回落到目录第一项，
    // 出现"选的是拉伸、记的是篮球"这种错配
    const item = sport ?? sports[0];
    if (!item) return;
    onPick({
      kind: "exercise",
      timerMode,
      minutes: timerMode === "countdown" ? sportMinutes : undefined,
      sportKey: item.key,
      sportName: item.name,
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="一键开始" height="62%" onClosed={onClosed}>
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
          <PressableScale haptic style={styles.bigCard} onPress={() => pickLearning("countdown", 25)}>
            <View style={[styles.bigIcon, { backgroundColor: colors.primary }]}>
              <ThemedIcon name="timer-outline" size={22} color="#fff" />
            </View>
            <View style={styles.bigBody}>
              <Text style={styles.bigTitle}>学习 25 分钟</Text>
              <Text style={styles.bigSub}>倒计时 · 环形进度 · Bing 每日壁纸</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </PressableScale>

          <View style={styles.minuteRow}>
            {[15, 25, 45].map((m) => (
              <PressableScale key={m} haptic style={styles.minuteChip} onPress={() => pickLearning("countdown", m)}>
                <Text style={styles.minuteChipText}>{m} 分钟</Text>
              </PressableScale>
            ))}
          </View>

          <PressableScale haptic style={styles.lineCard} onPress={() => pickLearning("stopwatch")}>
            <ThemedIcon name="play-forward-outline" size={18} color={colors.primary} />
            <View style={styles.bigBody}>
              <Text style={styles.lineTitle}>正向计时（秒表）</Text>
              <Text style={styles.bigSub}>不设上限，结束时按实际时长计入专注</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </PressableScale>
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

          <PressableScale haptic style={styles.bigCard} onPress={() => pickExercise("countdown")}>
            <View style={[styles.bigIcon, { backgroundColor: "#e1781c" }]}>
              <ThemedIcon name="timer-outline" size={22} color="#fff" />
            </View>
            <View style={styles.bigBody}>
              <Text style={styles.bigTitle}>
                开始{(sport ?? sports[0])?.name ?? "运动"} {sportMinutes} 分钟
              </Text>
              <Text style={styles.bigSub}>倒计时结束自动记入运动记录</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </PressableScale>

          <PressableScale haptic style={styles.lineCard} onPress={() => pickExercise("stopwatch")}>
            <ThemedIcon name="play-forward-outline" size={18} color={colors.primary} />
            <View style={styles.bigBody}>
              <Text style={styles.lineTitle}>正向计时（秒表）</Text>
              <Text style={styles.bigSub}>按实际时长记录（秒级，不再取整成分钟）</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </PressableScale>
        </View>
      )}
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
