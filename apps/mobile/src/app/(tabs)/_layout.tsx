import { useEffect, useMemo } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View, type OpaqueColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/lib/use-tab-bar-space";
import { haptics } from "@/lib/haptics";
import { SPRING, useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 一级 Tab 布局（v17 阶段 B：从根 _layout.tsx 整体搬进来；阶段 C3：底栏材质升级）。
 *
 * 存在的意义：根布局改为 <Stack> 之后，"一级 Tab" 必须有自己的嵌套布局，
 * 这样 hub → 子页 才是真正的 push（有原生转场 / 侧滑返回 / 预测性返回），
 * 而不是过去那种"所有页面平铺成 href:null 的 Tab、切换只是瞬时替换"。
 *
 * `(tabs)` 是**括号分组**，不进 URL —— /today、/learn、/career、/wellness、
 * /settings、/、/dashboard 与迁移前完全一致。
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ *
 * 材质三档（v17 C3，方案 §4.1）
 *  1. iOS 26+        → expo-glass-effect 的 GlassView（真液态玻璃）
 *  2. Android / <26  → 实底 + 高透明降档（无 blur，见下方注释的取舍）
 *  3. 低端机         → 材质不变，仅关掉装饰动效（isMotionActive / MOTION_ENABLED）
 * 决策 D3：**不引入 expo-blur**（原生依赖、不能 OTA，且 ColorOS 上真模糊代价高）。
 * ------------------------------------------------------------------ */

/** iOS 26 且运行时 API 可用时才有真玻璃；非 iOS 或系统不支持返回 false */
function liquidGlassAvailable(): boolean {
  try {
    return Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // 极老版本 / 能力探测异常：安全回退到实底，绝不因为材质让底栏消失
    return false;
  }
}

/**
 * 底栏材质层。
 *
 * Android 没有系统级 blur，所以"更透"必须与**可读性**折中：
 * 底栏下方是滚动内容，透明度压太低（<80%）会让标签与图标在花背景上糊掉。
 * 因此这里用 85% canvas + 中性 hairline + 更柔的投影来换"轻"，而不是一味加透明度。
 */
function TabBarMaterial({ dark, styles, glass }: { dark: boolean; styles: Styles; glass: boolean }) {
  if (glass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={dark ? "dark" : "light"}
        style={styles.tabBarGlassIos}
      >
        <View style={styles.tabBarHighlight} pointerEvents="none" />
      </GlassView>
    );
  }
  return (
    <View style={styles.tabBarGlass} pointerEvents="none">
      <View style={styles.tabBarTint} pointerEvents="none" />
      <View style={styles.tabBarHighlight} pointerEvents="none" />
    </View>
  );
}

/**
 * Tab 图标：选中弹跳 + SF Symbols。
 * 动效纪律（CLAUDE.md）：只动共享值 + Reanimated API，worklet 内不调用任何外部普通函数。
 * 减弱动态 / 低端机（isMotionActive=false）时直接落到终值，不做弹跳。
 */
function TabIcon({
  name,
  outlineName,
  iosFilled,
  iosOutline,
  color,
  focused,
}: {
  name: IoniconName;
  outlineName: IoniconName;
  /** iOS 26 的 SF Symbol 名（Android 自动走 name） */
  iosFilled: string;
  iosOutline: string;
  color: string | OpaqueColorValue;
  focused?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      scale.value = 1;
      return;
    }
    // 选中：先弹到 1.12 再回 1（一次"点一下"的手感）；取消选中：直接柔和收回
    scale.value = focused
      ? withSequence(withSpring(1.12, SPRING.press), withSpring(1, SPRING.press))
      : withTiming(1, { duration: 120 });
  }, [active, focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.tabIcon}>
      <Animated.View style={animatedStyle}>
        <ThemedIcon
          ios={focused ? iosFilled : iosOutline}
          name={focused ? name : outlineName}
          size={24}
          color={typeof color === "string" ? color : undefined}
        />
      </Animated.View>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /**
     * 图标盒高度参与 TabBar 的几何标定（v1.27 真机反馈"图标与文字偏下"）。
     *
     * v17 C3 把标签字号 10 → 11（10pt 在真机上发虚），因此**三处数字一起重算**：
     *   内容高 = 图标盒 27 + 标签间距 2 + 标签行高 13 = 42
     *   item 高 = 56 − 2×4(marginVertical) = 48
     *   可用内高 = 48 − 2×2(paddingVertical) = 44
     *   余量 2pt 由 justifyContent:center 均分 → 上下各 1pt，**几何居中**。
     * 三处（本高度 / tabBarLabelStyle 的 lineHeight+marginTop / paddingVertical）互为一体，
     * 改任一处都要照上式重算，否则又会出现"偏下"。
     */
    tabIcon: { width: 40, height: 27, alignItems: "center", justifyContent: "center" },
    tabBarTint: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      backgroundColor: colors.primary + "17",
    },
    tabBarHighlight: {
      position: "absolute",
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
      borderRadius: TAB_BAR_HEIGHT / 2,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "rgba(255,255,255,0.34)",
    },
    /** iOS 26 真玻璃：只给圆角，材质由系统画；高光内描边仍保留以勾勒胶囊轮廓 */
    tabBarGlassIos: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      overflow: "hidden",
    },
    /**
     * Android / iOS<26 的实底降档：85% canvas + 中性 hairline + 柔和中性投影。
     * 阶段 A 已把 border 与阴影中性化；这里同步收紧描边、加大投影半径，让它更像"浮起来的玻璃"。
     */
    tabBarGlass: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      backgroundColor: colors.canvas.length === 7 ? colors.canvas + "D9" : colors.canvas,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      shadowColor: "#1C2430",
      shadowOpacity: 0.1,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
  });

export default function TabsLayout() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // 能力探测只在渲染时做一次；失败安全回退实底
  const glass = liquidGlassAvailable();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.textMuted,
        // 选中项是一枚浅色圆角胶囊 + 主色文字（不是整块变色）
        tabBarActiveBackgroundColor: colors.surface + "E6",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarStyle: {
          position: "absolute",
          left: 10,
          right: 10,
          bottom: insets.bottom + 6,
          height: TAB_BAR_HEIGHT,
          borderRadius: TAB_BAR_HEIGHT / 2,
          paddingHorizontal: 8,
          paddingBottom: 0,
          paddingTop: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => <TabBarMaterial dark={dark} styles={styles} glass={glass} />,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        // 字号 10 → 11（真机 10pt 发虚）；行高与 marginTop 参与居中标定，见 tabIcon 注释
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", lineHeight: 13, marginTop: 2, marginBottom: 0 },
        tabBarItemStyle: {
          marginVertical: 4,
          marginHorizontal: 2,
          paddingVertical: 2,
          paddingHorizontal: 0,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
        },
        sceneStyle: { backgroundColor: "transparent" },
      }}
      screenListeners={{
        // Tab 切换触觉（v17 C3）：Apple 手感里"切换"属语义化柔和反馈
        tabPress: () => haptics.soft(),
      }}
    >
      {/* 一级 Tab：今日 / 学习 / 职业 / 健康 / 我的 */}
      <Tabs.Screen
        name="today"
        options={{
          title: "今日",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" outlineName="home-outline" iosFilled="house.fill" iosOutline="house" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "学习",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book" outlineName="book-outline" iosFilled="book.fill" iosOutline="book" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: "职业",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="briefcase"
              outlineName="briefcase-outline"
              iosFilled="briefcase.fill"
              iosOutline="briefcase"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: "健康",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="heart" outlineName="heart-outline" iosFilled="heart.fill" iosOutline="heart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "我的",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person"
              outlineName="person-outline"
              iosFilled="person.crop.circle.fill"
              iosOutline="person.crop.circle"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* 重定向页：不占底部导航，但仍在 Tab 组内（底栏可见，与迁移前一致） */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}
