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

/**
 * ScreenHeader v2（v17-C2）：受滚动驱动的**双态折叠栏**。
 *
 * 设计（对齐 iOS Large Title 的心智，但跨平台自绘、保持 headerShown:false 的既有语言）：
 *   静止态 = 大标题（typography.display）+ 副标题，随内容一起上滚；
 *   滚过阈值 = 折叠为紧凑栏（小标题 + 返回键），吸附在页面顶部。
 *
 * 与旧版的兼容：**旧调用点一行都不用改** —— 不传 `large` 时行为与旧版一致（紧凑栏）。
 * 想要折叠栏的页面用 `useLargeTitleHeader()` 拿到 scrollY/onScroll，把 onScroll 挂到自己
 * 的 Animated.ScrollView 上、并把 scrollY 传给本组件即可。
 *
 * 顶部留白也收归组件：组件自己吃 insets.top + HEADER_GAP，页面不再手写 padding。
 * 自绘 hero 的页面可用导出的 `useHeaderTopInset()` 取同一个间距，保持全 App 一致。
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
/** 大标题块的高度（折叠时同步收到 0，避免留下空白） */
const LARGE_BLOCK_HEIGHT = 62;
/**
 * v17-C2b 真吸顶：紧凑栏独立成层后，它占用的**一行**高度。
 * 大标题块（在滚动内容里）要给这一行让位，否则静止态会被吸顶栏压住。
 */
const STICKY_ROW_HEIGHT = 44;
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
 * 与 `<ScreenHeader large scrollY={header.scrollY} ... />`
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

export function ScreenHeader({
  title,
  subtitle,
  compact = false,
  backTo,
  large = false,
  scrollY,
  right,
}: {
  title: string;
  subtitle?: string;
  /** 旧参数：紧凑栏（不显示大标题）。传了 large 时忽略 */
  compact?: boolean;
  /** 无导航历史时的兜底返回目标；默认按当前路径解析到所属 Hub */
  backTo?: string;
  /** v2：大标题折叠栏 */
  large?: boolean;
  /** v2：由 useLargeTitleHeader() 提供的滚动值；缺失时大标题静态展开（不折叠） */
  scrollY?: SharedValue<number>;
  /** v2：右侧动作区（替代各页自己塞按钮） */
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  /**
   * 减弱动态下**不做折叠动画**：直接渲染紧凑栏（功能完整、无动画），
   * 既满足"尊重减弱动态"，也避免为了降级而在 worklet 里读 JS 布尔值（CLAUDE.md 硬约束）。
   */
  const collapsible = large && !reduced && !!scrollY;
  const styles = useMemo(
    () => makeStyles(colors, compact || !large || reduced),
    [colors, compact, large, reduced]
  );

  const progress = useDerivedValue(() => {
    if (!collapsible) return 0;
    const y = scrollY ? scrollY.value : 0;
    const p = y / COLLAPSE_RANGE;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }, [collapsible]);

  // 大标题：上移 + 淡出 + 高度收起（避免折叠后残留空白）
  const largeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0, 1], [0, -10], Extrapolation.CLAMP) }],
      height: interpolate(p, [0, 1], [LARGE_BLOCK_HEIGHT, 0], Extrapolation.CLAMP),
    };
  });

  // 紧凑小标题：随进度交叉淡入
  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // v17-C2b：返回逻辑抽成 useGoBack，供本组件与新的 ScreenHeaderStickyBar 共用（行为不变）
  const goBack = useGoBack(backTo);

  const BackButton = (
    <Pressable
      hitSlop={8}
      onPress={goBack}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="返回"
    >
      <ThemedIcon name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );

  const Right = right ? <View style={styles.right}>{right}</View> : null;

  if (!large || reduced) {
    // 旧行为（也是减弱动态下的降级）：单行紧凑栏
    return (
      <View style={[styles.root, { paddingTop: insets.top + HEADER_GAP }]}>
        {BackButton}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {Right}
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.rootLarge, { paddingTop: insets.top + HEADER_GAP }]}>
      {/* 大标题块：随滚动收起 */}
      <Animated.View style={[styles.largeBlock, largeStyle]} pointerEvents="none">
        <Text style={styles.largeTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {/* 紧凑栏：大标题收起后接管（返回键 + 小标题恒在此行，避免折叠时布局跳动） */}
      <View style={styles.compactRow}>
        {BackButton}
        <Animated.View style={[styles.text, compactTitleStyle]}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        {Right}
      </View>
    </View>
  );
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
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
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
  const styles = useMemo(() => makeStyles(colors, false), [colors]);
  const goBack = useGoBack(backTo);
  const animated = !reduced && !!scrollY;

  const progress = useDerivedValue(() => {
    if (!animated || !scrollY) return 0;
    const p = scrollY.value / COLLAPSE_RANGE;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }, [animated, scrollY]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: animated ? interpolate(progress.value, [0.2, 1], [0, 1], Extrapolation.CLAMP) : 1,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: animated ? interpolate(progress.value, [0.45, 1], [0, 1], Extrapolation.CLAMP) : 1,
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

const makeStyles = (colors: ThemeColors, compactOnly: boolean) =>
  StyleSheet.create({
    root: { flexDirection: "row", alignItems: "center", gap: 10 },
    /** large 模式是纵向两段（大标题块 + 紧凑行） */
    rootLarge: { flexDirection: "column", alignItems: "stretch", gap: 0 },
    largeBlock: { justifyContent: "flex-end", overflow: "hidden", gap: 2 },
    compactRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
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
    // compactOnly 仅用于保持 makeStyles 依赖签名（样式差异走外层样式数组）
    ...(compactOnly ? {} : {}),
  });
