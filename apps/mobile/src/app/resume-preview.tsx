import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { resumeSectionKeyLabels, type ResumeContent, type ResumeSectionConfig } from "@learn-workbench/shared";
import { typography } from "@/theme/tokens";

interface DocState {
  id: number;
  title: string;
  templateKey: string;
  sectionOrder: ResumeSectionConfig[];
}

/** V3 简历预览（移动端只读）：内容实时来自 /api/resumes/[id] 的组装结果 */
export default function ResumePreviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [doc, setDoc] = useState<DocState | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);

  /** v17/v18 收尾：loader 上提到组件作用域（useCallback 稳定引用）以便统一接入下拉刷新；取数口径与顺序不变 */
  const load = useCallback(async () => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const lr = await fetch(getApiUrl() + "/api/resumes", { headers });
      const ld = await lr.json();
      const list = Array.isArray(ld.documents) ? ld.documents : [];
      if (list.length === 0) return;
      const dr = await fetch(`${getApiUrl()}/api/resumes/${list[0].id}`, { headers });
      const dd = await dr.json();
      setDoc(dd.document ?? null);
      setContent(dd.content ?? null);
    } catch {
      // 离线保持空态
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    // 保持与改动前同构的 async IIFE 形态（load 内部已吞异常，不会 reject）
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [load]);

  const { control: pullControl } = usePullRefresh(load, { stickyHeader: true });

  const rows = (key: ResumeSectionConfig["key"]) => {
    if (!content) return null;
    switch (key) {
      case "basics":
        return (
          <View style={styles.basicsBlock}>
            <Text style={styles.name}>{content.basics.name || "（未填写姓名）"}</Text>
            <Text style={styles.muted}>
              {[content.basics.headline || content.basics.targetRole, content.basics.city, content.basics.email]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {content.basics.summary ? <Text style={styles.body}>{content.basics.summary}</Text> : null}
          </View>
        );
      case "education":
        if (content.education.length === 0) return <Text style={styles.empty}>暂无内容</Text>;
        return content.education.map((e, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>
              {e.school}
              {e.major ? ` · ${e.major}` : ""}
            </Text>
            <Text style={styles.muted}>{[e.start, e.end].filter(Boolean).join(" – ")}</Text>
          </View>
        ));
      case "skills":
        if (content.skills.length === 0) return <Text style={styles.empty}>暂无内容</Text>;
        return (
          <View style={styles.chips}>
            {content.skills.map((s, i) => (
              <Text key={i} style={styles.chip}>{s.name}</Text>
            ))}
          </View>
        );
      case "experience":
        if (content.experience.length === 0) return <Text style={styles.empty}>暂无内容</Text>;
        return content.experience.map((x, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>{x.title}{x.org ? ` · ${x.org}` : ""}</Text>
            <Text style={styles.muted}>{[x.start, x.end].filter(Boolean).join(" – ")}</Text>
            {x.description ? <Text style={styles.body}>{x.description}</Text> : null}
          </View>
        ));
      case "projects":
        if (content.projects.length === 0) return <Text style={styles.empty}>暂无内容</Text>;
        return content.projects.map((p, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>{p.title}{p.kind === "github" ? "（GitHub）" : ""}</Text>
            {p.content ? <Text style={styles.body} numberOfLines={4}>{p.content}</Text> : null}
            {p.url ? <Text style={styles.link} numberOfLines={1}>{p.url}</Text> : null}
          </View>
        ));
      case "certificates":
        if (content.certificates.length === 0) return <Text style={styles.empty}>暂无内容</Text>;
        return content.certificates.map((c, i) => (
          <View key={i} style={styles.rowBetween}>
            <Text style={styles.rowTitle}>{c.name}{c.issuer ? ` · ${c.issuer}` : ""}</Text>
            <Text style={styles.muted}>{c.earnedDate ?? ""}</Text>
          </View>
        ));
      default:
        return null;
    }
  };

  const visible = (doc?.sectionOrder ?? []).filter((s) => s.visible);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="简历预览" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      refreshControl={<RefreshControl {...pullControl} />} showsVerticalScrollIndicator={false}>
      <ScreenHeaderLargeTitle title="简历预览" subtitle={doc ? `${doc.title} · ${doc.templateKey}` : "内容实时取自资料 / 证书 / 技能 / 资产"} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : !doc || !content ? (
        <Card><Text style={styles.empty}>还没有简历，先在 Web 端简历编辑器创建</Text></Card>
      ) : (
        <Card style={styles.paper}>
          {visible.map((s) => (
            <View key={s.key} style={styles.section}>
              {s.key === "basics" ? null : <Text style={styles.sectionTitle}>{resumeSectionKeyLabels[s.key]}</Text>}
              {rows(s.key)}
            </View>
          ))}
        </Card>
      )}
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    paper: { gap: 14 },
    section: { gap: 6 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.primary },
    basicsBlock: { gap: 3 },
    name: { ...typography.title2, fontWeight: "800", color: colors.text },
    muted: { fontSize: 12, color: colors.textMuted },
    body: {
      ...typography.body,
      color: colors.text,
      marginTop: 2,
    },
    link: { fontSize: 12, color: colors.primary, marginTop: 2 },
    row: { gap: 1, marginBottom: 6 },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 4 },
    rowTitle: { ...typography.callout, fontWeight: "700", color: colors.text, flexShrink: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { fontSize: 12, color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  });