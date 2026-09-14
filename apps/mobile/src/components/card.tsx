import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, shadows, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 卡片三变体（见 docs/APP端设计与打包方案.md §5.2）
 * - surface：绝大多数信息卡（默认）
 * - glass  ：悬浮于壁纸/图片之上的卡（必须保证文字对比度，玻璃不承载语义）
 * - hero   ：每屏最多 1 张（今日完成度 / Hub 头图），留白更大
 */
export type CardVariant = "surface" | "glass" | "hero";

export function Card({
  children,
  style,
  title,
  subtitle,
  variant = "surface",
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
  variant?: CardVariant;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, styles[variant], style]}>
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
    card: {
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    surface: {
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    glass: {
      // 半透明表面 + 轻边框：仅作层级，不作为信息载体
      backgroundColor: colors.surface,
      borderColor: colors.border,
      ...shadows.floating,
    },
    hero: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.borderStrong,
      borderRadius: radius.xl,
      padding: 20,
      gap: 12,
      ...shadows.floating,
    },
    header: { gap: 2 },
    title: { ...typography.headline, color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
  });
