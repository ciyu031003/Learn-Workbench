import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { SectionHeader } from "@/components/section-header";
import { Card } from "@/components/card";
import { AnimatedNumber } from "@/components/animated-number";
import { DayStrip, DAY_STRIP_MAX_WEEKS } from "@/components/day-strip";
import { MonthCalendar } from "@/components/month-calendar";
import { MealCardGrid } from "@/components/meal-card-grid";
import { RecipeShelf } from "@/components/recipe-shelf";
import { haptics } from "@/lib/haptics";
import { compactKcal, dayLabel, weeksAgo, weekRangeLabel, isCurrentWeek } from "@/lib/nutrition-views";
import { type ThemeColors } from "@/theme/tokens";
import { mealKindLabels } from "@learn-workbench/shared/labels";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";
import { mealAccentColor } from "@/lib/nutrition/constants";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { NutritionStyles } from "./nutrition-styles";

export function NutritionOverview({
  model,
  styles,
  colors,
}: {
  model: NutritionModel;
  styles: NutritionStyles;
  colors: ThemeColors;
}) {
  const { todayKey, yesterdayKey, date, setDate, weekOffset, setWeekOffset, viewMode, setViewMode, monthView, setMonthView, setDateSheetOpen, setSheetOpen, meal, setMeal, mealNow, hydration, setCupOpen, setLiveOpen, daySummary, mealCards, weekStrip, shiftWeek, doneMap, weekSummary, monthSummary, isToday, totals, remaining, overBudget, openSheet, dailyPicks } = model;
  return (
    <>
      {/* v11 P2（参考图 4）：餐次彩色卡组 + 近 7 天热量条 */}
      <MealCardGrid
        cards={mealCards}
        week={weekStrip}
        weekRange={weekRangeLabel(date)}
        onAdd={(nextMeal) => {
          setMeal(nextMeal);
          setSheetOpen(true);
        }}
        onPickDay={(key) => setDate(key)}
        onPrevWeek={() => shiftWeek(-1)}
        onNextWeek={isCurrentWeek(date, todayKey) ? undefined : () => shiftWeek(1)}
      />

      {/* 需求 2：每日推荐 —— 按日期确定性轮换（同一天稳定、跨天变化），
          与下方「精选食谱」分工：这里回答"今天吃什么"，那里看配料与做法 */}
      {dailyPicks.length > 0 ? (
        <View style={styles.dailyWrap}>
          <SectionHeader
            title="每日推荐"
            subtitle={`按日期确定性轮换 · ${isToday ? "今天" : dayLabel(date, todayKey)}内不变`}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dailyRow}
            nestedScrollEnabled
          >
            {dailyPicks.map(({ meal: pickMeal, recipe }) => {
              const accent = mealAccentColor(pickMeal, colors);
              return (
                <View
                  key={`${pickMeal}-${recipe.id}`}
                  accessible
                  accessibilityLabel={`${mealKindLabels[pickMeal]}推荐：${recipe.name}，${recipe.kcal} 千卡`}
                  style={styles.dailyCard}
                >
                  <View style={styles.dailyTop}>
                    <Text style={[styles.dailyMeal, { color: accent }]}>{mealKindLabels[pickMeal]}</Text>
                    <View style={[styles.dailyTag, { backgroundColor: accent + "1A" }]}>
                      <Text style={[styles.dailyTagText, { color: accent }]}>{recipe.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.dailyName} numberOfLines={2}>{recipe.name}</Text>
                  <Text style={styles.dailyKcal}>{recipe.kcal} kcal</Text>
                  <Text style={styles.dailyMacro}>
                    P{recipe.proteinG} C{recipe.carbsG} F{recipe.fatG} · {recipe.minutes} 分钟
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 2026-10 扩充：与 Web 共用的精选食谱 */}
      <RecipeShelf />

      {/* v4 P4-a：日 / 周 / 月 视图切换（圆角胶囊分段控件，参考「吃一点」顶部那条） */}
      <View style={styles.segment}>
        {(
          [
            { key: "day", label: "日" },
            { key: "week", label: "周" },
            { key: "month", label: "月" },
          ] as const
        ).map((o) => {
          const active = viewMode === o.key;
          return (
            <Pressable
              key={o.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => {
                haptics.soft();
                // 切到「月」时对齐当前所选日期的月份，符合"我正在看哪天就展开哪个月"的预期
                if (o.key === "month") {
                  setMonthView({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
                }
                // 切到「周」时把日期条翻到包含所选日期的那一周（否则会停在今天那周且没有格子高亮）
                if (o.key === "week") {
                  setWeekOffset(weeksAgo(date, todayKey, DAY_STRIP_MAX_WEEKS));
                }
                setViewMode(o.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 日视图：今天 / 昨天 快捷胶囊 + 自定义日期（复用月历弹层） */}
      {viewMode === "day" ? (
        <View style={styles.dayPills}>
          {[
            { key: todayKey, label: "今天" },
            { key: yesterdayKey, label: "昨天" },
          ].map((o) => {
            const active = date === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => {
                  haptics.soft();
                  setDate(o.key);
                }}
              >
                <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.dayPill}
            onPress={() => {
              haptics.soft();
              setDateSheetOpen(true);
            }}
          >
            <Text style={styles.dayPillText}>{date === todayKey || date === yesterdayKey ? "选择日期" : dayLabel(date, todayKey)}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* v4 P4-b 顶部摘要胶囊：把「摄入 / 剩余（或日均）/ 饮水或记录天数」收敛成一行，
          首屏只保留一个强视觉块（下面的热量 Hero），避免多个 hero 互相抢焦点 */}
      <View style={styles.summaryPill}>
        <View style={styles.summaryItem}>
          {/* v19-M2：摘要数字滚动（400ms），切日/周/月时平滑过渡 */}
          <AnimatedNumber
            style={styles.summaryValue}
            value={viewMode === "day" ? Math.round(totals.kcal) : viewMode === "week" ? weekSummary.kcal : monthSummary.kcal}
          />
          <Text style={styles.summaryLabel}>
            {viewMode === "day" ? "已摄入 kcal" : viewMode === "week" ? "本周 kcal" : "本月 kcal"}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <AnimatedNumber
            style={[styles.summaryValue, viewMode === "day" && overBudget && { color: colors.danger }]}
            value={
              viewMode === "day"
                ? Math.abs(remaining)
                : viewMode === "week"
                  ? weekSummary.avgKcal
                  : monthSummary.avgKcal
            }
          />
          <Text style={styles.summaryLabel}>
            {viewMode === "day" ? (overBudget ? "已超出 kcal" : "还能吃 kcal") : "日均 kcal"}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <AnimatedNumber
            style={styles.summaryValue}
            value={
              viewMode === "day"
                ? hydration.totalMl
                : viewMode === "week"
                  ? weekSummary.daysLogged
                  : monthSummary.daysLogged
            }
          />
          <Text style={styles.summaryLabel}>{viewMode === "day" ? "饮水 ml" : "记录天数"}</Text>
        </View>
        <Pressable
          style={styles.summaryAdd}
          onPress={() => {
            haptics.soft();
            openSheet();
          }}
          accessibilityLabel={`添加${mealKindLabels[mealNow]}`}
        >
          <ThemedIcon name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* v1.45 进阶入口：趋势（升级为独立全屏页 /trends）、水杯、LiveLog。
          做成一行**低权重胶囊**而不是卡片：既让功能可发现，又不会在首屏和热量 Hero 抢焦点。 */}
      <View style={styles.advancedRow}>
        <Pressable
          style={styles.advancedChip}
          onPress={() => {
            haptics.soft();
            router.push("/trends" as never);
          }}
          accessibilityLabel="打开趋势分析"
        >
          <ThemedIcon name="stats-chart-outline" size={15} color={colors.primary} />
          <Text style={styles.advancedText}>趋势</Text>
        </Pressable>
        {viewMode === "day" && isToday ? (
          <Pressable
            style={styles.advancedChip}
            onPress={() => {
              haptics.soft();
              setCupOpen(true);
            }}
            accessibilityLabel="打开水杯"
          >
            <ThemedIcon name="water-outline" size={15} color={colors.teal} />
            <Text style={styles.advancedText}>水杯</Text>
            <Text style={styles.advancedMeta}>{hydration.totalMl}</Text>
          </Pressable>
        ) : null}
        {viewMode === "day" ? (
          <Pressable
            style={styles.advancedChip}
            onPress={() => {
              haptics.soft();
              setLiveOpen(true);
            }}
            accessibilityLabel="打开 LiveLog 贴纸画布"
          >
            <ThemedIcon name="sparkles-outline" size={15} color={colors.accent} />
            <Text style={styles.advancedText}>LiveLog</Text>
          </Pressable>
        ) : null}
      </View>

      {/* M2 日期条：周视图的一排（可回看 4 周，今天用能量橙描边） */}
      {viewMode === "week" ? (
        <DayStrip
          selected={date}
          onSelect={setDate}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          doneMap={doneMap}
          todayKey={todayKey}
        />
      ) : null}

      {/* 周视图：这一周的区间汇总 */}
      {viewMode === "week" ? (
        <Card style={styles.rangeCard}>
          <Text style={styles.rangeTitle}>
            {weekSummary.daysLogged > 0 ? `这一周记录了 ${weekSummary.daysLogged} 天` : "这一周还没有记录"}
          </Text>
          <Text style={styles.rangeMeta}>
            {weekSummary.kcal} kcal · 日均 {weekSummary.avgKcal} kcal
            {weekSummary.daysLogged > 0
              ? ` · P${weekSummary.proteinG} C${weekSummary.carbsG} F${weekSummary.fatG}`
              : ""}
          </Text>
        </Card>
      ) : null}

      {/* 月视图：整月日历 + 每格当天 kcal 汇总（点某天 → 回日视图看那天） */}
      {viewMode === "month" ? (
        <>
          <Card style={styles.monthCard}>
            <MonthCalendar
              key={`${monthView.y}-${monthView.m}`}
              selected={fromDateKey(date)}
              initialView={monthView}
              onViewChange={setMonthView}
              onSelect={(d) => {
                haptics.soft();
                setDate(toDateKey(d));
                setViewMode("day");
              }}
              onClose={() => {
                // 月视图是内联的日历，选中即切日视图，无需关闭动作
              }}
              renderDayBadge={(key) => {
                const row = daySummary[key];
                if (!row) return null;
                return <Text style={styles.calBadgeText}>{compactKcal(row.kcal)}</Text>;
              }}
            />
          </Card>
          <Card style={styles.rangeCard}>
            <Text style={styles.rangeTitle}>
              {monthSummary.daysLogged > 0
                ? `${monthView.y} 年 ${monthView.m + 1} 月：记录了 ${monthSummary.daysLogged} 天`
                : `${monthView.y} 年 ${monthView.m + 1} 月还没有记录`}
            </Text>
            <Text style={styles.rangeMeta}>
              {monthSummary.kcal} kcal · 日均 {monthSummary.avgKcal} kcal
              {monthSummary.daysLogged > 0
                ? ` · P${monthSummary.proteinG} C${monthSummary.carbsG} F${monthSummary.fatG}`
                : ""}
            </Text>
            <Text style={styles.rangeHint}>点日期格子可以查看那一天的记录</Text>
          </Card>
        </>
      ) : null}
    </>
  );
}
