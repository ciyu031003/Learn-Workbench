import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 页内状态轻条（P1 · 六态统一组件）：离线 / 待同步 / 可重试失败 / 需用户处理。
 *
 * 为什么必须统一：此前每个页面各自写一句「网络错误」，用户无法区分
 * 「我已经保存了只差同步」和「这次操作真的失败了」——这是数据信任的第一道裂缝。
 * 四类语义固定映射到四种色调与四种文案模板（见 docs 方案 §4.2）：
 *   offline  → 中性灰（本地内容仍可看）
 *   pending  → 主色（已保存，等待同步）
 *   error    → 危险色（保存失败，但已留在待同步，会自动重试）
 *   action   → 强调色（需要用户处理：重新登录 / 冲突）
 *
 * 硬约束：只用语义 token；不写裸 fontSize；不参与交互的高频动画。
 */
export type NoticeVariant = "offline" | "pending" | "error" | "action";

const ICON: Record<NoticeVariant, keyof typeof Ionicons.glyphMap> = {
  offline: "cloud-offline-outline",
  pending: "sync-outline",
  error: "alert-circle-outline",
  action: "hand-left-outline",
};

export function InlineNotice({
  variant,
  message,
  detail,
  actionLabel,
  onAction,
  style,
  testID,
}: {
  variant: NoticeVariant;
  /** 一句话结论（必须能独立看懂） */
  message: string;
  /** 可选补充：条数 / 下次重试时间 / 失败原因 */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = useMemo(() => noticeTone(colors, variant), [colors, variant]);
  const showAction = Boolean(actionLabel && onAction);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={detail ? `${message}，${detail}` : message}
      style={[styles.wrap, { backgroundColor: tone.bg, borderColor: tone.border }, style]}
      testID={testID}
    >
      <Ionicons name={ICON[variant]} size={16} color={tone.fg} style={styles.icon} />
      <View style={styles.textCol}>
        <Text style={[styles.message, { color: tone.fg }]} numberOfLines={2}>
          {message}
        </Text>
        {detail ? (
          <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {showAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          onPress={() => {
            haptics.light();
            onAction?.();
          }}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={[styles.actionText, { color: tone.fg }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 四类语义 → 色调（浅/深色都走 token，不新造颜色） */
export function noticeTone(
  colors: ThemeColors,
  variant: NoticeVariant
): { bg: string; fg: string; border: string } {
  if (variant === "error") {
    return { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft };
  }
  if (variant === "action") {
    return { bg: colors.accentSoft, fg: colors.accentStrong, border: colors.accentSoft };
  }
  if (variant === "pending") {
    return { bg: colors.primarySoft, fg: colors.primaryStrong, border: colors.primarySoft };
  }
  return { bg: colors.surfaceMuted, fg: colors.textSecondary, border: colors.border };
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 44,
    },
    icon: { marginTop: 1 },
    textCol: { flex: 1, gap: 2 },
    message: { ...typography.meta, fontWeight: "600" },
    detail: { ...typography.meta, fontWeight: "400" },
    action: {
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPressed: { opacity: 0.6 },
    actionText: { ...typography.callout, fontWeight: "600" },
  });
