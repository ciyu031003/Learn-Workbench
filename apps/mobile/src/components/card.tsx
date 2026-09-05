import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadows } from "@/theme/tokens";

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,251,234,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    ...shadows.card,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
});
