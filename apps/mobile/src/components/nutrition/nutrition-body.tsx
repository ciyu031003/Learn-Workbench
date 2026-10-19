import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { SectionHeader } from "@/components/section-header";
import { Card } from "@/components/card";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { AnimatedNumber } from "@/components/animated-number";
import { ProgressBar } from "@/components/stat";
import { KcalBadge } from "@/components/kcal-badge";
import { FoodSticker } from "@/components/food-sticker";
import { MacroMiniRings } from "@/components/macro-mini-rings";
import { SwipeRow } from "@/components/swipe-row";
import { WaterCard } from "@/components/water-card";
import { WeightCard } from "@/components/weight-card";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { hasPendingFor, pendingCount } from "@/lib/nutrition-outbox";
import { dayLabel } from "@/lib/nutrition-views";
import { type ThemeColors } from "@/theme/tokens";
import { MEAL_KCAL_SHARES, mealKindLabels } from "@learn-workbench/shared/labels";
import { formatEntryTime } from "@learn-workbench/shared/dates";
import { kcalEquivalentText, sumNutrition } from "@learn-workbench/shared/pure";
import { MEALS } from "@/lib/nutrition/constants";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { NutritionStyles } from "./nutrition-styles";

export function NutritionBody({
  model,
  styles,
  colors,
}: {
  model: NutritionModel;
  styles: NutritionStyles;
  colors: ThemeColors;
}) {
  const { todayKey, date, viewMode, entries, loading, foods, mealNow, setManual, setEditing, outbox, pendingIds, profile, setTargetOpen, hydration, weightPoints, wellnessBusy, setWeightOpen, setWeightDraft, setBookOpen, target, isToday, totals, remaining, overBudget, ringProgress, retryPending, stickers, openSheet, quickAdd, remove, onAddWater, onUndoWater, macroItems } = model;
  return (
    <>
      {/* M1 热量 Hero：主角是「今天还能吃多少」——只在日视图出现（每屏唯一 hero） */}
      {viewMode === "day" ? (
      <>
      <GlassSurface corner={24} style={styles.hero}>
        <ProgressArc
          progress={ringProgress}
          size={132}
          strokeWidth={12}
          overBudget={overBudget}
          beatOnChange
          pulseKey={date}
          value={`${Math.round(ringProgress * 100)}%`}
          label="已完成"
        />
        <View style={styles.heroRight}>
          <Text style={styles.heroCaption}>
            {overBudget ? "已超出" : isToday ? "今天还能吃" : `${dayLabel(date, todayKey)}还能吃`}
          </Text>
          <View style={styles.heroValueRow}>
            <AnimatedNumber
              value={Math.abs(remaining)}
              style={[styles.heroValue, overBudget && { color: colors.danger }]}
              accessibilityLabel={`${overBudget ? "已超出" : "今天还能吃"} ${Math.abs(remaining)} 千卡`}
            />
            <Text style={styles.heroUnit}>kcal</Text>
          </View>
          <Text style={styles.heroHint} numberOfLines={2}>
            {overBudget
              ? "超一点没关系，明天正常吃就好"
              : remaining > 0
                ? kcalEquivalentText(remaining)
                : "刚好达标，收工"}
          </Text>
          <Pressable
            onPress={() => {
              haptics.soft();
              setTargetOpen(true);
            }}
            hitSlop={6}
            style={styles.targetRow}
          >
            <Text style={styles.targetText}>
              已吃 {totals.kcal} · 目标 {target.kcal}
              {target.computed ? "（按身体数据）" : ""}
            </Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
          </Pressable>
        </View>
      </GlassSurface>
      </>
      ) : null}

      {/* v6 P0-3：待同步状态条 —— 未上传的条目始终可见，且可一键重试 */}
      {pendingCount(outbox) > 0 ? (
        <Pressable
          onPress={() => void retryPending()}
          style={styles.syncBar}
          accessibilityLabel="重试同步待上传的饮食记录"
        >
          <ThemedIcon name="refresh" size={15} color={colors.accentStrong} />
          <Text style={styles.syncBarText}>{pendingCount(outbox)} 条待同步 · 点此重试</Text>
        </Pressable>
      ) : null}

      {viewMode === "month" ? null : (
        <PressableScale haptic style={styles.addBtn} onPress={openSheet}>
          <ThemedIcon name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>添加{mealKindLabels[mealNow]}</Text>
        </PressableScale>
      )}

      {/* M3 餐次时间线（月视图只看日历与汇总，不铺明细） */}
      {viewMode === "month" ? null : loading && entries.length === 0 ? (
        <SkeletonList count={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title={isToday ? "今天还没有记录" : "这天没有记录"}
          hint="从常用食物一点即记，或手动填写营养"
        />
      ) : (
        MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m);
          if (list.length === 0) return null;
          const mealKcal = sumNutrition(list).kcal;
          const share = MEAL_KCAL_SHARES[m];
          const mealTarget = Math.round(target.kcal * share);
          const mealPct = mealTarget > 0 ? Math.min(1, mealKcal / mealTarget) : 0;
          return (
            <View key={m} style={styles.mealBlock}>
              <View style={styles.mealHead}>
                <Text style={styles.mealTitle}>{mealKindLabels[m]}</Text>
                <Text style={styles.mealMeta}>
                  {mealKcal} / {mealTarget} kcal · {Math.round(share * 100)}%
                </Text>
              </View>
              {/* v19-M2：餐次进度条动画化（240ms 缓动），随记录增减平滑变化 */}
              <ProgressBar
                progress={Math.min(1, Number.isFinite(mealPct) ? mealPct : 0)}
                height={5}
                color={mealPct >= 1 ? colors.success : colors.accent}
                style={styles.mealTrack}
              />
              <View style={styles.timeline}>
                {list.map((e, i) => {
                  const time = formatEntryTime(e.createdAt);
                  const isPending = e.id < 0 || hasPendingFor(outbox, e.id) || pendingIds.includes(e.id);
                  return (
                    <Animated.View key={e.id} entering={FadeInUp.duration(180)} layout={LinearTransition.duration(180)}>
                      <SwipeRow
                        onDelete={() => {
                          void remove(e.id);
                        }}
                        deleteLabel="删除"
                      >
                        <Pressable
                          onPress={() => {
                            haptics.soft();
                            setEditing(e);
                          }}
                          style={styles.entryRow}
                          accessibilityLabel={`修改 ${e.name}`}
                        >
                          <View style={styles.rail}>
                            <View style={[styles.node, isPending && { backgroundColor: colors.textFaint }]} />
                            {i !== list.length - 1 ? <View style={styles.line} /> : null}
                          </View>
                          {/* 「吃一点」式行结构：左侧「日期 时间」品牌绿 → 食物名 → 单位/营养素，
                              贴纸与 kcal 放到右侧（贴纸角上的橙色数字） */}
                          <View style={styles.entryBody}>
                            <Text style={styles.entryWhen} numberOfLines={1}>
                              {dayLabel(date, todayKey)}
                              {time ? ` ${time}` : ""}
                              {isPending ? " · 待同步" : ""}
                            </Text>
                            <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                            <Text style={styles.entryMeta} numberOfLines={1}>
                              {e.amount} {e.unit} · P{Math.round(e.proteinG)} C{Math.round(e.carbsG)} F{Math.round(e.fatG)}
                            </Text>
                          </View>
                          <View style={styles.entrySticker}>
                            <FoodSticker name={e.name} size={52} outlined rotate={i % 2 === 0 ? -6 : 5} />
                            <View style={styles.entryKcal}>
                              <KcalBadge kcal={e.kcal} size="sm" bare />
                            </View>
                          </View>
                        </Pressable>
                      </SwipeRow>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}

      {/* 日视图的次要卡片（三大营养素 / 饮水 / 体重）**放在时间线之后**：
          首屏先给"还能吃 + 吃了什么"（借「吃一点」的信息优先级），这些日常打卡往下排一行，
          既满足"每屏唯一强视觉块"，也避免首屏被四张卡挤满。 */}
      {viewMode === "day" ? (
        <>
          <Card style={styles.macroCard}>
            <MacroMiniRings items={macroItems} />
          </Card>
          {isToday ? (
            <>
              <WaterCard
                totalMl={hydration.totalMl}
                targetMl={hydration.targetMl}
                lastLogId={hydration.lastId}
                busy={wellnessBusy}
                onAdd={(ml) => void onAddWater(ml)}
                onUndo={() => void onUndoWater()}
              />
              <WeightCard
                points={weightPoints.map((p) => ({ date: p.date, weightKg: p.weightKg }))}
                heightCm={profile?.heightCm ?? null}
                busy={wellnessBusy}
                onAdd={() => {
                  const latest = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].weightKg : (profile?.weightKg ?? 60);
                  setWeightDraft(String(Math.round(latest * 10) / 10));
                  setWeightOpen(true);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* M9 我的饮食日记：当天贴纸（点一下 = 再记一份），完整收集册在弹层里；月视图不显示 */}
      {viewMode !== "month" && stickers.length > 0 ? (
        <Card style={styles.stickerCard}>
          <SectionHeader
            title="我的饮食日记"
            subtitle={`今天收集了 ${stickers.length} 种食物`}
            actionLabel="收集册"
            onAction={() => {
              haptics.soft();
              setBookOpen(true);
            }}
          />
          <View style={styles.stickerGrid}>
            {stickers.map((s) => (
              <Pressable
                key={s.name}
                onPress={() => {
                  const food = foods.find((f) => f.name === s.name);
                  if (food) {
                    void quickAdd(food);
                    return;
                  }
                  haptics.soft();
                  setManual((prev) => ({ ...prev, name: s.name, kcal: String(Math.round(s.kcal)) }));
                  openSheet();
                }}
                style={styles.stickerCell}
                accessibilityLabel={`再记一份 ${s.name}`}
              >
                <FoodSticker name={s.name} size={44} />
                <Text style={styles.stickerName} numberOfLines={1}>{s.name}</Text>
                {s.times > 1 ? <Text style={styles.stickerTimes}>×{s.times}</Text> : null}
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}
