import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { focusShareText, type FocusShareData } from "@/lib/focus-share";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";

/**
 * v1.22：专注/打卡的**卡片图片分享**（用户真机反馈："参考那个闪光卡片，以卡片图片类型分享数据，
 * 不要几个文字分享"）。
 *
 * 做法：把一张固定尺寸的卡片渲染在弹层里 → `react-native-view-shot` 截图成 PNG
 * → `expo-sharing` 交给系统分享面板（微信/QQ 里就是一张图）。
 * 兜底：截图或分享面板不可用时，退回原来的文字分享，**绝不让"分享"点了没反应**。
 */

export type { FocusShareData } from "@/lib/focus-share";
export { focusShareText };

/** 卡片本体（`ref` 直接给 captureRef 截图用） */
export function FocusShareCard({ data, cardRef }: { data: FocusShareData; cardRef: React.RefObject<RNView | null> }) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  const max = Math.max(1, ...data.last14.map((d) => d.minutes));
  const today = data.last14[data.last14.length - 1]?.date;
  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      {/* 背景装饰：两团柔和色块（无渐变依赖） */}
      <View pointerEvents="none" style={[styles.blob, styles.blobAccent]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobPrimary]} />

      <View style={styles.brandRow}>
        <View style={styles.brandChip}>
          <Ionicons name="book" size={14} color={colors.primaryStrong} />
        </View>
        <Text style={styles.brandText}>学习工作台 · {data.title}</Text>
      </View>
      <Text style={styles.date}>{data.dateText}</Text>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>今日专注</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroValue}>{data.minutes}</Text>
          <Text style={styles.heroUnit}>分钟</Text>
        </View>
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={13} color={colors.accentStrong} />
          <Text style={styles.streakText}>连续 {data.streak} 天 · 累计 {data.totalFocusDays} 天</Text>
        </View>
      </View>

      <Svg width="100%" height={72} viewBox={`0 0 ${Math.max(14, data.last14.length) * 10} 72`} preserveAspectRatio="none">
        {data.last14.map((d, i) => {
          const h = Math.max(3, Math.round((d.minutes / max) * 64));
          return (
            <Rect
              key={d.date}
              x={i * 10 + 1}
              y={72 - h}
              width={7}
              height={h}
              rx={3}
              fill={d.date === today ? colors.primary : colors.primary + "5A"}
            />
          );
        })}
      </Svg>
      <Text style={styles.chartHint}>近 14 天分布</Text>

      <View style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{data.sessions}</Text>
          <Text style={styles.statLabel}>今日次数</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{Math.round(data.minutes / Math.max(1, data.sessions))}</Text>
          <Text style={styles.statLabel}>单次均时长</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{data.totalFocusDays}</Text>
          <Text style={styles.statLabel}>累计天数</Text>
        </View>
      </View>

      <Text style={styles.motivation}>{data.motivation}</Text>
      <Text style={styles.footer}>学习工作台 · learn.yuanabd.cn</Text>
    </View>
  );
}

/** 弹层：卡片预览 + 分享图片（主）/ 文字兜底（次） */
export function FocusShareSheet({ visible, onClose, data }: { visible: boolean; onClose: () => void; data: FocusShareData }) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  const cardRef = useRef<RNView>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const shareImage = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    haptics.soft();
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing-unavailable");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "分享专注卡片", UTI: "public.png" });
    } catch {
      // 截图/分享面板不可用：直接回到文字分享，保证"点了有反应"
      setFailed(true);
      try {
        await Share.share({ message: focusShareText(data) });
      } catch {
        // 用户取消也算正常
      }
    } finally {
      setBusy(false);
    }
  }, [data]);

  const shareText = useCallback(async () => {
    haptics.soft();
    try {
      await Share.share({ message: focusShareText(data) });
    } catch {
      // 忽略
    }
  }, [data]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭分享" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>分享打卡卡片</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="关闭">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.previewWrap}>
          <FocusShareCard data={data} cardRef={cardRef} />
        </View>
        {failed ? <Text style={styles.failText}>这台设备暂时存不了图片，已改用文字分享</Text> : null}
        <View style={styles.sheetBtns}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={shareImage} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={colors.canvas} /> : <Ionicons name="share-social" size={16} color={colors.canvas} />}
            <Text style={styles.btnPrimaryText}>{busy ? "正在生成图片…" : "分享图片"}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={shareText} disabled={busy}>
            <Ionicons name="text" size={16} color={colors.textMuted} />
            <Text style={styles.btnGhostText}>复制文字</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeCardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing["2xl"],
      gap: spacing.md,
    },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { ...typography.title2, fontWeight: "800", color: colors.text },
    previewWrap: { alignItems: "center" },
    sheetBtns: { flexDirection: "row", gap: spacing.sm },
    btn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: radius.lg,
    },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { ...typography.body, fontWeight: "800", color: colors.canvas },
    btnGhost: { backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    btnGhostText: { ...typography.body, fontWeight: "700", color: colors.textMuted },
    failText: { ...typography.caption, color: colors.warning, textAlign: "center" },

    // ---- 卡片本体（固定宽度，截图产出稳定） ----
    card: {
      width: 320,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
      overflow: "hidden",
      ...shadows.card,
    },
    blob: { position: "absolute", borderRadius: 999 },
    blobAccent: { width: 190, height: 190, right: -70, top: -80, backgroundColor: colors.accent + "1F" },
    blobPrimary: { width: 220, height: 220, left: -90, bottom: -110, backgroundColor: colors.primary + "1A" },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    brandChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + "1A",
    },
    brandText: { ...typography.caption, fontWeight: "800", color: colors.text },
    date: { ...typography.micro, color: colors.textMuted, letterSpacing: 0.6 },
    hero: { gap: 4, alignItems: "flex-start" },
    heroLabel: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    heroRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    heroValue: { fontSize: 54, lineHeight: 58, fontWeight: "900", color: colors.text, ...tabularNums },
    heroUnit: { ...typography.body, fontWeight: "700", color: colors.textMuted, marginBottom: 8 },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
    },
    streakText: { ...typography.micro, fontWeight: "800", color: colors.accentStrong },
    chartHint: { ...typography.micro, color: colors.textMuted, marginTop: -6 },
    statRow: { flexDirection: "row", gap: spacing.sm },
    statCell: { flex: 1, gap: 2 },
    statValue: { ...typography.title2, fontWeight: "900", color: colors.text, ...tabularNums },
    statLabel: { ...typography.micro, color: colors.textMuted },
    motivation: { ...typography.caption, fontWeight: "700", color: colors.text, lineHeight: 19 },
    footer: { ...typography.micro, color: colors.textMuted },
  });