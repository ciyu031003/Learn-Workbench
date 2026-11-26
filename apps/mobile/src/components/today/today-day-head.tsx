import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * ① Day Sheet 页头（V7 · 一页日程的抬头）。
 *
 * 左：巨大日期数字（21）+ 月份缩写（NOV）+ 星期（周六）。
 * 右：竖线分隔后是「第 47 周 · 09:41」小字 + 两行大标题「早上好。/今天只做三件事。」。
 * 数据全部由今日页从 useTodayScreen 传入（日期/时间取当前时刻，问候按小时段派生），组件无副作用。
 * 通知铃铛是既有入口（打开 TodayNotificationsSheet），只在右上角占一格，不抢大标题的视觉。
 */
export function TodayDayHead({
  dateNum,
  monthLabel,
  weekdayLabel,
  weekNo,
  nowLabel,
  greetFirst,
  greetHeadline,
  onOpenNotifications,
}: {
  dateNum: string;
  monthLabel: string;
  weekdayLabel: string;
  weekNo: number;
  nowLabel: string;
  greetFirst: string;
  greetHeadline: string;
  onOpenNotifications: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.head}>
      <View style={[styles.dateCol, compact && styles.dateColCompact]}>
        <Text style={styles.dateNum} {...TEXT_SCALE_POLICY.chrome}>
          {dateNum}
        </Text>
        <Text style={styles.month} {...TEXT_SCALE_POLICY.chrome}>
          {monthLabel}
        </Text>
        <Text style={styles.weekday} {...TEXT_SCALE_POLICY.chrome}>
          {weekdayLabel}
        </Text>
      </View>

      <View style={styles.greetCol}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker} numberOfLines={1} {...TEXT_SCALE_POLICY.chrome}>
            {"第 " + weekNo + " 周 · " + nowLabel}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              haptics.light();
              onOpenNotifications();
            }}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.bellBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="通知"
          >
            <Icon name="bell" size={ICON_SIZE.sm} weight="regular" color={colors.textMuted} />
            <View pointerEvents="none" style={styles.bellDot} />
          </Pressable>
        </View>
        <Text style={styles.headline} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
          {greetFirst + "\n" + greetHeadline}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg, marginTop: spacing.xs },
    dateCol: { width: 74, alignItems: "center" },
    dateColCompact: { width: 62 },

    dateNum: { ...typography.dateNum, ...tabularNums, color: colors.text },
    month: {
      ...typography.eyebrow,
      letterSpacing: 2,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    weekday: { ...typography.micro, fontWeight: "600", color: colors.textMuted, marginTop: 2 },
    greetCol: {
      flex: 1,
      minWidth: 0,
      paddingLeft: spacing.lg,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.borderStrong,
    },
    kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    kicker: { ...typography.eyebrow, letterSpacing: 1, color: colors.textMuted, flex: 1 },
    bellBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    bellBtnPressed: { backgroundColor: colors.surfaceMuted },
    bellDot: {
      position: "absolute",
      top: 7,
      right: 8,
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    headline: {
      ...typography.pageTitle,
      color: colors.text,
      marginTop: spacing.sm,
    },
  });
