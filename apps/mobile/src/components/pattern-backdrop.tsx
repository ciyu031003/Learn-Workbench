import { useId, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";

/**
 * v13 U12 · 空状态几何底纹（技法参考 uiverse.io/csemszepp/old-hound-37 的暖色几何拼花
 * 与 uiverse.io/csemszepp/kind-frog-70 的灰阶人字纹，均为 MIT）。
 *
 * RN 没有 CSS conic-gradient，所以按方案要求用 **react-native-svg 的 `<Pattern>`**
 * 拼一个 2×2 单元（4 个半透明三角形）平铺：
 * - 不透明度压在 **3%–7%**，只做氛围不抢内容；深色档再减半（更弱）；
 * - 组件本身绝对定位铺满父容器，父容器负责 `overflow: hidden` + 圆角。
 */

export type PatternVariant = "bauhaus" | "chevron";

/** 平铺单元边长（Web 端 bauhaus 是 96px；移动端屏幕小，取一半） */
export const PATTERN_TILE = 48;

/** 浅色档各层不透明度上限（3%–7% 区间内） */
export const PATTERN_MAX_OPACITY = 0.07;
/** 深色档衰减系数（深色底纹必须更弱） */
export const PATTERN_DARK_SCALE = 0.5;

export interface PatternLayer {
  color: string;
  opacity: number;
}

/**
 * 底纹分层（纯函数，可单测）：bauhaus = 暖色几何拼花，chevron = 灰阶人字纹。
 * 所有颜色取自主题 token，深色档统一按 PATTERN_DARK_SCALE 衰减。
 */
export function patternLayers(
  colors: ThemeColors,
  variant: PatternVariant,
  dark: boolean
): PatternLayer[] {
  const scale = dark ? PATTERN_DARK_SCALE : 1;
  if (variant === "chevron") {
    return [
      { color: colors.textFaint, opacity: 0.05 * scale },
      { color: colors.textMuted, opacity: 0.03 * scale },
    ];
  }
  return [
    { color: colors.accent, opacity: 0.06 * scale },
    { color: colors.warning, opacity: 0.06 * scale },
    { color: colors.teal, opacity: 0.04 * scale },
    { color: colors.coral, opacity: 0.04 * scale },
  ];
}

/** 所有层的不透明度都不允许超过上限（守门函数，测试用） */
export function clampPatternOpacity(opacity: number): number {
  if (!Number.isFinite(opacity) || opacity < 0) return 0;
  return Math.min(PATTERN_MAX_OPACITY, opacity);
}

export function PatternBackdrop({
  variant = "bauhaus",
  style,
  testID,
}: {
  variant?: PatternVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors, dark } = useTheme();
  const rawId = useId();
  const patternId = useMemo(
    () => `lwbPattern${variant}${rawId.replace(/[^a-zA-Z0-9]/g, "")}`,
    [rawId, variant]
  );
  const layers = useMemo(() => patternLayers(colors, variant, dark), [colors, dark, variant]);

  return (
    <View pointerEvents="none" style={[styles.fill, style]} testID={testID}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={patternId} patternUnits="userSpaceOnUse" width={PATTERN_TILE} height={PATTERN_TILE}>
            {variant === "chevron" ? (
              <>
                <Path
                  d={`M0 28 L12 16 L24 28 L36 16 L48 28`}
                  stroke={layers[0].color}
                  strokeOpacity={clampPatternOpacity(layers[0].opacity)}
                  strokeWidth={2}
                  fill="none"
                />
                <Path
                  d={`M0 52 L12 40 L24 52 L36 40 L48 52`}
                  stroke={layers[1].color}
                  strokeOpacity={clampPatternOpacity(layers[1].opacity)}
                  strokeWidth={2}
                  fill="none"
                />
              </>
            ) : (
              <>
                {/* 2×2 单元：四个半透明三角形拼成风车（Web conic-gradient 的等价物） */}
                <Path
                  d={`M0 0 L24 0 L0 24 Z`}
                  fill={layers[0].color}
                  fillOpacity={clampPatternOpacity(layers[0].opacity)}
                />
                <Path
                  d={`M48 0 L48 24 L24 0 Z`}
                  fill={layers[1].color}
                  fillOpacity={clampPatternOpacity(layers[1].opacity)}
                />
                <Path
                  d={`M48 48 L24 48 L48 24 Z`}
                  fill={layers[2].color}
                  fillOpacity={clampPatternOpacity(layers[2].opacity)}
                />
                <Path
                  d={`M0 48 L0 24 L24 48 Z`}
                  fill={layers[3].color}
                  fillOpacity={clampPatternOpacity(layers[3].opacity)}
                />
              </>
            )}
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" },
});
