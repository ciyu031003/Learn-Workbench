import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";

export function ScreenHeader({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/jobs");
  };

  return (
    <View style={styles.root}>
      <Pressable hitSlop={8} onPress={goBack} style={styles.back}>
        <ThemedIcon name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.text}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, compact: boolean) =>
  StyleSheet.create({
    root: { flexDirection: "row", alignItems: "center", gap: 10 },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: { fontSize: 22, fontWeight: "900", color: colors.text },
    titleCompact: { fontSize: 19 },
    subtitle: { fontSize: 12, color: colors.textMuted },
  });
