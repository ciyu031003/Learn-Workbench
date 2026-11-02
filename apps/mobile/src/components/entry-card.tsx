import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 统一入口卡（v1.62 P0-1，方案见 docs/移动端UI复盘与v1.62实施方案.md §3.1）
 *
 * 三种尺寸，替代此前四套各自实现的入口卡：
 * - hero：整行大卡，图标 44 + 标题 17/600 + 说明 + 可选进度 + 右侧箭头（每屏最多 1–3 个）
 * - mid ：两列中卡，图标 36 + 标题 15/500 + 两行说明 + 可选进度（2×2 网格）
 * - row ：无卡片底的列表行（图标槽 36 + 标题 + 副标题 + 右侧值 + 箭头 + 分隔线）
 *
 * 约束：
 * - 只做展示 + 点击，不内置业务逻辑；所有颜色/字号来自 token，不写裸 fontSize；
 * - 动效只用 PressableScale 的按压缩放（不新增动效点）。
 */
export type EntryTone = "primary" | "accent" | "teal" | "success" | "warning";

const TONE_KEYS: Record<EntryTone, { soft: keyof ThemeColors; strong: keyof ThemeColors }> = {
  primary: { soft: "primarySoft", strong: "primary" },
  accent: { soft: "accentSoft", strong: "accent" },
  teal: { soft: "surfaceMuted", strong: "teal" },
  success: { soft: "successSoft", strong: "success" },
  warning: { soft: "warningSoft", strong: "warning" },
};

export interface EntryCardProps {
  size?: "hero" | "mid" | "row";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** 一行说明 / 数字摘要（mid 最多两行） */
  meta?: string;
  /** 右侧值（row 用；hero/mid 一般用 meta） */
  value?: string;
  /** 0–1；传了就画进度条 */
  progress?: number;
  /** 进度条颜色档 */
  tone?: EntryTone;
  /** hero 底部的行动文案（如「继续学习」「查看路线」） */
  cta?: string;
  /** 右上角角标（如「3」「新」） */
  badge?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** row 用：最后一行不画分隔线 */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function EntryCard({
  size = "mid",
  icon,
  title,
  meta,
  value,
  progress,
  tone = "primary",
  cta,
  badge,
  onPress,
  disabled = false,
  last = false,
  style,
  accessibilityLabel,
}: EntryCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tonePair = TONE_KEYS[tone];
  const strong = colors[tonePair.strong] as string;
  const soft = colors[tonePair.soft] as string;
  const ratio = typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : null;

  const content =
    size === "row" ? (
      <View style={[styles.rowWrap, style]}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: soft }]}>
            <ThemedIcon name={icon} size={18} color={strong} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
            {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
          </View>
          {value ? <Text style={[styles.rowValue, tabularNums]} numberOfLines={1}>{value}</Text> : null}
          {onPress ? <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} /> : null}
        </View>
        {!last ? <View pointerEvents="none" style={styles.rowDivider} /> : null}
      </View>
    ) : size === "hero" ? (
      <View style={[styles.hero, style]}>
        <View style={styles.heroHead}>
          <View style={[styles.heroIcon, { backgroundColor: soft }]}>
            <ThemedIcon name={icon} size={22} color={strong} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.titleRow}>
              <Text style={styles.heroTitle} numberOfLines={1}>{title}</Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: soft }]}>
                  <Text style={[styles.badgeText, { color: strong }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            {meta ? <Text style={styles.heroMeta} numberOfLines={2}>{meta}</Text> : null}
          </View>
          {onPress ? <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} /> : null}
        </View>
        {ratio !== null ? (
          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: strong }]} />
            </View>
            {cta ? <Text style={[styles.heroCta, { color: strong }]}>{cta}</Text> : null}
          </View>
        ) : null}
      </View>
    ) : (
      <View style={[styles.mid, style]}>
        <View style={styles.midHead}>
          <View style={[styles.midIcon, { backgroundColor: soft }]}>
            <ThemedIcon name={icon} size={18} color={strong} />
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: soft }]}>
              <Text style={[styles.badgeText, { color: strong }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.midTitle} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={styles.midMeta} numberOfLines={2}>{meta}</Text> : null}
        {ratio !== null ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: strong }]} />
          </View>
        ) : null}
      </View>
    );

  if (!onPress) return content;

  return (
    <PressableScale
      haptic
      scaleTo={size === "row" ? 0.995 : 0.98}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={size === "row" ? undefined : styles.pressWrap}
    >
      {content}
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pressWrap: { borderRadius: radius.lg },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    badge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { ...typography.micro },
    progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    progressTrack: {
      flex: 1,
      height: 4,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: radius.pill },
    // hero
    hero: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.card,
    },
    heroHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    heroBody: { flex: 1, gap: 2 },
    heroTitle: { ...typography.headline, color: colors.text },
    heroMeta: { ...typography.caption, color: colors.textMuted },
    heroCta: { ...typography.caption },
    // mid
    mid: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      minHeight: 112,
      justifyContent: "space-between",
      ...shadows.card,
    },
    midHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    midIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    midTitle: { ...typography.callout, color: colors.text },
    midMeta: { ...typography.caption, color: colors.textMuted },
    // row
    rowWrap: { position: "relative" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    rowDivider: {
      position: "absolute",
      left: 64,
      right: 0,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBody: { flex: 1, gap: 1 },
    rowTitle: { ...typography.callout, color: colors.text },
    rowMeta: { ...typography.caption, color: colors.textMuted },
    rowValue: { ...typography.callout, color: colors.textSecondary },
  });
