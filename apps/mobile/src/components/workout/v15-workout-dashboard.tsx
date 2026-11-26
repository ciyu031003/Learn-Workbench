import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, Share, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { Icon } from "@/components/ui/icon";
import { typography } from "@/theme/tokens";
import type { Workout } from "@learn-workbench/shared/schemas";
import { workoutVolume } from "@learn-workbench/shared/pure";
import { buildExerciseComposition, buildWorkoutWeek, isoWeekNumber, recentWorkouts, weekGoalPct } from "@/lib/v15/workout-model";
import { V15Bars, V15RingStack } from "@/components/v15/v15-charts";
import { V15Button, V15Card, V15Header, V15IconButton, V15Note, V15Pill, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";

const HERO_INK = "#F4F1E8";
const HERO_SUB = "rgba(244,241,232,0.64)";
const HERO_LINE = "rgba(255,255,255,0.12)";
const MINT = "#7BE0A6";
const WEEK_GOAL_MIN = 150;
const WEEK_GOAL_SESSIONS = 3;

/**
 * 训练 · V15 仪表盘（对齐 demo renderWorkout）。
 * 数据只有时长 / 组次 / 容量，没有 kcal，因此不复制 demo 的热量假数据。
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/wellness" as never);
}

export function V15WorkoutDashboard({
  workouts,
  todayKey,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  workouts: Workout[];
  todayKey: string;
  loading: boolean;
  onAdd: () => void;
  onEdit: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
}) {
  const p = useV15();
  const layout = useV15Layout();
  const styles = useMemo(() => makeStyles(p), [p]);

  const week = useMemo(() => buildWorkoutWeek(workouts, todayKey), [workouts, todayKey]);
  const composition = useMemo(() => buildExerciseComposition(workouts, todayKey), [workouts, todayKey]);
  const recent = useMemo(() => recentWorkouts(workouts, 4), [workouts]);
  const goalPct = weekGoalPct(week.minutes, WEEK_GOAL_MIN);
  const latest = recent[0] ?? null;
  const latestDay = latest ? latest.exercisedOn.slice(0, 10) : null;
  const daysSince = latestDay ? Math.max(0, Math.round((Date.parse(todayKey + "T00:00:00") - Date.parse(latestDay + "T00:00:00")) / 86400000)) : null;
  const trainedToday = week.days.find((day) => day.key === todayKey)?.minutes ?? 0;

  const recovery = trainedToday > 0
    ? { title: "今天已训练", body: "用 10 分钟拉伸收尾，今晚优先睡够；恢复也是训练的一部分。", steps: [["拉伸", "5m"], ["呼吸", "3m"], ["补水", "—"]] }
    : daysSince !== null && daysSince <= 2
      ? { title: "低强度恢复", body: "上次训练在 " + (daysSince === 0 ? "今天" : daysSince + " 天前") + "，今天做热身 + 快走，把节奏捡回来。", steps: [["热身", "5m"], ["快走", "12m"], ["拉伸", "5m"]] }
      : { title: "可以安排力量训练", body: daysSince === null ? "还没有训练记录，从一次 20 分钟的轻量训练开始。" : "距上次训练 " + daysSince + " 天，状态允许就从复合动作开始。", steps: [["热身", "5m"], ["主项", "25m"], ["拉伸", "5m"]] };

  const share = () => {
    const text = "本周训练 · " + week.sessions + " 次 · " + week.minutes + " 分钟 · " + week.sets + " 组 · " + week.reps + " 次" + (week.volumeKg > 0 ? " · " + week.volumeKg + " kg 容量" : "");
    void Share.share({ message: text });
  };

  return (
    <>
      <V15Header
        p={p}
        onBack={goBack}
        kicker={"TRAINING · WEEK " + isoWeekNumber(todayKey)}
        title="训练"
        subtitle={"本周 " + week.sessions + " 次 · " + week.minutes + " 分钟" + (loading ? " · 读取中" : "")}
        actions={
          <>
            <V15IconButton p={p} icon="plus" label="记录训练" onPress={onAdd} weight="bold" size={17} />
            <V15IconButton p={p} icon="share" label="分享本周训练" onPress={share} />
          </>
        }
      />

      <View style={styles.heroWrap}>
        <View style={styles.hero}>
          <View pointerEvents="none" style={[styles.heroGlow, { borderColor: "rgba(123,224,166,0.14)" }]} />
          <View pointerEvents="none" style={[styles.heroGlowInner, { borderColor: "rgba(123,224,166,0.10)" }]} />
          <View style={styles.heroTop}>
            <Text style={styles.heroKicker}>WEEKLY LOAD</Text>
            <View style={[styles.heroPill, { borderColor: HERO_LINE }]}>
              <Icon name="trophy" size={10} weight="fill" color={MINT} />
              <Text style={styles.heroPillText}>本周 {week.sessions}/{WEEK_GOAL_SESSIONS} 次</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroBigRow}>
                <Text style={styles.heroBig} numberOfLines={1} adjustsFontSizeToFit>{week.minutes}</Text>
                <Text style={styles.heroUnit}>min</Text>
              </View>
              <Text style={styles.heroSub}>{week.sessions} 次训练 · {week.sets} 组 · {week.reps} 次</Text>
              <Text style={styles.heroTarget}>{week.minutes >= WEEK_GOAL_MIN ? "本周目标已达成" : "再练 " + (WEEK_GOAL_MIN - week.minutes) + " 分钟达成周目标"}</Text>
            </View>
            <V15RingStack
              size={layout.width < 360 ? 96 : layout.width < 400 ? 108 : 120}
              stroke={10}
              track="rgba(255,255,255,0.14)"
              rings={[{ pct: goalPct, color: MINT }]}
            >
              <Text style={styles.heroRingPct} numberOfLines={1}>{goalPct}%</Text>
              <Text style={styles.heroRingLabel}>周目标</Text>
            </V15RingStack>
          </View>

          <View style={[styles.heroStats, { borderTopColor: HERO_LINE }]}>
            <HeroStat value={String(week.minutes)} unit="分钟" label="本周训练" align="left" styles={styles} />
            <HeroStat value={String(week.sessions)} unit="次" label="训练次数" styles={styles} />
            <HeroStat value={week.volumeKg > 0 ? String(week.volumeKg) : "—"} unit={week.volumeKg > 0 ? "kg" : ""} label="训练容量" align="right" styles={styles} />
          </View>
        </View>
      </View>

      <V15Card p={p} style={{ marginTop: 12 }}>
        <View style={styles.planHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.planKicker, { color: p.green }]}>TODAY · RECOVERY</Text>
            <Text style={[styles.planTitle, { color: p.ink }]}>{recovery.title}</Text>
            <Text style={[styles.planBody, { color: p.sub }]}>{recovery.body}</Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: p.greenSoft }]}>
            <Text style={[styles.planBadgeValue, { color: p.green }]}>20</Text>
            <Text style={[styles.planBadgeUnit, { color: p.green }]}>MIN</Text>
          </View>
        </View>

        <View style={styles.steps}>
          {recovery.steps.map(([label, time], index) => (
            <View key={label} style={styles.step}>
              <View style={[styles.stepDot, { borderColor: index === 0 ? p.amber : index === 1 ? p.green : p.lilac }]}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: index === 0 ? p.amber : index === 1 ? p.green : p.lilac }} />
              </View>
              <Text style={[styles.stepLabel, { color: p.ink }]} numberOfLines={1}>{label}</Text>
              <Text style={[styles.stepTime, { color: p.sub }]} numberOfLines={1}>{time}</Text>
              {index < recovery.steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: p.line }]} /> : null}
            </View>
          ))}
        </View>

        <V15Button p={p} label="开始记录训练" icon="play" onPress={onAdd} variant="green" style={{ marginTop: 12 }} />
      </V15Card>

      <V15Section p={p} title="本周训练量" right={"目标 " + WEEK_GOAL_MIN + " 分钟"} />
      <V15Card p={p}>
        <View style={styles.chartHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.chartTitle, { color: p.ink }]}>每日训练</Text>
            <Text style={[styles.chartSub, { color: p.sub }]} numberOfLines={1}>
              {week.sessions > 0 ? "按已记录的时长统计 · 今天高亮" : "记录一次训练后开始生成趋势"}
            </Text>
          </View>
          <V15Pill p={p} tone={goalPct >= 100 ? "green" : "neutral"} label={goalPct + "%"} />
        </View>
        <View style={{ marginTop: 14 }}>
          <V15Bars
            p={p}
            max={Math.max(45, week.maxDayMinutes * 1.2)}
            items={week.days.map((day) => ({ key: day.key, label: day.label, value: day.minutes, valueLabel: day.minutes > 0 ? String(day.minutes) : "", active: day.active }))}
            height={120}
            color={p.orange}
          />
        </View>
        <View style={[styles.chartStats, { borderTopColor: p.line }]}>
          <ChartStat value={String(week.minutes)} label="本周分钟" p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat value={String(week.sessions)} label="训练次数" p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat value={week.volumeKg > 0 ? String(week.volumeKg) : "—"} label={week.volumeKg > 0 ? "容量 kg" : "无负重数据"} p={p} styles={styles} />
        </View>
      </V15Card>

      {composition.length > 0 ? (
        <>
          <V15Section p={p} title="训练构成" right="近 7 天 · 按组数" />
          <V15Card p={p}>
            <View style={styles.distBar}>
              {composition.map((row, index) => (
                <View key={row.label} style={{ width: (Math.max(3, row.pct) + "%") as DimensionValue, backgroundColor: [p.orange, p.blue, p.green, p.lilac, p.amber][index % 5], opacity: 0.9 }} />
              ))}
            </View>
            <View style={styles.legend}>
              {composition.map((row, index) => (
                <View key={row.label} style={styles.legendRow}>
                  <View style={{ width: 7, height: 7, borderRadius: 3, backgroundColor: [p.orange, p.blue, p.green, p.lilac, p.amber][index % 5] }} />
                  <Text style={[styles.legendLabel, { color: p.sub }]} numberOfLines={1}>{row.label}</Text>
                  <Text style={[styles.legendValue, { color: p.ink }]} numberOfLines={1}>{row.sets} 组</Text>
                </View>
              ))}
            </View>
          </V15Card>
        </>
      ) : null}

      <V15Section p={p} title="最近训练" right={workouts.length + " 条"} onRight={onAdd} />
      {recent.length === 0 ? (
        <V15Card p={p}>
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: p.orangeSoft }]}>
              <Icon name="workout" size={22} weight="duotone" color={p.orange} />
            </View>
            <Text style={[styles.emptyTitle, { color: p.ink }]}>还没有训练记录</Text>
            <Text style={[styles.emptyBody, { color: p.sub }]}>从动作库里选动作、填组次，自动汇总训练容量。</Text>
            <V15Button p={p} label="记录第一次训练" icon="plus" onPress={onAdd} style={{ marginTop: 10, alignSelf: "stretch" }} />
          </View>
        </V15Card>
      ) : (
        <V15Card p={p} padded={false}>
          {recent.map((workout, index) => {
            const volume = workoutVolume(workout.items);
            const minutes = Math.max(0, Math.round(workout.durationSeconds / 60));
            return (
              <Pressable
                key={workout.id}
                onPress={() => onEdit(workout)}
                accessibilityRole="button"
                accessibilityLabel={"编辑训练 " + workout.name}
                style={({ pressed }) => [styles.session, index > 0 && { borderTopWidth: 1, borderTopColor: p.line }, pressed && { backgroundColor: p.card2 }]}
              >
                <View style={[styles.sessionDate, { backgroundColor: p.card2 }]}>
                  <Text style={[styles.sessionDay, { color: p.ink }]}>{workout.exercisedOn.slice(8, 10)}</Text>
                  <Text style={[styles.sessionMonth, { color: p.sub }]}>{Number(workout.exercisedOn.slice(5, 7))} 月</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sessionName, { color: p.ink }]} numberOfLines={1}>{workout.name}</Text>
                  <Text style={[styles.sessionMeta, { color: p.sub }]} numberOfLines={1}>
                    {workout.items.length} 个动作{minutes > 0 ? " · " + minutes + " 分钟" : ""} · {volume.sets} 组
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={[styles.sessionVolume, { color: p.ink }]} numberOfLines={1}>{volume.volumeKg > 0 ? volume.volumeKg : minutes}</Text>
                  <Text style={[styles.sessionVolumeUnit, { color: p.sub }]}>{volume.volumeKg > 0 ? "kg" : "min"}</Text>
                </View>
                <Pressable
                  onPress={() => onDelete(workout)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={"删除训练 " + workout.name}
                  style={styles.deleteBtn}
                >
                  <Icon name="close" size={14} weight="bold" color={p.faint} />
                </Pressable>
              </Pressable>
            );
          })}
        </V15Card>
      )}

      <V15Note p={p}>训练记录包含时长、组次与容量；未记录活动热量，因此这里不展示 kcal。</V15Note>

      <Text style={[styles.quote, { color: p.faint }]}>不是每次都要拼尽全力，保持出现就已经赢了一半。</Text>
    </>
  );
}

function HeroStat({ value, unit, label, align = "center", styles }: { value: string; unit: string; label: string; align?: "left" | "center" | "right"; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={{ flex: 1, alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" }}>
      <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        <Text style={styles.heroStatUnit}> {unit}</Text>
      </Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ChartStat({ value, label, p, styles }: { value: string; label: string; p: ReturnType<typeof useV15>; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.chartStat}>
      <Text style={[styles.chartStatValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.chartStatLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const makeStyles = (p: ReturnType<typeof useV15>) =>
  StyleSheet.create({
    heroWrap: { marginTop: 14, borderRadius: 24, shadowColor: "#123A2A", shadowOpacity: p.dark ? 0 : 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: p.dark ? 0 : 5 },
    hero: { borderRadius: 24, overflow: "hidden", padding: 15, backgroundColor: "#143B2A", borderWidth: 1, borderColor: "rgba(123,224,166,0.18)" },
    heroGlow: { position: "absolute", right: -70, bottom: -110, width: 250, height: 250, borderRadius: 125, borderWidth: 1 },
    heroGlowInner: { position: "absolute", right: -30, bottom: -68, width: 170, height: 170, borderRadius: 85, borderWidth: 1 },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    heroKicker: { ...typography.micro, fontWeight: "800", letterSpacing: 1.6, color: "rgba(244,241,232,0.66)" },
    heroPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    heroPillText: { ...typography.micro, fontWeight: "700", color: MINT },
    heroBody: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    heroBigRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    heroBig: { ...typography.numLg, fontWeight: "900", color: HERO_INK, fontVariant: ["tabular-nums"] },
    heroUnit: { ...typography.caption, fontWeight: "700", color: HERO_SUB },
    heroSub: { ...typography.meta, color: HERO_SUB, marginTop: 1 },
    heroTarget: { ...typography.meta, fontWeight: "700", color: MINT, marginTop: 4 },
    heroRingPct: { ...typography.title2, fontWeight: "900", color: HERO_INK, fontVariant: ["tabular-nums"] },
    heroRingLabel: { ...typography.micro, fontWeight: "600", color: HERO_SUB },
    heroStats: { flexDirection: "row", marginTop: 14, paddingTop: 11, borderTopWidth: 1 },
    heroStatValue: { ...typography.headline, fontWeight: "800", color: HERO_INK, fontVariant: ["tabular-nums"] },
    heroStatUnit: { ...typography.micro, fontWeight: "600", color: HERO_SUB },
    heroStatLabel: { ...typography.micro, fontWeight: "500", color: HERO_SUB, marginTop: 1 },
    planHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    planKicker: { ...typography.micro, fontWeight: "800", letterSpacing: 1.2 },
    planTitle: { ...typography.headline, fontWeight: "800", marginTop: 2 },
    planBody: { ...typography.meta, marginTop: 3, lineHeight: 19 },
    planBadge: { width: 50, height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    planBadgeValue: { ...typography.headline, fontWeight: "900", fontVariant: ["tabular-nums"] },
    planBadgeUnit: { ...typography.micro, fontWeight: "700" },
    steps: { flexDirection: "row", marginTop: 14, marginBottom: 2 },
    step: { flex: 1, alignItems: "center", gap: 2 },
    stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", zIndex: 2 },
    stepLine: { position: "absolute", top: 6, left: "60%", right: "-40%", height: 1, zIndex: 0 },
    stepLabel: { ...typography.caption, fontWeight: "700", marginTop: 1 },
    stepTime: { ...typography.micro, fontWeight: "500" },
    chartHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    chartTitle: { ...typography.headline, fontWeight: "800" },
    chartSub: { ...typography.meta, marginTop: 2 },
    chartStats: { flexDirection: "row", alignItems: "center", paddingTop: 11, marginTop: 12, borderTopWidth: 1 },
    chartStat: { flex: 1, alignItems: "center", gap: 1 },
    chartStatValue: { ...typography.headline, fontWeight: "800", fontVariant: ["tabular-nums"] },
    chartStatLabel: { ...typography.micro, fontWeight: "500" },
    chartDivider: { width: 1, height: 26 },
    distBar: { height: 12, borderRadius: 4, overflow: "hidden", flexDirection: "row", backgroundColor: p.track },
    legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, rowGap: 7 },
    legendRow: { width: "50%", flexDirection: "row", alignItems: "center", gap: 5 },
    legendLabel: { ...typography.micro, flex: 1, fontWeight: "600" },
    legendValue: { ...typography.micro, fontWeight: "700" },
    session: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
    sessionDate: { width: 42, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    sessionDay: { ...typography.headline, fontWeight: "900", fontVariant: ["tabular-nums"] },
    sessionMonth: { ...typography.micro, fontWeight: "500" },
    sessionName: { ...typography.callout, fontWeight: "800" },
    sessionMeta: { ...typography.meta, marginTop: 1 },
    sessionRight: { alignItems: "flex-end" },
    sessionVolume: { ...typography.headline, fontWeight: "800", fontVariant: ["tabular-nums"] },
    sessionVolumeUnit: { ...typography.micro, fontWeight: "500" },
    deleteBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
    empty: { alignItems: "center", paddingVertical: 8 },
    emptyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    emptyTitle: { ...typography.headline, fontWeight: "800", marginTop: 9 },
    emptyBody: { ...typography.meta, textAlign: "center", marginTop: 3, maxWidth: 260 },
    quote: { ...typography.meta, textAlign: "center", marginTop: 20, marginBottom: 8 },
  });
