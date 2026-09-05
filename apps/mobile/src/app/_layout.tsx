import { useEffect } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type OpaqueColorValue } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { DailyBackground } from "@/components/daily-background";
import { colors } from "@/theme/tokens";
import { startSyncEngine } from "@/lib/sync-engine";

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
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Ionicons name={focused ? name : outlineName} size={22} color={color} />
    </View>
  );
}

function FlowerTabIcon({ color, focused }: { color: string | OpaqueColorValue; focused?: boolean }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(withSpring(1.22, { damping: 10, stiffness: 220 }), withSpring(1));
      rotate.value = withSequence(withTiming(-14, { duration: 140 }), withTiming(12, { duration: 140 }), withTiming(0, { duration: 140 }));
    } else {
      scale.value = withSpring(1);
      rotate.value = withTiming(0, { duration: 140 });
    }
  }, [focused, rotate, scale]);

  const flowerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: rotate.value + "deg" }],
  }));

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Animated.View style={flowerStyle}>
        <Ionicons name={focused ? "flower" : "flower-outline"} size={22} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabIcon: { alignItems: "center", gap: 3, paddingVertical: 2 },
  tabIconFocused: {
    backgroundColor: "rgba(47,116,192,0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
});

function SwipeNavigator() {
  const pathname = usePathname();

  const gesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 48 || Math.abs(e.velocityX) < 320) return;
      const right = e.translationX < 0;
      if (pathname === "/" || pathname === "/dashboard") runOnJS(router.navigate)(right ? "/learn" : "/dashboard");
      else if (pathname === "/learn") runOnJS(router.navigate)(right ? "/jobs" : "/dashboard");
      else if (pathname === "/jobs") runOnJS(router.navigate)(right ? "/settings" : "/learn");
      else if (pathname === "/settings" && !right) runOnJS(router.navigate)("/jobs");
    });

  return (
    <View pointerEvents="box-none" style={swipeStyles.layer}>
      <GestureDetector gesture={gesture}>
        <View style={swipeStyles.gestureZone} />
      </GestureDetector>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 },
  gestureZone: { flex: 1 },
});

export default function RootLayout() {
  // 离线优先：启动后台同步引擎（联网/回前台/登录后自动推送本地变更）
  useEffect(() => startSyncEngine(), []);

  // 默认竖屏锁定；专注页打开时会临时解锁以支持横屏时钟模式
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
      // 忽略不支持锁定的设备
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <DailyBackground>
        <StatusBar style="dark" />
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 18,
            height: 62,
            borderRadius: 21,
            backgroundColor: "rgba(255,251,234,0.72)",
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.65)",
            shadowColor: "#A96F2F",
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            overflow: "hidden",
          },
          tabBarItemStyle: { paddingVertical: 3 },
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "今天",
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
          name="jobs"
          options={{
            title: "招花",
            tabBarIcon: ({ color, focused }) => <FlowerTabIcon color={color} focused={focused} />,
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
        <Tabs.Screen name="career" options={{ href: null }} />
        <Tabs.Screen name="roadmap" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="logs" options={{ href: null }} />
        <Tabs.Screen name="market" options={{ href: null }} />
        <Tabs.Screen name="applications" options={{ href: null }} />
        <Tabs.Screen name="+not-found" options={{ href: null }} />
        </Tabs>
      </DailyBackground>
      <SwipeNavigator />
    </GestureHandlerRootView>
  );
}
