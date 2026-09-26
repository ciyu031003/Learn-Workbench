import { useMemo, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { radius, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 统一列表行（见 docs/APP端优化方案-v2 §8.3②）
 * 图标槽 36×36 / 主文字 15·600 / 副文字 12·muted / 行高 ≥56 / 按压缩放 0.98
 * 左图标槽 + 主副文字 + 右侧值或 chevron；`onPress` 为空时退化为纯展示行。
 */
export function ListRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  valueColor,
  right,
  onPress,
  showChevron = false,
  last = false,
  disabled = false,
  style,
  haptic = true,
}: {
  /** Ionicons 名（iOS 自动走 SF Symbols） */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  /** 最后一行不画分隔线 */
  last?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = (
    <>
      {icon ? (
        <View style={[styles.iconSlot, { backgroundColor: iconBg ?? colors.primarySoft }]}>
          <ThemedIcon name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, disabled && styles.disabledText]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>{value}</Text>
      ) : null}
      {right}
      {showChevron ? <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} /> : null}
      {/**
       * v17 R6：iOS 分隔线**左端从文字起点开始**（有图标槽时让开图标槽），不是通栏。
       * 绝对定位实现，不占布局、不影响 minHeight。
       */}
      {!last ? <View pointerEvents="none" style={[styles.divider, { left: icon ? 62 : 14 }]} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <PressableScale
      haptic={haptic}
      disabled={disabled}
      onPress={onPress}
      /** v17 R6：整行"变色"取代"缩放"（iOS 列表行的标准反馈），所以 scale 归 1 */
      scaleTo={1}
      pressedStyle={styles.rowPressed}
      accessibilityRole="button"
      style={[styles.row, style]}
    >
      {body}
    </PressableScale>
  );
}

/** 分组容器：把若干 ListRow 包成一张卡（自带圆角与左右内边距） */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.group, style]}>{children}</View>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    /** 绝对定位的分隔线：left 由行内容决定（见 body 里的 icon ? 62 : 14） */
    divider: {
      position: "absolute",
      bottom: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    /** 按压态：整行铺一层极淡的中性底（iOS 列表行反馈） */
    rowPressed: { backgroundColor: colors.surfaceMuted },
    iconSlot: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.body, fontWeight: "600", color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    value: { ...typography.callout, fontWeight: "700", color: colors.text },
    disabledText: { color: colors.textFaint },
  });
