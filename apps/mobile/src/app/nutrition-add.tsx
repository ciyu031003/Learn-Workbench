import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { typography } from "@/theme/tokens";
import { useV15 } from "@/components/v15/v15-theme";
import { V15Button, V15Card, V15Header, V15IconButton, V15ProgressBar, V15Scroll, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { useNutritionScreen } from "@/lib/nutrition/use-nutrition-screen";
import { useAppStore } from "@/store/app-store";
import { MEALS } from "@/lib/nutrition/constants";
import { isDateKey } from "@/lib/nutrition-stats";
import { mealForNow } from "@/lib/meal-time";
import { dayLabel, todayAndYesterday } from "@/lib/nutrition-views";
import { haptics } from "@/lib/haptics";
import { mealKindLabels } from "@learn-workbench/shared/labels";
import type { MealKind } from "@learn-workbench/shared/schemas";

/**
 * 记录饮食（全屏，V15）。
 *
 * 与 demo renderNutritionAdd 对齐：餐次分段 → 吃了什么 → 份量/营养预估 → 保存。
 * 正式版保留营养库搜索、克数换算、常用食物与手动填写；保存仍走发件箱（离线可记）。
 */
export default function NutritionAddScreen() {
  const p = useV15();
  const layout = useV15Layout();
  const token = useAppStore((state) => state.token);
  const styles = useMemo(() => makeStyles(p), [p]);
  const goBack = useCallback(() => {
    const canPop = typeof router.canGoBack === "function" && router.canGoBack();
    if (canPop) {
      router.back();
      return;
    }
    router.replace("/nutrition" as never);
  }, []);

  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { today } = useMemo(() => todayAndYesterday(), []);
  const initialDate = isDateKey(params.date) ? params.date : today;
  const initialMeal = MEALS.includes(params.meal as MealKind) ? (params.meal as MealKind) : mealForNow();

  const model = useNutritionScreen({
    initialDate,
    initialMeal,
    searchEnabled: true,
    onSaved: () => goBack(),
  });
  const {
    date,
    meal,
    setMeal,
    foodQuery,
    setFoodQuery,
    dbItems,
    dbLoading,
    pickedItem,
    setPickedItem,
    itemGrams,
    setItemGrams,
    itemScaled,
    addFromItem,
    saving,
    recentFoods,
    lastPortionOf,
    addFoodByPortion,
    manual,
    setManual,
    saveAsCommon,
    setSaveAsCommon,
    addManual,
    target,
    totals,
    hydration,
  } = model;

  const [showManual, setShowManual] = useState(true);

  const proteinLeft = Math.max(0, target.proteinG - totals.proteinG);
  const waterLeft = Math.max(0, (hydration.targetMl > 0 ? hydration.targetMl : 2000) - hydration.totalMl);
  const dateText = dayLabel(date, today);

  const manualReady = manual.name.trim().length > 0 && Number(manual.kcal) > 0;

  const pickSearchItem = useCallback(
    (item: (typeof dbItems)[number]) => {
      haptics.light();
      setPickedItem(item);
      setItemGrams(String(item.basisAmount || 100));
    },
    [setItemGrams, setPickedItem]
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <V15Scroll p={p}>
          <V15Header
            p={p}
            kicker="LOG FOOD"
            title="记录饮食"
            subtitle={dateText + " · " + mealKindLabels[meal] + " · 营养估算可修正"}
            onBack={() => goBack()}
            actions={<V15IconButton p={p} icon="close" label="关闭" onPress={() => goBack()} size={16} weight="bold" />}
          />

          <V15Card p={p} style={{ marginTop: 16 }}>
            <Text style={[styles.label, { color: p.sub }]}>餐次</Text>
            <View style={styles.mealRow}>
              {MEALS.map((kind) => {
                const active = kind === meal;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setMeal(kind)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={mealKindLabels[kind]}
                    style={[styles.mealChip, { backgroundColor: active ? p.ink : p.card2, borderColor: active ? p.ink : p.line }]}
                  >
                    <Text style={[styles.mealChipText, { color: active ? p.canvasTop : p.sub }]} numberOfLines={1}>
                      {mealKindLabels[kind]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: p.sub, marginTop: 16 }]}>吃了什么</Text>
            <View style={[styles.search, { backgroundColor: p.card2, borderColor: p.line }]}>
              <Icon name="search" size={16} weight="regular" color={p.faint} />
              <TextInput
                value={foodQuery}
                onChangeText={setFoodQuery}
                placeholder="搜索食物，如 番茄鸡蛋面 / 鸡胸"
                placeholderTextColor={p.faint}
                style={[styles.searchInput, { color: p.ink }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {foodQuery.length > 0 ? (
                <Pressable onPress={() => setFoodQuery("")} hitSlop={8} accessibilityLabel="清空搜索">
                  <Icon name="close" size={14} weight="bold" color={p.faint} />
                </Pressable>
              ) : null}
            </View>

            {pickedItem ? (
              <View style={[styles.picked, { backgroundColor: p.orangeSoft, borderColor: p.dark ? "transparent" : "rgba(242,92,10,0.16)" }]}>
                <View style={styles.pickedHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.pickedName, { color: p.ink }]} numberOfLines={1}>{pickedItem.name}</Text>
                    <Text style={[styles.pickedMeta, { color: p.sub }]} numberOfLines={1}>
                      基准 {pickedItem.basisAmount}{pickedItem.basisUnit} · {Math.round(pickedItem.kcal)} kcal
                    </Text>
                  </View>
                  <Pressable onPress={() => setPickedItem(null)} hitSlop={8} accessibilityLabel="返回搜索结果">
                    <Icon name="close" size={15} weight="bold" color={p.faint} />
                  </Pressable>
                </View>

                <View style={styles.gramsRow}>
                  <Text style={[styles.gramsLabel, { color: p.sub }]}>实际摄入</Text>
                  <View style={[styles.gramsInput, { backgroundColor: p.card, borderColor: p.line }]}>
                    <TextInput
                      value={itemGrams}
                      onChangeText={setItemGrams}
                      keyboardType="decimal-pad"
                      style={[styles.gramsText, { color: p.ink }]}
                      accessibilityLabel="实际摄入量"
                    />
                    <Text style={[styles.gramsUnit, { color: p.sub }]}>{pickedItem.basisUnit}</Text>
                  </View>
                </View>

                <View style={styles.quickRow}>
                  {[0.5, 1, 1.5, 2].map((multiplier) => {
                    const base = pickedItem.basisAmount > 0 ? pickedItem.basisAmount : 100;
                    const grams = Math.round(base * multiplier * 10) / 10;
                    const active = Math.abs((Number(itemGrams) || 0) - grams) < 0.01;
                    return (
                      <Pressable
                        key={multiplier}
                        onPress={() => {
                          haptics.light();
                          setItemGrams(String(grams));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={"摄入 " + grams + pickedItem.basisUnit}
                        style={[styles.quickChip, { backgroundColor: active ? p.ink : p.card, borderColor: active ? p.ink : p.line }]}
                      >
                        <Text style={[styles.quickText, { color: active ? p.canvasTop : p.sub }]} numberOfLines={1}>
                          {grams}{pickedItem.basisUnit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {itemScaled ? (
                  <View style={styles.previewRow}>
                    <Preview label="kcal" value={String(Math.round(itemScaled.kcal))} p={p} styles={styles} />
                    <Preview label="蛋白 g" value={String(Math.round(itemScaled.proteinG))} p={p} styles={styles} />
                    <Preview label="碳水 g" value={String(Math.round(itemScaled.carbsG))} p={p} styles={styles} />
                    <Preview label="脂肪 g" value={String(Math.round(itemScaled.fatG))} p={p} styles={styles} />
                  </View>
                ) : null}

                <V15Button p={p} label={"添加 " + pickedItem.name} icon="plus" loading={saving} onPress={() => void addFromItem()} style={{ marginTop: 10 }} />
              </View>
            ) : null}

            {!pickedItem && foodQuery.trim().length > 0 ? (
              <View style={{ marginTop: 10, gap: 6 }}>
                {dbLoading ? <Text style={[styles.hint, { color: p.sub }]}>正在搜索营养库…</Text> : null}
                {!dbLoading && dbItems.length === 0 ? (
                  <Text style={[styles.hint, { color: p.sub }]}>没有匹配的食物，可以在下面手动填写。</Text>
                ) : null}
                {dbItems.slice(0, 8).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => pickSearchItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={"选择 " + item.name}
                    style={({ pressed }) => [styles.result, { backgroundColor: p.card, borderColor: p.line }, pressed && { opacity: 0.7 }]}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: p.orangeSoft }]}>
                      <Icon name="food" size={15} weight="duotone" color={p.orange} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.resultName, { color: p.ink }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.resultMeta, { color: p.sub }]} numberOfLines={1}>
                        {item.basisAmount}{item.basisUnit} · {Math.round(item.kcal)} kcal · P{Math.round(item.proteinG)} C{Math.round(item.carbsG)} F{Math.round(item.fatG)}
                      </Text>
                    </View>
                    <Icon name="chevron" size={13} weight="bold" color={p.faint} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </V15Card>

          <V15Section p={p} title="手动记录" right={showManual ? "收起" : "展开"} onRight={() => setShowManual((value) => !value)} />
          {showManual ? (
            <V15Card p={p}>
              <Text style={[styles.label, { color: p.sub }]}>名称</Text>
              <TextInput
                value={manual.name}
                onChangeText={(value) => setManual((prev) => ({ ...prev, name: value }))}
                placeholder="例如：食堂番茄鸡蛋面"
                placeholderTextColor={p.faint}
                style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
              />
              <View style={styles.fieldRow}>
                <View style={styles.fieldCell}>
                  <Text style={[styles.label, { color: p.sub }]}>单位</Text>
                  <TextInput
                    value={manual.unit}
                    onChangeText={(value) => setManual((prev) => ({ ...prev, unit: value }))}
                    placeholder="份"
                    placeholderTextColor={p.faint}
                    style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  />
                </View>
                <View style={styles.fieldCell}>
                  <Text style={[styles.label, { color: p.sub }]}>热量 kcal</Text>
                  <TextInput
                    value={manual.kcal}
                    onChangeText={(value) => setManual((prev) => ({ ...prev, kcal: value }))}
                    keyboardType="numeric"
                    placeholder="560"
                    placeholderTextColor={p.faint}
                    style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  />
                </View>
              </View>
              <View style={styles.fieldRow3}>
                <View style={styles.fieldCell}>
                  <Text style={[styles.label, { color: p.sub }]}>蛋白 g</Text>
                  <TextInput
                    value={manual.proteinG}
                    onChangeText={(value) => setManual((prev) => ({ ...prev, proteinG: value }))}
                    keyboardType="numeric"
                    placeholder="选填"
                    placeholderTextColor={p.faint}
                    style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  />
                </View>
                <View style={styles.fieldCell}>
                  <Text style={[styles.label, { color: p.sub }]}>碳水 g</Text>
                  <TextInput
                    value={manual.carbsG}
                    onChangeText={(value) => setManual((prev) => ({ ...prev, carbsG: value }))}
                    keyboardType="numeric"
                    placeholder="选填"
                    placeholderTextColor={p.faint}
                    style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  />
                </View>
                <View style={styles.fieldCell}>
                  <Text style={[styles.label, { color: p.sub }]}>脂肪 g</Text>
                  <TextInput
                    value={manual.fatG}
                    onChangeText={(value) => setManual((prev) => ({ ...prev, fatG: value }))}
                    keyboardType="numeric"
                    placeholder="选填"
                    placeholderTextColor={p.faint}
                    style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  />
                </View>
              </View>
              <Pressable
                onPress={() => {
                  if (token) setSaveAsCommon((value) => !value);
                }}
                disabled={!token}
                style={styles.switchRow}
                accessibilityRole="switch"
                accessibilityState={{ checked: Boolean(token) && saveAsCommon, disabled: !token }}
              >
                <Switch
                  value={Boolean(token) && saveAsCommon}
                  onValueChange={setSaveAsCommon}
                  disabled={!token}
                  trackColor={{ false: p.track, true: p.orange }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={p.track}
                />
                <Text style={[styles.switchLabel, { color: token ? p.sub : p.faint }]}>
                  {token ? "存入常用食物（下次直接选）" : "登录后可存入常用食物"}
                </Text>
              </Pressable>
              <Text style={[styles.contributeNote, { color: p.faint }]}>手动填写的食材会同步到公共食物库（仅名称与营养值），同名自动去重。</Text>
              <V15Button p={p} label="保存饮食记录" icon="check" loading={saving} disabled={!manualReady} onPress={() => void addManual()} />
            </V15Card>
          ) : (
            <V15Button p={p} label="手动填写一条" icon="food" variant="soft" onPress={() => setShowManual(true)} />
          )}

          {recentFoods.length > 0 ? (
            <>
              <V15Section p={p} title="最近吃过" right="点 + 直接记一份" />
              <V15Card p={p} padded={false}>
                {recentFoods.slice(0, 6).map((food, index) => {
                  const last = lastPortionOf(food);
                  return (
                    <View key={food.id} style={[styles.recentRow, index > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}>
                      <View style={[styles.resultIcon, { backgroundColor: p.card2 }]}>
                        <Icon name="food" size={14} weight="duotone" color={p.sub} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.resultName, { color: p.ink }]} numberOfLines={1}>{food.name}</Text>
                        <Text style={[styles.resultMeta, { color: p.sub }]} numberOfLines={1}>
                          上次 {last.amount} {last.unit} · {Math.round(food.kcal)} kcal
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void addFoodByPortion(food, last.amount, date)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={"把 " + food.name + " 加入记录"}
                        style={[styles.miniAdd, { backgroundColor: p.orangeSoft }]}
                      >
                        <Icon name="plus" size={14} weight="bold" color={p.orange} />
                      </Pressable>
                    </View>
                  );
                })}
              </V15Card>
            </>
          ) : null}

          <V15Section p={p} title="饮食建议" right="基于今日记录" />
          <V15Card p={p}>
            <AdviceRow
              p={p}
              styles={styles}
              icon="sparkle"
              tone={p.orange}
              soft={p.orangeSoft}
              title={proteinLeft > 0 ? "蛋白质还差 " + Math.round(proteinLeft) + "g" : "蛋白质目标已达成"}
              body={proteinLeft > 0 ? "优先鸡胸、鱼虾或希腊酸奶，饱腹感更稳。" : "可以优先补充蔬菜与水分，避免夜间过量加餐。"}
            />
            <View style={[styles.adviceDivider, { backgroundColor: p.line }]} />
            <AdviceRow
              p={p}
              styles={styles}
              icon="drop"
              tone={p.blue}
              soft={p.blueSoft}
              title={waterLeft > 0 ? "饮水还差 " + (waterLeft / 1000).toFixed(2).replace(/\.?0+$/, "") + "L" : "今日饮水目标已达成"}
              body={waterLeft > 0 ? "餐前 30 分钟一杯水，减少无意识加餐。" : "保持少量多次，睡前 1 小时减少大量饮水。"}
            />
            <View style={{ marginTop: 12 }}>
              <View style={styles.proteinHead}>
                <Text style={[styles.proteinLabel, { color: p.sub }]}>今日蛋白质</Text>
                <Text style={[styles.proteinValue, { color: p.ink }]}>
                  {Math.round(totals.proteinG)} / {target.proteinG} g
                </Text>
              </View>
              <V15ProgressBar p={p} pct={target.proteinG > 0 ? (totals.proteinG / target.proteinG) * 100 : 0} color={p.orange} height={6} />
            </View>
          </V15Card>

          <View style={{ height: layout.wide ? 18 : 10 }} />
        </V15Scroll>
      </KeyboardAvoidingView>
    </View>
  );
}

function Preview({ label, value, p, styles }: { label: string; value: string; p: ReturnType<typeof useV15>; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.preview}>
      <Text style={[styles.previewValue, { color: p.ink }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.previewLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function AdviceRow({
  p,
  styles,
  icon,
  tone,
  soft,
  title,
  body,
}: {
  p: ReturnType<typeof useV15>;
  styles: ReturnType<typeof makeStyles>;
  icon: "sparkle" | "drop";
  tone: string;
  soft: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.advice}>
      <View style={[styles.adviceIcon, { backgroundColor: soft }]}>
        <Icon name={icon} size={16} weight="fill" color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.adviceTitle, { color: p.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.adviceBody, { color: p.sub }]}>{body}</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: ReturnType<typeof useV15>) =>
  StyleSheet.create({
    label: { ...typography.micro, fontWeight: "700", marginBottom: 6 },
    mealRow: { flexDirection: "row", gap: 6 },
    mealChip: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    mealChipText: { ...typography.caption, fontWeight: "700" },
    search: { height: 50, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
    searchInput: { flex: 1, ...typography.callout, paddingVertical: 0 },
    hint: { ...typography.meta },
    result: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
    resultIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    resultName: { ...typography.callout, fontWeight: "700" },
    resultMeta: { ...typography.micro, fontWeight: "500", marginTop: 1 },
    picked: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
    pickedHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    pickedName: { ...typography.headline, fontWeight: "800" },
    pickedMeta: { ...typography.meta, marginTop: 2 },
    gramsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    gramsLabel: { ...typography.caption },
    gramsInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
    gramsText: { flex: 1, ...typography.callout, fontWeight: "700", paddingVertical: 0 },
    gramsUnit: { ...typography.caption },
    quickRow: { flexDirection: "row", gap: 5, marginTop: 6 },
    quickChip: { flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    quickText: { ...typography.micro, fontWeight: "700" },
    previewRow: { flexDirection: "row", gap: 6, marginTop: 9 },
    preview: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 10, backgroundColor: p.card },
    previewValue: { ...typography.callout, fontWeight: "800" },
    previewLabel: { ...typography.micro, fontWeight: "500" },
    input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, ...typography.callout },
    fieldRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    fieldRow3: { flexDirection: "row", gap: 8, marginTop: 10 },
    fieldCell: { flex: 1, minWidth: 0 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 },
    switchLabel: { ...typography.meta, flex: 1 },
    contributeNote: { ...typography.meta, marginTop: -4, marginBottom: 10 },
    recentRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 8 },
    miniAdd: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    advice: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
    adviceIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    adviceTitle: { ...typography.callout, fontWeight: "700" },
    adviceBody: { ...typography.meta, marginTop: 2, lineHeight: 18 },
    adviceDivider: { height: 1, marginVertical: 10 },
    proteinHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    proteinLabel: { ...typography.meta },
    proteinValue: { ...typography.caption, fontWeight: "800" },
  });
