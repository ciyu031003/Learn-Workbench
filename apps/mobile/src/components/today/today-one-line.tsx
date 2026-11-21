import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { TodaySectionHead } from "./today-section-head";

/**
 * 「今日一句」的固定文案池（纯装饰性文案，允许静态；点一下轮换，不做接口）。
 * 第一条取自 v7 demo，其余几条是同一语气的补充，避免只有一句时点不动。
 */
const QUOTES = [
  "专注不是把时间填满，而是把一件事做透。",
  "今天只做三件事，做完就是好的一天。",
  "把最难的那件放在最前面，剩下的都会变轻。",
  "慢一点没关系，只要一直在往前走。",
  "记下今天做成的一件小事，明天会更有底气。",
] as const;

/**
 * ④ 「02 今日一句」：可点的引言块。
 *
 * 点一下切到下一条（轮换 5 条固定文案），橙色引号做装饰。
 * 无副作用、无接口；可点元素带热区 + button 角色 + 含当前文本的无障碍标签。
 */
export function TodayOneLine() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const quote = QUOTES[index % QUOTES.length] ?? QUOTES[0];

  return (
    <View style={styles.section}>
      <TodaySectionHead index="02" title="今日一句" />
      <Pressable
        hitSlop={4}
        onPress={() => {
          haptics.light();
          setIndex((prev) => (prev + 1) % QUOTES.length);
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={"今日一句：" + quote + "，点一下换一句"}
      >
        <Text pointerEvents="none" style={styles.quoteMark}>
          {"\u201C"}
        </Text>
        <Text style={styles.quoteText}>{quote}</Text>
        <Text style={styles.hint}>点一下换一句</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    card: {
      position: "relative",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingLeft: 30,
      borderRadius: radius.card,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPressed: { opacity: 0.85 },
    quoteMark: {
      position: "absolute",
      left: spacing.sm,
      top: spacing.xs,
      ...typography.title1,
      color: colors.accent,
      opacity: 0.55,
    },
    quoteText: { ...typography.callout, color: colors.textSecondary },
    hint: { ...typography.meta, color: colors.textMuted, marginTop: spacing.sm },
  });
