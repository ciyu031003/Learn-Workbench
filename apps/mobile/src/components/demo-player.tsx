import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { resolveExam408DemoFrame, type Exam408DemoStep } from "@/lib/exam-408-demos";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const BASE_FRAME_MS = 1600;

/**
 * 408 交互演示播放器（移动端 / 1.55）。
 *
 * 与 Web 同构：帧是 408card.top 逐帧镜像的静态图，播放 = 按倍速切帧。
 * 手势：在画面上左右横扫切换上一步/下一步（PanResponder，跑在 JS 线程，无 worklet）；
 * 按钮：播放/暂停、上一步、下一步、重放、倍速。
 * 尊重系统「减弱动态效果」：开启时不自动播放（仍可手动单步）。
 */
export function DemoPlayer({
  steps,
  title,
  autoPlay = true,
}: {
  steps: Exam408DemoStep[];
  title?: string;
  autoPlay?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // 三态：null = 还没探测完（此时不许自动播放，避免「先播后停」闪一下）
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [failedFrames, setFailedFrames] = useState<Set<number>>(() => new Set());

  const safeIndex = total === 0 ? 0 : Math.min(index, total - 1);
  const current = steps[safeIndex];
  const frameUri = useMemo(
    () => resolveExam408DemoFrame(current?.frame ?? null),
    [current?.frame],
  );

  const clampIndex = useCallback(
    (next: number) => {
      if (total === 0) return 0;
      return ((next % total) + total) % total;
    },
    [total],
  );

  const stepBy = useCallback(
    (delta: number) => {
      setPlaying(false);
      setIndex((previous) => clampIndex(previous + delta));
    },
    [clampIndex],
  );

  const togglePlay = useCallback(() => {
    if (total <= 1) return;
    setPlaying((value) => !value);
  }, [total]);

  const replay = useCallback(() => {
    setIndex(0);
    setPlaying(total > 1 && reducedMotion === false);
  }, [total, reducedMotion]);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line -- AccessibilityInfo 只有异步读取 API，只能在 effect 中订阅
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReducedMotion(Boolean(value));
      })
      .catch(() => {
        if (alive) setReducedMotion(false);
      });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReducedMotion(Boolean(value));
      if (value) setPlaying(false);
    });
    return () => {
      alive = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!autoPlay || reducedMotion !== false || total <= 1) return;
    const timer = setTimeout(() => setPlaying(true), 0);
    return () => clearTimeout(timer);
  }, [autoPlay, reducedMotion, total]);

  useEffect(() => {
    if (!playing || total <= 1) return;
    const timer = setTimeout(
      () => setIndex((previous) => clampIndex(previous + 1)),
      BASE_FRAME_MS / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, total, speed, safeIndex, clampIndex]);

  // 左右横扫切换步骤：只在明显水平滑动时接管，避免和页面纵向滚动打架
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) < 32) return;
          setPlaying(false);
          setIndex((previous) => {
            if (total === 0) return 0;
            const next = previous + (gesture.dx < 0 ? 1 : -1);
            return ((next % total) + total) % total;
          });
        },
      }),
    [total],
  );

  const frameFailed = failedFrames.has(safeIndex);
  const ratio = total <= 1 ? 0 : (safeIndex / (total - 1)) * 100;

  const speedLabel = `${speed}x`;
  const nextSpeed = () => {
    const at = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(at + 1) % SPEEDS.length] ?? 1);
  };

  if (total === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>该演示暂无步骤数据。</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headTitleWrap}>
          <ThemedIcon name="play" size={14} color={colors.primary} />
          <Text style={styles.headTitle} numberOfLines={1}>
            {title ? `演示 · ${title}` : "408 交互演示"}
          </Text>
        </View>
        <Text style={styles.counter}>
          {safeIndex + 1} / {total}
        </Text>
      </View>

      <View style={styles.frameBox} {...panResponder.panHandlers}>
        {frameUri && !frameFailed ? (
          <Image
            key={frameUri}
            source={{ uri: frameUri }}
            style={styles.frameImage}
            resizeMode="contain"
            onError={() =>
              setFailedFrames((previous) => {
                const next = new Set(previous);
                next.add(safeIndex);
                return next;
              })
            }
            accessibilityLabel={`第 ${safeIndex + 1} 步配图`}
          />
        ) : (
          <Text style={styles.frameFallback}>
            {frameUri ? "这一帧图片暂时无法加载（演示资产可能尚未导入）" : "该步骤为纯文字说明，没有配图"}
          </Text>
        )}
        <Text style={styles.swipeHint}>左右滑动可单步翻帧</Text>
      </View>

      <Text style={styles.caption} numberOfLines={4}>
        {current?.explain || "（本步无文字说明）"}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio}%` }]} />
      </View>

      <View style={styles.controls}>
        <PressableScale
          onPress={togglePlay}
          disabled={total <= 1}
          haptic
          style={[styles.primaryButton, total <= 1 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={playing ? "暂停" : "播放"}
        >
          <ThemedIcon name={playing ? "pause" : "play"} size={14} color={colors.primaryStrong} />
          <Text style={styles.primaryText}>{playing ? "暂停" : "播放"}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => stepBy(-1)}
          style={styles.controlButton}
          accessibilityRole="button"
          accessibilityLabel="上一步"
        >
          <ThemedIcon name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.controlText}>上一步</Text>
        </PressableScale>
        <PressableScale
          onPress={() => stepBy(1)}
          style={styles.controlButton}
          accessibilityRole="button"
          accessibilityLabel="下一步"
        >
          <Text style={styles.controlText}>下一步</Text>
          <ThemedIcon name="chevron-forward" size={14} color={colors.textMuted} />
        </PressableScale>
        <PressableScale
          onPress={replay}
          style={styles.controlButton}
          accessibilityRole="button"
          accessibilityLabel="重放"
        >
          <ThemedIcon name="refresh" size={14} color={colors.textMuted} />
        </PressableScale>
        <Pressable onPress={nextSpeed} style={styles.controlButton} accessibilityRole="button" accessibilityLabel={`倍速，当前 ${speedLabel}`}>
          <Text style={styles.controlText}>{speedLabel}</Text>
        </Pressable>
      </View>

      {reducedMotion === true ? (
        <Text style={styles.reducedHint}>已根据系统「减弱动态效果」设置关闭自动播放，可手动单步。</Text>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: spacing.sm,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    headTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    headTitle: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
    counter: { ...typography.micro, color: colors.textMuted },
    frameBox: {
      minHeight: 200,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      paddingVertical: spacing.sm,
    },
    frameImage: { width: "100%", aspectRatio: 16 / 10 },
    frameFallback: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg },
    swipeHint: { ...typography.micro, color: colors.textFaint, marginTop: 4 },
    caption: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 20,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
    controls: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.sm,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    primaryText: { ...typography.micro, color: colors.primaryStrong },
    controlButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    controlText: { ...typography.micro, color: colors.textMuted },
    disabled: { opacity: 0.4 },
    reducedHint: { ...typography.micro, color: colors.textMuted },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.lg,
      alignItems: "center",
    },
    emptyText: { ...typography.caption, color: colors.textMuted },
  });
}