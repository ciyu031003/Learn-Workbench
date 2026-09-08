import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { resumeAssetKindLabels, type ResumeAsset, type ResumeAssetKind } from "@learn-workbench/shared";

const KINDS: ResumeAssetKind[] = ["project", "skill", "github", "certificate"];

export default function ResumeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [records, setRecords] = useState<ResumeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kind, setKind] = useState<ResumeAssetKind>("project");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(getApiUrl() + "/api/resume-assets", { headers: headers() });
      const data = await r.json();
      if (r.ok) setRecords(data.records ?? []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [token]);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("请填写名称");
      return;
    }
    setSaving(true);
    try {
      await fetch(getApiUrl() + "/api/resume-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ kind, title: title.trim(), content: content.trim(), url: url.trim() }),
      });
      setSheetOpen(false);
      setTitle("");
      setContent("");
      setUrl("");
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const remove = (record: ResumeAsset) => {
    Alert.alert("删除简历资产", `删除「${record.title}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const r = await fetch(`${getApiUrl()}/api/resume-assets?id=${record.id}`, { method: "DELETE", headers: headers() });
            if (r.ok) setRecords((prev) => prev.filter((x) => x.id !== record.id));
          } catch (e) {
            Alert.alert("删除失败", e instanceof Error ? e.message : "");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>简历</Text>
        <Text style={styles.heroSub}>技能 / 项目 / GitHub / 证书，整理成随时可投的资产</Text>
      </View>

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>添加资产</Text>
      </PressableScale>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : records.length === 0 ? (
        <Card><Text style={styles.empty}>还没有简历资产，先加一条项目或技能吧</Text></Card>
      ) : (
        records.map((r) => (
          <Card key={r.id} style={styles.item}>
            <View style={styles.itemHead}>
              <View style={styles.itemTitleWrap}>
                <Text style={styles.kind}>{resumeAssetKindLabels[r.kind]}</Text>
                <Text style={styles.itemTitle}>{r.title}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => remove(r)}>
                <ThemedIcon name="trash-outline" size={18} color={colors.textFaint} />
              </Pressable>
            </View>
            {r.content ? <Text style={styles.itemContent} numberOfLines={4}>{r.content}</Text> : null}
            {r.url ? <Text style={styles.itemUrl} numberOfLines={1}>{r.url}</Text> : null}
          </Card>
        ))
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="添加简历资产" height="62%">
        <View style={styles.form}>
          <Text style={styles.label}>类型</Text>
          <View style={styles.kindRow}>
            {KINDS.map((k) => (
              <Pressable key={k} onPress={() => setKind(k)} style={[styles.kindChip, kind === k && styles.kindChipActive]}>
                <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>{resumeAssetKindLabels[k]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>名称</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="例如：电商中台项目" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>说明 / 链接</Text>
          <TextInput style={[styles.input, styles.area]} value={content} onChangeText={setContent} placeholder="亮点、职责或成果" placeholderTextColor={colors.textFaint} multiline />
          <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="链接（选填）" placeholderTextColor={colors.textFaint} autoCapitalize="none" />
          <Pressable style={[styles.primaryBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={() => void submit()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存资产</Text>}
          </Pressable>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    hero: { marginBottom: 4 },
    heroTitle: { fontSize: 28, fontWeight: "800", color: colors.text },
    heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    item: { gap: 8 },
    itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    itemTitleWrap: { flex: 1, minWidth: 0 },
    kind: { fontSize: 11, fontWeight: "800", color: colors.primary },
    itemTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 2 },
    itemContent: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    itemUrl: { fontSize: 12, color: colors.primary, lineHeight: 18 },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    area: { minHeight: 108, textAlignVertical: "top" },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
