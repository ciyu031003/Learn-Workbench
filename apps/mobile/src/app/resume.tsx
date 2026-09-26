import { useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { resumeAssetKindLabels, type ResumeAsset, type ResumeAssetKind } from "@learn-workbench/shared";
import { ResumeFilesCard } from "@/components/resume-files-card";
import { typography } from "@/theme/tokens";

const KINDS: ResumeAssetKind[] = ["project", "skill", "github", "certificate"];

export default function ResumeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
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

  // v17-D（R9）：下拉刷新统一入口（本页有吸顶栏 → 偏移 insets.top + 44）
  const { control: pullControl } = usePullRefresh(load);

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
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="简历" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView
      onScroll={headerScroll.onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl {...pullControl} />} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <ScreenHeaderLargeTitle title="简历" subtitle="技能 / 项目 / GitHub / 证书，整理成随时可投的资产" />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>添加资产</Text>
      </PressableScale>

      <PressableScale style={styles.addBtn} haptic onPress={() => router.push("/resume-preview" as never)}>
        <ThemedIcon name="eye-outline" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>预览简历</Text>
      </PressableScale>

      {/* v12 P2-2：上传的 PDF / Word 简历（文件在 COS 私有目录，只有本人能取） */}
      <ResumeFilesCard />

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
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    hero: { marginBottom: 4 },
    heroTitle: {
      ...typography.display,
      color: colors.text,
    },
    heroSub: {
      ...typography.callout,
      // 任务4：正文级（callout 15pt）不能用 textMuted（浅色下对白底约 3.0，低于 WCAG AA 4.5）。
      // token 只有三档灰、不能新增，故用 text 加 0.72 透明（≈ #5A5A5C，约 7:1）保留副标题层级。
      color: colors.textSecondary,
      marginTop: 4,
    },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    item: { gap: 8 },
    itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    itemTitleWrap: { flex: 1, minWidth: 0 },
    kind: { fontSize: 11, fontWeight: "800", color: colors.primary },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      marginTop: 2,
    },
    itemContent: {
      ...typography.callout,
      // 任务4：正文级（callout 15pt）改用加深度色（同上）
      color: colors.textSecondary,
    },
    itemUrl: { fontSize: 12, color: colors.primary, lineHeight: 18 },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { ...typography.callout, backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,  color: colors.text },
    area: { minHeight: 108, textAlignVertical: "top" },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { ...typography.callout, color: "#fff",  fontWeight: "800" },
  });
