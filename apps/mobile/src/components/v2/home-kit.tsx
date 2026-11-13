import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { RingProgress } from "@/components/ring-progress";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { radius, shadows, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import type { Ionicons } from "@expo/vector-icons";

/**
 * 2.6.8 首页设计件（对齐移动端 demo）
 *
 * 骨架来源：prototype/mobile-ui-2.6.6-refactor.html
 * - HeroCard：浅蓝渐变底 + 右上装饰圆环 + 大数字 / 环形进度 + 唯一主 CTA
 * - StatStrip：三格数据条（有数据用数值，无数据用「待规划 / 待开始」而非 0）
 * - Panel：白卡（白底 + 1px 细边 + 轻投影 + 20 圆角）
 */

/** 白卡：demo `.card` */
export function Panel({
  children,
  style,
  padded = true,
  spotlight = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** 浅蓝渐变底（hero 卡） */
  spotlight?: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={[styles.panel, padded && styles.panelPadded, spotlight && styles.spotlight, style]}>
      {spotlight ? <View pointerEvents="none" style={styles.spotlightRing} /> : null}
      {children}
    </View>
  );
}

/** 首页 hero：有数据（大数字 + 环）与空态（图标 + 标题 + CTA）两套骨架 */
export function HeroCard({
  eyebrow,
  eyebrowIcon = "sparkles-outline",
  eyebrowTone = "primary",
  value,
  valueUnit,
  ring,
  title,
  copy,
  ctaLabel,
  ctaIcon = "play",
  onCta,
  children,
  style,
}: {
  eyebrow: string;
  eyebrowIcon?: keyof typeof Ionicons.glyphMap;
  eyebrowTone?: "primary" | "accent";
  /** 大数字（有数据态） */
  value?: string;
  valueUnit?: string;
  /** 右侧环形进度（0-100） */
  ring?: { percent: number; label: string };
  /** 空态主标题 / 有数据态可省略 */
  title?: string;
  copy?: string;
  ctaLabel: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onCta: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const isNumber = typeof value === "string" && value.length > 0;

  return (
    <Panel spotlight style={[styles.hero, style]}>
      <View style={styles.heroInner}>
        <View style={styles.heroMain}>
          <View style={styles.eyebrow}>
            <ThemedIcon
              name={eyebrowIcon}
              size={14}
              color={eyebrowTone === "accent" ? colors.accent : colors.primary}
            />
            <Text style={[styles.eyebrowText, eyebrowTone === "accent" && { color: colors.accent }]}>
              {eyebrow}
            </Text>
          </View>

          {isNumber ? (
            <View style={styles.bigRow}>
              <Text
                style={[styles.bigNumber, tabularNums]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.62}
              >
                {value}
              </Text>
              {valueUnit ? <Text style={styles.bigUnit}>{valueUnit}</Text> : null}
            </View>
          ) : null}

          {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
          {copy ? <Text style={styles.heroCopy}>{copy}</Text> : null}
          {children}
        </View>

        {ring ? (
          <RingProgress
            size={82}
            strokeWidth={7}
            progress={Math.max(0, Math.min(100, ring.percent)) / 100}
            trackColor={colors.borderStrong}
          >
            <View style={styles.ringCenter}>
              <Text style={[styles.ringValue, tabularNums]}>{Math.round(ring.percent)}%</Text>
              <Text style={styles.ringLabel}>{ring.label}</Text>
            </View>
          </RingProgress>
        ) : null}
      </View>

      <PrimaryButton label={ctaLabel} icon={ctaIcon} onPress={onCta} />
    </Panel>
  );
}


/** 主按钮：demo .btn-primary（14/700、46 高、圆角 14、主色投影） */
export function PrimaryButton({
  label,
  icon = "play",
  onPress,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.cta, style, pressed && styles.ctaPressed]}
    >
      <ThemedIcon name={icon} size={15} color="#FFFFFF" />
      <Text style={styles.ctaText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** 三格数据条：无数据时显示 pending 文案，禁止裸 0 */
export function StatStrip({
  items,
  style,
}: {
  items: Array<{ value: string; unit?: string; label: string; pending?: boolean }>;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={[styles.statRow, style]}>
      {items.map((item) => (
        <View key={item.label} style={styles.stat}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.statValue, item.pending && styles.statValuePending, !item.pending && tabularNums]}
          >
            {item.value}
            {item.unit ? <Text style={styles.statUnit}> {item.unit}</Text> : null}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.card,
      overflow: "hidden",
      ...shadows.card,
    },
    panelPadded: { padding: 18 },
    spotlight: {
      backgroundColor: dark ? "rgba(91,147,214,0.14)" : "#EEF5FB",
      borderColor: dark ? "rgba(91,147,214,0.22)" : "rgba(47,116,192,0.16)",
    },
    spotlightRing: {
      position: "absolute",
      width: 130,
      height: 130,
      borderRadius: 65,
      borderWidth: 24,
      borderColor: "rgba(47,116,192,0.045)",
      right: -62,
      top: -68,
    },
    hero: { padding: 18, marginBottom: 14 },
    heroInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    heroMain: { flex: 1, minWidth: 0 },
    eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
    eyebrowText: { ...typography.eyebrow, color: colors.textMeta },
    bigRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 10, marginBottom: 4 },
    bigNumber: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: "700",
      letterSpacing: -1.2,
      color: colors.text,
    },
    bigUnit: { ...typography.meta, fontWeight: "600", color: colors.textSecondary, marginLeft: 6, marginBottom: 4 },
    heroTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3, color: colors.text, marginTop: 8 },
    heroCopy: { ...typography.meta, color: colors.textMeta, lineHeight: 19, marginTop: 5 },
    ringCenter: { alignItems: "center", justifyContent: "center" },
    ringValue: { fontSize: 18, lineHeight: 21, fontWeight: "700", color: colors.text },
    ringLabel: { fontSize: 10, lineHeight: 13, color: colors.textMeta, marginTop: 2 },
    cta: {
      marginTop: 16,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 14,
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    statRow: { flexDirection: "row", gap: 9, marginBottom: 4 },
    stat: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 10,
    },
    statValue: { fontSize: 19, lineHeight: 23, fontWeight: "700", letterSpacing: -0.3, color: colors.text },
    statValuePending: { fontSize: 14, letterSpacing: 0, color: colors.textSecondary },
    statUnit: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    statLabel: { fontSize: 11, lineHeight: 15, color: colors.textMeta, marginTop: 4 },
  });