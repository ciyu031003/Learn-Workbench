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
  const pathname = usePathname();
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

  const goBack = () => {
    /**
     * v17-B：导航栈已真实存在（根 <Stack> 包 (tabs) + 子页），所以**优先 pop** ——
     * 才有原生返回动画，且回到的一定是真正的上一页。resolveBackTarget 只作无栈历史兜底
     * （深链直达、冷启动、外部协议唤起）。
     */
    const canPop = typeof router.canGoBack === "function" && router.canGoBack();
    if (canPop) {
      router.back();
      return;
    }
    router.replace((backTo ?? resolveBackTarget(pathname)) as never);
  };

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
    // compactOnly 仅用于保持 makeStyles 依赖签名（样式差异走外层样式数组）
    ...(compactOnly ? {} : {}),
  });
