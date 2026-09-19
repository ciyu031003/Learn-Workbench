import { useEffect , useMemo } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { InteractionManager, Platform, Pressable, StyleSheet, View, type OpaqueColorValue } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";
import { DailyBackground } from "@/components/daily-background";
import { ThemedIcon } from "@/components/themed-icon";
import { ThemeProvider } from "@/theme";
import { useTheme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/lib/use-tab-bar-space";
import { resolveEdgeSwipeEnabled } from "@/lib/edge-swipe";
import type { ThemeColors } from "@/theme/tokens";
import { startSyncEngine } from "@/lib/sync-engine";
import { silentCheckForUpdate } from "@/lib/ota";
import { useUpdateStore } from "@/store/update-store";
import { UpdateSheet } from "@/components/update-sheet";
import { secureToken } from "@/lib/secure-token";
import { useAppStore } from "@/store/app-store";
import { migrateLegacySports } from "@/store/sport-legacy";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  outlineName,
  color,
  focused,
}: {
  name: IoniconName;
  outlineName: IoniconName;
  color: string | OpaqueColorValue;
  focused?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.tabIcon}>
      <ThemedIcon ios={undefined} name={focused ? name : outlineName} size={22} color={typeof color === "string" ? color : undefined} />
    </View>
  );
}

function FlatTabButton({ children, onPress, accessibilityState, style }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const focused = !!accessibilityState?.selected;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      android_ripple={{ color: "transparent" }}
      style={[styles.tabButton, style]}
    >
      {children}
      {/* 激活项短下划线（参考图：通栏扁平 + 品牌色短横线） */}
      <View style={[styles.tabUnderline, focused && styles.tabUnderlineActive]} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  tabIcon: { width: 42, height: 30, alignItems: "center", justifyContent: "center" },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8, paddingBottom: 10 },
  tabUnderline: {
    position: "absolute",
    bottom: 2,
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "transparent",
  },
  tabUnderlineActive: { backgroundColor: colors.primary },
});

/**
 * iOS 风格边缘横滑：只截获屏幕左右 26pt 边缘的横滑。
 *
 * 关键约束（OPPO/ColorOS 触摸失效专项）：**不允许存在全屏覆盖层**。
 * v1.3.3 及以前这里是个 `position:absolute` 四边贴边 + `zIndex:60` 的全屏 View，
 * 依赖 `pointerEvents="box-none"` 把触摸透下去；在部分 ROM + Fabric 组合下 box-none
 * 会退化成"整层可点"，表现就是"界面正常、点哪儿都没反应"。
 * 现在改成两条**各自独立绝对定位**的窄条：屏幕中央不存在任何覆盖层，
 * 最坏情况也只是失去边缘横滑这一项锦上添花的能力。
 *
 * 默认值：iOS 开、Android 关（Android 的系统返回手势本就占用左右边缘，避免互抢）。
 */
function SwipeNavigator() {
  const pathname = usePathname();
  const stored = useAppStore((s) => s.edgeSwipeEnabled);
  const edgeSwipeEnabled = resolveEdgeSwipeEnabled(stored, Platform.OS);

  // 5 Tab 顺序：今日 → 学习 → 职业 → 健康 → 我的
  const ORDER = ["/today", "/learn", "/career", "/wellness", "/settings"];
  const normalize = (p: string) => (p === "/" || p === "" ? "/today" : p === "/dashboard" ? "/today" : p);

  const go = (dir: "left" | "right") => {
    const cur = ORDER.indexOf(normalize(pathname));
    if (cur < 0) return;
    // dir=left 表示手指左滑 = 前进到下一个 tab；dir=right = 返回上一个
    const next = dir === "left" ? cur + 1 : cur - 1;
    if (next < 0 || next >= ORDER.length) return;
    runOnJS(router.navigate)(ORDER[next]);
  };

  const makeEdge = (side: "left" | "right") =>
    Gesture.Pan()
      .activeOffsetX(side === "left" ? [-24, 24] : [-24, 24])
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        if (Math.abs(e.translationX) < 48 || Math.abs(e.velocityX) < 320) return;
        const right = e.translationX < 0;
        // 左边缘响应右滑（返回上一 tab），右边缘响应左滑（前进下一 tab）
        if (side === "left" && !right) return;
        if (side === "right" && right) return;
        runOnJS(go)(right ? "left" : "right");
      });

  if (!edgeSwipeEnabled) return null;

  return (
    <>
      <GestureDetector gesture={makeEdge("left")}>
        <View style={swipeStyles.edgeLeft} />
      </GestureDetector>
      <GestureDetector gesture={makeEdge("right")}>
        <View style={swipeStyles.edgeRight} />
      </GestureDetector>
    </>
  );
}

// 两条窄条各自绝对定位，互不包裹 → 不存在任何全屏（甚至中等面积）的覆盖层
const swipeStyles = StyleSheet.create({
  edgeLeft: { position: "absolute", top: 0, bottom: 0, left: 0, width: 26, zIndex: 60 },
  edgeRight: { position: "absolute", top: 0, bottom: 0, right: 0, width: 26, zIndex: 60 },
});

export default function RootLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // 启动期只做「必要且轻」的事；重活（同步引擎/旧数据迁移/令牌恢复）延后到首帧之后，
  // 避免与首屏渲染抢 JS 线程（TTI 优化，见 docs/APP端设计与打包方案.md §6.3）
  useEffect(() => {
    let stopSync: (() => void) | undefined;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      // 离线优先：后台同步引擎（联网/回前台/登录后自动推送本地变更）
      stopSync = startSyncEngine();
      // 旧运动记录一次性并入 app-store（入同步队列）
      void migrateLegacySports();
      // OTA 静默检查：落盘标记（「我的」页展示「发现新版本」）
      // v11 起：有新版本时弹「应用内升级」弹层（不跳浏览器）；延后 1.5s，避开首屏动画
      void silentCheckForUpdate().then((pending) => {
        if (!pending || cancelled) return;
        setTimeout(() => {
          if (!cancelled) useUpdateStore.getState().promptFromPending(pending);
        }, 1500);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
      stopSync?.();
    };
  }, []);

  // 登录令牌恢复：token 存于安全存储（Keychain/Keystore），启动时回填会话。
  // 带 3s 超时：ColorOS 等 ROM 的 Keystore 有已知卡顿，宁可当未登录启动，也不拖住启动链路。
  useEffect(() => {
    secureToken.loadWithTimeout(3000).then((t) => {
      const st = useAppStore.getState();
      if (t && !st.token) st.setAuth(t, st.username);
    });
  }, []);

  // 默认竖屏锁定；专注页打开时会临时解锁以支持横屏时钟模式
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
      // 忽略不支持锁定的设备
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* v4 P2：键盘适配（react-native-keyboard-controller）需要根部 Provider，
          供 BottomSheet 的键盘高度动画与 KeyboardAwareScrollView 使用 */}
      <KeyboardProvider>
        <ThemeProvider>
          <ThemedShell />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** 壳层（吃主题）：TabBar / StatusBar / 每日背景 / 边缘横滑 */
function ThemedShell() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  return (
    <DailyBackground>
      <StatusBar style={dark ? "light" : "dark"} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarButton: FlatTabButton,
          // 通栏扁平底栏（用户参考图）：实底、无圆角、无阴影、顶部 hairline 分隔
          // 注意：底栏有文字，玻璃会削弱可读性 —— 底栏不走玻璃（决策 D10）
          tabBarStyle: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 0,
            backgroundColor: colors.surfaceStrong,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            borderWidth: 0,
            borderRadius: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.2 },
          tabBarItemStyle: { paddingVertical: 0 },
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        {/* 一级 Tab：今日 / 学习 / 职业 / 健康 / 我的 */}
        <Tabs.Screen
          name="today"
          options={{
            title: "今日",
            tabBarIcon: ({ color, focused }) => <TabIcon name="home" outlineName="home-outline" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="learn"
          options={{
            title: "学习",
            tabBarIcon: ({ color, focused }) => <TabIcon name="book" outlineName="book-outline" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="career"
          options={{
            title: "职业",
            tabBarIcon: ({ color, focused }) => <TabIcon name="briefcase" outlineName="briefcase-outline" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="wellness"
          options={{
            title: "健康",
            tabBarIcon: ({ color, focused }) => <TabIcon name="heart" outlineName="heart-outline" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "我的",
            tabBarIcon: ({ color, focused }) => <TabIcon name="person" outlineName="person-outline" color={color} focused={focused} />,
          }}
        />

        {/* 次级页面：不占底部导航 */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="jobs" options={{ href: null }} />
        <Tabs.Screen name="roadmap" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="logs" options={{ href: null }} />
        <Tabs.Screen name="market" options={{ href: null }} />
        <Tabs.Screen name="radar" options={{ href: null }} />
        <Tabs.Screen name="applications" options={{ href: null }} />
        <Tabs.Screen name="resume" options={{ href: null }} />
        <Tabs.Screen name="resume-preview" options={{ href: null }} />
        <Tabs.Screen name="certificates" options={{ href: null }} />
        <Tabs.Screen name="interview" options={{ href: null }} />
        <Tabs.Screen name="phase/[id]" options={{ href: null }} />
        <Tabs.Screen name="account-security" options={{ href: null }} />
        <Tabs.Screen name="domain-manager" options={{ href: null }} />
        <Tabs.Screen name="trackers" options={{ href: null }} />
        {/* 运动档案（v10 新增页面）：必须显式 href:null，否则会变成第 6 个 Tab */}
        <Tabs.Screen name="sports-card" options={{ href: null }} />
        <Tabs.Screen name="habits" options={{ href: null }} />
        <Tabs.Screen name="workout" options={{ href: null }} />
        <Tabs.Screen name="nutrition" options={{ href: null }} />
        {/* 排障用隐藏页（问题诊断 / 触摸自检）：不占底部导航，纯 App 内部，与厂商无关 */}
        <Tabs.Screen name="diagnostics" options={{ href: null }} />
        <Tabs.Screen name="+not-found" options={{ href: null }} />
      </Tabs>
      <SwipeNavigator />
      <UpdateSheet />
    </DailyBackground>
  );
}
