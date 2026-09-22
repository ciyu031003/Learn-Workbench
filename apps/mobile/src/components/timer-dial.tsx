import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v13 U3 · 计时表盘（技法参考 uiverse.io/david-mohseni/young-frog-89 (MIT)：
 * 刻度 + 指针 + 中心轴的秒表表盘构图）。
 *
 * 与圆环的分工：圆环表"还剩多少"，表盘表"走到哪了"——正计时/秒表场景读数更自然。
 * 纯展示组件（进度由调用方按秒驱动），没有 worklet，因此与 MOTION_ENABLED 无关。
 */

/** 刻度数量：按尺寸推导（约每 5px 一个刻度），限制在 12–72 之间 */
export function dialTickCount(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 12;
  return Math.min(72, Math.max(12, Math.round(size / 5)));
}

/** 进度 → 指针角度（0–360，12 点方向为 0） */
export function dialHandAngle(progress: number): number {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return clamped * 360;
}

/** 第 index 个刻度的角度 */
export function dialTickAngle(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return (360 / count) * index;
}

/** 是否主刻度（每 count/12 个一个，用于加长加粗） */
export function dialIsMajorTick(index: number, count: number): boolean {
  if (!Number.isFinite(count) || count <= 0) return false;
  const step = Math.max(1, Math.round(count / 12));
  return index % step === 0;
}

/** 指针是否已扫过该刻度（"已走过"的刻度高亮） */
export function dialTickPassed(index: number, count: number, progress: number): boolean {
  return dialTickAngle(index, count) <= dialHandAngle(progress) + 0.001;
}

export function TimerDial({
  progress,
  label,
  caption,
  size = 280,
  color,
  trackColor,
  tickColor,
  style,
  children,
}: {
  /** 0–1 */
  progress: number;
  label?: string;
  caption?: string;
  size?: number;
  color?: string;
  trackColor?: string;
  tickColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const count = dialTickCount(size);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const majorLen = Math.round(size * 0.055);
  const minorLen = Math.round(size * 0.03);
  const handColor = color ?? colors.primary;
  const ringColor = trackColor ?? colors.surfaceMuted;
  const baseTick = tickColor ?? colors.textFaint;
  const angle = dialHandAngle(clamped);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {/* 外圈 + 内圈 */}
        <Circle cx={cx} cy={cy} r={outer} stroke={ringColor} strokeWidth={2} fill="none" />
        <Circle cx={cx} cy={cy} r={outer * 0.62} stroke={ringColor} strokeWidth={1} fill="none" />

        {/* 刻度：已走过的用主色，未走到用中性色 */}
        {Array.from({ length: count }).map((_, index) => {
          const a = (dialTickAngle(index, count) - 90) * (Math.PI / 180);
          const major = dialIsMajorTick(index, count);
          const length = major ? majorLen : minorLen;
          const x1 = cx + Math.cos(a) * (outer - 6);
          const y1 = cy + Math.sin(a) * (outer - 6);
          const x2 = cx + Math.cos(a) * (outer - 6 - length);
          const y2 = cy + Math.sin(a) * (outer - 6 - length);
          const passed = dialTickPassed(index, count, clamped);
          return (
            <Line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={passed ? handColor : baseTick}
              strokeWidth={major ? 2 : 1}
              strokeOpacity={passed ? 0.95 : 0.45}
              strokeLinecap="round"
            />
          );
        })}

        {/* 指针 + 中心轴 */}
        <G transform={`rotate(${angle} ${cx} ${cy})`}>
          <Line
            x1={cx}
            y1={cy + 8}
            x2={cx}
            y2={cy - outer * 0.72}
            stroke={handColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </G>
        <Circle cx={cx} cy={cy} r={9} fill={handColor} />
        <Circle cx={cx} cy={cy} r={3.5} fill={colors.surfaceStrong} />
      </Svg>

      {children ?? (label || caption ? (
        <View style={styles.center} pointerEvents="none">
          {label ? (
            <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
              {label}
            </Text>
          ) : null}
          {caption ? (
            <Text style={styles.caption} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null)}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    center: {
      position: "absolute",
      left: "18%",
      right: "18%",
      top: "52%",
      alignItems: "center",
      gap: 2,
    },
    label: { ...typography.title2, color: colors.text, ...tabularNums },
    caption: { ...typography.micro, color: colors.textMuted, textAlign: "center" },
  });
