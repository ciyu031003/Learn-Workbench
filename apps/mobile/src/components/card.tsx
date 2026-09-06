import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export function Card({
  children,
  style,
  title,
  subtitle,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, style]}>
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
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    ...shadows.card,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
});
