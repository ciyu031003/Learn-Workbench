import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { MOTION_ENABLED, isMotionActive } from "@/theme/motion";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 全局背景（v1.27 重构为「可流动的呼吸光效」）。
 *
 * 设计意图：底色之上叠 4 团**大尺寸柔和色斑**，各自以不同周期做
 * 位移 / 缩放 / 透明度呼吸；颜色面板按各自的定时器缓慢轮换，形成
 * "模糊的色彩在随机变换、像流云一样呼吸"的观感。
 *
 * 工程约束（见 CLAUDE.md 与踩坑清单）：
 * - **只用 transform / opacity 驱动**（Reanimated 共享值），没有逐帧 setState；
 * - **不依赖任何 blur 滤镜**（RN 无原生模糊，靠大圆角 + 低透明度 + 叠加模拟柔焦）；
 * - 层数固定 4 层，面积大但数量少，避免低端机大量透明叠加掉帧；
 * - 色板切换走 setTimeout（9–18s 一次），不是动画帧；
 * - 降级：MOTION_ENABLED=false 或系统「减弱动态」→ 不建动画、不建定时器，
 *   只画静态分层底（仍保留层次与光感）；
 * - 深色模式使用**独立暗色板**（暖炭底 + 极低透明度暖橙/冷蓝/紫微光），不拿浅色板压暗色。
 */

/**
 * 色板：[变体][色斑序号]，浅色为暖象牙/冷蓝系的柔和色，底色仍是 canvas。
 * v17 A5「降档」：浅色透明度压到 **≤0.5**（原 0.80–0.95）——
 * 背景安静下来，卡片与文字才出得来"高级感"；色相保持不变，身份不丢。
 */
const LIGHT_PALETTES: string[][] = [
  ["rgba(255, 243, 218, 0.50)", "rgba(220, 236, 255, 0.46)", "rgba(255, 224, 206, 0.44)", "rgba(214, 243, 230, 0.40)"],
  ["rgba(255, 232, 236, 0.48)", "rgba(226, 232, 255, 0.47)", "rgba(255, 246, 214, 0.44)", "rgba(220, 246, 246, 0.40)"],
  ["rgba(236, 255, 244, 0.47)", "rgba(240, 232, 255, 0.47)", "rgba(255, 238, 220, 0.46)", "rgba(222, 240, 255, 0.41)"],
];

/** 深色板：透明度压到 0.06–0.11，只在暖炭底上留一层若有若无的光 */
const DARK_PALETTES: string[][] = [
  ["rgba(245, 160, 84, 0.10)", "rgba(111, 168, 224, 0.09)", "rgba(196, 140, 255, 0.07)", "rgba(84, 205, 180, 0.06)"],
  ["rgba(255, 138, 128, 0.09)", "rgba(120, 150, 255, 0.10)", "rgba(255, 196, 120, 0.07)", "rgba(120, 220, 200, 0.06)"],
  ["rgba(168, 140, 255, 0.09)", "rgba(90, 120, 220, 0.10)", "rgba(255, 170, 120, 0.07)", "rgba(140, 230, 190, 0.06)"],
];

/** 4 团色斑的几何（大尺寸 + 负偏移 → 只露出柔和的边缘，天然的"虚化"感） */
const BLOBS: ViewStyle[] = [
  { width: 460, height: 460, top: -170, left: -150 },
  { width: 420, height: 420, top: -150, right: -170 },
  { width: 440, height: 440, bottom: -190, left: -130 },
  { width: 400, height: 400, bottom: -170, right: -150 },
];

/** 色斑共享的静态部分（与主题无关） */
const staticStyles = StyleSheet.create({
  blob: { position: "absolute", borderRadius: 999 },
});

/**
 * 每团色斑**各自**的换色定时器：初始延迟与周期都带 seed 偏移，
 * 因此 4 团不会同时跳色，观感是"颜色在随机流动"而不是整块闪一下。
 * 注意这是 setTimeout（秒级）而非动画帧，不受性能约束。
 */
function usePaletteIndex(count: number, active: boolean, seed: number): number {
  const [index, setIndex] = useState(() => seed % Math.max(1, count));
  useEffect(() => {
    if (!active || count <= 1) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setIndex((i) => (i + 1 + Math.floor(Math.random() * (count - 1))) % count);
          schedule();
        },
        9000 + seed * 2100 + Math.random() * 6000
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active, count, seed]);
  return index;
}

/** 一团会呼吸的色斑 */
function BreathingBlob({
  geometry,
  colorOptions,
  seed,
  active,
}: {
  geometry: ViewStyle;
  /** 该色斑在各色板变体下的颜色（按变体顺序） */
  colorOptions: string[];
  seed: number;
  active: boolean;
}) {
  const index = usePaletteIndex(colorOptions.length, active, seed);
  const dx = useSharedValue(0.5);
  const dy = useSharedValue(0.5);
  const scale = useSharedValue(0.5);
  const breathe = useSharedValue(0.5);

  useEffect(() => {
    if (!active) {
      // 降级：停在呼吸中位，画面仍是分层静态底（不是死平的一块色）
      dx.value = 0.5;
      dy.value = 0.5;
      scale.value = 0.5;
      breathe.value = 0.6;
      return;
    }
    const duration = 11000 + seed * 2700;
    const ease = Easing.inOut(Easing.sin);
    dx.value = withRepeat(withTiming(1, { duration, easing: ease }), -1, true);
    dy.value = withRepeat(withTiming(1, { duration: duration * 1.4, easing: ease }), -1, true);
    scale.value = withRepeat(withTiming(1, { duration: duration * 1.2, easing: ease }), -1, true);
    breathe.value = withRepeat(withTiming(1, { duration: duration * 0.85, easing: ease }), -1, true);
    return () => {
      cancelAnimation(dx);
      cancelAnimation(dy);
      cancelAnimation(scale);
      cancelAnimation(breathe);
    };
  }, [active, seed, dx, dy, scale, breathe]);

  const animated = useAnimatedStyle(() => ({
    // v17 A5：呼吸区间也收窄（0.55–1.0 → 峰值仍受色板 ≤0.5 约束），整体更像"底噪"而非"主角"
    opacity: 0.55 + breathe.value * 0.45,
    transform: [
      { translateX: (dx.value - 0.5) * 72 },
      { translateY: (dy.value - 0.5) * 56 },
      { scale: 0.9 + scale.value * 0.26 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[staticStyles.blob, geometry, { backgroundColor: colorOptions[index] ?? colorOptions[0] }, animated]}
    />
  );
}

/**
 * 画布底色 + 呼吸光效。
 * 浅色=暖象牙白 + 柔和色斑；深色=暖炭底 + 极淡暖橙/冷蓝微光。
 * 普通页面不再压黑遮罩，仅专注全屏保留沉浸暗色。
 */
export function DailyBackground({ children }: { children: ReactNode }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const reduceMotion = useReducedMotion();
  // 显式带上 MOTION_ENABLED：低端机把总开关置 false 时这里即静默降级
  const active = isMotionActive(reduceMotion, MOTION_ENABLED);

  const palettes = dark ? DARK_PALETTES : LIGHT_PALETTES;

  // 每团色斑的可选颜色（按变体展开），交给各自的定时器轮换
  const colorOptions = useMemo(
    () => BLOBS.map((_, blobIndex) => palettes.map((variant) => variant[blobIndex] ?? variant[0])),
    [palettes]
  );

  return (
    <View style={styles.root}>
      {BLOBS.map((geometry, i) => (
        <BreathingBlob
          key={i}
          geometry={geometry}
          colorOptions={colorOptions[i]}
          seed={i}
          active={active}
        />
      ))}
      {/* 顶部静态柔光：与呼吸层叠加，降级时也保证"上亮下稳"的层次 */}
      <View pointerEvents="none" style={styles.topGlow} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas, overflow: "hidden" },
    topGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      backgroundColor: dark ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.32)",
    },
    content: { flex: 1 },
  });
