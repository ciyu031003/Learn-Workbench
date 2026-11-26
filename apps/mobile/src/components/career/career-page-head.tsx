import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 职业页页头（对齐 demo .career-head）：
 * 蓝色 eyebrow「职业决策台 · CAREER DESK」+ 两行 27/34 大标题 + 右上搜索圆钮。
 */
export function CareerPageHead({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>职业决策台 · CAREER DESK</Text>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        hitSlop={8}
        onPress={() => {
          haptics.light();
          router.push("/jobs" as never);
        }}
        style={({ pressed }) => [styles.search, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="搜索岗位"
      >
        <Icon name="search" size={18} weight="regular" color={colors.text} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingTop: spacing.xs },
    copy: { flex: 1, minWidth: 0 },
    eyebrow: { ...typography.eyebrow, fontWeight: "800", letterSpacing: 1.2, color: colors.primary },
    title: { ...typography.pageTitle, fontWeight: "800", color: colors.text, marginTop: 7 },
    subtitle: { ...typography.meta, color: colors.textMuted, marginTop: 5 },
    search: {
      width: 42,
      height: 42,
      borderRadius: radius.panel,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });