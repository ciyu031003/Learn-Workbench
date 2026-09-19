import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildSportsCardModel, computeSportsRecord, sportItemByKey, SPORT_CATALOG, type SportsProfile } from "@learn-workbench/shared";
import { ScreenHeader } from "@/components/screen-header";
import { GroupLabel } from "@/components/group-label";
import { Surface } from "@/components/surface";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BottomSheet } from "@/components/bottom-sheet";
import { SportsHoloCard } from "@/components/sports-holo-card";
import { hasHoloImages } from "@/lib/holo-images";
import {
  deleteSportsProfile,
  draftFromProfile,
  emptySportsDraft,
  fetchSportsProfiles,
  saveSportsProfile,
  type SportsProfileDraft,
} from "@/lib/sports-client";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/** 可做闪光卡的运动项目（其余项目仍可建档，只是没有卡面素材） */
const CARD_SPORTS = ["badminton", "tennis", "basketball", "volleyball", "table-tennis", "soccer", "baseball"] as const;

export default function SportsCardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [profiles, setProfiles] = useState<SportsProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SportsProfileDraft>(() => emptySportsDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfiles(await fetchSportsProfiles());
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 进屏即拉档案（数据加载后在 effect 中写状态是既有模式）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
        { ...draft, gear: draft.gear.filter((g) => g.value.trim()), highlights: draft.highlights.filter((h) => h.label.trim() || h.value.trim()) },
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

  const setGear = (i: number, patch: Partial<{ label: string; value: string }>) => {
    setDraft((d) => ({ ...d, gear: d.gear.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  };

  const setHighlight = (i: number, patch: Partial<{ label: string; value: string }>) => {
    setDraft((d) => ({ ...d, highlights: d.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="运动档案" subtitle="闪光卡 · 实时镭射" backTo="/wellness" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {profiles.length === 0 && !loading ? (
          <Surface style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有运动档案</Text>
            <Text style={styles.emptyHint}>建档后即可生成一张镭射闪光卡：战绩、装备、绝技都会印在卡面上。</Text>
          </Surface>
        ) : null}

        {profiles.map((p, index) => {
          const sportName = sportItemByKey(p.sportKey)?.name ?? p.sportKey;
          const record = computeSportsRecord(p);
          const model = buildSportsCardModel(p, { sportName, index: index + 1, total: profiles.length });
          return (
            <View key={p.id} style={styles.block}>
              {hasHoloImages(p.sportKey) ? (
                <SportsHoloCard model={model} />
              ) : (
                <Surface style={styles.noArt}>
                  <Text style={styles.noArtText}>{sportName}暂时没有闪光卡素材</Text>
                </Surface>
              )}

              <Surface style={styles.info}>
                <Text style={styles.infoTitle}>{sportName} · {p.identity || "运动爱好者"}</Text>
                <Text style={styles.infoMeta}>
                  {[p.playStyle, p.levelText, record.matches > 0 ? record.matches + " 场" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {(p.gear ?? []).map((g, i) => (
                  <View key={i} style={styles.gearRow}>
                    <Text style={styles.gearLabel}>{g.label}</Text>
                    <Text style={styles.gearValue} numberOfLines={1}>{g.value || "—"}</Text>
                  </View>
                ))}
                <View style={styles.actions}>
                  <Button label="编辑" variant="secondary" size="sm" fullWidth={false} onPress={() => openEdit(p)} />
                  <Button label="删除" variant="danger" size="sm" fullWidth={false} onPress={() => remove(p)} />
                  <View style={styles.publicTag}>
                    <Text style={styles.publicText}>{p.isPublic ? "公开分享中" : "仅自己可见"}</Text>
                  </View>
                </View>
              </Surface>
            </View>
          );
        })}

        <GroupLabel>新建 / 编辑</GroupLabel>
        <View style={styles.chipRow}>
          {SPORT_CATALOG.filter((s) => (CARD_SPORTS as readonly string[]).includes(s.key)).map((s) => (
            <Pressable key={s.key} onPress={() => openNew(s.key)} style={styles.chip}>
              <Text style={styles.chipText}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

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
          <Text style={styles.tip}>只填胜负也行：场次按「胜 + 负」补齐，胜率自动计算。</Text>

          <GroupLabel>主力装备</GroupLabel>
          {draft.gear.map((g, i) => (
            <View key={i} style={styles.gearInputRow}>
              <View style={styles.gearInputLabel}>
                <Field value={g.label} onChangeText={(v) => setGear(i, { label: v })} placeholder="类别" />
              </View>
              <View style={styles.gearInputValue}>
                <Field value={g.value} onChangeText={(v) => setGear(i, { value: v })} placeholder="型号 / 类型" />
              </View>
            </View>
          ))}

          <GroupLabel>公开成绩</GroupLabel>
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
          <Text style={styles.tip}>公开后只展示身份 / 等级 / 装备 / 战绩 / 公开成绩，绝不包含体重、身体测量或训练细节。</Text>

          <Button label={saving ? "保存中…" : "保存档案"} onPress={() => void save()} loading={saving} disabled={saving} />
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
    block: { gap: 12 },
    empty: { gap: 6 },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    emptyHint: { fontSize: 12, lineHeight: 19, color: colors.textMuted },
    noArt: { alignItems: "center", paddingVertical: 28 },
    noArtText: { fontSize: 12, color: colors.textMuted },
    info: { gap: 8 },
    infoTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    infoMeta: { fontSize: 12, color: colors.textMuted },
    gearRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    gearLabel: { fontSize: 12, color: colors.textMuted },
    gearValue: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "right" },
    actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    publicTag: { marginLeft: "auto" },
    publicText: { fontSize: 11, color: colors.textMuted },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
    form: { gap: 12 },
    triple: { flexDirection: "row", gap: 8 },
    tripleCell: { flex: 1 },
    tip: { fontSize: 11, lineHeight: 17, color: colors.textMuted },
    gearInputRow: { flexDirection: "row", gap: 8 },
    gearInputLabel: { width: 108 },
    gearInputValue: { flex: 1 },
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
