import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { FloatField } from "@/components/float-field";
import { PressButton } from "@/components/press-button";
import { ChipGroup } from "@/components/sheet";
import { SkeletonList } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { GroupLabel } from "@/components/group-label";
import { StatRow } from "@/components/stat";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { typography } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { resumeAssetKindLabels, type ResumeAsset, type ResumeAssetKind } from "@learn-workbench/shared";
import { ResumeFilesCard } from "@/components/resume-files-card";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";

const KINDS: ResumeAssetKind[] = ["project", "skill", "github", "certificate"];

export default function ResumeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v20-D3：首屏入场错峰 */
  const entrance = useScreenEntrance();
  const reduced = useReducedMotion();
  const token = useAppStore((s) => s.token);
  const [records, setRecords] = useState<ResumeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** v20-D1：编辑态（editingId 非空 = 编辑已有资产，保存走 PATCH） */
  const [editing, setEditing] = useState<ResumeAsset | null>(null);
  const [kind, setKind] = useState<ResumeAssetKind>("project");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/resume-assets", { headers: headers() });
      const data = await r.json();
      if (r.ok) setRecords(data.records ?? []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // v17-D（R9）：下拉刷新统一入口（本页有吸顶栏 → 偏移 insets.top + 44）
  const { control: pullControl } = usePullRefresh(load);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setKind("project");
    setTitle("");
    setContent("");
    setUrl("");
    setSheetOpen(true);
  };

  const openEdit = (record: ResumeAsset) => {
    haptics.light();
    setEditing(record);
    setKind(record.kind);
    setTitle(record.title);
    setContent(record.content ?? "");
    setUrl(record.url ?? "");
    setSheetOpen(true);
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("请填写名称");
      return;
    }
    setSaving(true);
    try {
      // v20-D1：编辑走 PATCH（后端已有），新建走 POST
      await fetch(getApiUrl() + "/api/resume-assets", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(
          editing
            ? { id: editing.id, kind, title: title.trim(), content: content.trim(), url: url.trim() }
            : { kind, title: title.trim(), content: content.trim(), url: url.trim() }
        ),
      });
      haptics.success();
      setSheetOpen(false);
      setEditing(null);
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

  /** v20-D3：按类型分组的资产（概览 + 分节，替代原先四类混排一列） */
  const grouped = useMemo(
    () => KINDS.map((k) => ({ kind: k, items: records.filter((r) => r.kind === k) })).filter((g) => g.items.length > 0),
    [records]
  );
  const overview = useMemo(
    () => [
      { key: "project", value: records.filter((r) => r.kind === "project").length, label: "项目" },
      { key: "skill", value: records.filter((r) => r.kind === "skill").length, label: "技能" },
      { key: "github", value: records.filter((r) => r.kind === "github").length, label: "GitHub" },
      { key: "certificate", value: records.filter((r) => r.kind === "certificate").length, label: "证书" },
    ],
    [records]
  );

  let entranceIndex = -1;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="简历" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView
      onScroll={headerScroll.onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl {...pullControl} />} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <ScreenHeaderLargeTitle title="简历" subtitle="技能 / 项目 / GitHub / 证书，整理成随时可投的资产" />

      {/* v20-D3：主次分明——预览简历是高频主操作 */}
      <Animated.View entering={entrance(0)}>
      <View style={styles.actions}>
        <View style={styles.actionItem}>
        <PressButton label="预览简历" icon="eye-outline" onPress={() => router.push("/resume-preview" as never)} />
        </View>
        <View style={styles.actionItem}>
        <PressButton label="添加资产" icon="add" variant="secondary" onPress={openCreate} />
        </View>
      </View>
      </Animated.View>

      {records.length > 0 ? (
        <Animated.View entering={entrance(1)}>
          <StatRow items={overview} />
        </Animated.View>
      ) : null}

      {/* v12 P2-2：上传的 PDF / Word 简历（文件在 COS 私有目录，只有本人能取） */}
      <ResumeFilesCard />

      {loading ? (
        <SkeletonList count={3} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="还没有简历资产"
          hint="先加一条项目或技能，预览页会自动组装成简历。"
          actionLabel="添加资产"
          onAction={openCreate}
        />
      ) : (
        grouped.map((group) => {
          entranceIndex += 1;
          return (
            <View key={group.kind} style={styles.group}>
              <GroupLabel>
                {`${resumeAssetKindLabels[group.kind]} · ${group.items.length}`}
              </GroupLabel>
              {group.items.map((r, i) => (
                <Animated.View
                  key={r.id}
                  layout={reduced ? undefined : LinearTransition}
                  entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(entranceIndex))}
                >
                <Card style={styles.item}>
                  <View style={styles.itemHead}>
                    <View style={styles.itemTitleWrap}>
                      <Text style={styles.itemTitle}>{r.title}</Text>
                    </View>
                    <PressableScale hitSlop={8} scaleTo={0.88} onPress={() => openEdit(r)} accessibilityLabel={`编辑 ${r.title}`}>
                      <ThemedIcon name="create-outline" size={18} color={colors.primary} />
                    </PressableScale>
                    <PressableScale hitSlop={8} scaleTo={0.88} onPress={() => remove(r)} accessibilityLabel={`删除 ${r.title}`}>
                      <ThemedIcon name="trash-outline" size={18} color={colors.textFaint} />
                    </PressableScale>
                  </View>
                  {r.content ? <Text style={styles.itemContent} numberOfLines={4}>{r.content}</Text> : null}
                  {r.url ? <Text style={styles.itemUrl} numberOfLines={1}>{r.url}</Text> : null}
                </Card>
                </Animated.View>
              ))}
            </View>
          );
        })
      )}

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "编辑简历资产" : "添加简历资产"}
        height="68%"
      >
        <View style={styles.form}>
          {/* v20-D4：表单对齐 certificates（ChipGroup 选类 + FloatField 输入 + PressButton 保存） */}
          <Text style={styles.label}>类型</Text>
          <ChipGroup
            multiple={false}
            wrap
            options={KINDS.map((k) => ({ key: k, label: resumeAssetKindLabels[k] }))}
            selected={[kind]}
            onToggle={(k) => setKind(k as ResumeAssetKind)}
          />
          <FloatField label="名称" value={title} onChangeText={setTitle} placeholder="例如：电商中台项目" />
          <FloatField label="说明 / 亮点" value={content} onChangeText={setContent} placeholder="职责、成果或掌握程度" multiline />
          <FloatField label="链接（选填）" value={url} onChangeText={setUrl} placeholder="https://…" autoCapitalize="none" />
          <PressButton label={editing ? "保存修改" : "保存资产"} loadingLabel="保存中…" loading={saving} onPress={() => void submit()} disabled={saving} />
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
    actions: { flexDirection: "row", gap: 10 },
    actionItem: { flex: 1 },
    group: { gap: 10 },
    item: { gap: 8 },
    itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    itemTitleWrap: { flex: 1, minWidth: 0 },
    itemTitle: {
      ...typography.headline,
      color: colors.text,
    },
    itemContent: {
      ...typography.callout,
      color: colors.textSecondary,
    },
    itemUrl: { ...typography.caption, color: colors.primary, lineHeight: 18 },
    form: { gap: 12, paddingTop: 6 },
    label: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  });
