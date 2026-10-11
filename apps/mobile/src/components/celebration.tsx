import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "@/lib/motion";
import {
  BURSTS,
  PALETTE,
  TOTAL_MS,
  buildParticles,
  particleStateAt,
  type Particle,
} from "@/lib/celebration-particles";

/**
 * 庆祝特效 v2（v1.44 真机反馈重做）。
 *
 * ## 为什么要重做
 * 旧版是「36 个同色系小矩形从一个点放射出去」：
 *   - 全部粒子**同一时刻、同一角度公式、同一时长** → 看起来只有几根彩带；
 *   - 形状只有矩形（宽 7~11 × 高 5~11）→ 用户原话「彩带也只是几个颜色的矩形」；
 *   - 没有重力与飘动，粒子沿直线匀速飞出去就消失 → 不像烟花，也不像彩带；
 *   - 只有 7 个颜色，且集中在浅色区，深色遮罩上对比不足。
 *
 * ## 现在的做法
 * 1. **一个驱动值**：整屏只用一个 `progress`（0→1，线性）。每个粒子在自己的
 *    `useAnimatedStyle` 里按「自己的延迟 / 自己的寿命」把它换算成局部进度。
 *    好处：122 个粒子只跑 1 个动画，没有 122 份 withTiming 互相抢帧。
 * 2. **真烟花**：3 个爆点（正中 + 左上 + 右上）错峰炸开，火花是**沿飞行方向的短线**
 *    （速度角随时间变化，重力下坠时射线也跟着转向），配一圈扩散光环。
 * 3. **真彩带**：44 条从顶部飘落，带横向摆动（sin）+ 翻转（scaleY 随 cos 呼吸），
 *    形状分「缎带 / 圆点 / 长条」三种，颜色 12 色。
 *
 * **所有数值都来自 `lib/celebration-particles.ts`**（纯逻辑、有 18 条单测）。
 * 这里只负责把数字喂给 useAnimatedStyle —— 组件与数值单一事实源分离，
 * 避免"组件里一份、测试里一份"各自漂移（首版就犯过这个错：组件里写死 TOTAL_MS=2600，
 * 纯模块里已改成 2900，两边不一致会让特效尾部被提前掐断）。
 *
 * 无障碍：系统「减弱动态效果」开启时整个组件不渲染（返回 null），与旧版一致。
 */

function ParticleView({
  particle,
  progress,
  width,
  height,
}: {
  particle: Particle;
  progress: ReturnType<typeof useSharedValue<number>>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const s = particleStateAt(particle, progress.value, width, height);
    return {
      opacity: s.opacity,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { rotate: `${s.rotate}deg` },
        { scaleY: s.scaleY },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: particle.w,
          height: particle.h,
          borderRadius: particle.radius,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

/** 爆点扩散光环：让"炸开"这件事有明确的视觉起手 */
function BurstRing({
  x,
  y,
  delayMs,
  color,
  progress,
  size,
}: {
  x: number;
  y: number;
  delayMs: number;
  color: string;
  progress: ReturnType<typeof useSharedValue<number>>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const elapsed = progress.value * TOTAL_MS - delayMs;
    const started = elapsed > 0;
    const life = started ? Math.min(1, elapsed / 700) : 0;
    return {
      opacity: started ? (1 - life) * 0.55 : 0,
      transform: [{ scale: 0.25 + life * 1.15 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: x * size - size * 0.25,
          top: y * size - size * 0.25,
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: size * 0.25,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export function Celebration({ play }: { play: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ width: 380, height: 720 });

  /**
   * `[play]` 依赖让"再庆祝一次"抽到新的一组粒子；同一次展示期间 play 不变 →
   * 粒子数组稳定，不会每帧重建。
   */
  const particles = useMemo(() => buildParticles(play ? 0x9e3779b9 : 0x1234567), [play]);

  useEffect(() => {
    if (!play) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: TOTAL_MS, easing: Easing.linear });
  }, [play, progress]);

  if (reduced) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
      }}
    >
      {BURSTS.map((burst, index) => (
        <BurstRing
          key={`ring-${index}`}
          x={burst.x}
          y={burst.y}
          delayMs={burst.delayMs}
          color={PALETTE[index % PALETTE.length] ?? PALETTE[0]}
          progress={progress}
          size={Math.min(size.width, size.height)}
        />
      ))}
      {particles.map((particle, index) => (
        <ParticleView
          key={index}
          particle={particle}
          progress={progress}
          width={size.width}
          height={size.height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: "absolute", left: 0, top: 0 },
  ring: { position: "absolute", borderWidth: 2 },
});
