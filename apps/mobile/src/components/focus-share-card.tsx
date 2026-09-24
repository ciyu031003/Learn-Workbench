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
import Svg, { Circle, Rect } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { focusShareText, type FocusShareData } from "@/lib/focus-share";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";

/**
 * 专注/学习的**卡片图片分享**（真机反馈：分享要卡片图片，不要几个文字）。
 *
 * 做法：把一张固定尺寸的卡片渲染在弹层里 → `react-native-view-shot` 截图成 PNG
 * → `expo-sharing` 交给系统分享面板（微信/QQ 里就是一张图）。
 * 兜底：截图或分享面板不可用时，退回文字分享，**绝不让"分享"点了没反应**。
 *
 * 2026-09-24 精修：今日任务与「学习统计」共用同一张卡片（标题不同）；
 * 版式改为「进度环 + 大数字 hero + 14 天柱 + 三格统计 + 金句块 + 品牌页脚」。
 */

export type { FocusShareData } from "@/lib/focus-share";
export { focusShareText };

const RING_SIZE = 96;
const RING_STROKE = 10;

/** 卡片本体（`ref` 直接给 captureRef 截图用） */
export function FocusShareCard({ data, cardRef }: { data: FocusShareData; cardRef: React.RefObject<RNView | null> }) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  const max = Math.max(1, ...data.last14.map((d) => d.minutes));
  const today = data.last14[data.last14.length - 1]?.date;
  const goal = Math.max(1, data.goalMinutes ?? 150);
  const ratio = Math.min(1, data.minutes / goal);
  const pct = Math.round(ratio * 100);
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const avg = Math.round(data.minutes / Math.max(1, data.sessions));

  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      {/* 背景装饰：两团柔和色块 + 右上细环（无渐变/图片依赖，截图稳定） */}
      <View pointerEvents="none" style={[styles.blob, styles.blobAccent]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobPrimary]} />
      <View pointerEvents="none" style={styles.decoRing} />

      <View style={styles.brandRow}>
        <View style={styles.brandChip}>
          <Ionicons name="book" size={14} color={colors.primaryStrong} />
        </View>
        <Text style={styles.brandText} numberOfLines={1}>学习工作台 · {data.title}</Text>
        <Text style={styles.date}>{data.dateText}</Text>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} stroke={colors.primary + "22"} strokeWidth={RING_STROKE} fill="none" />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              stroke={colors.primary}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <Text style={styles.ringPct}>{pct}%</Text>
        </View>

        <View style={styles.heroBody}>
          <Text style={styles.heroLabel}>今日专注</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{data.minutes}</Text>
            <Text style={styles.heroUnit}>分钟</Text>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={13} color={colors.accentStrong} />
            <Text style={styles.streakText}>连续 {data.streak} 天 · 累计 {data.totalFocusDays} 天</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartHead}>
        <Text style={styles.chartHint}>近 14 天专注分布</Text>
        <Text style={styles.chartHint}>目标 {goal} 分钟</Text>
      </View>
      <Svg width="100%" height={64} viewBox={`0 0 ${Math.max(14, data.last14.length) * 10} 64`} preserveAspectRatio="none">
        {data.last14.map((d, i) => {
          const h = Math.max(3, Math.round((d.minutes / max) * 56));
          return (
            <Rect
              key={d.date}
              x={i * 10 + 1}
              y={64 - h}
              width={7}
              height={h}
              rx={3}
              fill={d.date === today ? colors.primary : colors.primary + "4D"}
            />
          );
        })}
      </Svg>

      <View style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{data.sessions}</Text>
          <Text style={styles.statLabel}>今日次数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{avg}</Text>
          <Text style={styles.statLabel}>单次均时长</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{data.totalFocusDays}</Text>
          <Text style={styles.statLabel}>累计天数</Text>
        </View>
      </View>

      {data.motivation ? (
        <View style={styles.quote}>
          <Ionicons name="sparkles" size={13} color={colors.accentStrong} />
          <Text style={styles.motivation}>{data.motivation}</Text>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>学习工作台</Text>
        <Text style={styles.footer}>learn.yuanabd.cn</Text>
      </View>
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
      width: 332,
      padding: spacing.lg,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
      overflow: "hidden",
      ...shadows.card,
    },
    blob: { position: "absolute", borderRadius: 999 },
    blobAccent: { width: 200, height: 200, right: -80, top: -90, backgroundColor: colors.accent + "22" },
    blobPrimary: { width: 230, height: 230, left: -100, bottom: -120, backgroundColor: colors.primary + "18" },
    decoRing: {
      position: "absolute",
      width: 128,
      height: 128,
      borderRadius: 64,
      right: -44,
      top: -30,
      borderWidth: 10,
      borderColor: colors.primary + "12",
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    brandChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + "1A",
    },
    brandText: { flex: 1, minWidth: 0, ...typography.caption, fontWeight: "800", color: colors.text },
    date: { ...typography.micro, color: colors.textMuted, letterSpacing: 0.6, ...tabularNums },
    heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
    ringPct: { position: "absolute", ...typography.callout, fontWeight: "900", color: colors.text, ...tabularNums },
    heroBody: { flex: 1, minWidth: 0, gap: 4 },
    heroLabel: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    heroValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    heroValue: { fontSize: 46, lineHeight: 50, fontWeight: "900", color: colors.text, ...tabularNums },
    heroUnit: { ...typography.caption, fontWeight: "700", color: colors.textMuted, marginBottom: 8 },
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
    chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -8 },
    chartHint: { ...typography.micro, color: colors.textMuted },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 10,
    },
    statCell: { flex: 1, alignItems: "center", gap: 2 },
    statDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.border },
    statValue: { ...typography.title2, fontWeight: "900", color: colors.text, ...tabularNums },
    statLabel: { ...typography.micro, color: colors.textMuted },
    quote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.accentSoft,
    },
    motivation: { flex: 1, ...typography.caption, fontWeight: "700", color: colors.text, lineHeight: 18 },
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footer: { ...typography.micro, color: colors.textMuted },
  });
