import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { resolveBackTarget } from "@/lib/back-target";

export function ScreenHeader({
  title,
  subtitle,
  compact = false,
  backTo,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
  /** 无导航历史时的兜底返回目标；默认按当前路径解析到所属 Hub */
  backTo?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);
  const pathname = usePathname();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    // 冷启动深链 / 切过 Tab 导致无历史时：回到该页所属 Hub（而不是一律回今日）
    else router.replace((backTo ?? resolveBackTarget(pathname)) as never);
  };

  return (
    <View style={styles.root}>
      <Pressable
        hitSlop={8}
        onPress={goBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="返回"
      >
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
      // 触控目标 ≥40（配合 hitSlop 8 → 有效 ≥56）
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.title1, fontWeight: "900", color: colors.text },
    titleCompact: { fontSize: 19 },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
  });
