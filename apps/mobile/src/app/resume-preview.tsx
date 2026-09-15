import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { resumeSectionKeyLabels, type ResumeContent, type ResumeSectionConfig } from "@learn-workbench/shared";

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
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [doc, setDoc] = useState<DocState | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const lr = await fetch(getApiUrl() + "/api/resumes", { headers });
        const ld = await lr.json();
        const list = Array.isArray(ld.documents) ? ld.documents : [];
        if (list.length === 0) {
          if (alive) setLoading(false);
          return;
        }
        const dr = await fetch(`${getApiUrl()}/api/resumes/${list[0].id}`, { headers });
        const dd = await dr.json();
        if (!alive) return;
        setDoc(dd.document ?? null);
        setContent(dd.content ?? null);
      } catch {
        // 离线保持空态
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

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
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="简历预览" subtitle={doc ? `${doc.title} · ${doc.templateKey}` : "内容实时取自资料 / 证书 / 技能 / 资产"} compact />

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
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    paper: { gap: 14 },
    section: { gap: 6 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.primary },
    basicsBlock: { gap: 3 },
    name: { fontSize: 22, fontWeight: "800", color: colors.text },
    muted: { fontSize: 12, color: colors.textMuted },
    body: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 2 },
    link: { fontSize: 12, color: colors.primary, marginTop: 2 },
    row: { gap: 1, marginBottom: 6 },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 4 },
    rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { fontSize: 12, color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  });