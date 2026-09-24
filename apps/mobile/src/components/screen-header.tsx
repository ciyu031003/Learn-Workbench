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
    // 2026-09-24 定稿：**一律回到"上一级"**，不再用 router.back()。
    // 因为 app/ 下所有页面都被 <Tabs> 注册成了 Tab（次级页只是 href:null），
    // back() 回的是"上一个看过的 Tab"（常常是今日），而不是这个子页的父页面。
    // 真机反馈：健康子页、招花页返回都直接回了今日首页。
    router.replace((backTo ?? resolveBackTarget(pathname)) as never);
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
