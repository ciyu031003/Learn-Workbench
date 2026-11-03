import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassSurface } from "@/components/surface";
import { radius, shadows, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 卡片（v2.0）：白底 + 1px 细描边 + 轻投影；圆角 19。
 * 变体：
 * - surface：常规信息卡（默认）
 * - glass  ：轻玻璃（每屏克制使用）
 * - hero   ：大留白强调卡（每屏最多 1 张）
 */
export type CardVariant = "surface" | "glass" | "hero";

export function Card({
  children,
  style,
  title,
  subtitle,
  variant = "surface",
  bordered = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
  variant?: CardVariant;
  bordered?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (variant === "glass") {
    return (
      <GlassSurface corner={radius.card} style={style}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </GlassSurface>
    );
  }
  return (
    <View style={[styles.card, styles[variant], bordered && styles.bordered, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { borderRadius: radius.card, padding: 16, gap: 10 },
    bordered: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
    surface: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    hero: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.panel,
      padding: 20,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    header: { gap: 2 },
    title: { ...typography.section, color: colors.text },
    subtitle: { ...typography.meta, color: colors.textMuted },
  });
