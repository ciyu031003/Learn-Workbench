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
    /**
     * v17 阶段 B：导航栈已真实存在（根 <Stack> 包 `(tabs)` + 子页），
     * 所以**优先 pop** —— 才有原生的返回动画，且回到的一定是真正的上一页。
     *
     * 旧实现一律 `router.replace(上一级)` 是因为当时所有页面都是 Tab，
     * `back()` 会回到"上一个看过的 Tab"（真机表现为"返回却回到今日首页"）。
     * 那个问题随导航栈重构已消失；`resolveBackTarget` 只保留给**无栈历史**的兜底
     * （深链直达、冷启动、外部协议唤起）。
     */
    const canPop = typeof router.canGoBack === "function" && router.canGoBack();
    if (canPop) {
      router.back();
      return;
    }
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
