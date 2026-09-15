import { useMemo, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 材质三级（见 docs/APP端优化方案-v2 §8.3①）
 *
 * - `surface`  实底 `surfaceStrong` + hairline 边       → 常规信息卡
 * - `elevated` 实底 + `shadows.card` + 稍大圆角         → 需要浮起（列表容器 / 工具条）
 * - `glass`    iOS 26 `GlassView`（真液态玻璃）         → Sheet / Hero / 卡片
 *              非 iOS 或系统不可用时回落 `elevated`
 *
 * 约束：**玻璃只做层级，不承载语义**；文字对比度按最坏背景（Bing 深色风景）校验，
 * 系统「降低透明度」开启时回落实底。底栏不走玻璃（决策 D10）。
 */
export type SurfaceTier = "surface" | "elevated" | "glass";

/** iOS 26 且运行时 API 可用时才有真玻璃（Android/iOS<26 返回 false） */
export function glassSupported(): boolean {
  return Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
}

export function Surface({
  children,
  style,
  tier = "surface",
  corner = radius.lg,
  padded = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tier?: SurfaceTier;
  corner?: number;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (tier === "glass") {
    return (
      <GlassSurface style={style} corner={corner} padded={padded}>
        {children}
      </GlassSurface>
    );
  }
  return (
    <View style={[styles.base, { borderRadius: corner }, padded && styles.padded, styles[tier], style]}>
      {children}
    </View>
  );
}

/**
 * 软玻璃容器：iOS 走真玻璃，其它平台回落 `elevated`（保证一致观感）。
 * 需要显式给出 `fallbackColor` 之外的内容时，直接传 children。
 */
export function GlassSurface({
  children,
  style,
  corner = radius.lg,
  padded = true,
  tint,
  interactive = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  corner?: number;
  padded?: boolean;
  /** iOS 玻璃染色；不传则用系统默认 */
  tint?: string;
  /** 可交互玻璃（iOS 26 按压高亮） */
  interactive?: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (glassSupported()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={dark ? "dark" : "light"}
        tintColor={tint}
        isInteractive={interactive}
        style={[styles.base, { borderRadius: corner }, padded && styles.padded, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.base,
        { borderRadius: corner },
        padded && styles.padded,
        styles.elevated,
        glassTintOverlay(colors, dark, tint),
        style,
      ]}
    >
      {/* 顶部 1px 高光：模拟软玻璃的受光边（不做模糊，零性能开销） */}
      <View pointerEvents="none" style={[styles.highlight, { borderTopLeftRadius: corner, borderTopRightRadius: corner }]} />
      {children}
    </View>
  );
}

/** 非 iOS 回落时的染色：深色下更暗、浅色下更亮，保证玻璃内文字对比度 */
function glassTintOverlay(colors: ThemeColors, dark: boolean, tint?: string): ViewStyle {
  if (tint) return { backgroundColor: tint };
  return { backgroundColor: dark ? "rgba(20,24,28,0.72)" : "rgba(255,255,255,0.86)" };
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    padded: { padding: 16, gap: 10 },
    surface: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.borderStrong,
    },
    elevated: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.borderStrong,
      ...shadows.card,
    },
    highlight: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "rgba(255,255,255,0.28)",
    },
  });
