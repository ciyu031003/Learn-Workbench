import { useEffect , useMemo } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { InteractionManager, Pressable, StyleSheet, View, type OpaqueColorValue } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { DailyBackground } from "@/components/daily-background";
import { ThemedIcon } from "@/components/themed-icon";
import { ThemeProvider } from "@/theme";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { startSyncEngine } from "@/lib/sync-engine";
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

function FlatTabButton({ children, onPress, accessibilityState }: any) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      android_ripple={{ color: "transparent" }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  tabIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
});

/**
 * iOS 风格边缘横滑：只截获屏幕左右 26pt 边缘的横滑，
 * 不再全屏覆盖（避免吃掉子页面内部的横向手势/轮播/sheet 冲突）。
 */
function SwipeNavigator() {
  const pathname = usePathname();

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

  return (
    <View pointerEvents="box-none" style={swipeStyles.layer}>
      <GestureDetector gesture={makeEdge("left")}>
        <View style={swipeStyles.edgeLeft} />
      </GestureDetector>
      <GestureDetector gesture={makeEdge("right")}>
        <View style={swipeStyles.edgeRight} />
      </GestureDetector>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, flexDirection: "row", justifyContent: "space-between" },
  edgeLeft: { width: 26, height: "100%" },
  edgeRight: { width: 26, height: "100%" },
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
    });
    return () => {
      cancelled = true;
      task.cancel();
      stopSync?.();
    };
  }, []);

  // 登录令牌恢复：token 存于安全存储（Keychain/Keystore），启动时回填会话
  useEffect(() => {
    secureToken.load().then((t) => {
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
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** 壳层（吃主题）：TabBar / StatusBar / 每日背景 / 边缘横滑 */
function ThemedShell() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          tabBarStyle: {
            position: "absolute",
            // 5 Tab：收窄左右留白，保证每项 ≥64pt 触控宽度（HIG/Material 触控目标）
            left: 14,
            right: 14,
            bottom: 16,
            height: 62,
            borderRadius: 22,
            backgroundColor: colors.surfaceStrong,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            shadowColor: dark ? colors.text : "#A96F2F",
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
            overflow: "hidden",
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
          tabBarItemStyle: { paddingVertical: 3 },
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
        <Tabs.Screen name="habits" options={{ href: null }} />
        <Tabs.Screen name="workout" options={{ href: null }} />
        <Tabs.Screen name="nutrition" options={{ href: null }} />
        <Tabs.Screen name="+not-found" options={{ href: null }} />
      </Tabs>
      <SwipeNavigator />
    </DailyBackground>
  );
}
