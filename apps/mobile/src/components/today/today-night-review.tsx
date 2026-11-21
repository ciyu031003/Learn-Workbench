import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * ⑥ 夜间回顾占位：虚线框 + 锁 + 「21:00 解锁」。
 *
 * 现在只是占位（不可点、无接口）：21:00 之后的回顾入口要等日报能力上线，
 * 这里先把位置和承诺留给用户，避免首页在晚上变成空档。
 */
export function TodayNightReview() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card} accessibilityLabel="夜间回顾，21 点解锁">
      <Text style={styles.title}>夜间回顾</Text>
      <Text style={styles.desc}>21:00 后解锁：今天做成了什么、哪一步最难、明天第一件事。</Text>
      <View style={styles.lockRow}>
        <Icon name="lock" size={12} weight="regular" color={colors.textFaint} />
        <Text style={styles.lockText} {...TEXT_SCALE_POLICY.chrome}>
          21:00 解锁
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.card,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
    },
    title: { ...typography.headline, color: colors.text },
    desc: {
      ...typography.meta,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 5,
      lineHeight: 18,
    },
    lockRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
    lockText: { ...typography.eyebrow, letterSpacing: 1, color: colors.textMuted },
  });
