import { useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAnimatedScrollHandler, useSharedValue, type SharedValue } from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { resolveBackTarget } from "@/lib/back-target";
import { STICKY_HEADER_ROW as STICKY_ROW_HEIGHT } from "@/lib/pull-refresh-core";

/**
 * ScreenHeader v3：一级 Tab 不渲染返回栏；详情页返回栏放回文档流，避免覆盖状态栏与内容。
 *
 * `ScreenHeaderLargeTitle` 仍在滚动内容内部；`ScreenHeaderStickyBar` 只承担详情页的普通顶部导航。
 * 页面可继续用 `useLargeTitleHeader()` 统一拿滚动事件，组件不再依赖滚动值显示或隐藏返回栏。
 */

/** 状态栏之下的统一间距（替代此前 23 个页面里 +6~+24 的 8 种取值）：折叠栏/紧凑栏页 */
const HEADER_GAP = 6;
/**
 * 自绘 hero 页的间距（today/learn/settings 与 trackers/sports-card/account-security/domain-manager）。
 * hero 是一整块视觉（大图/大标题），不是紧凑导航栏，压到 +6 会"顶得太紧"、丢掉呼吸感；
 * 原值是 +16~+24，这里统一收到 +16 —— 既比原来克制，又保留层次。
 */
const HERO_GAP = 16;
/**
 * 详情页顶部栏仍统一占一行高度，保持历史页面间距与下拉刷新偏移不跳变。
 *
 * v19-S3：数值收单源 —— `STICKY_HEADER_ROW` 定义在 lib/pull-refresh-core.ts（纯逻辑、有单测），
 * 此处以别名引用；此前两处各写一份 44，漏改一处会导致下拉转圈与吸顶栏错位。
 */
/** 吸顶栏与内容的左右留白（与各页 contentContainerStyle 的 padding 16 对齐） */
const STICKY_GUTTER = 16;

/**
 * 一级 Tab 没有“返回上一页”的语义，旧版悬浮紧凑栏会在首页制造悬挂返回键。
 * 一级 Tab 直接不渲染紧凑头；详情页改为普通文档流头部，不再覆盖内容。
 */
const TAB_ROOT_PATHS = new Set(["/today", "/learn", "/career", "/wellness", "/settings"]);

function isTabRootPath(pathname: string): boolean {
  const normalized = pathname
    .split("/")
    .filter((segment) => !segment.startsWith("(") || !segment.endsWith(")"))
    .join("/")
    .replace(/\/+/g, "/");
  return TAB_ROOT_PATHS.has(normalized || "/");
}

/** 页面统一取顶部安全区 + 组件间距（自绘 hero 的页面用，避免再写 insets.top + N 魔数） */
function resolveTopInset(insetTop: number) {
  return Math.max(
    insetTop,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0,
  );
}

export function useHeaderTopInset(variant: "compact" | "hero" = "compact"): number {
  const insets = useSafeAreaInsets();
  const topInset = resolveTopInset(insets.top);
  return topInset + (variant === "hero" ? HERO_GAP : HEADER_GAP);
}

/**
 * 统一挂载页面滚动事件。预览与下拉刷新仍复用同一套事件入口。
 *
 * 用法（**两种容器必须用不同的 prop，别混**）：
 * - `<Animated.ScrollView onScroll={header.onScroll} scrollEventThrottle={16} />`
 * - `<FlatList / FlashList onScroll={header.onScrollJS} scrollEventThrottle={16} />`
 * 再配 `<ScreenHeaderLargeTitle …/>`（内容内）+ `<ScreenHeaderStickyBar …/>`（内容外）。
 */
export function useLargeTitleHeader(): {
  scrollY: SharedValue<number>;
  /** Reanimated 的事件处理器：**只能**挂到 `Animated.*` 容器上（见下面的 ⚠️） */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** 普通 `FlatList` / `FlashList` / `ScrollView` 必须用这个 */
  onScrollJS: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const scrollY = useSharedValue(0);
  // ⚠️ CLAUDE.md worklet 硬约束：worklet 内只读写共享值 + Reanimated API；
  // scrollY 在 worklet 之前声明。
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  /**
   * ⚠️⚠️ 2026-09-29 真机闪退**真根因**（v1.32.2 修）：
   * `useAnimatedScrollHandler()` 返回的**不是函数**，而是 Reanimated `useEvent()` 的返回值 ——
   * 一个 `{ workletEventHandler }` **对象**；只有 `Animated.createAnimatedComponent` 认得这个形状
   * （Reanimated 源码注释："we handle it being a React Ref in createAnimatedComponent"）。
   *
   * 普通列表把它当普通 prop **直接调用**：FlashList v2 的源码里就是
   * `recyclerViewManager.props.onScroll?.(event)`（dist/recyclerview/RecyclerView.js:188），
   * 调用一个对象 → `TypeError: undefined is not a function` → RN 判为 fatal JS error
   * → 抛 Java 异常 → **进程直接死**（ApplicationExitInfo = CRASH(4)）。
   * 真机表现就是「招花岗位列表一往下滑就闪退」（jobs 是全仓唯一的 FlashList）。
   *
   * 所以：**非 Animated 容器一律用 onScrollJS** —— 一个真的 JS 函数，在 JS 线程写共享值
   * （scrollEventThrottle 16ms 足够驱动吸顶栏，代价可忽略）。
   * 回归护栏见 `src/lib/scroll-handler-guard.test.ts`。
   */
  const onScrollJS = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // 用 `.set()` 而不是 `.value =`：后者会被 React Compiler 的 immutability 规则拦下（lint error）
      scrollY.set(e.nativeEvent.contentOffset.y);
    },
    [scrollY]
  );
  return { scrollY, onScroll, onScrollJS };
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
 * 大标题块放进滚动容器内部，随内容自然滚走。
 */
export function ScreenHeaderLargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = resolveTopInset(insets.top);
  const pathname = usePathname();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topPadding = isTabRootPath(pathname) ? topInset + HERO_GAP : HEADER_GAP;
  return (
    <View style={[styles.largeInFlow, { paddingTop: topPadding }]}>
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

/** 详情页顶部栏：滚动容器外、状态栏下方的一行普通文档流导航。 */
export function ScreenHeaderStickyBar({
  title,
  backTo,
  right,
}: {
  title: string;
  backTo?: string;
  scrollY?: SharedValue<number>;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = resolveTopInset(insets.top);
  const pathname = usePathname();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const goBack = useGoBack(backTo);
  if (isTabRootPath(pathname)) return null;

  return (
    <View style={[styles.stickyWrap, { paddingTop: topInset }]}>
      <View style={styles.stickyBg} pointerEvents="none" />
      <View style={styles.stickyRow}>
        <Pressable
          hitSlop={8}
          onPress={goBack}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ThemedIcon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.text} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ? (
          <View style={styles.right}>
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
    /** 大标题块（在滚动内容里）——只补顶部让位，左右留白由页面 content 的 padding 提供 */
    largeInFlow: { paddingBottom: 6, gap: 2 },
    /** 详情页顶部栏只占一行，绝不铺满全屏 */
    stickyWrap: {
      position: "relative",
      justifyContent: "center",
      backgroundColor: colors.canvas,
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
