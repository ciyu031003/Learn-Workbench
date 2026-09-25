/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
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
  subtitle,
  icon,
  headerAction,
  segmented,
  footer,
  footerHint,
  children,
  body,
  expandable = false,
  height = "50%",
  scroll = true,
  onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** v16：标题下一行小字（把"选择 ≠ 开始"这类规则直接写在界面上） */
  subtitle?: string;
  /** v16：标题左侧图标徽章 */
  icon?: Parameters<typeof ThemedIcon>[0]["name"];
  /** v16：右上角动作（如"重置"），渲染在关闭钮左侧 */
  headerAction?: ReactNode;
  /** v16：头部下方的分段槽位（固定不滚动，适合 2–4 段切换） */
  segmented?: ReactNode;
  /** v16：吸底 CTA —— 内容滚动、按钮不动（自带底部安全区） */
  footer?: ReactNode;
  /** v16：吸底 CTA 下方一句规则/说明 */
  footerHint?: string;
  children?: ReactNode;
  body?: (expanded: boolean) => ReactNode;
  expandable?: boolean;
  height?: string;
  /** 是否内置滚动容器（内容自带 ScrollView 时传 false） */
  scroll?: boolean;
  /**
   * 退场动画结束、Modal 真正卸载后调用。
   * 用途：需要"关掉这个弹层再打开另一个全屏 Modal"时，必须等它卸载完再开，
   * 否则 Android/iOS 上会出现两个 Modal 同时 present（iOS 常见表现是第二个不出现）。
   */
  onClosed?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  /**
   * 高度基准一律用**屏幕高度**（`Dimensions.get("screen")`），不用 `useWindowDimensions()`：
   * Android `adjustResize` 在键盘弹出时会把 window 变矮，若拿它当基准，
   * 弹层高度会跟着缩小 → 视觉上"顶边往下缩"（v1.4.0 真机反馈）。
   * "窗口是否已被键盘 resize 吃掉一部分"改用**实测根容器高度**判断（见 eatenByResize）。
   */
  const screenHeight = Dimensions.get("screen").height;
  const ratio = parsePercent(height, 0.5);
  /**
   * 高度基准用"屏幕高 − 状态栏 − 底部安全区"，而不是裸 screen 高度：
   * 0.92/0.94 档若按裸屏高算，顶边会落进状态栏（审查发现）。
   * 这个基准对键盘免疫（不随窗口 resize 变化），配合下面的 `eatenByResize` 做自校正。
   */
  const usableScreen = Math.max(240, screenHeight - insets.top - insets.bottom);
  const collapsed = usableScreen * ratio;
  const full = usableScreen * 0.94;
  const maxOffset = Math.max(0, full - collapsed);

  // 收起态 = 停在 collapsed 高度；展开态 = 上移 maxOffset
  const restOffset = expandable ? maxOffset : 0;
  const [mounted, setMounted] = useState(visible);
  /** 根容器实测高度：判断窗口是否已被键盘 resize 吃掉一部分（见 eatenByResize） */
  const [rootH, setRootH] = useState(screenHeight);
  const [expanded, setExpanded] = useState(false);

  /** 键盘高度（reanimated 共享值；键盘收起时为 0） */
  const keyboardAnim = useReanimatedKeyboardAnimation().height;
  const translateY = useSharedValue(collapsed);
  const dragBase = useSharedValue(restOffset);
  const scrim = useSharedValue(0);

  // ⚠️ 顺序约束（v1.4.2 真机崩溃根因，见看板踩坑 78）：worklet 会在**定义处**
  // 快照它引用的自由变量 —— 下面这些量都被 panGesture 的 worklet 读取，
  // 因此必须声明在 tapGesture / panGesture / useAnimatedStyle **之前**。
  // 一旦挪到后面，worklet 里拿到的是 undefined（产物把 const 降级成 var，不报 TDZ），
  // 读 .value 会在 UI 线程抛 TypeError → Android 直接闪退。
  const sheetHeight = expandable ? full : collapsed;
  /** 弹层顶边允许到达的最高位置（减掉状态栏 + 底部安全区） */
  const maxSheetHeight = Math.max(160, usableScreen);

  /**
   * 键盘避让（v1.4.0 反馈："搜索框往下缩，更看不到内容"）——**自校正**几何，两个平台都对：
   *
   * 关键事实：Android 的 Modal 是 Dialog，RN 给它设了 `ADJUST_RESIZE` → 键盘弹出时**窗口自己就变矮**
   * （`useWindowDimensions()` 会变小），而 iOS 的 Modal 全屏、窗口不变。
   * 因此"要补多少"取决于窗口是否已经把键盘高度吃掉：
   *   - iOS：`winH ≈ screenH` → `eaten = 0` → 需要整体上抬 `kb`
   *   - Android：`winH ≈ screenH - kb` → `eaten ≈ kb` → **不需要再抬**（否则就是之前那种双重补偿）
   *
   * 同时**按键盘高度收缩高度**（而不是恒定高度）：高弹层（82%/92%）若不收缩，
   * 顶边会被变矮的窗口裁掉（标题/搜索框看不见）——这是审查发现的阻断点。
   *   `height = min(sheetHeight, usableScreen - kb)`：顶边永远 ≥ 安全区；
   *   `lift   = max(0, kb - eaten)`：底边永远贴在键盘上沿。
   *
   * `eaten` 用**实测根容器高度**（onLayout）而不是 `useWindowDimensions()`：
   * Modal 是独立 Window，`useWindowDimensions` 在其中是否反映 Dialog 的 resize 语义不够确定；
   * onLayout 给的是真实布局高度 —— Android 被 resize 时 rootH ≈ screenH - kb → eaten ≈ kb → 不再上抬；
   * iOS 全屏 rootH ≈ screenH → eaten = 0 → 整体上抬 kb。
   */
  const eatenByResize = useDerivedValue(() => Math.max(0, screenHeight - rootH));
  const lift = useDerivedValue(() => {
    const kb = Math.abs(keyboardAnim.value);
    return Math.max(0, kb - eatenByResize.value);
  });

  /**
   * 把 collapsed / restOffset 放进共享值，供"滑入滑出" effect 读取：
   * 若把它们留在依赖数组里，键盘/窗口尺寸变化会重播滑入动画（弹层会从下方重新弹一次）。
   * 这个同步 effect 必须声明在滑入 effect **之前**（effect 按声明顺序执行）。
   */
  const collapsedSV = useSharedValue(collapsed);
  const restOffsetSV = useSharedValue(restOffset);
  useEffect(() => {
    collapsedSV.value = collapsed;
    restOffsetSV.value = restOffset;
  }, [collapsed, restOffset, collapsedSV, restOffsetSV]);

  // 滑入 / 滑出（Modal 不做动画，全部自己实现）
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setExpanded(false);
      translateY.value = collapsedSV.value;
      dragBase.value = restOffsetSV.value;
      scrim.value = withTiming(1, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
      // 静止位 = restOffset：非展开弹层是 0；可展开弹层是 maxOffset
      // （元素本身按 full 高度渲染，靠 translateY 下移露出 height 比例的高度）——
      // 这样「上滑到全屏」才有可拖的余量（v6 决策 D12）。
      translateY.value = withTiming(restOffsetSV.value, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      scrim.value = withTiming(0, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(collapsedSV.value, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) {
          runOnJS(setMounted)(false);
          if (onClosedRef.current) runOnJS(onClosedRef.current)();
        }
      });
    }
    // 只在 visible/mounted 变化时播动画（collapsed/restOffset 走上面的共享值同步，不进依赖）
  }, [visible, mounted, scrim, translateY, dragBase, collapsedSV, restOffsetSV]);

  const close = useCallback(() => {
    setExpanded(false);
    onClose();
  }, [onClose]);

  /** 用 ref 持有最新回调，避免把它写进 worklet 的依赖里（渲染期不写 ref，走 effect） */
  const onClosedRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

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
        // 非展开态：下滑关闭。阈值把键盘抬起量算进去，
        // 否则视觉上弹层已被 lift 抬起、用户却要多拖 lift 像素才触发关闭（审查发现）
        if (current - lift.value > 110 || e.velocityY > 900) {
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


  const animatedSheet = useAnimatedStyle(() => {
    const kb = Math.abs(keyboardAnim.value);
    const available = Math.max(160, maxSheetHeight - kb);
    return {
      height: Math.min(sheetHeight, available),
      transform: [{ translateY: translateY.value - lift.value }],
      opacity: 0.6 + scrim.value * 0.4,
    };
  });
  const animatedScrim = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const content = body ? body(expanded) : children;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {/*
        必须再包一层 `GestureHandlerRootView`：Android 的 Modal 是独立 Window，
        主 Window 的根 view（_layout.tsx 里那个）收不到它的触摸流 →
        Modal 内的 Pan/Pinch（LiveLog 拖贴纸、portion-slider 等）会**静默失效**（v1.4.0 反馈）。
        注意：下拉关闭手势只挂在 grabber 区（handleZone），内容区滚动不受它影响。
      */}
      <GestureHandlerRootView style={styles.root} onLayout={(e) => setRootH(e.nativeEvent.layout.height)}>
        <Animated.View style={[styles.scrimWrap, animatedScrim]}>
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="关闭弹层" />
        </Animated.View>

        <Animated.View style={[styles.sheetWrap, animatedSheet]}>
          {/* opaque：弹窗必须是实底（玻璃会"看穿"到底部内容） */}
          <GlassSurface corner={SHEET_CORNER} padded={false} opaque style={styles.sheet}>
            <GestureDetector gesture={handleGesture}>
              <View style={styles.handleZone} accessibilityRole="adjustable">
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            <View style={styles.head}>
              {icon ? (
                <View style={styles.headIcon}>
                  <ThemedIcon name={icon} size={16} color={colors.primary} />
                </View>
              ) : null}
              <View style={styles.headText}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
              </View>
              {headerAction ? <View style={styles.headAction}>{headerAction}</View> : null}
              <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel="关闭">
                <ThemedIcon name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {segmented ? <View style={styles.segmentedWrap}>{segmented}</View> : null}

            <View style={styles.flex}>
              {scroll ? (
                <ScrollView
                  style={styles.flex}
                  // 有吸底 footer 时，底部安全区由 footer 承担，内容只留一点呼吸
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: footer ? 16 : insets.bottom + 16 },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {content}
                </ScrollView>
              ) : (
                <View style={[styles.flex, { paddingBottom: footer ? 8 : insets.bottom + 8 }]}>{content}</View>
              )}
            </View>

            {/* v16 吸底 CTA：不在 ScrollView 内，内容再长按钮也不会被推走 */}
            {footer ? (
              <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                {footer}
                {footerHint ? <Text style={styles.footerHint}>{footerHint}</Text> : null}
              </View>
            ) : null}
          </GlassSurface>
        </Animated.View>
      </GestureHandlerRootView>
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
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    headText: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.title2, fontWeight: "700", color: colors.text },
    subtitle: { ...typography.caption, color: colors.textMuted },
    headAction: { flexDirection: "row", alignItems: "center" },
    segmentedWrap: { marginBottom: 12 },
    footer: {
      gap: 8,
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerHint: { ...typography.micro, color: colors.textMuted, textAlign: "center" },
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
