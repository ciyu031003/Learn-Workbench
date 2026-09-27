import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View, type View as RNView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useTheme } from "@/theme";
import { radius, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";
import { resumeSectionKeyLabels, type ResumeContent } from "@learn-workbench/shared";

/**
 * v20-D2 · 简历**卡片图片分享**（与专注卡/学习卡同一套机制：view-shot 截图 → 系统分享面板）。
 *
 * 版式：姓名/ headline 主视觉 + 联系行 + 技能 chips + 项目 & 证书摘要 + 品牌页脚。
 * 兜底：截图或分享面板不可用时退回文字分享，绝不让"分享"点了没反应。
 */

export interface ResumeShareData {
  name: string;
  headline: string;
  contact: string;
  skills: string[];
  projects: { title: string; description: string }[];
  certificates: { name: string; issuer: string }[];
  education: { school: string; major?: string; span: string }[];
}

export function resumeShareDataOf(content: ResumeContent): ResumeShareData {
  return {
    name: content.basics.name || "（未填写姓名）",
    headline: content.basics.headline || content.basics.targetRole || "",
    contact: [content.basics.city, content.basics.email].filter(Boolean).join(" · "),
    skills: content.skills.slice(0, 12).map((s) => s.name),
    projects: content.projects.slice(0, 3).map((p) => ({ title: p.title, description: p.content ?? "" })),
    certificates: content.certificates.slice(0, 3).map((c) => ({ name: c.name, issuer: c.issuer ?? "" })),
    education: content.education.slice(0, 2).map((e) => ({
      school: e.school,
      major: e.major,
      span: [e.start, e.end].filter(Boolean).join(" – "),
    })),
  };
}

export function resumeShareText(data: ResumeShareData): string {
  const lines = [
    `${data.name}${data.headline ? ` · ${data.headline}` : ""}`,
    data.contact,
    "",
  ];
  if (data.skills.length) lines.push(`技能：${data.skills.join(" / ")}`);
  if (data.education.length) lines.push(`教育：${data.education.map((e) => e.school).join("、")}`);
  if (data.projects.length) lines.push(`项目：${data.projects.map((p) => p.title).join("、")}`);
  if (data.certificates.length) lines.push(`证书：${data.certificates.map((c) => c.name).join("、")}`);
  lines.push("", "—— 来自「苦旅」学习工作台");
  return lines.filter((l) => l !== undefined).join("\n");
}

const CARD_WIDTH = 340;

/** 卡片本体（`ref` 直接给 captureRef 截图用） */
export function ResumeShareCard({ data, cardRef }: { data: ResumeShareData; cardRef: React.RefObject<RNView | null> }) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      <View pointerEvents="none" style={[styles.blob, styles.blobPrimary]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobAccent]} />

      <View style={styles.brandRow}>
        <View style={styles.brandChip}>
          <Ionicons name="book" size={13} color={colors.primaryStrong} />
          <Text style={styles.brandText}>苦旅 · 简历</Text>
        </View>
      </View>

      <Text style={styles.name}>{data.name}</Text>
      {data.headline ? <Text style={styles.headline}>{data.headline}</Text> : null}
      {data.contact ? <Text style={styles.contact}>{data.contact}</Text> : null}

      {data.education.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{resumeSectionKeyLabels.education}</Text>
          {data.education.map((e, i) => (
            <Text key={i} style={styles.line} numberOfLines={1}>
              · {e.school}
              {e.major ? ` · ${e.major}` : ""}
              {e.span ? `（${e.span}）` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      {data.skills.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{resumeSectionKeyLabels.skills}</Text>
          <View style={styles.chips}>
            {data.skills.map((s, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {data.projects.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{resumeSectionKeyLabels.projects}</Text>
          {data.projects.map((p, i) => (
            <Text key={i} style={styles.line} numberOfLines={1}>
              · {p.title}
            </Text>
          ))}
        </View>
      ) : null}

      {data.certificates.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{resumeSectionKeyLabels.certificates}</Text>
          {data.certificates.map((c, i) => (
            <Text key={i} style={styles.line} numberOfLines={1}>
              · {c.name}
              {c.issuer ? `（${c.issuer}）` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>学习工作台 · learn.yuanabd.cn</Text>
      </View>
    </View>
  );
}

/** 分享弹层：卡片预览 + 分享图片（主）/ 文字兜底（次） */
export function ResumeShareSheet({
  visible,
  onClose,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  data: ResumeShareData | null;
}) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  const cardRef = useRef<RNView>(null);
  const [busy, setBusy] = useState(false);

  const shareImage = useCallback(async () => {
    if (!cardRef.current || !data) return;
    setBusy(true);
    haptics.soft();
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing-unavailable");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "分享简历卡片", UTI: "public.png" });
    } catch {
      // 截图/分享面板不可用：退回文字分享，保证"点了有反应"
      try {
        await Share.share({ message: resumeShareText(data) });
      } catch {
        // 用户取消也算正常
      }
    } finally {
      setBusy(false);
    }
  }, [data]);

  const shareText = useCallback(async () => {
    if (!data) return;
    haptics.soft();
    try {
      await Share.share({ message: resumeShareText(data) });
    } catch {
      // 忽略
    }
  }, [data]);

  return (
    <Modal visible={visible && !!data} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭分享" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>分享简历卡片</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="关闭">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.previewWrap}>{data ? <ResumeShareCard data={data} cardRef={cardRef} /> : null}</View>
        <View style={styles.ctaRow}>
          <Pressable style={[styles.cta, styles.ctaPrimary]} disabled={busy} onPress={() => void shareImage()}>
            {busy ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.ctaPrimaryText}>分享图片</Text>}
          </Pressable>
          <Pressable style={[styles.cta, styles.ctaGhost]} onPress={() => void shareText()}>
            <Text style={styles.ctaGhostText}>文字版</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeCardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
      overflow: "hidden",
    },
    blob: { position: "absolute", width: 190, height: 190, borderRadius: 95 },
    blobPrimary: { backgroundColor: colors.primarySoft, top: -70, right: -60 },
    blobAccent: { backgroundColor: colors.accentSoft, bottom: -80, left: -70 },
    brandRow: { flexDirection: "row" },
    brandChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    brandText: { ...typography.micro, color: colors.primaryStrong },
    name: { ...typography.display, fontWeight: "800", color: colors.text },
    headline: { ...typography.headline, color: colors.textSecondary },
    contact: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    section: { gap: 5 },
    sectionTitle: { ...typography.caption, fontWeight: "800", color: colors.primary },
    line: { ...typography.callout, fontWeight: "500", color: colors.text },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.text, ...tabularNums },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
      alignItems: "center",
    },
    footerText: { ...typography.micro, color: colors.textMuted },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      backgroundColor: colors.surfaceStrong,
      padding: 16,
      gap: 12,
    },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { ...typography.title2, fontWeight: "700", color: colors.text },
    previewWrap: { alignItems: "center", paddingVertical: 8 },
    ctaRow: { flexDirection: "row", gap: 10 },
    cta: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingVertical: 12,
    },
    ctaPrimary: { backgroundColor: colors.primary },
    ctaPrimaryText: { ...typography.callout, fontWeight: "700", color: "#ffffff" },
    ctaGhost: { backgroundColor: colors.surfaceMuted },
    ctaGhostText: { ...typography.callout, fontWeight: "700", color: colors.primary },
  });
