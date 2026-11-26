import { useId } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * V12 demo 页面底纹（warm wash）。
 *
 * demo 里每个一级页都不是纯 canvas：Today / Career 用右上角橙色径向光晕，
 * Learn 用顶部蓝色渐变，Growth 用暖米色 + 橙/青双光晕，Me 用淡紫光晕。
 * 这些渐变是「编辑感」的来源；正式端此前只有纯色画布，页面偏冷偏平。
 *
 * 用 react-native-svg 的径向渐变实现（不引入 expo-linear-gradient）：
 * 一层全屏 Svg 由原生绘制，成本很低，也不需要 blur。
 * 深色档降低不透明度，避免深色画布被光晕冲淡。
 */
export type PageWashTone = "today" | "learn" | "career" | "growth" | "me";

const LIGHT_BASE: Record<PageWashTone, string> = {
  today: "#F1F4F5",
  learn: "#F1F4F5",
  career: "#F1F4F5",
  growth: "#F7F2EA",
  me: "#F1F4F5",
};

const DARK_BASE: Record<PageWashTone, string> = {
  today: "#0B1216",
  learn: "#0B1216",
  career: "#0B1216",
  growth: "#141311",
  me: "#0B1216",
};

const GLOW: Record<
  PageWashTone,
  { tr: [string, number]; bl: [string, number] | null; topTint: [string, number] | null }
> = {
  today: { tr: ["#F3C495", 0.26], bl: ["#2F74C0", 0.07], topTint: null },
  learn: { tr: ["#2F74C0", 0.14], bl: null, topTint: ["#E3EFF9", 0.55] },
  career: { tr: ["#E1781C", 0.16], bl: ["#2F74C0", 0.07], topTint: null },
  growth: { tr: ["#F45B0B", 0.12], bl: ["#2FA79B", 0.07], topTint: null },
  me: { tr: ["#7E86E8", 0.11], bl: null, topTint: null },
};

export function PageWash({ tone }: { tone: PageWashTone }) {
  const { dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const base = (dark ? DARK_BASE : LIGHT_BASE)[tone];
  const glow = GLOW[tone];
  const dim = dark ? 0.55 : 1;
  const topGlowId = "pw-tr-" + id;
  const blGlowId = "pw-bl-" + id;
  const tintId = "pw-tint-" + id;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: base }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient id={topGlowId} cx={width} cy={0} r={width * 0.95} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={glow.tr[0]} stopOpacity={glow.tr[1] * dim} />
            <Stop offset="0.55" stopColor={glow.tr[0]} stopOpacity={glow.tr[1] * dim * 0.32} />
            <Stop offset="1" stopColor={glow.tr[0]} stopOpacity={0} />
          </RadialGradient>
          {glow.bl ? (
            <RadialGradient id={blGlowId} cx={0} cy={height * 0.34} r={width * 0.9} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={glow.bl[0]} stopOpacity={glow.bl[1] * dim} />
              <Stop offset="1" stopColor={glow.bl[0]} stopOpacity={0} />
            </RadialGradient>
          ) : null}
          {glow.topTint ? (
            <LinearGradient id={tintId} x1="0" y1="0" x2="0" y2={height * 0.42} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={glow.topTint[0]} stopOpacity={glow.topTint[1] * dim} />
              <Stop offset="1" stopColor={glow.topTint[0]} stopOpacity={0} />
            </LinearGradient>
          ) : null}
        </Defs>
        {glow.topTint ? <Rect x="0" y="0" width={width} height={height * 0.42} fill={"url(#" + tintId + ")"} /> : null}
        {glow.bl ? <Rect x="0" y="0" width={width} height={height} fill={"url(#" + blGlowId + ")"} /> : null}
        <Rect x="0" y="0" width={width} height={height} fill={"url(#" + topGlowId + ")"} />
      </Svg>
    </View>
  );
}
