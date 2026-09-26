import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { spacing, typography } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { useAppStore, type LogKind } from "@/store/app-store";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { logKindLabels } from "@learn-workbench/shared";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader, useLargeTitleHeader } from "@/components/screen-header";

const KINDS: LogKind[] = ["feynman", "review", "project", "interview"];

interface LogRow {
  id: number;
  kind: LogKind;
  title: string;
  content: string;
  createdAt: string;
}

export default function LogsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const logs = useAppStore((s) => s.logs);
  const addLog = useAppStore((s) => s.addLog);
  const [kind, setKind] = useState<LogKind>("feynman");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    addLog(kind, t, c);
    setTitle("");
    setContent("");
  };

  // 列表项：日志卡（虚拟化渲染，避免长列表全量挂载）
  const renderItem = useCallback(
    ({ item }: { item: LogRow }) => (
      <View style={styles.logItem}>
        <View style={styles.logHeader}>
          <Text style={styles.logKind}>{logKindLabels[item.kind] ?? item.kind}</Text>
          <Text style={styles.logDate}>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</Text>
        </View>
        <Text style={styles.logTitle}>{item.title}</Text>
        <Text style={styles.logContent} numberOfLines={4}>
          {item.content}
        </Text>
      </View>
    ),
    [styles]
  );

  const header = (
    <View style={styles.headerWrap}>
      {/* 真机反馈：子页要有返回上一级的按钮（这里 → 学习） */}
      <View>
        <ScreenHeader large scrollY={headerScroll.scrollY} title="学习日志" subtitle="费曼讲稿 · 周复盘 · 项目笔记 · 面试记录" />
      </View>

      <Card title="写一篇日志">
        <View style={styles.typeRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[styles.typeChip, kind === k && styles.typeChipActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.typeChipText, kind === k && styles.typeChipTextActive]}>
                {logKindLabels[k]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="标题"
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.contentInput]}
          placeholder="写下你的理解 / 复盘 / 项目进展…"
          placeholderTextColor={colors.textFaint}
          value={content}
          onChangeText={setContent}
          multiline
        />
        <Pressable style={styles.primaryBtn} onPress={submit}>
          <Text style={styles.primaryBtnText}>保存日志</Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>全部日志 · {logs.length} 篇</Text>
    </View>
  );

  return (
    <FlatList onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      data={logs as LogRow[]}
      keyExtractor={(l) => String(l.id)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState icon="create-outline" title="还没有日志" hint="写下第一篇费曼讲稿或周复盘" />
      }
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    headerWrap: { gap: spacing.md },
    hero: { paddingBottom: 6, gap: 4 },
    heroTitle: { ...typography.title1, color: "#ffffff" },
    heroSub: { ...typography.caption, fontWeight: "400", color: "rgba(255,255,255,0.85)" },
    sectionTitle: { ...typography.headline, color: colors.text, marginTop: spacing.xs },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    typeChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    typeChipActive: { backgroundColor: colors.primarySoft },
    typeChipText: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    typeChipTextActive: { color: colors.primary, fontWeight: "600" },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      ...typography.callout,
      fontWeight: "400",
      color: colors.text,
    },
    contentInput: { minHeight: 200, textAlignVertical: "top", lineHeight: 21 },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
    primaryBtnText: { ...typography.body, fontWeight: "600", color: "#fff" },
    logItem: { gap: 4, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    logHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    logKind: { ...typography.micro, color: colors.primary },
    logDate: { ...typography.micro, fontWeight: "400", color: colors.textFaint },
    logTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    logContent: { ...typography.caption, fontWeight: "400", color: colors.textMuted, lineHeight: 19 },
  });
