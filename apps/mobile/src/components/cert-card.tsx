import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { ThemedIcon } from "@/components/themed-icon";
import {
  ACHIEVEMENT_STAGGER_MS,
  achievementTone,
  type AchievementTone,
} from "@/components/achievement-card";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { MOTION_BASE, easingStandard, isMotionActive } from "@/theme/motion";
import type { Certificate } from "@learn-workbench/shared/schemas";
import { certificateStatusLabels } from "@learn-workbench/shared/labels";
import { certificateExpiryInfo } from "@learn-workbench/shared/pure";

/**
 * 证书卡（V3 证书页专用）。
 *
 * 为什么不再直接用 AchievementCard：状态流程 + 右侧证书缩略图要求「左图标 / 中信息 / 右图片」
 * 三栏，而 AchievementCard 的 body 是单列（图片只能塞在标题下方，卡片会变得很高）。
 * 这里复用它的三样东西，保证观感不跑偏：
 *  1. `achievementTone()` 状态语义色（金=已取得 / 蓝=备考中 / 中性=计划中）；
 *  2. 52×52 图形徽章、radius.lg 圆角、shadows.card 投影、spacing 间距；
 *  3. 同一套入场错峰（40ms/项、减弱动态时直接呈现终态）。
 * 卡片**不写死高度**：所有行都是内容撑开，图片靠 aspectRatio 由宽度推导高度（不裁切）。
 */
export type CertStatus = "planned" | "preparing" | "achieved";

export const CERT_STATUSES: readonly CertStatus[] = ["planned", "preparing", "achieved"];

/** 状态说明：让「更新状态」弹层里的每一行都能自解释，而不是只有三个词 */
export const CERT_STATUS_DESC: Record<CertStatus, string> = {
  planned: "先记下来，之后安排学习与报名",
  preparing: "正在备考 / 培训中，可在备注里记录进度",
  achieved: "已拿到证书，可上传证书照片留档",
};

/** 三种状态复用的 AchievementTone 语义（不新造色板） */
export function certStatusTone(status: CertStatus): AchievementTone {
  if (status === "achieved") return "gold";
  if (status === "preparing") return "blue";
  return "neutral";
}

/** 状态对应的 soft / strong 两档颜色，供卡片徽章与状态弹层共用 */
export function certStatusPalette(colors: ThemeColors, status: CertStatus): { soft: string; strong: string } {
  return achievementTone(colors, certStatusTone(status));
}

export const CERT_STATUS_ICON: Record<CertStatus, Parameters<typeof ThemedIcon>[0]["name"]> = {
  planned: "book",
  preparing: "locate",
  achieved: "trophy",
};

export function CertCard({
  record,
  index = 0,
  imageUri,
  uploading = false,
  onOpenStatus,
  onUpload,
  onDelete,
  onPreview,
}: {
  record: Certificate;
  /** 列表位置：入场错峰（与 AchievementCard 同一节奏） */
  index?: number;
  /** 已解析好的图片地址（服务端相对路径 → 绝对；离线暂存 → 本机 file://） */
  imageUri: string | null;
  /** 这张证书的图片正在上传（禁用入口 + 转圈） */
  uploading?: boolean;
  onOpenStatus: () => void;
  onUpload: () => void;
  onDelete: () => void;
  onPreview: (uri: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const status = (record.status ?? "planned") as CertStatus;
  const tone = certStatusTone(status);
  const palette = useMemo(() => achievementTone(colors, tone), [colors, tone]);
  const styles = useMemo(() => makeStyles(colors, palette), [colors, palette]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  // ⚠️ 顺序约束（见 CLAUDE.md「手势与 worklet」）：shared value 必须声明在 useAnimatedStyle 之前
  const enter = useSharedValue(active ? 0 : 1);

  useEffect(() => {
    if (!active) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      Math.max(0, index) * ACHIEVEMENT_STAGGER_MS,
      withTiming(1, { duration: MOTION_BASE, easing: easingStandard })
    );
  }, [active, enter, index]);

  const enterStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * -10 }],
  }));

  const expiry = certificateExpiryInfo(record.expiryDate);
  const statusLabel = certificateStatusLabels[status];
  const hasInfo = expiry.level !== "none" || !!record.earnedDate || !!record.note;

  return (
    <Animated.View style={[styles.card, enterStyle]}>
      <View style={styles.headRow}>
        {/* 左侧图标保持原证书卡的图形位（52×52 圆角徽章 + 状态语义色） */}
        <View style={styles.graphic}>
          <ThemedIcon name={CERT_STATUS_ICON[status]} size={26} color={palette.strong} />
        </View>

        <View style={styles.headBody}>
          <Text style={styles.title} numberOfLines={2}>
            {record.name}
          </Text>
          {record.issuer ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {record.issuer}
            </Text>
          ) : null}
        </View>

        {/* 状态徽章：颜色区分三档（中性 / 品牌蓝 / 金） */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText} accessibilityLabel={`状态：${statusLabel}`}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {hasInfo || imageUri ? (
        <View style={styles.contentRow}>
          <View style={styles.infoCol}>
            {hasInfo ? (
              <View style={styles.metaRow}>
                {record.earnedDate ? (
                  <Text style={styles.meta}>取得 {record.earnedDate.slice(0, 10)}</Text>
                ) : null}
                {expiry.level === "ok" ? <Text style={styles.metaStrong}>{expiry.label}</Text> : null}
                {expiry.level === "soon" || expiry.level === "expired" ? (
                  <Text style={expiry.level === "expired" ? styles.metaDanger : styles.metaWarn}>
                    {expiry.label}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {record.note ? (
              <Text style={styles.note} numberOfLines={2}>
                {record.note}
              </Text>
            ) : null}
          </View>

          {/* 右侧按比例缩放的证书图片：宽度固定、高度由 aspectRatio 推导；
              无图时整个节点不渲染，右侧不占位（也不留空白虚线框） */}
          {imageUri ? (
            <Pressable
              onPress={() => onPreview(imageUri)}
              style={({ pressed }) => [styles.imageBtn, pressed && styles.pressed]}
              accessibilityRole="imagebutton"
              accessibilityLabel={`查看「${record.name}」的证书图片`}
              accessibilityHint="打开全屏预览"
            >
              <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" transition={200} />
              <View style={styles.imageExpand} pointerEvents="none">
                <ThemedIcon
                  ios="arrow.up.left.and.arrow.down.right"
                  name="expand-outline"
                  size={11}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 已取得才出现上传入口：计划中/备考中还没有证书可拍，提前露出只会造成误解 */}
      {status === "achieved" ? (
        <Pressable
          onPress={onUpload}
          disabled={uploading}
          style={({ pressed }) => [styles.uploadRow, pressed && styles.pressed, uploading && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel={`上传「${record.name}」的证书图片`}
          accessibilityHint="从相册选择证书照片"
          accessibilityState={{ disabled: uploading, busy: uploading }}
        >
          <View style={styles.uploadBadge}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.accentStrong} />
            ) : (
              <ThemedIcon ios="camera" name="camera-outline" size={17} color={colors.accentStrong} />
            )}
          </View>
          <View style={styles.uploadBody}>
            <Text style={styles.uploadTitle}>
              {uploading ? "上传中…" : imageUri ? "更换证书图片" : "上传证书图片"}
            </Text>
            <Text style={styles.uploadHint}>
              {uploading ? "正在上传并保存到这张证书" : "从相册选择 · 自动压缩为 WebP"}
            </Text>
          </View>
          {uploading ? null : <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />}
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        {/* 44pt 命中区：动作面板入口（与「我的求职」更新阶段同一交互：点开 → 单选 → 乐观更新） */}
        <Pressable
          onPress={onOpenStatus}
          style={({ pressed }) => [styles.statusBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`更新「${record.name}」的状态，当前为${statusLabel}`}
          accessibilityHint="打开状态选择面板"
        >
          <ThemedIcon name="repeat-outline" size={15} color={colors.textMuted} />
          <Text style={styles.statusBtnLabel} numberOfLines={1}>
            更新状态
          </Text>
          <Text style={styles.statusBtnValue} numberOfLines={1}>
            {statusLabel}
          </Text>
          <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
        </Pressable>

        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`删除「${record.name}」`}
        >
          <ThemedIcon name="trash-outline" size={18} color={colors.textFaint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, palette: { soft: string; strong: string }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceStrong,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.card,
    },
    headRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    graphic: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.soft,
    },
    headBody: { flex: 1, minWidth: 0, gap: 3 },
    title: { ...typography.headline, color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.strong + "55",
      backgroundColor: palette.soft,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.strong },
    badgeText: { ...typography.micro, fontWeight: "800", color: palette.strong },
    contentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    infoCol: { flex: 1, minWidth: 0, gap: 3 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    meta: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    metaStrong: { ...typography.micro, fontWeight: "700", color: palette.strong },
    metaWarn: { ...typography.micro, fontWeight: "700", color: colors.accentStrong },
    metaDanger: { ...typography.micro, fontWeight: "700", color: colors.danger },
    note: { ...typography.callout, color: colors.textSecondary },
    imageBtn: {
      // 宽度按卡片内容区比例给（手机上约 110pt、平板封顶 140pt），高度由 aspectRatio 推导：
      // 屏幕变宽图片等比变大、卡片高度跟着内容走，任何一端都不写死高度（不会裁切）
      width: "36%",
      maxWidth: 140,
      aspectRatio: 4 / 3,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    imageExpand: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      opacity: 0.92,
    },
    uploadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    uploadBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    uploadBody: { flex: 1, minWidth: 0, gap: 1 },
    uploadTitle: { ...typography.callout, fontWeight: "700", color: colors.accentStrong },
    uploadHint: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: 2,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    statusBtn: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceMuted,
    },
    statusBtnLabel: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, flexShrink: 1 },
    statusBtnValue: { ...typography.caption, fontWeight: "800", color: palette.strong, flexShrink: 1 },
    deleteBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    pressed: { opacity: 0.72 },
    dim: { opacity: 0.7 },
  });
