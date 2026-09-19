import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  SPORT_CATALOG,
  buildSportsCardModel,
  computeSportsRecord,
  equipmentCategoryForGearLabel,
  formatMemberNo,
  sportItemByKey,
  type SportsProfile,
} from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { GroupLabel } from "@/components/group-label";
import { SportsHoloCard } from "@/components/sports-holo-card";
import { EquipmentPicker } from "@/components/equipment-picker-sheet";
import type { EquipmentItem } from "@/lib/equipment";
import { hasHoloImages, holoImages } from "@/lib/holo-images";
import { absoluteMediaUrl, deleteUpload, kindFromGearLabel, pickAndUpload } from "@/lib/uploads";
import {
  deleteSportsProfile,
  draftFromProfile,
  emptySportsDraft,
  fetchSportsProfiles,
  patchSportsProfile,
  saveSportsProfile,
  type SportsProfileDraft,
} from "@/lib/sports-client";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/** 可做闪光卡的运动项目 */
const CARD_SPORTS = ["badminton", "tennis", "basketball", "volleyball", "table-tennis", "soccer", "baseball"] as const;

interface BodyInfo {
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function levelLabel(profile: SportsProfile, sportName: string): string {
  const level = profile.levelText?.trim();
  if (level) return level.toUpperCase().includes("VIP") ? level : level + " · VIP";
  return sportName + " · VIP";
}

export default function SportsCardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const token = useAppStore((s) => s.token);

  const [profiles, setProfiles] = useState<SportsProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [body, setBody] = useState<BodyInfo>({ heightCm: null, weightKg: null, birthYear: null });
  const [city, setCity] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SportsProfileDraft>(() => emptySportsDraft());
  const [saving, setSaving] = useState(false);
  /** 正在从图库选装备的装备行下标（null = 未打开） */
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  // 闪光卡全屏弹层
  const [cardOpen, setCardOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const cardButtonRef = useRef<View | null>(null);
  const anim = useSharedValue(0);

  const load = useCallback(async () => {
    try {
      const list = await fetchSportsProfiles();
      setProfiles(list);
      setSelectedId((prev) => (prev && list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? null)));
    } catch {
      setProfiles([]);
    }
    // 身高/体重/生日 与 地区：只是图鉴上的补充信息，失败就不显示
    try {
      const headers: Record<string, string> = token ? { Authorization: "Bearer " + token } : {};
      const [targetRes, infoRes] = await Promise.all([
        fetch(getApiUrl() + "/api/nutrition/target", { headers }),
        fetch(getApiUrl() + "/api/profile/info", { headers }),
      ]);
      if (targetRes.ok) {
        const d = await targetRes.json();
        setBody({
          heightCm: num(d.heightCm ?? d.target?.heightCm),
          weightKg: num(d.weightKg ?? d.target?.weightKg),
          birthYear: num(d.birthYear ?? d.target?.birthYear),
        });
      }
      if (infoRes.ok) {
        const d = await infoRes.json();
        const value = d.currentCity ?? d.info?.currentCity ?? null;
        setCity(typeof value === "string" && value.trim() ? value.trim() : null);
      }
    } catch {
      // 忽略：图鉴依然可用
    }
  }, [token]);

  useEffect(() => {
    // 进屏即拉档案（数据加载后在 effect 中写状态是既有模式）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const current = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null,
    [profiles, selectedId]
  );
  const sportName = current ? (sportItemByKey(current.sportKey)?.name ?? current.sportKey) : "";
  const model = useMemo(() => {
    if (!current) return null;
    const index = Math.max(1, profiles.findIndex((p) => p.id === current.id) + 1);
    return buildSportsCardModel(current, {
      sportName,
      index,
      total: Math.max(1, profiles.length),
      memberNo: formatMemberNo(current.id),
    });
  }, [current, profiles, sportName]);
  const record = current ? computeSportsRecord(current) : null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/wellness" as never);
  };

  const openCard = () => {
    cardButtonRef.current?.measureInWindow((x, y, w, h) => {
      setOrigin({ x: x + w / 2, y: y + h / 2 });
    });
    setCardOpen(true);
    anim.value = 0;
    anim.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  };

  const closeCard = () => {
    anim.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setCardOpen)(false);
    });
  };

  const cardWrapStyle = useAnimatedStyle(() => {
    const dx = origin ? origin.x - screenWidth / 2 : 0;
    const dy = origin ? origin.y - screenHeight / 2 : 0;
    return {
      opacity: interpolate(anim.value, [0, 0.25, 1], [0, 1, 1]),
      transform: [
        { perspective: 1200 },
        { translateX: interpolate(anim.value, [0, 1], [dx, 0]) },
        { translateY: interpolate(anim.value, [0, 1], [dy, 0]) },
        { scale: interpolate(anim.value, [0, 1], [0.08, 1]) },
        { rotateY: `${interpolate(anim.value, [0, 1], [-180, 0])}deg` },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 1], [0, 0.88]),
  }));

  const closeRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.7, 1], [0, 0, 1]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.6, 1]) }],
  }));

  const openNew = (sportKey = "badminton") => {
    setEditId(null);
    setDraft(emptySportsDraft(sportKey));
    setSheetOpen(true);
  };

  const openEdit = (p: SportsProfile) => {
    setEditId(p.id);
    setDraft(draftFromProfile(p));
    setSheetOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSportsProfile(
        {
          ...draft,
          gear: draft.gear.filter((g) => g.value.trim()),
          highlights: draft.highlights.filter((h) => h.label.trim() || h.value.trim()),
        },
        editId
      );
      setSheetOpen(false);
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  /** 换本人照片：选图 → 上传 → PATCH photoUrl → 清理旧图 */
  const uploadHeroPhoto = async () => {
    if (!current) return;
    const target = current;
    try {
      const url = await pickAndUpload("avatar");
      if (!url) return;
      const previous = target.photoUrl;
      await patchSportsProfile(target.id, { photoUrl: url });
      if (previous?.startsWith("/uploads/")) void deleteUpload(previous);
      await load();
    } catch (e) {
      Alert.alert("上传失败", e instanceof Error ? e.message : "请稍后重试");
    }
  };

  /** 换装备图：选图 → 上传 → PATCH gear[i].imageUrl → 清理旧图 */
  const uploadGearImage = async (index: number) => {
    if (!current) return;
    const target = current;
    const item = (target.gear ?? [])[index];
    if (!item) return;
    try {
      const url = await pickAndUpload(kindFromGearLabel(item.label));
      if (!url) return;
      const nextGear = (target.gear ?? []).map((g, i) => (i === index ? { ...g, imageUrl: url } : g));
      await patchSportsProfile(target.id, { gear: nextGear });
      if (item.imageUrl?.startsWith("/uploads/")) void deleteUpload(item.imageUrl);
      await load();
    } catch (e) {
      Alert.alert("上传失败", e instanceof Error ? e.message : "请稍后重试");
    }
  };

  const remove = (p: SportsProfile) => {
    Alert.alert("删除档案", "删除后闪光卡与公开分享链接都会失效", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteSportsProfile(p.id);
              await load();
            } catch {
              Alert.alert("删除失败", "请稍后重试");
            }
          })();
        },
      },
    ]);
  };

  const setGear = (i: number, patch: Partial<{ label: string; value: string; imageUrl?: string | null }>) => {
    setDraft((d) => ({ ...d, gear: d.gear.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  };

  /** 从图库选中的装备：回填型号 + 商品图 */
  const applyEquipment = (item: EquipmentItem) => {
    if (pickerIndex === null) return;
    setGear(pickerIndex, { value: item.model, imageUrl: item.imageUrl });
    setPickerIndex(null);
  };

  const setHighlight = (i: number, patch: Partial<{ label: string; value: string }>) => {
    setDraft((d) => ({ ...d, highlights: d.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));
  };

  const heroImages = current ? holoImages(current.sportKey) : null;
  const grid = current
    ? [
        { label: "身高", value: body.heightCm ? body.heightCm + " cm" : "—" },
        { label: "体重", value: body.weightKg ? body.weightKg + " kg" : "—" },
        { label: "鞋码", value: current.shoeSize?.trim() || "—" },
        { label: "磅数", value: current.tensionLbs ? current.tensionLbs + " lbs" : "—" },
      ]
    : [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.headerBtn} accessibilityLabel="返回">
          <ThemedIcon name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {current ? "我的" + sportName + "档案" : "运动档案"}
        </Text>
        {current && hasHoloImages(current.sportKey) ? (
          <Pressable
            ref={cardButtonRef}
            onPress={openCard}
            style={styles.cardEntry}
            accessibilityRole="button"
            accessibilityLabel="查看闪光卡"
          >
            {heroImages ? (
              <Image source={heroImages.subject} style={styles.cardEntryImage} contentFit="cover" />
            ) : null}
            <Text style={styles.cardEntryText}>闪光卡</Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {profiles.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {profiles.map((p) => {
            const name = sportItemByKey(p.sportKey)?.name ?? p.sportKey;
            const active = current?.id === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedId(p.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {!current ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有运动档案</Text>
            <Text style={styles.emptyHint}>
              建一张档案，然后填战绩、装备与公开成绩 —— 右上角会生成一张镭射闪光卡。
            </Text>
          </View>
        ) : (
          <>
            {/* Hero 头图 */}
            <Pressable onPress={() => void uploadHeroPhoto()} style={styles.hero} accessibilityLabel="更换本人照片">
              {current.photoUrl ? (
                <Image source={{ uri: current.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <ThemedIcon name="camera-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.heroHint}>点这里拍照 / 从相册选一张本人照片</Text>
                </View>
              )}
              <View style={styles.vipBadge}>
                <Text style={styles.vipText} numberOfLines={1}>{levelLabel(current, sportName)}</Text>
              </View>
              {current.photoUrl ? (
                <View style={styles.heroEditBadge}>
                  <ThemedIcon name="camera-outline" size={12} color="#ffffff" />
                  <Text style={styles.heroEditText}>换图</Text>
                </View>
              ) : null}
            </Pressable>

            {/* 身份与编号 */}
            <View style={styles.identity}>
              <Text style={styles.identityName} numberOfLines={1}>
                {current.identity?.trim() || "运动爱好者"}
              </Text>
              <Text style={styles.identityNo}>{formatMemberNo(current.id)}</Text>
              <Text style={styles.identityMeta} numberOfLines={1}>
                {[
                  city ? "中国 " + city : null,
                  body.birthYear ? body.birthYear + " 年生" : null,
                  current.playStyle?.trim() || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "地区与生日可在网页端资料里补充"}
              </Text>
            </View>

            {/* 四宫格 */}
            <View style={styles.grid}>
              {grid.map((cell) => (
                <View key={cell.label} style={styles.gridCell}>
                  <Text style={styles.gridValue} numberOfLines={1}>{cell.value}</Text>
                  <Text style={styles.gridLabel}>{cell.label}</Text>
                </View>
              ))}
            </View>

            {/* 战绩 */}
            {record ? (
              <View style={styles.recordRow}>
                <Text style={styles.recordItem}>{record.matches} 场</Text>
                <Text style={styles.recordItem}>{record.wins} 胜 / {record.losses} 负</Text>
                <Text style={styles.recordItem}>
                  胜率 {record.winRate === null ? "—" : record.winRate.toFixed(1) + "%"}
                </Text>
              </View>
            ) : null}

            {/* 装备图鉴 */}
            {(current.gear ?? []).map((item, index) =>
              item.label.trim() ? (
                <View key={item.label + index} style={styles.gearCard}>
                  <Pressable
                    onPress={() => void uploadGearImage(index)}
                    style={styles.gearImageArea}
                    accessibilityLabel={"上传" + item.label + "图片"}
                  >
                    {absoluteMediaUrl(item.imageUrl) ? (
                      <Image
                        source={{ uri: absoluteMediaUrl(item.imageUrl) as string }}
                        style={styles.gearImage}
                        contentFit="contain"
                        transition={200}
                      />
                    ) : (
                      <>
                        <ThemedIcon name="camera-outline" size={30} color={colors.textFaint} />
                        <Text style={styles.gearImageHint}>点这里拍照 / 选图</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.gearValue} numberOfLines={2}>{item.value || "—"}</Text>
                  <Text style={styles.gearLabel}>{item.label}</Text>
                </View>
              ) : null
            )}

            {/* 荣誉 */}
            {(current.highlights ?? []).length > 0 ? (
              <View style={styles.honorSection}>
                <Text style={styles.sectionTitle}>公开成绩</Text>
                {(current.highlights ?? []).map((honor, index) => (
                  <View key={honor.label + index} style={styles.honorRow}>
                    <Text style={styles.honorRank}>{index === 0 ? "🏆" : "·"}</Text>
                    <Text style={styles.honorName} numberOfLines={1}>{honor.label}</Text>
                    <Text style={styles.honorPrize} numberOfLines={1}>{honor.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        <GroupLabel>新建档案</GroupLabel>
        <View style={styles.chipRow}>
          {SPORT_CATALOG.filter((s) => (CARD_SPORTS as readonly string[]).includes(s.key)).map((s) => (
            <Pressable key={s.key} onPress={() => openNew(s.key)} style={styles.chip}>
              <Text style={styles.chipText}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {current ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Button
            label={"编辑" + sportName + "档案"}
            icon="create-outline"
            onPress={() => openEdit(current)}
          />
          <Pressable onPress={() => remove(current)} style={styles.deleteBtn} accessibilityLabel="删除档案">
            <ThemedIcon name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {/* 闪光卡全屏弹层：从小到 + 旋转弹出，下方叉号关闭 */}
      <Modal visible={cardOpen} transparent animationType="none" onRequestClose={closeCard}>
        <View style={styles.modalRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCard} accessibilityLabel="关闭闪光卡" />
          {model ? (
            <Animated.View style={[styles.cardWrap, cardWrapStyle]} pointerEvents="none">
              <SportsHoloCard model={model} hint={false} />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.closeRow, closeRowStyle]}>
            <Pressable onPress={closeCard} style={styles.closeBtn} accessibilityLabel="关闭闪光卡">
              <ThemedIcon name="close" size={26} color="#ffffff" />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editId ? "编辑运动档案" : "新建运动档案"}
        height="88%"
      >
        <View style={styles.form}>
          <Field label="等级" value={draft.levelText} onChangeText={(v) => setDraft((d) => ({ ...d, levelText: v }))} placeholder="如：业余 6 级" />
          <Field label="运动身份" value={draft.identity} onChangeText={(v) => setDraft((d) => ({ ...d, identity: v }))} placeholder="如：双打搭子" />
          <Field label="打法" value={draft.playStyle} onChangeText={(v) => setDraft((d) => ({ ...d, playStyle: v }))} placeholder="如：混双" />
          <Field label="绝技（卡面大字）" value={draft.signatureMove} onChangeText={(v) => setDraft((d) => ({ ...d, signatureMove: v }))} placeholder="如：疾风·劈杀" />
          <Field
            label="本人照片链接（下一版支持直接上传）"
            value={draft.photoUrl}
            onChangeText={(v) => setDraft((d) => ({ ...d, photoUrl: v }))}
            placeholder="https://…"
            autoCapitalize="none"
          />

          <GroupLabel>图鉴四宫格</GroupLabel>
          <View style={styles.triple}>
            <View style={styles.tripleCell}>
              <Field label="鞋码" value={draft.shoeSize} onChangeText={(v) => setDraft((d) => ({ ...d, shoeSize: v }))} placeholder="40" />
            </View>
            <View style={styles.tripleCell}>
              <Field
                label="磅数"
                value={draft.tensionLbs === null ? "" : String(draft.tensionLbs)}
                keyboardType="decimal-pad"
                onChangeText={(v) => {
                  const cleaned = v.replace(/[^0-9.]/g, "");
                  setDraft((d) => ({ ...d, tensionLbs: cleaned ? Number(cleaned) : null }));
                }}
                placeholder="27.5"
              />
            </View>
          </View>
          <Text style={styles.tip}>身高与体重取「营养目标」里的资料（网页端可改）。</Text>

          <GroupLabel>战绩</GroupLabel>
          <View style={styles.triple}>
            <View style={styles.tripleCell}>
              <Field label="比赛场次" value={String(draft.matchesPlayed || "")} keyboardType="number-pad" onChangeText={(v) => setDraft((d) => ({ ...d, matchesPlayed: Number(v.replace(/[^0-9]/g, "")) || 0 }))} placeholder="214" />
            </View>
            <View style={styles.tripleCell}>
              <Field label="胜场" value={String(draft.wins || "")} keyboardType="number-pad" onChangeText={(v) => setDraft((d) => ({ ...d, wins: Number(v.replace(/[^0-9]/g, "")) || 0 }))} placeholder="178" />
            </View>
            <View style={styles.tripleCell}>
              <Field label="负场" value={String(draft.losses || "")} keyboardType="number-pad" onChangeText={(v) => setDraft((d) => ({ ...d, losses: Number(v.replace(/[^0-9]/g, "")) || 0 }))} placeholder="36" />
            </View>
          </View>

          <GroupLabel>主力装备</GroupLabel>
          {draft.gear.map((g, i) => (
            <View key={i} style={styles.gearInputRow}>
              <View style={styles.gearInputLabel}>
                <Field value={g.label} onChangeText={(v) => setGear(i, { label: v })} placeholder="类别" />
              </View>
              <View style={styles.gearInputValue}>
                <Field value={g.value} onChangeText={(v) => setGear(i, { value: v })} placeholder="型号 / 类型" />
              </View>
              <Pressable
                onPress={() => setPickerIndex(pickerIndex === i ? null : i)}
                style={styles.gearPickBtn}
                accessibilityLabel="从图库选择"
              >
                <ThemedIcon name="images-outline" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ))}

          {pickerIndex !== null ? (
            <View style={styles.pickerBox}>
              <Text style={styles.pickerTitle}>
                {draft.gear[pickerIndex]?.label || "装备"} · 从图库选择
              </Text>
              <EquipmentPicker
                key={pickerIndex}
                inline
                visible
                onClose={() => setPickerIndex(null)}
                onPick={applyEquipment}
                sportKey={draft.sportKey}
                defaultCategory={equipmentCategoryForGearLabel(draft.sportKey, draft.gear[pickerIndex]?.label ?? "")}
              />
            </View>
          ) : null}

          <GroupLabel>公开成绩（第一条会放大到卡面）</GroupLabel>
          {draft.highlights.map((h, i) => (
            <View key={i} style={styles.gearInputRow}>
              <View style={styles.gearInputLabel}>
                <Field value={h.label} onChangeText={(v) => setHighlight(i, { label: v })} placeholder="赛事" />
              </View>
              <View style={styles.gearInputValue}>
                <Field value={h.value} onChangeText={(v) => setHighlight(i, { value: v })} placeholder="成绩" />
              </View>
            </View>
          ))}
          <Button
            label="添加一条成绩"
            variant="ghost"
            size="sm"
            icon="add"
            fullWidth={false}
            onPress={() => setDraft((d) => ({ ...d, highlights: [...d.highlights, { label: "", value: "" }] }))}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>公开分享</Text>
            <Switch value={draft.isPublic} onValueChange={(v) => setDraft((d) => ({ ...d, isPublic: v }))} />
          </View>
          <Text style={styles.tip}>公开后只展示身份 / 等级 / 装备 / 战绩 / 公开成绩，不含身高体重等身体数据。</Text>

          <Button label={saving ? "保存中…" : "保存档案"} onPress={() => void save()} loading={saving} disabled={saving} />
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#f5f6f8" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingBottom: 8,
      backgroundColor: colors.canvas,
    },
    headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
    cardEntry: {
      width: 62,
      height: 40,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.8)",
      alignItems: "center",
      justifyContent: "flex-end",
      backgroundColor: "#0b1017",
    },
    cardEntryImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.85 },
    cardEntryText: { fontSize: 9, fontWeight: "700", color: "#ffe6ad", paddingBottom: 3 },
    chipScroll: { maxHeight: 48, backgroundColor: colors.canvas },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surfaceStrong,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
    chipTextActive: { color: "#ffffff" },
    content: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
    empty: { gap: 6, paddingVertical: 40, alignItems: "center" },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    emptyHint: { fontSize: 12, lineHeight: 19, color: colors.textMuted, textAlign: "center" },
    hero: {
      height: 230,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceStrong,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
    heroHint: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
    vipBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: "rgba(255,214,138,0.92)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      maxWidth: "70%",
    },
    vipText: { fontSize: 10, fontWeight: "800", color: "#4a3308", letterSpacing: 0.6 },
    heroEditBadge: {
      position: "absolute",
      left: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroEditText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
    identity: { gap: 2 },
    identityName: { fontSize: 24, fontWeight: "800", color: colors.text },
    identityNo: { fontSize: 12, color: colors.textMuted, letterSpacing: 1.2 },
    identityMeta: { fontSize: 12, color: colors.textMuted },
    grid: {
      flexDirection: "row",
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    gridCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    gridValue: { fontSize: 17, fontWeight: "800", color: colors.text },
    gridLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    recordRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    recordItem: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
    },
    gearCard: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      alignItems: "center",
      gap: 6,
    },
    gearImageArea: {
      width: "100%",
      height: 140,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    gearImageHint: { fontSize: 10, color: colors.textFaint },
    gearImage: { width: "100%", height: "100%" },
    gearValue: { fontSize: 14, fontWeight: "700", color: colors.text, textAlign: "center" },
    gearLabel: { fontSize: 11, color: colors.textMuted },
    honorSection: { gap: 8, marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
    honorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#fff8e8",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.6)",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    honorRank: { fontSize: 16 },
    honorName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#5a4210" },
    honorPrize: { fontSize: 14, fontWeight: "800", color: "#a9741a" },
    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: colors.canvas,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    deleteBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    modalRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
    backdrop: { backgroundColor: "#05070b" },
    cardWrap: { width: "100%", maxWidth: 420, paddingHorizontal: 20 },
    closeRow: { position: "absolute", bottom: 54, alignItems: "center" },
    closeBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.45)",
    },
    form: { gap: 12 },
    triple: { flexDirection: "row", gap: 8 },
    tripleCell: { flex: 1 },
    tip: { fontSize: 11, lineHeight: 17, color: colors.textMuted },
    gearInputRow: { flexDirection: "row", gap: 8 },
    gearInputLabel: { width: 108 },
    gearInputValue: { flex: 1 },
    gearPickBtn: {
      width: 40,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
    },
    pickerBox: {
      gap: 10,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    pickerTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    switchLabel: { fontSize: 14, color: colors.text },
  });
