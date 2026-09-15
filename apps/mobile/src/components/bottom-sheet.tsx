/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { GlassSurface, glassSupported } from "@/components/surface";
import { motion, radius, shadows, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

function parsePercent(value: string, fallback = 0.5) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0.12, Math.min(0.98, n / 100)) : fallback;
}

const SLIDE_IN = motion.standard.duration;
const SLIDE_OUT = 180;
/** HIG Sheets：顶部圆角比常规卡大一档 */
const SHEET_CORNER = radius.xl + 4;

/**
 * 底部弹层 v2（见 docs/APP端优化方案-v2 §Bug 3）
 *
 * 相对旧实现的 5 个修复：
 * 1. **键盘避让**：内置 `KeyboardAvoidingView`（iOS padding），输入框不再被键盘挡住
 * 2. **可滚动**：内置 `ScrollView`（`scroll` 默认开）+ `keyboardShouldPersistTaps="handled"`，
 *    长表单能滚到底部按钮（自带 ScrollView 的调用方传 `scroll={false}`，避免嵌套滚动）
 * 3. **安全区**：滚动内容底部留 `insets.bottom + 16`
 * 4. **头部**：grabber 36×5、标题左对齐 17/700、关闭钮 28×28 淡底、标题与内容间距 12
 * 5. **动效**：`Modal animationType="none"`，自己用 `translateY` + 遮罩淡入滑入（无内部弹簧叠加）
 *
 * 材质：iOS 走 `GlassView`（真液态玻璃），其它平台回落 `elevated` 实底；
 * 下滑关闭与「一次只 present 一个 sheet」保持 HIG 行为。
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  body,
  expandable = false,
  height = "50%",
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  body?: (expanded: boolean) => ReactNode;
  expandable?: boolean;
  height?: string;
  /** 是否内置滚动容器（内容自带 ScrollView 时传 false） */
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const ratio = parsePercent(height, 0.5);
  const collapsed = winH * ratio;
  const full = winH * 0.94;
  const maxOffset = Math.max(0, full - collapsed);

  // 收起态 = 停在 collapsed 高度；展开态 = 上移 maxOffset
  const restOffset = expandable ? maxOffset : 0;
  const [mounted, setMounted] = useState(visible);
  const [expanded, setExpanded] = useState(false);

  const translateY = useSharedValue(collapsed);
  const dragBase = useSharedValue(restOffset);
  const scrim = useSharedValue(0);

  // 滑入 / 滑出（Modal 不做动画，全部自己实现）
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setExpanded(false);
      translateY.value = collapsed;
      dragBase.value = restOffset;
      scrim.value = withTiming(1, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      scrim.value = withTiming(0, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(collapsed, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, collapsed, restOffset, scrim, translateY, dragBase]);

  const close = useCallback(() => {
    setExpanded(false);
    onClose();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (!expandable) return;
    setExpanded((prev) => {
      const next = !prev;
      translateY.value = withTiming(next ? 0 : maxOffset, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
      dragBase.value = next ? 0 : maxOffset;
      return next;
    });
  }, [expandable, dragBase, maxOffset, translateY]);

  const tapGesture = Gesture.Tap()
    .enabled(expandable)
    .maxDuration(220)
    .onEnd(() => {
      runOnJS(toggle)();
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      dragBase.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, dragBase.value + e.translationY);
    })
    .onEnd((e) => {
      const current = dragBase.value + e.translationY;
      if (!expandable) {
        // 非展开态：下滑关闭
        if (current > 110 || e.velocityY > 900) {
          runOnJS(close)();
        } else {
          translateY.value = withTiming(0, { duration: SLIDE_OUT, easing: Easing.out(Easing.cubic) });
        }
        return;
      }
      if (current > maxOffset + 90) {
        runOnJS(close)();
      } else if (current < maxOffset * 0.5 || e.velocityY < -500) {
        translateY.value = withTiming(0, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
        runOnJS(setExpanded)(true);
      } else {
        translateY.value = withTiming(maxOffset, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
        runOnJS(setExpanded)(false);
      }
    });

  const handleGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 0.6 + scrim.value * 0.4,
  }));
  const animatedScrim = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const sheetHeight = expandable ? full : collapsed;
  const content = body ? body(expanded) : children;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.scrimWrap, animatedScrim]}>
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="关闭弹层" />
        </Animated.View>

        <Animated.View style={[styles.sheetWrap, { height: sheetHeight }, animatedSheet]}>
          <GlassSurface corner={SHEET_CORNER} padded={false} style={styles.sheet}>
            <GestureDetector gesture={handleGesture}>
              <View style={styles.handleZone} accessibilityRole="adjustable">
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel="关闭">
                <ThemedIcon name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              {scroll ? (
                <ScrollView
                  style={styles.flex}
                  contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {content}
                </ScrollView>
              ) : (
                <View style={[styles.flex, { paddingBottom: insets.bottom + 8 }]}>{content}</View>
              )}
            </KeyboardAvoidingView>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    scrimWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    scrim: { flex: 1, backgroundColor: colors.scrim },
    sheetWrap: { width: "100%" },
    sheet: {
      flex: 1,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: SHEET_CORNER,
      borderTopRightRadius: SHEET_CORNER,
      paddingHorizontal: 16,
      // iOS 有真玻璃，阴影交给系统；其它平台用轻阴影表达层级
      ...(glassSupported() ? null : shadows.floating),
    },
    handleZone: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
    grabber: { width: 36, height: 5, borderRadius: 999, backgroundColor: colors.borderStrong },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    title: { flex: 1, minWidth: 0, ...typography.title2, fontWeight: "700", color: colors.text },
    close: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1 },
    scrollContent: { gap: 12 },
  });
