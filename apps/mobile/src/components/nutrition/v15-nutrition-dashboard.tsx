import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { tabularNums, typography } from "@/theme/tokens";
import { mealForNow } from "@/lib/meal-time";
import { weekdayShort } from "@/lib/v15/dates";
import { buildMealSections, kcalDeltaFromYesterday, weekKcalStats } from "@/lib/v15/nutrition-model";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { MealEntry, MealKind } from "@learn-workbench/shared/schemas";
import { V15Bars, V15RingStack, V15WeekStrip } from "@/components/v15/v15-charts";
import {
  V15Card,
  V15Header,
  V15HeroSurface,
  V15IconButton,
  V15Note,
  V15Pill,
  V15ProgressBar,
  V15Section,
  useV15Layout,
} from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";

const MEAL_ICON: Record<MealKind, "sun" | "food" | "sparkle" | "drop"> = {
  breakfast: "sun",
  lunch: "food",
  dinner: "food",
  snack: "sparkle",
};

/**
 * 饮食 · V15 仪表盘（对齐 demo renderNutrition）。
 *
 * 只读 use-nutrition-screen 的数据，所有写操作仍走原来的发件箱 / 编辑弹层。
 * 新增食物改为全屏 /nutrition-add，不再是 86% BottomSheet。
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/wellness" as never);
}

export function V15NutritionDashboard({
  model,
  onOpenAdd,
  onOpenTrends,
}: {
  model: NutritionModel;
  onOpenAdd: (meal?: MealKind) => void;
  onOpenTrends: () => void;
}) {
  const p = useV15();
  const layout = useV15Layout();
  const styles = useMemo(() => makeStyles(p), [p]);

  const {
    date,
    isToday,
    entries,
    totals,
    target,
    remaining,
    overBudget,
    ringProgress,
    weekStrip,
    weekRows,
    hydration,
    recentFoods,
    quickAdd,
    setEditing,
    setTargetOpen,
    onAddWater,
    pendingIds,
  } = model;

  const sections = useMemo(() => buildMealSections(entries), [entries]);
  const filled = sections.filter((section) => section.count > 0);
  const empty = sections.filter((section) => section.count === 0);
  const weekStats = useMemo(() => weekKcalStats(weekStrip), [weekStrip]);
  const delta = useMemo(() => kcalDeltaFromYesterday(weekRows, date, totals.kcal), [weekRows, date, totals.kcal]);

  const pct = Math.round(ringProgress * 100);
  const proteinPct = target.proteinG > 0 ? (totals.proteinG / target.proteinG) * 100 : 0;
  const macroRows = [
    { key: "protein", label: "蛋白", value: Math.round(totals.proteinG), goal: target.proteinG, unit: "g", color: p.blue },
    { key: "carbs", label: "碳水", value: Math.round(totals.carbsG), goal: target.carbsG, unit: "g", color: p.amber },
    { key: "fat", label: "脂肪", value: Math.round(totals.fatG), goal: target.fatG, unit: "g", color: p.orange },
    { key: "kcal", label: "热量", value: Math.round(totals.kcal), goal: target.kcal, unit: "", color: p.green },
  ];

  const ringSize = layout.width < 360 ? 108 : layout.width < 400 ? 124 : 140;
  const monthDay = Number(date.slice(5, 7)) + "/" + Number(date.slice(8, 10));

  const waterTarget = hydration.targetMl > 0 ? hydration.targetMl : 2000;
  const waterLeft = Math.max(0, waterTarget - hydration.totalMl);
  const glasses = Math.round(hydration.totalMl / 250);
  const targetGlasses = Math.max(4, Math.round(waterTarget / 250));
  const proteinLeft = Math.max(0, target.proteinG - totals.proteinG);

  const share = () => {
    const text =
      "今日饮食 · " +
      totals.kcal +
      " / " +
      target.kcal +
      " kcal · 蛋白 " +
      Math.round(totals.proteinG) +
      "g · 碳水 " +
      Math.round(totals.carbsG) +
      "g · 脂肪 " +
      Math.round(totals.fatG) +
      "g";
    void Share.share({ message: text });
  };

  return (
    <>
      <V15Header
        p={p}
        onBack={goBack}
        kicker={"NUTRITION · 周" + weekdayShort(date) + " " + monthDay}
        title={isToday ? "今日饮食" : "饮食记录"}
        subtitle={entries.length + " 条记录 · 目标 " + target.kcal.toLocaleString() + " kcal" + (pendingIds.length > 0 ? " · " + pendingIds.length + " 条待同步" : "")}
        actions={
          <>
            <V15IconButton p={p} icon="target" label="每日营养目标" onPress={() => setTargetOpen(true)} />
            <V15IconButton p={p} icon="share" label="分享今日饮食" onPress={share} />
          </>
        }
      />

      <V15WeekStrip p={p} items={weekStrip} onPick={model.setDate} />

      <V15HeroSurface
        p={p}
        from={p.dark ? "#241B14" : "#FFF8F2"}
        to={p.dark ? "#1C1B19" : "#FFFFFF"}
        glow={p.dark ? "#FF8A4C" : "#FF8A3D"}
        glow2={p.dark ? "#8A4A1E" : "#FFD6BC"}
        borderColor={p.dark ? "rgba(255,138,76,0.18)" : "rgba(242,92,10,0.15)"}
        style={{ marginTop: 12 }}
      >
        <View style={styles.energyTop}>
          <Text style={[styles.energyKicker, { color: p.sub }]}>今日能量</Text>
          <V15Pill p={p} tone="neutral" label={"目标 " + target.kcal.toLocaleString() + " kcal"} />
        </View>

        <View style={styles.energyBody}>
          <V15RingStack
            size={ringSize}
            stroke={ringSize > 120 ? 12 : 10}
            track={p.track}
            rings={[
              { pct, color: p.orange },
              { pct: proteinPct, color: p.blue },
            ]}
          >
            <Text style={[styles.ringPct, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {pct}%
            </Text>
            <Text style={[styles.ringLabel, { color: p.sub }]}>目标完成</Text>
          </V15RingStack>

          <View style={styles.energyCopy}>
            <Text style={[styles.energyLabel, { color: p.sub }]}>{overBudget ? "今日已超出" : "今日剩余"}</Text>
            <View style={styles.energyBigRow}>
              <Text style={[styles.energyBig, { color: overBudget ? p.red : p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                {Math.abs(Math.round(remaining)).toLocaleString()}
              </Text>
              <Text style={[styles.energyUnit, { color: p.sub }]}>kcal</Text>
            </View>
            <Text style={[styles.energyNote, { color: p.sub }]} numberOfLines={2}>
              已摄入 <Text style={{ color: p.ink, fontWeight: "700" }}>{Math.round(totals.kcal).toLocaleString()}</Text> kcal · 完成 {pct}%
            </Text>
            {delta !== null ? (
              <View style={[styles.delta, { backgroundColor: delta <= 0 ? p.greenSoft : p.amberSoft }]}>
                <Icon name="sparkle" size={10} weight="fill" color={delta <= 0 ? p.green : p.amber} />
                <Text style={{ ...typography.micro, color: delta <= 0 ? p.green : p.amber }} numberOfLines={1}>
                  比昨日{delta <= 0 ? "少" : "多"} {Math.abs(delta)} kcal
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.macroStrip, { borderTopColor: p.line }]}>
          {macroRows.map((row) => (
            <View key={row.key} style={styles.macro}>
              <View style={styles.macroHead}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: row.color }} />
                <Text style={[styles.macroLabel, { color: p.sub }]} numberOfLines={1}>
                  {row.label}
                </Text>
              </View>
              <Text style={[styles.macroValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                {row.value}
                <Text style={{ color: p.sub }}>/{row.goal}{row.unit}</Text>
              </Text>
              <V15ProgressBar p={p} pct={row.goal > 0 ? (row.value / row.goal) * 100 : 0} color={row.color} height={3} />
            </View>
          ))}
        </View>
      </V15HeroSurface>

      <Pressable
        onPress={() => router.push("/health-baseline" as never)}
        accessibilityRole="button"
        accessibilityLabel="查看目标依据与健康基线"
        style={({ pressed }) => [styles.basisLink, { backgroundColor: p.card, borderColor: p.line }, pressed && { opacity: 0.7 }]}
      >
        <Icon name="target" size={14} weight="regular" color={p.orange} />
        <Text style={[styles.basisText, { color: p.ink }]}>目标依据 · 7/28 天基线 · 睡眠判定</Text>
        <Icon name="chevron" size={13} weight="bold" color={p.faint} />
      </Pressable>

      <View style={styles.actions}>
        <PressableScale haptic scaleTo={0.97} onPress={() => onOpenAdd()} style={[styles.actionPrimary, { shadowColor: p.orangeStrong }]}>
          <Icon name="food" size={16} weight="fill" color="#FFFFFF" />
          <Text style={styles.actionPrimaryText} numberOfLines={1}>记录饮食</Text>
        </PressableScale>
        <Pressable
          onPress={() => void onAddWater(250)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="饮水加 250 毫升"
          style={[styles.action, { backgroundColor: p.card, borderColor: p.line }]}
        >
          <Icon name="drop" size={16} weight="regular" color={p.blue} />
          <Text style={[styles.actionText, { color: p.ink }]} numberOfLines={1}>饮水 +250</Text>
        </Pressable>
        <Pressable
          onPress={onOpenTrends}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="查看营养趋势"
          style={[styles.action, { backgroundColor: p.card, borderColor: p.line }]}
        >
          <Icon name="chart" size={16} weight="regular" color={p.orange} />
          <Text style={[styles.actionText, { color: p.ink }]} numberOfLines={1}>趋势</Text>
        </Pressable>
      </View>

      <V15Section p={p} title="今日餐食" right={entries.length + " 条记录"} />

      {filled.map((section) => (
        <MealCard key={section.meal} section={section} onEdit={setEditing} onAdd={onOpenAdd} p={p} styles={styles} />
      ))}

      {empty.length > 0 ? (
        <View style={styles.emptyGrid}>
          {empty.map((section) => (
            <Pressable
              key={section.meal}
              onPress={() => onOpenAdd(section.meal)}
              accessibilityRole="button"
              accessibilityLabel={"添加" + section.label}
              hitSlop={4}
              style={({ pressed }) => [
                styles.emptyMeal,
                { backgroundColor: p.card, borderColor: p.line },
                pressed && { opacity: 0.72 },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: p.card2 }]}>
                <Icon name={MEAL_ICON[section.meal]} size={16} weight="duotone" color={p.faint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.emptyTitle, { color: p.ink }]} numberOfLines={1}>{section.label}</Text>
                <Text style={[styles.emptySub, { color: p.sub }]} numberOfLines={1}>未记录</Text>
              </View>
              <Icon name="plus" size={15} weight="bold" color={p.orange} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <V15Section p={p} title="近 7 天热量" right={"趋势 →"} onRight={onOpenTrends} />
      <V15Card p={p}>
        <View style={styles.chartHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.chartTitle, { color: p.ink }]}>每日摄入</Text>
            <Text style={[styles.chartSub, { color: p.sub }]} numberOfLines={1}>
              {weekStats.recorded > 0 ? "平均 " + weekStats.avg.toLocaleString() + " kcal · 目标线 " + target.kcal.toLocaleString() : "记录一天后生成趋势"}
            </Text>
          </View>
          <V15Pill p={p} tone="orange" label="近 7 天" />
        </View>
        <View style={{ marginTop: 14 }}>
          <V15Bars
            p={p}
            max={Math.max(2400, target.kcal * 1.2, weekStats.max * 1.15)}
            goal={target.kcal}
            items={weekStrip.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.kcal,
              valueLabel: item.kcal > 0 ? (item.kcal / 1000).toFixed(1) + "k" : "",
              active: item.active,
            }))}
          />
        </View>
        <View style={[styles.chartStats, { borderTopColor: p.line }]}>
          <ChartStat label="日均 kcal" value={weekStats.avg > 0 ? weekStats.avg.toLocaleString() : "—"} p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat label="单日最高" value={weekStats.max > 0 ? weekStats.max.toLocaleString() : "—"} p={p} styles={styles} />
          <View style={[styles.chartDivider, { backgroundColor: p.line }]} />
          <ChartStat label="记录天数" value={weekStats.recorded + "/7"} p={p} styles={styles} />
        </View>
      </V15Card>

      <V15Card p={p} style={{ marginTop: 10 }}>
        <View style={styles.waterRow}>
          <View style={[styles.waterIcon, { backgroundColor: p.blueSoft }]}>
            <Icon name="drop" size={18} weight="fill" color={p.blue} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.waterTitle, { color: p.ink }]} numberOfLines={1}>
              饮水 {(hydration.totalMl / 1000).toFixed(2).replace(/\.?0+$/, "")} / {(waterTarget / 1000).toFixed(1)} L
            </Text>
            <Text style={[styles.waterSub, { color: p.sub }]} numberOfLines={1}>
              {glasses} 杯 · {waterLeft > 0 ? "还差 " + (waterLeft / 1000).toFixed(2).replace(/\.?0+$/, "") + " L" : "今日目标已达成"}
            </Text>
            <View style={styles.glasses}>
              {Array.from({ length: targetGlasses }).map((_, index) => (
                <View
                  key={"glass-" + index}
                  style={[
                    styles.glass,
                    { borderColor: p.line, backgroundColor: index < glasses ? p.blue : "transparent" },
                    index < glasses ? { opacity: 0.72 } : null,
                  ]}
                />
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => void onAddWater(250)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="饮水加 250 毫升"
            style={[styles.waterAdd, { backgroundColor: p.orangeSoft }]}
          >
            <Icon name="plus" size={16} weight="bold" color={p.orange} />
          </Pressable>
        </View>
      </V15Card>

      {recentFoods.length > 0 ? (
        <>
          <V15Section p={p} title="常吃" right="一点即记" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {recentFoods.slice(0, 10).map((food) => (
              <Pressable
                key={food.id}
                onPress={() => void quickAdd(food, mealForNow())}
                accessibilityRole="button"
                accessibilityLabel={"快速记录 " + food.name}
                hitSlop={4}
                style={({ pressed }) => [styles.foodChip, { backgroundColor: p.card, borderColor: p.line }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.foodChipIcon, { backgroundColor: p.orangeSoft }]}>
                  <Icon name="food" size={14} weight="duotone" color={p.orange} />
                </View>
                <View style={{ minWidth: 0 }}>
                  <Text style={[styles.foodChipName, { color: p.ink }]} numberOfLines={1}>{food.name}</Text>
                  <Text style={[styles.foodChipKcal, { color: p.sub }]} numberOfLines={1}>{Math.round(food.kcal)} kcal</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={[styles.insight, { backgroundColor: p.orangeSoft, borderColor: p.dark ? "transparent" : "rgba(242,92,10,0.14)" }]}>
        <View style={styles.insightHead}>
          <Icon name="sparkle" size={13} weight="fill" color={p.orange} />
          <Text style={[styles.insightKicker, { color: p.orange }]}>今日洞察</Text>
        </View>
        <Text style={[styles.insightTitle, { color: p.ink }]}>
          {proteinLeft > 0 ? "蛋白质还差 " + Math.round(proteinLeft) + "g" : "蛋白质目标已达成"}
        </Text>
        <Text style={[styles.insightBody, { color: p.sub }]}>
          {proteinLeft > 0
            ? "晚餐加一份鸡胸、鱼虾或希腊酸奶，今天的蛋白质目标就能达成。"
            : "优先补充蔬菜与水分，避免夜间过量加餐。"}
          {waterLeft > 0 ? " 饮水还差 " + (waterLeft / 1000).toFixed(2).replace(/\.?0+$/, "") + " L。" : ""}
        </Text>
      </View>

      <V15Note p={p}>营养估算可随时点开记录修改；离线时先记在本机，联网后自动同步。</V15Note>

      <Text style={[styles.quote, { color: p.faint }]}>今天吃了什么，也是今天的一部分。</Text>
    </>
  );
}

function MealCard({
  section,
  onEdit,
  onAdd,
  p,
  styles,
}: {
  section: ReturnType<typeof buildMealSections>[number];
  onEdit: (entry: MealEntry) => void;
  onAdd: (meal: MealKind) => void;
  p: ReturnType<typeof useV15>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const mealColor = section.meal === "breakfast" ? p.amber : section.meal === "lunch" ? p.blue : section.meal === "dinner" ? p.lilac : p.green;
  const mealSoft = section.meal === "breakfast" ? p.amberSoft : section.meal === "lunch" ? p.blueSoft : section.meal === "dinner" ? p.lilacSoft : p.greenSoft;
  const firstTime = section.items[0]?.createdAt ? clock(section.items[0].createdAt) : "";
  return (
    <View style={[styles.meal, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={[styles.mealRail, { backgroundColor: mealColor }]} />
      <View style={styles.mealHead}>
        <View style={[styles.mealIcon, { backgroundColor: mealSoft }]}>
          <Icon name={MEAL_ICON[section.meal]} size={18} weight="duotone" color={mealColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.mealTitle, { color: p.ink }]} numberOfLines={1}>{section.label}</Text>
          <Text style={[styles.mealSub, { color: p.sub }]} numberOfLines={1}>
            {firstTime ? firstTime + " · " : ""}{section.count} 项
          </Text>
        </View>
        <Text style={[styles.mealKcal, { color: p.ink }]}>
          {Math.round(section.kcal)}
          <Text style={{ color: p.sub }}> kcal</Text>
        </Text>
      </View>

      {section.items.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() => onEdit(entry)}
          accessibilityRole="button"
          accessibilityLabel={"编辑 " + entry.name}
          style={({ pressed }) => [styles.foodRow, { borderTopColor: p.line }, pressed && { backgroundColor: p.card2 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.foodName, { color: p.ink }]} numberOfLines={1}>{entry.name}</Text>
            <Text style={[styles.foodMeta, { color: p.sub }]} numberOfLines={1}>
              {entry.createdAt ? clock(entry.createdAt) + " · " : ""}{entry.amount} {entry.unit}
            </Text>
            <View style={styles.macroChips}>
              <MacroChip label={"P" + Math.round(entry.proteinG)} color={p.blue} bg={p.blueSoft} styles={styles} />
              <MacroChip label={"C" + Math.round(entry.carbsG)} color={p.amber} bg={p.amberSoft} styles={styles} />
              <MacroChip label={"F" + Math.round(entry.fatG)} color={p.orange} bg={p.orangeSoft} styles={styles} />
            </View>
          </View>
          <Text style={[styles.foodKcal, { color: p.ink }]}>{Math.round(entry.kcal)}</Text>
          <Icon name="chevron" size={13} weight="bold" color={p.faint} />
        </Pressable>
      ))}

      <Pressable
        onPress={() => onAdd(section.meal)}
        accessibilityRole="button"
        accessibilityLabel={"添加" + section.label}
        hitSlop={4}
        style={({ pressed }) => [styles.mealAdd, { borderTopColor: p.line }, pressed && { opacity: 0.65 }]}
      >
        <Text style={[styles.mealAddText, { color: p.orange }]}>＋ 添加{section.label}</Text>
        <Icon name="chevron" size={13} weight="bold" color={p.faint} />
      </Pressable>
    </View>
  );
}

function MacroChip({ label, color, bg, styles }: { label: string; color: string; bg: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.macroChip, { backgroundColor: bg }]}>
      <Text style={[styles.macroChipText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ChartStat({ label, value, p, styles }: { label: string; value: string; p: ReturnType<typeof useV15>; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.chartStat}>
      <Text style={[styles.chartStatValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.chartStatLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function clock(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const d = new Date(time);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

const makeStyles = (p: ReturnType<typeof useV15>) =>
  StyleSheet.create({
    energyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    energyKicker: { ...typography.caption, fontWeight: "700" },
    energyBody: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    energyCopy: { flex: 1, minWidth: 0 },
    energyLabel: { ...typography.caption },
    energyBigRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    energyBig: { ...typography.numLg, ...tabularNums },
    energyUnit: { ...typography.caption, fontWeight: "700" },
    energyNote: { ...typography.meta, marginTop: 3 },
    delta: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, marginTop: 7 },
    ringPct: { ...typography.numXl, ...tabularNums },
    ringLabel: { ...typography.micro, fontWeight: "600", marginTop: 1 },
    macroStrip: { flexDirection: "row", gap: 7, marginTop: 12, paddingTop: 11, borderTopWidth: 1 },
    macro: { flex: 1, minWidth: 0, gap: 3 },
    macroHead: { flexDirection: "row", alignItems: "center", gap: 3 },
    macroLabel: { ...typography.micro, fontWeight: "600" },
    macroValue: { ...typography.caption, fontWeight: "800", ...tabularNums },
    basisLink: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, borderWidth: 1 },
    basisText: { ...typography.micro, fontWeight: "700", flex: 1 },
    actions: { flexDirection: "row", gap: 7, marginTop: 10 },
    actionPrimary: {
      flex: 1.2,
      minHeight: 46,
      borderRadius: 15,
      backgroundColor: p.orange,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      shadowOpacity: 0.24,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    actionPrimaryText: { ...typography.caption, fontWeight: "800", color: "#FFFFFF" },
    action: { flex: 1, minHeight: 46, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
    actionText: { ...typography.caption, fontWeight: "700" },
    meal: { borderWidth: 1, borderRadius: 21, marginTop: 9, overflow: "hidden" },
    mealRail: { position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    mealHead: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
    mealIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    mealTitle: { ...typography.headline, fontWeight: "800" },
    mealSub: { ...typography.meta },
    mealKcal: { ...typography.num, ...tabularNums },
    foodRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderStyle: "dashed" },
    foodName: { ...typography.callout, fontWeight: "700" },
    foodMeta: { ...typography.meta, marginTop: 1 },
    macroChips: { flexDirection: "row", gap: 4, marginTop: 5 },
    macroChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
    macroChipText: { ...typography.micro, fontWeight: "700" },
    foodKcal: { ...typography.headline, fontWeight: "800", ...tabularNums },
    mealAdd: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderStyle: "dashed" },
    mealAddText: { ...typography.caption, fontWeight: "700" },
    emptyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
    emptyMeal: { width: "48.5%", flexGrow: 1, minHeight: 58, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
    emptyIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    emptyTitle: { ...typography.caption, fontWeight: "700" },
    emptySub: { ...typography.micro, fontWeight: "500" },
    chartHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    chartTitle: { ...typography.headline, fontWeight: "800" },
    chartSub: { ...typography.meta, marginTop: 2 },
    chartStats: { flexDirection: "row", alignItems: "center", paddingTop: 11, marginTop: 12, borderTopWidth: 1 },
    chartStat: { flex: 1, alignItems: "center", gap: 1 },
    chartStatValue: { ...typography.headline, fontWeight: "800", ...tabularNums },
    chartStatLabel: { ...typography.micro, fontWeight: "500" },
    chartDivider: { width: 1, height: 26 },
    waterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    waterIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    waterTitle: { ...typography.callout, fontWeight: "800" },
    waterSub: { ...typography.meta, marginTop: 1 },
    glasses: { flexDirection: "row", gap: 4, marginTop: 7 },
    glass: { flex: 1, maxWidth: 18, height: 7, borderRadius: 3, borderWidth: 1 },
    waterAdd: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    foodChip: { width: 132, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 15, borderWidth: 1, padding: 9 },
    foodChipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    foodChipName: { ...typography.caption, fontWeight: "700" },
    foodChipKcal: { ...typography.micro, fontWeight: "500" },
    insight: { borderRadius: 20, borderWidth: 1, padding: 14, marginTop: 20, gap: 4 },
    insightHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    insightKicker: { ...typography.micro, fontWeight: "800" },
    insightTitle: { ...typography.headline, fontWeight: "800", marginTop: 2 },
    insightBody: { ...typography.meta, lineHeight: 19 },
    quote: { ...typography.meta, textAlign: "center", marginTop: 20, marginBottom: 8 },
  });

