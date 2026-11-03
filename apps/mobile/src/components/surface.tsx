import { useMemo, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 材质分层（v2.0 · 冷调浅工作台 / Liquid Glass）
 *
 * - `surface`     实底白卡 + 细描边                    → 常规信息卡（默认）
 * - `elevated`    实底 + 轻投影                         → 需要浮起的容器
 * - `glass`       轻玻璃（导航 / 吸顶栏 / 选中 pill）      → 只做层级，不承载语义
 * - `glassStrong` 强玻璃（视觉锚点：专注卡 / 弹层）        → 每屏最多 1 个
 *
 * 三档实现：
 *  1) iOS 26+：`expo-glass-effect` 系统液态玻璃；
 *  2) Android / iOS<26：`expo-blur` BlurView（Android 用 dimezisBlurView）+ 半透明叠加 + 1px 高光；
 *  3) `opaque`（弹层底色需不透光）：仍叠 BlurView，但用高不透明度实底压住穿透。
 *
 * 约束：玻璃只做层级、不承载语义；文字对比度按最坏背景校验；系统「降低透明度」时回落实底。
 */
export type SurfaceTier = "surface" | "elevated" | "glass" | "glassStrong";

/** iOS 26 且运行时 API 可用时才有系统级液态玻璃（Android/iOS<26 返回 false） */
export function glassSupported(): boolean {
  return Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
}

/** Android 的 BlurView 需要显式开启实验实现；其它平台不需要 */
const BLUR_METHOD = Platform.OS === "android" ? "dimezisBlurView" : "none";

export function Surface({
  children,
  style,
  tier = "surface",
  corner = radius.card,
  padded = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tier?: SurfaceTier;
  corner?: number;
  padded?: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  if (tier === "glass" || tier === "glassStrong") {
    return (
      <GlassSurface strong={tier === "glassStrong"} style={style} corner={corner} padded={padded}>
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
 * 玻璃容器：iOS 26 走系统 GlassView；其它平台走 BlurView + 叠加层（无 blur 时退化为半透明实底）。
 * 需要完全遮住下层内容时传 `opaque`（弹层底部用）。
 */
export function GlassSurface({
  children,
  style,
  corner = radius.card,
  padded = true,
  tint,
  interactive = false,
  opaque = false,
  strong = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  corner?: number;
  padded?: boolean;
  /** iOS 玻璃染色；不传用系统默认 */
  tint?: string;
  /** 可交互玻璃（iOS 26 按压高亮） */
  interactive?: boolean;
  /** 弹层/抽屉：底色必须不透光 */
  opaque?: boolean;
  /** 强玻璃（视觉锚点） */
  strong?: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const themeKey = dark ? "dark" : "light";

  if (glassSupported() && !opaque) {
    return (
      <GlassView
        key={themeKey}
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

  // ---- BlurView 降档（Android / iOS<26 / opaque 弹层）----
  return (
    <View
      key={themeKey}
      style={[
        styles.base,
        { borderRadius: corner, overflow: "hidden" },
        padded && styles.padded,
        strong ? { ...shadows.glass, elevation: 0 } : { ...shadows.card, elevation: 0 },
        style,
      ]}
    >
      <BlurView
        intensity={strong ? 54 : 36}
        tint={dark ? "dark" : "light"}
        experimentalBlurMethod={BLUR_METHOD}
        style={StyleSheet.absoluteFill}
      />
      {/* 半透明染色层：保证文字对比度，同时给玻璃一点色温 */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: opaque ? colors.surfaceStrong : colors.glassTint, opacity: opaque ? 0.94 : 1 },
        ]}
      />
      {/* 细边 + 1px 顶部高光：玻璃的"厚度"全靠这两笔 */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: corner, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.glassBorder },
        ]}
      />
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </View>
  );
}

/** Hero / 专注卡用的静态柔光（斜向高光 + 顶部 1px），不做循环动画 */
export function GlassHighlight({ corner = radius.panel }: { corner?: number }) {
  const { colors } = useTheme();
  return (
    <>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: corner, borderWidth: 1, borderColor: colors.glassHighlight, opacity: 0.7 }]}
      />
      <View pointerEvents="none" style={stylesHighlightStatic} />
    </>
  );
}

const stylesHighlightStatic = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  height: StyleSheet.hairlineWidth * 2,
  backgroundColor: "rgba(255,255,255,0.85)",
};

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    base: {
      // v2.0.1：玻璃容器不能带不透明白底，否则 Android 的 BlurView 会糊在一层白底上，
      // 真机表现为"整块白/底部白矩形"。透明底 + 染色叠加层 + 描边才是玻璃。
      overflow: "hidden",
      backgroundColor: "transparent",
    },
    padded: { padding: 16, gap: 10 },
    surface: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    elevated: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    highlight: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)",
    },
  });
