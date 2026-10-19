import { Pressable, Switch, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { FoodSticker } from "@/components/food-sticker";
import { scaleNutrition } from "@/lib/portion";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { dayLabel } from "@/lib/nutrition-views";
import { type ThemeColors } from "@/theme/tokens";
import { mealKindLabels } from "@learn-workbench/shared/labels";
import { formatBasisLabel } from "@learn-workbench/shared/pure";
import { MEALS } from "@/lib/nutrition/constants";
import { portionOptions } from "@/lib/nutrition/portion-memo";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { NutritionStyles } from "./nutrition-styles";
import { AccordionGroup } from "./accordion-group";

export function AddFoodSheet({
  model,
  styles,
  colors,
}: {
  model: NutritionModel;
  styles: NutritionStyles;
  colors: ThemeColors;
}) {
  const { todayKey, date, loading, sheetOpen, meal, setMeal, saving, openGroups, portionById, justAdded, manual, setManual, saveAsCommon, setSaveAsCommon, foodQuery, setFoodQuery, dbItems, dbLoading, pickedItem, setPickedItem, itemGrams, setItemGrams, isToday, itemScaled, addFromItem, closeSheet, toggleGroup, choosePortion, focusPortionRow, addFoodByPortion, recentFoods, lastPortionOf, quickAdd, addManual, visibleFoods } = model;
  return (
    <>
      <BottomSheet visible={sheetOpen} onClose={closeSheet} title="添加饮食" height="86%" expandable>
        <View style={styles.form}>
          <Text style={styles.label}>餐次</Text>
          <View style={styles.kindRow}>
            {MEALS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMeal(m)}
                style={[styles.kindChip, meal === m && styles.kindChipActive]}
              >
                <Text style={[styles.kindChipText, meal === m && styles.kindChipTextActive]}>{mealKindLabels[m]}</Text>
              </Pressable>
            ))}
          </View>

          {/* v6 P1-3：搜索提到最前 —— 先查营养基准库（模糊匹配 → 输入克数换算），再是常用食物网格 */}
          <Field
            value={foodQuery}
            onChangeText={setFoodQuery}
            placeholder="搜索食物（如 番茄鸡蛋面 / 鸡旦）"
            returnKeyType="search"
            autoCapitalize="none"
          />

          {foodQuery.trim().length > 0 ? (
            <View style={styles.dbBlock}>
              <SectionHeader
                title="营养库匹配"
                subtitle={dbLoading ? "搜索中…" : "选一条 → 填实际摄入量"}
                style={styles.sheetSection}
              />
              {pickedItem ? (
                <View style={styles.itemCard}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemName} numberOfLines={1}>{pickedItem.name}</Text>
                    <Pressable hitSlop={8} onPress={() => setPickedItem(null)} accessibilityLabel="返回搜索结果">
                      <ThemedIcon name="close-circle" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                  <Text style={styles.itemMeta}>
                    {formatBasisLabel(pickedItem)} · {Math.round(pickedItem.kcal)} kcal
                    {pickedItem.category ? ` · ${pickedItem.category}` : ""}
                  </Text>
                  <View style={styles.gramsRow}>
                    <Field
                      label="实际摄入量"
                      value={itemGrams}
                      onChangeText={setItemGrams}
                      keyboardType="numeric"
                      placeholder={String(pickedItem.basisAmount)}
                      containerStyle={styles.gramsField}
                    />
                    <Text style={styles.gramsUnit}>{pickedItem.basisUnit}</Text>
                  </View>
                  {/* 需求 1：按「基准量（如每 100g）」的倍数选分量，点一下下面那行预览立刻重算 */}
                  <View style={styles.gramsQuick}>
                    {[0.5, 1, 1.5, 2].map((multiplier) => {
                      const base = Number(pickedItem.basisAmount) > 0 ? Number(pickedItem.basisAmount) : 100;
                      const grams = Math.round(base * multiplier * 10) / 10;
                      const active = Math.abs((Number(itemGrams) || 0) - grams) < 0.01;
                      return (
                        <Pressable
                          key={multiplier}
                          onPress={() => {
                            haptics.light();
                            setItemGrams(String(grams));
                          }}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${grams} ${pickedItem.basisUnit}`}
                          style={[styles.gramsChip, active && styles.gramsChipActive]}
                        >
                          <Text style={[styles.gramsChipText, active && styles.gramsChipTextActive]}>
                            {grams} {pickedItem.basisUnit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {itemScaled ? (
                    <Text style={styles.itemPreview}>
                      ≈ {Math.round(itemScaled.kcal)} kcal · P{itemScaled.proteinG} C{itemScaled.carbsG} F{itemScaled.fatG}
                    </Text>
                  ) : null}
                  <Button label={`添加到${mealKindLabels[meal]}`} icon="add" loading={saving} onPress={() => void addFromItem()} />
                </View>
              ) : (
                <>
                  {dbItems.map((it) => (
                    <PressableScale
                      key={it.id}
                      haptic
                      scaleTo={0.98}
                      style={styles.dbRow}
                      onPress={() => {
                        setPickedItem(it);
                        setItemGrams(String(it.basisAmount));
                      }}
                    >
                      <View style={styles.dbRowBody}>
                        <Text style={styles.dbName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.dbMeta} numberOfLines={1}>
                          {formatBasisLabel(it)} · {Math.round(it.kcal)} kcal
                          {it.category ? ` · ${it.category}` : ""}
                        </Text>
                      </View>
                      <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                    </PressableScale>
                  ))}
                  {!dbLoading && dbItems.length === 0 ? (
                    <Text style={styles.muted}>营养库没有匹配，可试试下方手动添加</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* 需求 1：分组收纳栏 —— 默认只展开「常用食物」，其余折叠；折叠标题上带条目数 */}
          <AccordionGroup
            id="common"
            title="常用食物"
            hint="点一下记 1 份 · 长按选分量"
            count={visibleFoods.length}
            open={!!openGroups.common}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {/* v6 P1-1：两列大图标网格（原来一食物一行太占地方） */}
            <View style={styles.foodGrid}>
              {visibleFoods.slice(0, 12).map((f) => (
                <PressableScale
                  key={f.id}
                  haptic
                  scaleTo={0.96}
                  onPress={() => void quickAdd(f)}
                  onLongPress={() => focusPortionRow(f)}
                  style={styles.foodCard}
                  accessibilityLabel={`记一份 ${f.name}`}
                >
                  <View style={styles.foodCardTop}>
                    <FoodSticker name={f.name} size={46} />
                    <ThemedIcon name="add-circle" size={18} color={colors.accentStrong} />
                  </View>
                  <Text style={styles.foodCardName} numberOfLines={2}>{f.name}</Text>
                  <Text style={styles.foodCardMeta} numberOfLines={1}>
                    {Math.round(f.kcal)} kcal · {f.unit}
                  </Text>
                </PressableScale>
              ))}
              {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试手动添加</Text> : null}
            </View>
            {visibleFoods.length > 12 ? (
              <Text style={styles.muted}>还有 {visibleFoods.length - 12} 种没铺出来：用上方搜索能直接找到</Text>
            ) : null}
          </AccordionGroup>

          {/* 需求 1：按分量添加 —— 选中分量时该行的热量与 P/C/F 立刻按「单位营养 × 分量」重算 */}
          <AccordionGroup
            id="portion"
            title="按分量添加"
            hint="选分量后热量与三大营养素实时重算"
            count={visibleFoods.length}
            open={!!openGroups.portion}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {visibleFoods.slice(0, 12).map((f) => {
              const options = portionOptions(f);
              const amountValue = portionById[f.id] ?? options[1]?.value ?? 1;
              const scaled = scaleNutrition(f, amountValue);
              const added = !!justAdded[f.id];
              return (
                <View key={f.id} style={styles.portionRow}>
                  <View style={styles.portionHead}>
                    <FoodSticker name={f.name} size={34} />
                    <View style={styles.portionBody}>
                      <Text style={styles.portionName} numberOfLines={1}>{f.name}</Text>
                      <Text style={styles.portionMeta} numberOfLines={1}>
                        每 {f.unit}：{Math.round(f.kcal)} kcal · P{f.proteinG} C{f.carbsG} F{f.fatG}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void addFoodByPortion(f, amountValue, date)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`添加 ${amountValue} ${f.unit} ${f.name} 到${mealKindLabels[meal]}`}
                      style={[styles.portionAdd, added && styles.portionAddDone]}
                    >
                      <ThemedIcon name={added ? "checkmark" : "add"} size={13} color={added ? colors.success : "#ffffff"} />
                      <Text style={[styles.portionAddText, added && styles.portionAddTextDone]}>
                        {added ? "已加入" : "添加"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.portionChips}>
                    {options.map((o) => {
                      const active = o.value === amountValue;
                      return (
                        <Pressable
                          key={o.value}
                          onPress={() => choosePortion(f.id, o.value)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${f.name} 选 ${o.label}`}
                          style={[styles.portionChip, active && styles.portionChipActive]}
                        >
                          <Text style={[styles.portionChipText, active && styles.portionChipTextActive]}>
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* 实时联动：每份营养 × 当前分量（scaleNutrition），不是只改标签 */}
                  <Text style={styles.portionPreview}>
                    ≈ {Math.round(scaled.kcal)} kcal · P{scaled.proteinG} C{scaled.carbsG} F{scaled.fatG}
                  </Text>
                </View>
              );
            })}
            {visibleFoods.length === 0 ? <Text style={styles.muted}>没有匹配的食物，试试手动添加</Text> : null}
            {visibleFoods.length > 12 ? (
              <Text style={styles.muted}>还有 {visibleFoods.length - 12} 种没列出来：用上方搜索能直接找到</Text>
            ) : null}
          </AccordionGroup>

          {/* 需求 3：以往添加的食物 —— 右侧「+ 今日」按上次分量一键入账 */}
          <AccordionGroup
            id="history"
            title="以往添加的食物"
            hint={
              isToday
                ? `按上次分量，一键记到${mealKindLabels[meal]}`
                : `「+ 今日」始终记到今天；当前在看 ${dayLabel(date, todayKey)}`
            }
            count={recentFoods.length}
            open={!!openGroups.history}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            {recentFoods.map((f) => {
              const last = lastPortionOf(f);
              const added = !!justAdded[f.id];
              return (
                <View key={f.id} style={styles.historyRow}>
                  <FoodSticker name={f.name} size={32} />
                  <View style={styles.historyBody}>
                    <Text style={styles.historyName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      上次 {last.amount} {last.unit}
                      {typeof f.times === "number" && f.times > 0 ? ` · 吃过 ${f.times} 次` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void addFoodByPortion(f, last.amount, todayKey)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`把 ${f.name} 加入今天记录`}
                    style={[styles.historyAdd, added && styles.historyAddDone]}
                  >
                    <ThemedIcon
                      name={added ? "checkmark" : "add"}
                      size={13}
                      color={added ? colors.success : colors.accentStrong}
                    />
                    <Text style={[styles.historyAddText, added && styles.historyAddTextDone]}>
                      {added ? "已加入" : "+ 今日"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {recentFoods.length === 0 ? (
              <Text style={styles.muted}>还没有吃过的记录：从上方常用食物开始记一条吧</Text>
            ) : null}
          </AccordionGroup>

          <AccordionGroup
            id="manual"
            title="手动添加"
            hint="只填名称与热量也能记一条"
            open={!!openGroups.manual}
            onToggle={toggleGroup}
            styles={styles}
            colors={colors}
          >
            <Field
              label="名称"
              value={manual.name}
              onChangeText={(v) => setManual((s) => ({ ...s, name: v }))}
              placeholder="例如：食堂番茄鸡蛋面"
            />
            <View style={styles.macroInputRow}>
              <Field
                label="单位"
                value={manual.unit}
                onChangeText={(v) => setManual((s) => ({ ...s, unit: v }))}
                placeholder="份"
                containerStyle={styles.macroInput}
              />
              <Field
                label="热量 kcal"
                value={manual.kcal}
                onChangeText={(v) => setManual((s) => ({ ...s, kcal: v }))}
                keyboardType="numeric"
                placeholder="520"
                containerStyle={styles.macroInput}
              />
            </View>
            <View style={styles.macroInputRow}>
              <Field
                label="蛋白 g"
                value={manual.proteinG}
                onChangeText={(v) => setManual((s) => ({ ...s, proteinG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
              <Field
                label="碳水 g"
                value={manual.carbsG}
                onChangeText={(v) => setManual((s) => ({ ...s, carbsG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
              <Field
                label="脂肪 g"
                value={manual.fatG}
                onChangeText={(v) => setManual((s) => ({ ...s, fatG: v }))}
                keyboardType="numeric"
                placeholder="选填"
                containerStyle={styles.macroInput}
              />
            </View>
            <Pressable style={styles.switchRow} onPress={() => setSaveAsCommon((v) => !v)}>
              <Switch value={saveAsCommon} onValueChange={setSaveAsCommon} trackColor={{ true: colors.primary }} />
              <Text style={styles.switchLabel}>存入常用食物（下次可直接选）</Text>
            </Pressable>
            <Button
              label="手动添加到这天"
              icon="create-outline"
              variant="secondary"
              loading={saving}
              onPress={() => void addManual()}
            />
          </AccordionGroup>
        </View>
      </BottomSheet>
    </>
  );
}
