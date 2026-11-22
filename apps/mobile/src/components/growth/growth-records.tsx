import { useMemo, type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ListGroup } from "@/components/list-row";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { groupThousands } from "@/lib/nutrition-views";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { MEAL_LABELS, NO_RECORD } from "./growth-format";
import type { GrowthScreenData } from "./use-growth-data";

/**
 * 今日记录明细：饮食摄入卡 / 训练卡 / 饮水·饮食·训练三行 / 快捷记录胶囊。
 *
 * 这几块不属于「概览层」的五个模块，但重构后成长页首屏只留概览，明细必须继续可达，
 * 所以整块搬到数据看板的最后一节（跳转目标与交互与重构前逐一对应）：
 *  - 饮水 / 饮食 → /nutrition（饮水 +250ml 的乐观增量也保留在原处）
 *  - 训练 → /workout（记录训练 → /workout-add）
 *  - 睡眠 → /sleep
 * 数据来源不变（/api/daily、/api/nutrition/summary、/api/nutrition/target、/api/wellbeing/hydration、/api/workouts）。
 */
export function GrowthTodayRecords({ growth }: { growth: GrowthScreenData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lastMeal = growth.lastMeal;
  const dietKcal = growth.dietKcal;

  return (
    <View style={styles.wrap}>
      {/* 饮食摄入卡：最近一餐 / 今日摄入 ÷ 目标 / 三大宏量条（整卡点进饮食页） */}
      <PressableScale
        haptic
        scaleTo={0.99}
        hitSlop={4}
        style={styles.pressWrap}
        accessibilityRole="button"
        accessibilityLabel={
          "饮食记录，" +
          (dietKcal !== null ? "今日摄入 " + groupThousands(dietKcal) + " 千卡" : "今日还没有记录") +
          "，打开饮食页"
        }
        onPress={() => router.push("/nutrition" as never)}
      >
        <Surface tier="surface" corner={radius.card} padded={false} style={styles.dietCard}>
          <View style={styles.mealTop}>
            <View style={styles.mealThumb}>
              <ThemedIcon name="restaurant-outline" size={22} color={colors.primaryStrong} />
            </View>
            <View style={styles.mealBody}>
              <Text style={styles.mealKicker} numberOfLines={1}>
                {lastMeal
                  ? (growth.mealClock ? growth.mealClock + " · " : "") + MEAL_LABELS[lastMeal.meal]
                  : "最近一餐"}
              </Text>
              <Text style={styles.mealTitle} numberOfLines={1}>
                {lastMeal ? lastMeal.name : "还没有饮食记录"}
              </Text>
              <Text style={styles.mealMeta} numberOfLines={1}>
                {lastMeal ? "点开查看并补记今天的饮食" : "点一下去记今天第一餐"}
              </Text>
            </View>
            <View style={styles.mealKcal}>
              <Text style={[styles.mealKcalValue, tabularNums]} numberOfLines={1}>
                {lastMeal ? String(lastMeal.kcal) : NO_RECORD}
              </Text>
              <Text style={styles.mealKcalUnit}>千卡</Text>
            </View>
          </View>

          <View style={styles.dietTotal}>
            <Text style={styles.dietTotalLabel}>今日摄入 / 目标</Text>
            <Text style={[styles.dietTotalValue, tabularNums]} numberOfLines={1}>
              {dietKcal !== null ? groupThousands(dietKcal) : NO_RECORD}
              <Text style={styles.dietTotalTarget}>
                {growth.dietTargetSource
                  ? " / " + groupThousands(growth.dietTarget) + " 千卡"
                  : " / " + NO_RECORD + " 千卡"}
              </Text>
            </Text>
          </View>

          <View style={styles.macros}>
            <MacroRow
              label="蛋白"
              tone="primary"
              value={growth.todaySummary?.proteinG ?? null}
              target={growth.nutritionTarget?.proteinG ?? null}
              unit="g"
            />
            <MacroRow
              label="碳水"
              tone="success"
              value={growth.todaySummary?.carbsG ?? null}
              target={growth.nutritionTarget?.carbsG ?? null}
              unit="g"
            />
            <MacroRow
              label="脂肪"
              tone="accent"
              value={growth.todaySummary?.fatG ?? null}
              target={growth.nutritionTarget?.fatG ?? null}
              unit="g"
            />
          </View>
        </Surface>
      </PressableScale>

      {/* 训练卡：今日训练 + 记录训练按钮 + 全部训练记录入口 */}
      <Surface tier="surface" corner={radius.card} padded={false} style={styles.trainCard}>
        <View style={styles.trainHead}>
          <View style={styles.trainIcon}>
            <ThemedIcon name="barbell-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.trainBody}>
            <Text style={styles.trainKicker}>今日训练</Text>
            <Text style={styles.trainTitle} numberOfLines={1}>
              {growth.trainingName ?? "还没有训练记录"}
            </Text>
            <Text style={styles.trainMeta} numberOfLines={1}>
              {growth.trainingRecorded
                ? growth.exerciseMinutes +
                  " 分钟" +
                  (growth.trainingActions > 0 ? " · " + growth.trainingActions + " 个动作" : "") +
                  " · 本周 " +
                  (growth.workoutsFailed ? NO_RECORD : growth.weekWorkouts) +
                  " 次"
                : "记录一次训练，今天的状态会更完整"}
            </Text>
          </View>
          <PressableScale
            haptic
            scaleTo={0.94}
            hitSlop={10}
            onPress={() => router.push("/workout-add" as never)}
            style={styles.trainGo}
            accessibilityRole="button"
            accessibilityLabel={growth.trainingRecorded ? "再记录一次训练" : "记录今天的训练"}
          >
            <ThemedIcon name="play" size={15} color={colors.canvas} />
          </PressableScale>
        </View>
        <View style={styles.trainFoot}>
          <Text style={styles.trainFootText}>
            {"训练记录 · 本周 " + (growth.workoutsFailed ? NO_RECORD : growth.weekWorkouts) + " 次"}
          </Text>
          <PressableScale
            haptic
            scaleTo={1}
            hitSlop={10}
            onPress={() => router.push("/workout" as never)}
            style={styles.trainLink}
            accessibilityRole="button"
            accessibilityLabel="查看全部训练记录"
          >
            <Text style={styles.trainLinkText}>全部记录</Text>
            <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
          </PressableScale>
        </View>
      </Surface>

      {/* 今日记录三行：饮水 / 饮食 / 训练，点进对应页面 */}
      <ListGroup>
        <RecordRow
          icon="water-outline"
          iconColor={colors.teal}
          iconBg={colors.surfaceMuted}
          title="饮水"
          subtitle={"目标 " + (growth.waterTarget / 1000).toFixed(1) + " L"}
          value={growth.waterRecorded ? (growth.waterMl / 1000).toFixed(1) + " L" : NO_RECORD}
          accessibilityLabel={
            "饮水 " +
            (growth.waterRecorded ? (growth.waterMl / 1000).toFixed(1) + " 升" : "无记录") +
            "，打开饮食页的饮水记录"
          }
          onPress={() => router.push("/nutrition" as never)}
        />
        <RecordRow
          icon="restaurant-outline"
          iconColor={colors.primaryStrong}
          iconBg={colors.primarySoft}
          title="饮食"
          subtitle={
            growth.summaryFailed
              ? "饮食汇总没加载出来"
              : growth.mealCount > 0
                ? "最近记录 " + growth.mealCount + " 条"
                : "今天还没有记录"
          }
          value={dietKcal !== null ? groupThousands(dietKcal) + " 千卡" : NO_RECORD}
          accessibilityLabel={
            "饮食 " + (dietKcal !== null ? groupThousands(dietKcal) + " 千卡" : "无记录") + "，打开饮食记录"
          }
          onPress={() => router.push("/nutrition" as never)}
        />
        <RecordRow
          icon="barbell-outline"
          iconColor={colors.primary}
          iconBg={colors.primarySoft}
          title="训练"
          subtitle={growth.workoutsFailed ? "本周训练次数没加载出来" : "本周 " + growth.weekWorkouts + " 次"}
          value={growth.trainingRecorded ? growth.exerciseMinutes + " 分钟" : NO_RECORD}
          last
          accessibilityLabel={
            "训练 " +
            (growth.trainingRecorded ? growth.exerciseMinutes + " 分钟" : "无记录") +
            "，打开训练记录"
          }
          onPress={() => router.push("/workout" as never)}
        />
      </ListGroup>

      {/* 快捷记录：就地 +250ml 饮水（乐观增量）与睡眠入口（详情仍走 /sleep） */}
      <View style={styles.quickRow}>
        <QuickPill
          icon="add"
          label={growth.waterBusy ? "记录中…" : "饮水 +250 ml"}
          accessibilityLabel="记录饮水 250 毫升"
          disabled={growth.waterBusy}
          onPress={() => void growth.quickWater(250)}
        />
        <QuickPill
          icon="moon-outline"
          label={growth.sleepPillLabel}
          accessibilityLabel={
            growth.sleepRecorded
              ? "打开睡眠详情，最近一晚 " + growth.sleepHours?.toFixed(1) + " 小时"
              : "记录睡眠"
          }
          onPress={() => router.push("/sleep" as never)}
        />
      </View>
    </View>
  );
}

/** 三大营养素一行：标签 + 进度条 + 「已摄入 / 目标」；缺数据一律「—」，不编造 0 */
function MacroRow({
  label,
  tone,
  value,
  target,
  unit,
}: {
  label: string;
  tone: "primary" | "success" | "accent";
  value: number | null;
  target: number | null;
  unit: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasTarget = target !== null && target > 0;
  const ratio = value !== null && hasTarget ? Math.max(0, Math.min(1, value / target)) : 0;
  const valueText =
    value === null
      ? NO_RECORD
      : hasTarget
        ? Math.round(value) + " / " + Math.round(target) + unit
        : Math.round(value) + unit;
  const color = (colors[tone] as string | undefined) ?? colors.primary;
  /** 宽度写成 `${number}%` 字面量类型，RN 的 DimensionValue 才收 */
  const fillWidth = `${Math.round(ratio * 100)}%` as `${number}%`;
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.macroTrack, { backgroundColor: colors.chartTrack }]}>
        <View style={[styles.macroFill, { width: fillWidth, backgroundColor: color }]} />
      </View>
      <Text style={[styles.macroValue, tabularNums]} numberOfLines={1}>
        {valueText}
      </Text>
    </View>
  );
}

/** 页内记录行（饮水 / 饮食 / 训练）：整行可点，图标芯片 + 标题 + 副文案 + 右侧数值 + 箭头 */
function RecordRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  last = false,
  accessibilityLabel,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  value: string;
  last?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={1}
      pressedStyle={styles.recordPressed}
      onPress={onPress}
      hitSlop={6}
      style={styles.recordRow}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.recordIcon, { backgroundColor: iconBg }]}>
        <ThemedIcon name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.recordBody}>
        <Text style={styles.recordTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.recordSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.recordValue, tabularNums]} numberOfLines={1}>
        {value}
      </Text>
      <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
      {last ? null : <View pointerEvents="none" style={styles.recordDivider} />}
    </PressableScale>
  );
}

/** 快捷记录胶囊（就地饮水 / 睡眠详情） */
function QuickPill({
  icon,
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      pressedStyle={styles.quickPillPressed}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.quickPill}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy: disabled }}
    >
      <ThemedIcon name={icon} size={15} color={colors.primary} />
      <Text style={styles.quickPillText} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    pressWrap: { borderRadius: radius.card },
    /* 饮食摄入卡 */
    dietCard: { padding: 14 },
    mealTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    mealThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    mealBody: { flex: 1, minWidth: 0, gap: 2 },
    mealKicker: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    mealTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    mealMeta: { ...typography.meta, color: colors.textMuted },
    mealKcal: { alignItems: "flex-end", flexShrink: 0 },
    mealKcalValue: { ...typography.headline, fontWeight: "700", color: colors.text },
    mealKcalUnit: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    dietTotal: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 14,
      paddingTop: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    dietTotalLabel: { ...typography.meta, color: colors.textMuted },
    dietTotalValue: { ...typography.hero, color: colors.text },
    dietTotalTarget: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    macros: { marginTop: 11, gap: spacing.sm },
    macroRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    macroLabel: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, width: 34 },
    macroTrack: { flex: 1, minWidth: 0, height: 6, borderRadius: radius.pill, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: radius.pill },
    macroValue: { ...typography.meta, color: colors.textMuted, width: 78, textAlign: "right" },

    /* 训练卡 */
    trainCard: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.primarySoft },
    trainHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    trainIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      flexShrink: 0,
    },
    trainBody: { flex: 1, minWidth: 0, gap: 2 },
    trainKicker: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    trainTitle: { ...typography.headline, color: colors.text },
    trainMeta: { ...typography.meta, color: colors.textMuted },
    trainGo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
    trainFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    trainFootText: { ...typography.meta, color: colors.textMuted },
    trainLink: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 24 },
    trainLinkText: { ...typography.caption, fontWeight: "600", color: colors.primary },

    /* 今日记录行 */
    recordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 58,
    },
    recordPressed: { backgroundColor: colors.surfaceMuted },
    recordIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    recordBody: { flex: 1, minWidth: 0, gap: 2 },
    recordTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    recordSub: { ...typography.meta, color: colors.textMuted },
    recordValue: { ...typography.callout, fontWeight: "700", color: colors.text },
    recordDivider: {
      position: "absolute",
      bottom: 0,
      left: 58,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    quickRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
    quickPill: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    quickPillPressed: { backgroundColor: colors.surfaceMuted },
    quickPillText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, flexShrink: 1 },
  });
