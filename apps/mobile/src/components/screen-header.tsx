import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { resolveBackTarget } from "@/lib/back-target";
import { useReducedMotion } from "@/lib/motion";
import { STICKY_HEADER_ROW as STICKY_ROW_HEIGHT } from "@/lib/pull-refresh-core";

/**
 * ScreenHeader v2（v17-C2）：受滚动驱动的**双态折叠栏**（真吸顶三件套）。
 *
 * 设计（对齐 iOS Large Title 的心智，但跨平台自绘、保持 headerShown:false 的既有语言）：
 *   `ScreenHeaderLargeTitle` 放进滚动内容**内部**随内容滚走；
 *   `ScreenHeaderStickyBar` 是滚动容器**之外**的兄弟节点，滚过阈值后吸顶淡入。
 *   页面用 `useLargeTitleHeader()` 拿 scrollY/onScroll，挂到自己的 Animated.ScrollView 上。
 *
 * 顶部留白收归组件：组件自己吃 insets.top + HEADER_GAP，页面不再手写 padding。
 * 自绘 hero 的页面可用导出的 `useHeaderTopInset()` 取同一个间距，保持全 App 一致。
 * （v19-S5：旧版单组件 `ScreenHeader` 已删——真吸顶落地后全仓库零消费。）
 */

/** 折叠行程：滚动多少像素完成"大标题 → 紧凑栏"的过渡（≈ 一个导航栏的高度） */
const COLLAPSE_RANGE = 44;
/** 状态栏之下的统一间距（替代此前 23 个页面里 +6~+24 的 8 种取值）：折叠栏/紧凑栏页 */
const HEADER_GAP = 6;
/**
 * 自绘 hero 页的间距（today/learn/settings 与 trackers/sports-card/account-security/domain-manager）。
 * hero 是一整块视觉（大图/大标题），不是紧凑导航栏，压到 +6 会"顶得太紧"、丢掉呼吸感；
 * 原值是 +16~+24，这里统一收到 +16 —— 既比原来克制，又保留层次。
 */
const HERO_GAP = 16;
/**
 * v17-C2b 真吸顶：紧凑栏独立成层后，它占用的**一行**高度。
 * 大标题块（在滚动内容里）要给这一行让位，否则静止态会被吸顶栏压住。
 *
 * v19-S3：数值收单源 —— `STICKY_HEADER_ROW` 定义在 lib/pull-refresh-core.ts（纯逻辑、有单测），
 * 此处以别名引用；此前两处各写一份 44，漏改一处会导致下拉转圈与吸顶栏错位。
 */
/** 吸顶栏与内容的左右留白（与各页 contentContainerStyle 的 padding 16 对齐） */
const STICKY_GUTTER = 16;

/** 页面统一取顶部安全区 + 组件间距（自绘 hero 的页面用，避免再写 insets.top + N 魔数） */
export function useHeaderTopInset(variant: "compact" | "hero" = "compact"): number {
  const insets = useSafeAreaInsets();
  return insets.top + (variant === "hero" ? HERO_GAP : HEADER_GAP);
}

/**
 * 拿到大标题折叠所需的滚动驱动。
 * 用法：`const header = useLargeTitleHeader();` → `<Animated.ScrollView onScroll={header.onScroll} scrollEventThrottle={16} />`
 * 与 `<ScreenHeaderLargeTitle …/>`（内容内）+ `<ScreenHeaderStickyBar scrollY={header.scrollY} …/>`（内容外）。
 */
export function useLargeTitleHeader(): {
  scrollY: SharedValue<number>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const scrollY = useSharedValue(0);
  // ⚠️ CLAUDE.md worklet 硬约束：worklet 内只读写共享值 + Reanimated API；
  // scrollY 在 worklet 之前声明。
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

/**
 * 返回：优先真实 pop（阶段 B 后栈是真实存在的，才有原生返回动画），
 * 无栈历史（深链直达/冷启动/外部协议）时兜底回所属 Hub。
 */
function useGoBack(backTo?: string): () => void {
  const pathname = usePathname();
  return () => {
    const canPop = typeof router.canGoBack === "function" && router.canGoBack();
    if (canPop) {
      router.back();
      return;
    }
    router.replace((backTo ?? resolveBackTarget(pathname)) as never);
  };
}

/**
 * v17-C2b（真吸顶）：大标题块 —— 放进滚动容器**内部**，随内容自然滚走。
 *
 * 为什么这里不做高度动画：大标题块本身已在滚动流里，滚动就会把它带走；再叠一层 height 动画
 * 会与滚动位移打架（折叠瞬间"跳一下"）。高度动画只适用于旧版「整块头部在滚动容器之外」的形态。
 */
export function ScreenHeaderLargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.largeInFlow, { paddingTop: insets.top + STICKY_ROW_HEIGHT + HEADER_GAP }]}>
      <Text style={styles.largeTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * v17-C2b（真吸顶）：紧凑栏 —— 必须是滚动容器**之外**的兄弟节点，绝对定位在状态栏下方**一行**高度。
 *
 * 触摸安全（OPPO/ColorOS 历史坑）：外层 pointerEvents="box-none" 且高度只有一行，
 * 空白处的手势会穿透到下面的滚动内容，只有返回键与右侧动作可点 —— **不是全屏覆盖层**。
 * 减弱动态时不做渐显，紧凑栏常显（功能完整、无动画）。
 */
export function ScreenHeaderStickyBar({
  title,
  backTo,
  scrollY,
  right,
}: {
  title: string;
  backTo?: string;
  scrollY?: SharedValue<number>;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const goBack = useGoBack(backTo);
  const animated = !reduced && !!scrollY;

  const progress = useDerivedValue(() => {
    if (!animated || !scrollY) return 0;
    const p = scrollY.value / COLLAPSE_RANGE;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }, [animated, scrollY]);

  /**
   * 真机反馈修复：吸顶栏的**背景与小标题必须同区间淡入**。
   * 原来是 背景 [0.2,1] / 小标题 [0.45,1] —— 于是 p 在 0.2~0.45 之间会出现
   * 「背景已经不透明、但一个字都没有」的空条，用户看到的正是页面顶部那块"空白面板"
   * （内容较短的页面尤其明显：轻微滑动就落进这个区间并停住）。
   */
  const STICKY_FADE: [number, number] = [0.35, 1];
  const bgStyle = useAnimatedStyle(() => ({
    opacity: animated ? interpolate(progress.value, STICKY_FADE, [0, 1], Extrapolation.CLAMP) : 1,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: animated ? interpolate(progress.value, STICKY_FADE, [0, 1], Extrapolation.CLAMP) : 1,
  }));

  return (
    <View style={[styles.stickyWrap, { top: insets.top }]} pointerEvents="box-none">
      <Animated.View style={[styles.stickyBg, bgStyle]} pointerEvents="none" />
      <View style={styles.stickyRow} pointerEvents="box-none">
        <Pressable
          hitSlop={8}
          onPress={goBack}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ThemedIcon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Animated.View style={[styles.text, titleStyle]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        {right ? (
          <View style={styles.right} pointerEvents="box-none">
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    back: {
      // 触控目标 ≥40（配合 hitSlop 8 → 有效 ≥56）
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.headline, fontWeight: "700", color: colors.text },
    largeTitle: { ...typography.display, color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    right: { flexDirection: "row", alignItems: "center", gap: 8 },
    /** v17-C2b：大标题块（在滚动内容里）——只补顶部让位，左右留白由页面 content 的 padding 提供 */
    largeInFlow: { paddingBottom: 6, gap: 2 },
    /** v17-C2b：真吸顶紧凑栏 —— 只占一行，绝不铺满全屏 */
    stickyWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      height: STICKY_ROW_HEIGHT,
      zIndex: 20,
      justifyContent: "center",
    },
    stickyBg: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    stickyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: STICKY_ROW_HEIGHT,
      paddingHorizontal: STICKY_GUTTER,
    },
  });
