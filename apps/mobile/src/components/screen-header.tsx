import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { isSameHubAsLast, resolveBackTarget } from "@/lib/back-target";

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
    // 同模块内（路线图 → 阶段详情）：保留真实回退，从哪来回哪去；
    // 跨模块（今日 → 面试这类从其它 Tab 跳进来的子页）：回该页所属 Hub，而不是回上一个 Tab。
    // 真机反馈 2026-09-22：职业 → 面试/证书 点返回曾直接回「今日」。
    if (isSameHubAsLast(pathname) && router.canGoBack()) router.back();
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
