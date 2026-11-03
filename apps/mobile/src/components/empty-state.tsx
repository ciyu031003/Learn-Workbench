import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/pressable-scale";
import { PatternBackdrop, type PatternVariant } from "@/components/pattern-backdrop";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 空状态：数据为空 / 搜索无结果 / 出错兜底时的统一占位。
 * 图标落在 primarySoft 圆角「芯片」里，主色 CTA 使用 PressableScale（带轻触感）。
 * 文案由调用方传入（简体中文）。
 *
 * v13 U12：叠加 **低透明度几何底纹**（技法参考 uiverse.io/csemszepp/old-hound-37 与
 * kind-frog-70，MIT；不透明度 3%–7%，深色档更弱），底纹只做氛围、不参与交互。
 */
export function EmptyState({
  icon = "sparkles-outline",
  title,
  hint,
  actionLabel,
  onAction,
  pattern = "chevron",
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** bauhaus=暖色几何拼花；chevron=灰阶人字纹；none=纯色 */
  pattern?: PatternVariant | "none";
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handlePress = useCallback(() => {
    haptics.light();
    onAction?.();
  }, [onAction]);

  return (
    <View style={[styles.wrap, style]}>
      {pattern !== "none" ? <PatternBackdrop variant={pattern} /> : null}
      <View style={styles.chip}>
        <ThemedIcon name={icon} size={26} color={colors.textFaint} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      {actionLabel ? (
        <PressableScale style={styles.cta} onPress={handlePress} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.ctaText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 26,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      borderRadius: radius.card,
      overflow: "hidden",
    },
    chip: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    title: { ...typography.callout, fontWeight: "700", color: colors.text, textAlign: "center" },
    hint: {
      ...typography.meta,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 280,
      lineHeight: 20,
    },
    cta: {
      marginTop: spacing.md,
      minHeight: 44,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      justifyContent: "center",
    },
    ctaText: { ...typography.callout, fontWeight: "700", color: colors.primary },
  });
