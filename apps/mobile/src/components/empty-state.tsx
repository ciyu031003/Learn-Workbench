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
        <ThemedIcon name={icon} size={22} color={colors.primary} />
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
        <PressableScale style={styles.cta} onPress={handlePress}>
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
      paddingVertical: spacing["3xl"],
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    chip: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    title: { ...typography.headline, color: colors.text, textAlign: "center" },
    hint: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    cta: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    ctaText: { ...typography.body, fontWeight: "800", color: "#FFFFFF" },
  });
