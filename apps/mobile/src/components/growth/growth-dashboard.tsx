import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { Icon, type IconName } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { GrowthReveal } from "@/components/growth/growth-reveal";
import { typography, type ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { GrowthScreenData } from "@/components/growth/use-growth-data";

/**
 * 成长洞察 · FoodNoms 仪表盘（对齐 demo v12 renderGrowth）。
 *
 * 版式：INSIGHTS 页头 → 连续记录 + 体重（双列）→ 宏量营养素（通栏）
 * → 热量 + 热量平衡（双列）→ 每日目标（通栏）→ 今天的状态 2×2 环卡
 * → 快捷记录 3 格。暖橙是这一页的强调色，与全局蓝色主色区分。
 */

const ORANGE = "#F45B0B";
const ORANGE_SOFT = "#FFE9DE";
const GREEN = "#3CB349";
const BLUE = "#2D9CFF";
const PURPLE = "#6D74E8";
const RED = "#FF3B30";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function chineseDate(date: Date) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${"日一二三四五六"[date.getDay()]}`;
}

export function GrowthDashboard({
  growth,
  onOpenInsights,
}: {
  growth: GrowthScreenData;
  onOpenInsights: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const now = new Date();
  /** 今日热量：未记录时按 0 参与进度，但展示用「—」区分「没记」和「真的 0」。 */
  const dietKcal = growth.dietKcal ?? 0;

  const score = growth.data === null ? "—" : String(growth.readiness.score);
  const macros = useMemo(() => {
    const rows = growth.weekRows.filter((row) => row.entryCount > 0);
    const days = Math.max(1, rows.length);
    const protein = Math.round(rows.reduce((sum, row) => sum + row.proteinG, 0) / days);
    const carbs = Math.round(rows.reduce((sum, row) => sum + row.carbsG, 0) / days);
    const fat = Math.round(rows.reduce((sum, row) => sum + row.fatG, 0) / days);
    return { protein, carbs, fat, rows };
  }, [growth.weekRows]);

  const macroMax = Math.max(1, ...macros.rows.map((row) => row.proteinG + row.carbsG + row.fatG));
  const goalDays = macros.rows.filter((row) => row.kcal >= growth.dietTarget * 0.8 && row.kcal <= growth.dietTarget * 1.15).length;
  const avgKcal = macros.rows.length > 0 ? Math.round(macros.rows.reduce((sum, row) => sum + row.kcal, 0) / macros.rows.length) : 0;
  const balance = avgKcal > 0 ? avgKcal - growth.dietTarget : 0;
  const kgPerWeek = Math.abs((balance * 7) / 7700);

  const proteinTarget = growth.nutritionTarget?.proteinG ?? 0;
  const proteinToday = growth.todaySummary?.proteinG ?? 0;
  const sleepPct = growth.sleepHours === null ? 0 : clamp01(growth.sleepHours / 8);
  const kcalPct = clamp01(dietKcal / Math.max(1, growth.dietTarget));
  const workoutPct = clamp01(growth.weekWorkouts / 3);
  const waterPct = clamp01(growth.waterMl / Math.max(1, growth.waterTarget));

  const dailyRows = [
    {
      key: "kcal",
      label: "热量",
      value: dietKcal > 0 ? String(dietKcal) : "—",
      pct: kcalPct,
      color: ORANGE,
    },
    {
      key: "protein",
      label: "蛋白",
      value: proteinToday > 0 ? `${Math.round(proteinToday)}g` : "—",
      pct: proteinTarget > 0 ? clamp01(proteinToday / proteinTarget) : 0,
      color: BLUE,
    },
    {
      key: "sleep",
      label: "睡眠",
      value: growth.sleepHours === null ? "—" : `${growth.sleepHours.toFixed(1)}h`,
      pct: sleepPct,
      color: GREEN,
    },
    {
      key: "workout",
      label: "训练",
      value: growth.exerciseMinutes > 0 ? `${growth.exerciseMinutes}m` : "0m",
      pct: clamp01(growth.exerciseMinutes / 30),
      color: RED,
    },
  ];

  return (
    <View style={styles.page}>
      {/* 页头 */}
      <GrowthReveal index={0}>
        <View style={styles.head}>
          <View style={styles.headCopy}>
            <Text style={styles.kicker}>INSIGHTS · 第 {isoWeek(now)} 周</Text>
            <Text style={styles.title} accessibilityRole="header">
              成长洞察
            </Text>
            <Text style={styles.headSub}>
              {chineseDate(now)} · 今日状态 {score} 分
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={onOpenInsights}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="编辑成长数据"
          >
            <Text style={styles.editText}>编辑</Text>
          </Pressable>
        </View>
      </GrowthReveal>

      <View style={styles.grid}>
        {/* 连续记录 */}
        <GrowthReveal index={1} style={styles.half}>
          <Pressable
            onPress={() => router.push("/habits" as never)}
            style={styles.streakCard}
            accessibilityRole="button"
            accessibilityLabel={`连续记录 ${growth.streakDays} 天`}
          >
            <View pointerEvents="none" style={styles.streakGlow} />
            <View style={styles.streakHead}>
              <Icon name="flame" size={14} weight="fill" color="#FFFFFF" />
              <Text style={styles.streakKicker}>连续记录</Text>
            </View>
            <Text style={styles.streakValue}>
              {growth.streakDays}
              <Text style={styles.streakUnit}> 天</Text>
            </Text>
            <Text style={styles.streakSub}>本周 {growth.recordedDays} 天有记录</Text>
            <View style={styles.streakShine}>
              <Icon name="sparkle" size={16} weight="fill" color="#FFFFFF" />
            </View>
          </Pressable>
        </GrowthReveal>

        {/* 体重 */}
        <GrowthReveal index={2} style={styles.half}>
          <Pressable
            onPress={() => router.push("/trends" as never)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel="体重趋势"
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>体重</Text>
              <Text style={styles.weightTag}>最新</Text>
            </View>
            <Text style={styles.bigValue}>
              {growth.weightValue ? growth.weightValue.weightKg.toFixed(1) : "—"}
              <Text style={styles.bigUnit}> kg</Text>
            </Text>
            <Text style={[styles.delta, growth.weekWeightDelta !== null && growth.weekWeightDelta > 0 && styles.deltaUp]}>
              {growth.weekWeightDelta === null
                ? "暂无对比"
                : (growth.weekWeightDelta > 0 ? "+" : "") + growth.weekWeightDelta.toFixed(1) + " kg"}
            </Text>
            <WeightSpark points={growth.weightSpark} />
            <View style={styles.weekLetters}>
              {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                <Text key={day} style={styles.weekLetter}>
                  {day}
                </Text>
              ))}
            </View>
          </Pressable>
        </GrowthReveal>

        {/* 宏量营养素 */}
        <GrowthReveal index={3} style={styles.full}>
          <Pressable
            onPress={() => router.push("/nutrition" as never)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel="宏量营养素"
          >
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>宏量营养素</Text>
                <Text style={styles.cardSub}>每日平均 · 近 7 天</Text>
              </View>
              <View style={styles.moreBtn}>
                <Icon name="more" size={14} weight="bold" color={colors.textMuted} />
              </View>
            </View>
            {macros.rows.length === 0 ? (
              <View style={styles.macroEmpty}>
                <Text style={styles.macroEmptyTitle}>近 7 天还没有饮食记录</Text>
                <Text style={styles.macroEmptyHint}>记录一餐后，这里会按天显示蛋白 / 碳水 / 脂肪的构成。</Text>
              </View>
            ) : (
              <>
                <View style={styles.macroChart}>
                  {Array.from({ length: 7 }).map((_, index) => {
                    const row = macros.rows[index];
                    const total = row ? row.proteinG + row.carbsG + row.fatG : 0;
                    const height = total > 0 ? Math.max(10, (total / macroMax) * 78) : 8;
                    const proteinH = total > 0 ? (row.proteinG / total) * height : 0;
                    const carbsH = total > 0 ? (row.carbsG / total) * height : 0;
                    const fatH = total > 0 ? (row.fatG / total) * height : 0;
                    return (
                      <View key={index} style={styles.macroCol}>
                        <View style={[styles.macroBar, { height }, total === 0 && styles.macroBarEmpty]}>
                          {total > 0 ? (
                            <>
                              <View style={{ height: fatH, backgroundColor: PURPLE }} />
                              <View style={{ height: carbsH, backgroundColor: BLUE }} />
                              <View style={{ height: proteinH, backgroundColor: ORANGE }} />
                            </>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.macroDayRow}>
                  {["一", "二", "三", "四", "五", "六", "日"].map((d, i) => (
                    <Text key={d} style={styles.macroDay}>
                      {d}
                    </Text>
                  ))}
                </View>
              </>
            )}
            <View style={styles.macroLegend}>
              <Legend color={ORANGE} label="蛋白" value={`${macros.protein}g`} />
              <Legend color={BLUE} label="碳水" value={`${macros.carbs}g`} />
              <Legend color={PURPLE} label="脂肪" value={`${macros.fat}g`} />
            </View>
          </Pressable>
        </GrowthReveal>

        {/* 热量达标 */}
        <GrowthReveal index={4} style={styles.half}>
          <Pressable
            onPress={() => router.push("/nutrition" as never)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`热量 ${goalDays} 天达标`}
          >
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>热量</Text>
                <Text style={styles.cardSub}>每日目标</Text>
              </View>
              <Icon name="flame" size={13} weight="regular" color={ORANGE} />
            </View>
            <Text style={styles.bigValue}>
              {goalDays}
              <Text style={styles.bigUnit}> 天达标</Text>
            </Text>
            <View style={styles.miniBars}>
              {Array.from({ length: 7 }).map((_, index) => {
                const row = macros.rows[index];
                const pct = row ? clamp01(row.kcal / Math.max(1, growth.dietTarget)) : 0;
                return (
                  <View key={index} style={styles.miniBarTrack}>
                    <View
                      style={[
                        styles.miniBarFill,
                        { height: `${Math.max(8, Math.round(pct * 100))}%` },
                        pct >= 0.8 && pct <= 1.15 ? styles.miniBarOn : styles.miniBarOff,
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </Pressable>
        </GrowthReveal>

        {/* 热量平衡 */}
        <GrowthReveal index={5} style={styles.half}>
          <Pressable
            onPress={() => router.push("/nutrition" as never)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel="热量平衡"
          >
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>热量平衡</Text>
                <Text style={styles.cardSub}>平均缺口</Text>
              </View>
              <Icon name="trend" size={13} weight="regular" color={colors.textMuted} />
            </View>
            <Text style={styles.balanceValue}>
              {avgKcal > 0 ? Math.abs(balance) : "—"}
              <Text style={styles.bigUnit}> Cal / 天</Text>
            </Text>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${Math.min(96, Math.round(clamp01(Math.abs(balance) / Math.max(1, growth.dietTarget)) * 100))}%` }]} />
            </View>
            <Text style={styles.cardSub}>
              {avgKcal > 0 ? (balance >= 0 ? `盈余 · 每周约 +${kgPerWeek.toFixed(1)} kg` : `缺口 · 每周约 ${kgPerWeek.toFixed(1)} kg`) : "有饮食记录后显示"}
            </Text>
          </Pressable>
        </GrowthReveal>

        {/* 每日目标 */}
        <GrowthReveal index={6} style={styles.full}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>每日目标</Text>
                <Text style={styles.cardSub}>今天已完成 {growth.habitPct}%</Text>
              </View>
              <View style={styles.dailyPill}>
                <Text style={styles.dailyPillText}>{growth.recordedDays}/7 天</Text>
              </View>
            </View>
            <View style={styles.dailyRows}>
              {dailyRows.map((row) => (
                <View key={row.key} style={styles.dailyRow}>
                  <View style={[styles.dot, { backgroundColor: row.color }]} />
                  <Text style={styles.dailyLabel}>{row.label}</Text>
                  <View style={styles.dailyTrack}>
                    <View style={[styles.dailyFill, { width: `${Math.round(clamp01(row.pct) * 100)}%`, backgroundColor: row.color }]} />
                  </View>
                  <Text style={styles.dailyValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </GrowthReveal>
      </View>

      {/* 今天的状态 */}
      <GrowthReveal index={7}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>今天的状态</Text>
          <Pressable hitSlop={8} onPress={onOpenInsights} accessibilityRole="button" accessibilityLabel="查看完整数据">
            <Text style={styles.sectionLink}>完整数据 ›</Text>
          </Pressable>
        </View>
      </GrowthReveal>
      <View style={styles.goalGrid}>
        <GrowthReveal index={8} style={styles.half}>
          <GoalCard
            pct={sleepPct}
            value={growth.sleepHours === null ? "—" : growth.sleepHours.toFixed(1)}
            unit="h"
            color={PURPLE}
            name="睡眠"
            sub={growth.sleepHours === null ? "还没有记录" : "目标 8 小时"}
            footLeft={growth.sleepHours === null ? "昨晚" : "昨晚睡眠"}
            footRight={growth.sleepHours !== null && growth.sleepHours >= 7 ? "良好" : "不足"}
            good={growth.sleepHours !== null && growth.sleepHours >= 7}
            onPress={() => router.push("/sleep" as never)}
          />
        </GrowthReveal>
        <GrowthReveal index={9} style={styles.half}>
          <GoalCard
            pct={kcalPct}
            value={dietKcal > 0 ? String(dietKcal) : "—"}
            unit="kcal"
            color={ORANGE}
            name="饮食"
            sub={`${growth.mealCount} 餐 · 蛋白 ${Math.round(proteinToday)}g`}
            footLeft={`目标 ${growth.dietTarget} kcal`}
            footRight={dietKcal > 0 ? `差 ${Math.max(0, growth.dietTarget - dietKcal)}` : "待记录"}
            onPress={() => router.push("/nutrition" as never)}
          />
        </GrowthReveal>
        <GrowthReveal index={10} style={styles.half}>
          <GoalCard
            pct={workoutPct}
            value={String(growth.exerciseMinutes)}
            unit="min"
            color={GREEN}
            name="训练"
            sub={`本周 ${growth.weekWorkouts} 次 · 目标 3 次`}
            footLeft={growth.trainingRecorded ? growth.trainingName ?? "今日训练" : growth.weekWorkouts > 0 ? "今天还没有训练" : "本周还没有训练"}
            footRight={growth.trainingRecorded ? `${growth.trainingActions} 个动作` : "待补练"}
            onPress={() => router.push("/workout-add" as never)}
          />
        </GrowthReveal>
        <GrowthReveal index={11} style={styles.half}>
          <GoalCard
            pct={waterPct}
            value={(growth.waterMl / 1000).toFixed(2)}
            unit="L"
            color={BLUE}
            name="饮水"
            sub={`目标 ${(growth.waterTarget / 1000).toFixed(1)} L`}
            footLeft={growth.waterRecorded ? "今天已记录" : "今天还没喝水"}
            footRight={`${Math.round(waterPct * 100)}%`}
            onPress={() => router.push("/nutrition" as never)}
          />
        </GrowthReveal>
      </View>

      {/* 快捷记录 */}
      <GrowthReveal index={12}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>快捷记录</Text>
        </View>
      </GrowthReveal>
      <View style={styles.quickRow}>
        <QuickAction icon="food" label="记一餐" onPress={() => router.push("/nutrition" as never)} />
        <QuickAction icon="moon" label="记录睡眠" onPress={() => router.push("/sleep" as never)} />
        <QuickAction icon="workout" label="记录训练" onPress={() => router.push("/workout-add" as never)} />
      </View>
    </View>
  );
}

function WeightSpark({ points }: { points: number[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
  const width = 120;
  const height = 40;
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(0.4, max - min);
    return points
      .map((value, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - 4 - ((value - min) / span) * (height - 10);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);
  return (
    <View style={styles.spark}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {path ? <Path d={path} stroke={ORANGE} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.length === 1 ? <Circle cx={width / 2} cy={height / 2} r={3} fill={ORANGE} /> : null}
      </Svg>
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

function GoalCard({
  pct,
  value,
  unit,
  color,
  name,
  sub,
  footLeft,
  footRight,
  good,
  onPress,
}: {
  pct: number;
  value: string;
  unit: string;
  color: string;
  name: string;
  sub: string;
  footLeft: string;
  footRight: string;
  good?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={styles.goalCard}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${value}${unit}`}
    >
      <View style={styles.goalTop}>
        <RingProgress size={46} strokeWidth={5} progress={clamp01(pct)} color={color} trackColor={colors.chartTrack}>
          <Text style={styles.ringValue}>{Math.round(clamp01(pct) * 100)}</Text>
        </RingProgress>
        <View style={styles.goalCopy}>
          <Text style={styles.goalName}>{name}</Text>
          <Text style={styles.goalSub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </View>
      <View style={styles.goalFoot}>
        <Text style={styles.goalFootText} numberOfLines={1}>
          {footLeft}
        </Text>
        <Text style={[styles.goalFootValue, good && styles.goalFootGood]}>{footRight}</Text>
      </View>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
  return (
    <PressableScale haptic scaleTo={0.97} onPress={onPress} style={styles.quick}>
      <Icon name={icon} size={18} weight="regular" color={ORANGE} />
      <Text style={styles.quickLabel}>{label}</Text>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    page: { gap: 10 },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
    headCopy: { flex: 1, minWidth: 0 },
    kicker: { ...typography.eyebrow, color: ORANGE },
    title: { ...typography.pageTitle, color: colors.text, marginTop: 3 },
    headSub: { ...typography.meta, color: colors.textMuted, marginTop: 4 },
    editBtn: {
      minHeight: 34,
      paddingHorizontal: 14,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
    },
    editText: { ...typography.meta, fontWeight: "700", color: colors.textSecondary },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    half: { width: "48%", flexGrow: 1, flexBasis: "45%" },
    full: { width: "100%" },

    card: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      padding: 14,
      overflow: "hidden",
    },
    cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
    cardTitle: { ...typography.caption, fontWeight: "800", color: colors.text },
    cardSub: { ...typography.micro, fontWeight: "500", color: colors.textMuted, marginTop: 2 },
    moreBtn: {
      width: 27,
      height: 27,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    bigValue: { ...typography.title2, fontWeight: "800", color: colors.text, marginTop: 12 },
    bigUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    delta: { ...typography.micro, fontWeight: "700", color: GREEN },
    deltaUp: { color: ORANGE },

    streakCard: {
      minHeight: 172,
      borderRadius: 20,
      padding: 16,
      overflow: "hidden",
      backgroundColor: ORANGE,
      borderWidth: 0,
    },
    streakGlow: {
      position: "absolute",
      top: -64,
      right: -54,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    streakHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    streakKicker: { ...typography.micro, fontWeight: "800", color: "rgba(255,255,255,0.92)" },
    streakValue: { ...typography.numLg, fontWeight: "800", color: "#FFFFFF", marginTop: 18 },
    streakUnit: { ...typography.caption, fontWeight: "600", color: "rgba(255,255,255,0.72)" },
    streakSub: { ...typography.micro, fontWeight: "500", color: "rgba(255,255,255,0.78)", marginTop: 6, maxWidth: "90%" },
    streakShine: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.22)",
    },
    weightTag: {
      ...typography.eyebrow,
      color: ORANGE,
      backgroundColor: ORANGE_SOFT,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 999,
      overflow: "hidden",
    },
    spark: { height: 42, marginTop: 10 },
    weekLetters: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
    weekLetter: { ...typography.eyebrow, fontWeight: "500", color: colors.textFaint },

    macroChart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 92,
      marginTop: 12,
      gap: 6,
    },
    macroCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
    macroBar: { width: "72%", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
    macroLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
    macroEmpty: { height: 84, marginTop: 12, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    macroEmptyTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    macroEmptyHint: { ...typography.micro, color: colors.textMuted, marginTop: 4, textAlign: "center" },
    macroDayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 7, paddingHorizontal: 0 },
    macroDay: { ...typography.eyebrow, fontWeight: "500", color: colors.textFaint, flex: 1, textAlign: "center" },
    macroBarEmpty: { backgroundColor: colors.chartTrack },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 6, height: 6, borderRadius: 3 },
    legendLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    legendValue: { ...typography.micro, fontWeight: "800", color: colors.text },

    miniBars: { flexDirection: "row", alignItems: "flex-end", height: 46, gap: 5, marginTop: 10 },
    miniBarTrack: { flex: 1, height: "100%", justifyContent: "flex-end", borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    miniBarFill: { width: "100%", borderRadius: 4 },
    miniBarOn: { backgroundColor: GREEN },
    miniBarOff: { backgroundColor: colors.chartTrack },
    balanceValue: { ...typography.title2, fontWeight: "800", color: colors.text, marginTop: 12 },
    track: { height: 6, borderRadius: 99, backgroundColor: colors.chartTrack, overflow: "hidden", marginTop: 9 },
    trackFill: { height: "100%", borderRadius: 99, backgroundColor: GREEN },

    dailyPill: { minHeight: 23, paddingHorizontal: 8, borderRadius: 999, backgroundColor: ORANGE_SOFT, justifyContent: "center" },
    dailyPillText: { ...typography.eyebrow, fontWeight: "800", color: ORANGE },
    dailyRows: { gap: 8, marginTop: 12 },
    dailyRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    dailyLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted, width: 34 },
    dailyTrack: { flex: 1, height: 5, borderRadius: 99, backgroundColor: colors.chartTrack, overflow: "hidden" },
    dailyFill: { height: "100%", borderRadius: 99 },
    dailyValue: { ...typography.micro, fontWeight: "800", color: colors.text, width: 42, textAlign: "right" },

    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 2 },
    sectionTitle: { ...typography.section, color: colors.text },
    sectionLink: { ...typography.meta, fontWeight: "700", color: ORANGE },

    goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    goalCard: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      padding: 12,
      minHeight: 108,
    },
    goalTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    goalCopy: { flex: 1, minWidth: 0 },
    goalName: { ...typography.caption, fontWeight: "800", color: colors.text },
    goalSub: { ...typography.micro, fontWeight: "500", color: colors.textMuted, marginTop: 2 },
    ringValue: { ...typography.eyebrow, fontWeight: "800", color: colors.text },
    goalFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      marginTop: 9,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    goalFootText: { flexShrink: 1, ...typography.eyebrow, fontWeight: "500", color: colors.textMuted },
    goalFootValue: { ...typography.eyebrow, fontWeight: "800", color: colors.text },
    goalFootGood: { color: GREEN },

    quickRow: { flexDirection: "row", gap: 8 },
    quick: {
      flex: 1,
      minHeight: 62,
      borderRadius: 18,
      padding: 12,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
    },
    quickLabel: { ...typography.caption, fontWeight: "700", color: colors.text, marginTop: 2 },
  });
