import { useId, type ReactElement, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/pressable-scale";
import { Icon, ICON_SIZE, type IconName, type IconWeight } from "@/components/ui/icon";
import { tabularNums, typography } from "@/theme/tokens";
import { v15CardShadow, v15HeroShadow, type V15Palette } from "./v15-theme";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

/**
 * 自适应网格：320 宽手机左右各 14，430 宽给到 20；平板内容封顶 680 居中。
 * 目标不是"越小越挤"，而是让卡片在每种屏幕上都铺满可用宽度。
 */
export function useV15Layout() {
  const { width, height } = useWindowDimensions();
  const hPad = clamp(Math.round(width * 0.045), 14, 22);
  const contentWidth = Math.min(width - hPad * 2, 680);
  return {
    width,
    height,
    hPad,
    contentWidth,
    cardPad: clamp(Math.round(width * 0.034), 13, 16),
    sectionGap: clamp(Math.round(width * 0.05), 18, 24),
    wide: width >= 400,
  };
}

export function V15Page({ p, children, style }: { p: V15Palette; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: p.canvas }, style]}>{children}</View>;
}

export function V15Scroll({
  p,
  children,
  refreshControl,
  contentContainerStyle,
  scrollRef,
}: {
  p: V15Palette;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const insets = useSafeAreaInsets();
  const { hPad } = useV15Layout();
  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingHorizontal: hPad, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 32 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>{children}</View>
    </ScrollView>
  );
}

/** 40pt 圆形后退钮；命中区补到 48（UI 矩阵要求所有图标按钮带 hitSlop） */
export function V15BackButton({ p, onPress, icon = "chevronLeft", label = "返回" }: { p: V15Palette; onPress: () => void; icon?: IconName; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [headerButtonStyle(p), pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={18} weight="bold" color={p.ink} />
    </Pressable>
  );
}

export function V15IconButton({
  p,
  icon,
  onPress,
  label,
  weight = "regular",
  size = ICON_SIZE.sm,
  active,
}: {
  p: V15Palette;
  icon: IconName;
  onPress: () => void;
  label: string;
  weight?: IconWeight;
  size?: number;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [headerButtonStyle(p), active && { backgroundColor: p.orangeSoft, borderColor: p.orange }, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={size} weight={weight} color={active ? p.orange : p.ink} />
    </Pressable>
  );
}

function headerButtonStyle(p: V15Palette): ViewStyle {
  return {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.card,
    borderWidth: 1,
    borderColor: p.line,
    ...v15CardShadow(p),
  };
}

export function V15Header({
  p,
  kicker,
  title,
  subtitle,
  onBack,
  actions,
}: {
  p: V15Palette;
  kicker: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? <V15BackButton p={p} onPress={onBack} /> : null}
      <View style={styles.headerCopy}>
        <Text style={[styles.kicker, { color: p.orange }]} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={[styles.title, { color: p.ink }]} numberOfLines={2} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: p.sub }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.headerActions}>{actions}</View> : null}
    </View>
  );
}

export function V15Card({ p, children, style, padded = true }: { p: V15Palette; children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: p.line, padding: padded ? 14 : 0 }, v15CardShadow(p), style]}>{children}</View>;
}

/** 暖色 / 深色渐变面板：SVG 画渐变与光晕，不引入 expo-linear-gradient */
export function V15HeroSurface({
  p,
  children,
  from,
  to,
  glow,
  glow2,
  borderColor,
  style,
  darkHero,
}: {
  p: V15Palette;
  children: ReactNode;
  from: string;
  to: string;
  glow?: string;
  glow2?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  darkHero?: boolean;
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const gradId = "v15g" + id;
  const glowId = "v15glow" + id;
  const glow2Id = "v15glow2" + id;
  return (
    <View
      style={[
        styles.hero,
        { borderColor: borderColor ?? p.line, backgroundColor: to },
        darkHero ? v15HeroShadow(p) : v15CardShadow(p),
        style,
      ]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          {glow ? (
            <RadialGradient id={glowId} cx="0.92" cy="0.05" r="0.75">
              <Stop offset="0" stopColor={glow} stopOpacity={0.34} />
              <Stop offset="0.55" stopColor={glow} stopOpacity={0.1} />
              <Stop offset="1" stopColor={glow} stopOpacity={0} />
            </RadialGradient>
          ) : null}
          {glow2 ? (
            <RadialGradient id={glow2Id} cx="0.02" cy="1" r="0.62">
              <Stop offset="0" stopColor={glow2} stopOpacity={0.24} />
              <Stop offset="1" stopColor={glow2} stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        {glow ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} /> : null}
        {glow2 ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glow2Id})`} /> : null}
      </Svg>
      {/* 两个极淡的装饰环，模拟 demo 的同心圆 */}
      <View pointerEvents="none" style={[styles.heroRingOuter, { borderColor: darkHero ? p.heroLine : p.line }]} />
      <View pointerEvents="none" style={[styles.heroRingInner, { borderColor: darkHero ? p.heroLine : p.line }]} />
      <View style={styles.heroBody}>{children}</View>
    </View>
  );
}

export function V15Section({ p, title, right, onRight, style }: { p: V15Palette; title: string; right?: string; onRight?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <Text style={[styles.sectionTitle, { color: p.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {right ? (
        onRight ? (
          <Pressable onPress={onRight} hitSlop={8} accessibilityRole="button" accessibilityLabel={right}>
            <Text style={[styles.sectionLink, { color: p.orange }]}>{right}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.sectionMeta, { color: p.sub }]}>{right}</Text>
        )
      ) : null}
    </View>
  );
}

export function V15Pill({ p, label, tone = "neutral", icon }: { p: V15Palette; label: string; tone?: "neutral" | "orange" | "blue" | "green" | "amber" | "lilac" | "red"; icon?: IconName }) {
  const map = {
    neutral: { bg: p.card2, fg: p.sub, border: p.line },
    orange: { bg: p.orangeSoft, fg: p.orange, border: "transparent" },
    blue: { bg: p.blueSoft, fg: p.blue, border: "transparent" },
    green: { bg: p.greenSoft, fg: p.green, border: "transparent" },
    amber: { bg: p.amberSoft, fg: p.amber, border: "transparent" },
    lilac: { bg: p.lilacSoft, fg: p.lilac, border: "transparent" },
    red: { bg: p.redSoft, fg: p.red, border: "transparent" },
  } as const;
  const c = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      {icon ? <Icon name={icon} size={11} weight="bold" color={c.fg} /> : null}
      <Text style={[styles.pillText, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function V15Button({
  p,
  label,
  icon,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  p: V15Palette;
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: "primary" | "soft" | "ghost" | "ink" | "green";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === "primary" ? p.orange : variant === "soft" ? p.orangeSoft : variant === "ink" ? p.ink : variant === "green" ? p.green : p.card;
  const fg = variant === "primary" || variant === "green" ? "#FFFFFF" : variant === "ink" ? p.canvasTop : variant === "soft" ? p.orange : p.ink;
  return (
    <PressableScale
      haptic
      scaleTo={0.98}
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: variant === "ghost" ? p.line : "transparent" },
        variant === "primary" ? { shadowColor: p.orangeStrong, shadowOpacity: 0.26, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 } : null,
        disabled ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={16} weight="bold" color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function V15Segmented<T extends string>({
  p,
  options,
  value,
  onChange,
  style,
}: {
  p: V15Palette;
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentTrack, { backgroundColor: p.card2, borderColor: p.line }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[styles.segmentCell, active && { backgroundColor: p.ink }]}
          >
            <Text style={[styles.segmentText, { color: active ? p.canvasTop : p.sub }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function V15ProgressBar({ p, pct, color, height = 4, trackColor }: { p: V15Palette; pct: number; color: string; height?: number; trackColor?: string }) {
  const w = clamp(pct, 0, 100);
  return (
    <View style={{ height, borderRadius: 99, backgroundColor: trackColor ?? p.track, overflow: "hidden" }}>
      <View style={{ width: `${w}%`, height: "100%", borderRadius: 99, backgroundColor: color }} />
    </View>
  );
}

export function V15Stat({ p, value, unit, label, tone, icon }: { p: V15Palette; value: string; unit?: string; label: string; tone: string; icon?: IconName }) {
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={[styles.statIcon, { backgroundColor: tone + "1F" }]}>
          <Icon name={icon} size={12} weight="fill" color={tone} />
        </View>
      ) : null}
      <Text style={[styles.statValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={[styles.statUnit, { color: p.sub }]}>{unit}</Text> : null}
      </Text>
      <Text style={[styles.statLabel, { color: p.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function V15Note({ p, children, tone = "neutral" }: { p: V15Palette; children: ReactNode; tone?: "neutral" | "green" }) {
  const bg = tone === "green" ? p.greenSoft : p.card2;
  const border = tone === "green" ? "transparent" : p.line;
  const color = tone === "green" ? p.green : p.sub;
  return (
    <View style={[styles.note, { backgroundColor: bg, borderColor: border }]}>
      <Icon name="info" size={14} weight="regular" color={color} />
      <Text style={[styles.noteText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 2 },
  headerCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  kicker: { ...typography.eyebrow, letterSpacing: 1.4, textTransform: "uppercase" },
  title: { ...typography.pageTitle, marginTop: 3 },
  subtitle: { ...typography.meta, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  card: { borderWidth: 1, borderRadius: 22, overflow: "hidden" },
  hero: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  heroBody: { padding: 15 },
  heroRingOuter: { position: "absolute", right: -66, bottom: -96, width: 226, height: 226, borderRadius: 113, borderWidth: 1 },
  heroRingInner: { position: "absolute", right: -32, bottom: -62, width: 158, height: 158, borderRadius: 79, borderWidth: 1 },
  section: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 9 },
  sectionTitle: { ...typography.section },
  sectionMeta: { ...typography.caption },
  sectionLink: { ...typography.caption, fontWeight: "700" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: "flex-start" },
  pillText: { ...typography.micro, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 16 },
  buttonText: { ...typography.callout, fontWeight: "800" },
  segmentTrack: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 16, borderWidth: 1 },
  segmentCell: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  segmentText: { ...typography.caption, fontWeight: "700" },
  stat: { gap: 2 },
  statIcon: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  statValue: { ...typography.num },
  statUnit: { ...typography.caption, fontWeight: "600" },
  statLabel: { ...typography.meta },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 14, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  noteText: { flex: 1, ...typography.meta, lineHeight: 18 },
});

export { tabularNums };

