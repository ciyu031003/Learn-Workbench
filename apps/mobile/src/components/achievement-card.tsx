import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { motion, radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { MOTION_BASE, easingStandard, isMotionActive } from "@/theme/motion";

/**
 * v13 U11 · 成就 / 里程碑卡（技法参考 uiverse.io/sohoning/ugly-horse-87 (MIT)：
 * 大图形 + 标题 + 达成日期 + `slide-in-top` 入场）。
 *
 * 落点：证书页（达成 / 备考中 / 计划中三档共用一张卡，图形与色调随状态变）。
 * 入场：opacity 0→1 + translateY -10→0，按 `index` 做 40ms 错峰；
 * 降级：MOTION_ENABLED=false 或系统减弱动态 → 直接呈现终态（不动）。
 */
export type AchievementTone = "gold" | "blue" | "green";

/** 入场错峰由 tokens.motion.stagger 决定（与列表逐项入场同源） */
export const ACHIEVEMENT_STAGGER_MS = motion.stagger;

const TONE_ICON: Record<AchievementTone, keyof typeof Ionicons.glyphMap> = {
  gold: "trophy",
  blue: "medal",
  green: "ribbon",
};

/** 三档语义色（金色=已达成 / 蓝=备考中 / 绿=计划中），全部取现有 token */
export function achievementTone(colors: ThemeColors, tone: AchievementTone): { soft: string; strong: string } {
  if (tone === "gold") return { soft: colors.accentSoft, strong: colors.accentStrong };
  if (tone === "blue") return { soft: colors.primarySoft, strong: colors.primary };
  return { soft: colors.successSoft, strong: colors.success };
}

export function AchievementCard({
  title,
  subtitle,
  date,
  tone = "gold",
  index = 0,
  emoji,
  right,
  children,
  style,
  testID,
}: {
  title: string;
  subtitle?: string | null;
  /** 达成日期 / 有效期这一类元信息（已格式化好的字符串） */
  date?: string | null;
  tone?: AchievementTone;
  /** 列表位置：用于入场错峰 */
  index?: number;
  /** 大图形用 emoji（可选，优先级高于 tone 图标） */
  emoji?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const palette = useMemo(() => achievementTone(colors, tone), [colors, tone]);
  const styles = useMemo(() => makeStyles(colors, palette), [colors, palette]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  // ⚠️ 顺序约束：shared value 声明在 useAnimatedStyle 之前
  const enter = useSharedValue(active ? 0 : 1);

  useEffect(() => {
    if (!active) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      Math.max(0, index) * ACHIEVEMENT_STAGGER_MS,
      withTiming(1, { duration: MOTION_BASE, easing: easingStandard })
    );
  }, [active, enter, index]);

  const enterStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * -10 }],
  }));

  return (
    <Animated.View testID={testID} style={[styles.wrap, enterStyle, style]}>
      <View style={styles.graphic}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <ThemedIcon name={TONE_ICON[tone]} size={26} color={palette.strong} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {right}
        </View>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {date ? <Text style={styles.date} numberOfLines={1}>{date}</Text> : null}
        {children}
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, palette: { soft: string; strong: string }) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceStrong,
      padding: spacing.lg,
      ...shadows.card,
    },
    graphic: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.soft,
    },
    emoji: { fontSize: 26, lineHeight: 32 },
    body: { flex: 1, minWidth: 0, gap: 3 },
    headRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    title: { flex: 1, minWidth: 0, ...typography.headline, color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
    date: { ...typography.micro, fontWeight: "600", color: palette.strong },
  });
