import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useBlurTarget } from "@/components/blur-target";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 快速过题 · 堆叠卡片（v1.31）
 *
 * 面试前把题目与答案快速过一遍，**不写任何作答记录**（答案走只读接口
 * /api/questions/answers，见 apps/web/app/api/questions/answers/route.ts）。
 *
 * 交互：
 * - 卡片占屏幕高度约 2/3、水平居中；
 * - 左右滑动切换上一题 / 下一题（跟手位移 + 位移/速度判定 + 回弹）；
 * - 卡片上半是题目，下半被**纯色盖板**遮住答案，点击盖板即移除、显示答案；
 * - 点击卡片以外的空白处退出。
 *
 * 约束遵守：worklet 内只读写共享值 + Reanimated API（外部逻辑一律 runOnJS）；
 * 所有共享值声明在 worklet 之前（踩坑 71/78）；减弱动态下不做位移动画。
 */

export interface QuizItem {
  id: number;
  module: string;
  question: string;
  difficulty: string;
  answer: string;
}

const DIFF_LABEL: Record<string, string> = { easy: "简单", medium: "中等", hard: "困难" };
/** 卡片高度占屏幕比例（用户要求约 2/3） */
const CARD_HEIGHT_RATIO = 0.66;
/** 触发切题的位移阈值（占卡片宽度比例）与速度阈值 */
const SWIPE_RATIO = 0.24;
const SWIPE_VELOCITY = 700;
/** 卡片最大宽度，避免平板上被拉得过宽 */
const CARD_MAX_WIDTH = 420;

export function QuizStack({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: QuizItem[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: winH, width: winW } = useWindowDimensions();
  const reduced = useReducedMotion();

  const cardW = Math.min(winW - 48, CARD_MAX_WIDTH);
  const cardH = Math.round(winH * CARD_HEIGHT_RATIO);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  /** 跟手位移（x）与卡片不透明度 */
  const dx = useSharedValue(0);
  const fade = useSharedValue(1);
  /** 3D 翻面进度：0 = 题目面，1 = 答案面 */
  const flip = useSharedValue(0);
  /** 切卡时的高斯模糊过渡层不透明度 */
  const blur = useSharedValue(0);
  const blurTarget = useBlurTarget();

  const total = items.length;
  const safeIndex = total === 0 ? 0 : Math.min(index, total - 1);
  const current = items[safeIndex];

  useEffect(() => {
    flip.value = reduced ? (revealed ? 1 : 0) : withTiming(revealed ? 1 : 0, { duration: 280 });
  }, [flip, reduced, revealed]);

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setRevealed(false);
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const next = Math.min(Math.max(safeIndex + dir, 0), Math.max(0, total - 1));
      if (next === safeIndex) {
        haptics.soft();
        return;
      }
      haptics.soft();
      goTo(next);
    },
    [goTo, safeIndex, total]
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      dx.value = e.translationX;
    })
    .onEnd((e) => {
      const threshold = cardW * SWIPE_RATIO;
      const wantsNext = e.translationX < -threshold || e.velocityX < -SWIPE_VELOCITY;
      const wantsPrev = e.translationX > threshold || e.velocityX > SWIPE_VELOCITY;
      if (wantsNext) {
        if (reduced) {
          dx.value = 0;
          runOnJS(step)(1);
        } else {
          blur.value = withTiming(1, { duration: 110 });
          fade.value = withTiming(0, { duration: 120 });
          dx.value = withTiming(-(cardW + 80), { duration: 170 }, (finished) => {
            if (!finished) return;
            runOnJS(step)(1);
            dx.value = 0;
            fade.value = withTiming(1, { duration: 160 });
            blur.value = withTiming(0, { duration: 200 });
          });
        }
        return;
      }
      if (wantsPrev) {
        if (reduced) {
          dx.value = 0;
          runOnJS(step)(-1);
        } else {
          blur.value = withTiming(1, { duration: 110 });
          fade.value = withTiming(0, { duration: 120 });
          dx.value = withTiming(cardW + 80, { duration: 170 }, (finished) => {
            if (!finished) return;
            runOnJS(step)(-1);
            dx.value = 0;
            fade.value = withTiming(1, { duration: 160 });
            blur.value = withTiming(0, { duration: 200 });
          });
        }
        return;
      }
      // 未过阈值：回弹
      dx.value = reduced ? 0 : withSpring(0, { damping: 26, stiffness: 240 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: dx.value },
      { rotate: (dx.value / Math.max(1, cardW)) * 6 + "deg" },
    ],
  }));

  /** 下一张卡片的示意层（堆叠感） */
  const behindStyle = useAnimatedStyle(() => {
    const p = interpolate(Math.abs(dx.value), [0, cardW * 0.6], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{ scale: 0.94 + p * 0.04 }, { translateY: 10 - p * 6 }],
      opacity: 0.5 + p * 0.4,
    };
  });

  /** 题目面：0° → 180°，过半后隐藏，避免两面同时可读 */
  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]),
    transform: [{ perspective: 1200 }, { rotateY: interpolate(flip.value, [0, 1], [0, 180]) + "deg" }],
  }));

  /** 答案面：-180° → 0°，与题目面交换 */
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 0.51, 1], [0, 0, 1, 1]),
    transform: [{ perspective: 1200 }, { rotateY: interpolate(flip.value, [0, 1], [-180, 0]) + "deg" }],
  }));

  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  const exit = useCallback(() => {
    haptics.soft();
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={exit}>
      {/*
        必须再包一层 GestureHandlerRootView：Android 的 Modal 是独立 Window，
        主 Window 的根 view 收不到它的触摸流 → Modal 内的 Pan 手势会**静默失效**
        （项目在 bottom-sheet.tsx 里踩过同一个坑）。少了它左右滑动切题在 Android 上不会生效。
      */}
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.root}>
        {/* 点空白退出：整屏背板（Modal 是独立窗口，与项目其他弹层同构） */}
        <Pressable style={StyleSheet.absoluteFill} onPress={exit} accessibilityLabel="退出快速过题" />

        <View style={styles.center} pointerEvents="box-none">
          {total === 0 ? (
            <Text style={styles.empty}>没有可速览的题目</Text>
          ) : (
            <>
              <View style={[styles.stackWrap, { width: cardW, height: cardH }]} pointerEvents="box-none">
                {safeIndex + 1 < total ? (
                  <Animated.View style={[styles.behindCard, { width: cardW, height: cardH }, behindStyle]} pointerEvents="none" />
                ) : null}

                <GestureDetector gesture={pan}>
                  <Animated.View style={[styles.card, { width: cardW, height: cardH }, cardStyle]}>
                    {/* 正面：题目 —— 轻点整张卡翻面 */}
                    <Animated.View style={[styles.face, frontStyle]}>
                      <Pressable
                        style={styles.faceInner}
                        onPress={() => {
                          haptics.success();
                          setRevealed(true);
                        }}
                        accessibilityLabel="翻面查看答案"
                      >
                        <View style={styles.head}>
                          <Text style={styles.headModule} numberOfLines={1}>{current.module}</Text>
                          <Text style={styles.headDiff}>{DIFF_LABEL[current.difficulty] ?? current.difficulty}</Text>
                          <Text style={styles.headCount}>{safeIndex + 1} / {total}</Text>
                        </View>

                        <ScrollView style={styles.questionWrap} contentContainerStyle={styles.questionPad} showsVerticalScrollIndicator={false}>
                          <Text style={styles.questionText}>{current.question}</Text>
                        </ScrollView>

                        <View style={styles.flipHint}>
                          <ThemedIcon name="eye-outline" size={20} color={colors.primary} />
                          <Text style={styles.flipHintTitle}>轻点翻面看答案</Text>
                          <Text style={styles.flipHintSub}>先自己想一想，再对答案更有效</Text>
                        </View>
                      </Pressable>
                    </Animated.View>

                    {/* 背面：参考答案 —— 轻点返回题目 */}
                    <Animated.View style={[styles.face, styles.faceBack, backStyle]}>
                      <Pressable
                        style={styles.faceInner}
                        onPress={() => {
                          haptics.light();
                          setRevealed(false);
                        }}
                        accessibilityLabel="翻回题目"
                      >
                        <View style={styles.head}>
                          <Text style={styles.headModule} numberOfLines={1}>{current.module} · 答案</Text>
                          <Text style={styles.headCount}>{safeIndex + 1} / {total}</Text>
                        </View>

                        <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerPad} showsVerticalScrollIndicator={false}>
                          <Text style={styles.answerLabel}>参考答案</Text>
                          <Text style={styles.answerText}>{current.answer.trim() || "（该题暂无答案记录）"}</Text>
                        </ScrollView>

                        <View style={styles.flipBackHint}>
                          <ThemedIcon name="refresh" size={13} color={colors.textMuted} />
                          <Text style={styles.flipBackHintText}>轻点返回题目</Text>
                        </View>
                      </Pressable>
                    </Animated.View>

                    {/* 切卡高斯模糊过渡：换字发生在完全模糊的一帧，看不到两张卡文字重叠 */}
                    <Animated.View pointerEvents="none" style={[styles.blurLayer, blurStyle]}>
                      <BlurView
                        intensity={30}
                        tint="light"
                        blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                        blurTarget={blurTarget ?? undefined}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </View>

              <View style={styles.footRow} pointerEvents="none">
                <ThemedIcon name="swap-horizontal" size={14} color={colors.textMuted} />
                <Text style={styles.footText}>左右滑动切题 · 点空白退出</Text>
              </View>
              <PressableScale
                onPress={exit}
                style={styles.closeBtn}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityLabel="退出快速过题"
              >
                <ThemedIcon name="close" size={18} color={colors.text} />
              </PressableScale>
            </>
          )}
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", alignItems: "center" },
    center: { alignItems: "center", justifyContent: "center", width: "100%" },
    stackWrap: { alignItems: "center", justifyContent: "center" },
    behindCard: {
      position: "absolute",
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: "#1C2430",
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headModule: { ...typography.caption, color: colors.primary, flex: 1 },
    headDiff: { ...typography.micro, color: colors.textMuted },
    headCount: { ...typography.micro, color: colors.textMuted },
    questionWrap: { flex: 1 },
    questionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    questionText: { ...typography.body, color: colors.text },
    face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: "hidden" },
    faceBack: { backgroundColor: colors.surfaceStrong },
    faceInner: { flex: 1 },
    answerScroll: { flex: 1 },
    answerPad: { padding: spacing.lg },
    answerLabel: { ...typography.caption, color: colors.primary, marginBottom: spacing.xs },
    answerText: { ...typography.callout, color: colors.text },
    flipHint: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
    },
    flipHintTitle: { ...typography.callout, fontWeight: "700", color: colors.primary },
    flipHintSub: { ...typography.meta, color: colors.textMuted },
    flipBackHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingBottom: spacing.md },
    flipBackHintText: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    blurLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    footRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
    footText: { ...typography.caption, color: colors.textMuted },
    closeBtn: {
      marginTop: spacing.md,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    empty: { ...typography.body, color: colors.text },
  });
