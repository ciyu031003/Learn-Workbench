import { useEffect } from "react";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type OpaqueColorValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { DailyBackground } from "@/components/daily-background";
import { colors } from "@/theme/tokens";

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
    <View style={styles.tabIcon}>
      <Ionicons name={focused ? name : outlineName} size={22} color={color} />
      {focused ? <View style={[styles.tabDot, { backgroundColor: color }]} /> : null}
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
    <View style={styles.tabIcon}>
      <Animated.View style={flowerStyle}>
        <Ionicons name={focused ? "flower" : "flower-outline"} size={22} color={color} />
      </Animated.View>
      {focused ? <View style={[styles.tabDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: "center", gap: 3, paddingVertical: 2 },
  tabDot: { width: 4, height: 4, borderRadius: 2 },
});

export default function RootLayout() {
  return (
    <DailyBackground>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: "rgba(255,255,255,0.90)",
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 64,
          },
          tabBarItemStyle: { paddingVertical: 4 },
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
        <Tabs.Screen name="career" options={{ href: null }} />
        <Tabs.Screen name="roadmap" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="logs" options={{ href: null }} />
        <Tabs.Screen name="market" options={{ href: null }} />
        <Tabs.Screen name="applications" options={{ href: null }} />
      </Tabs>
    </DailyBackground>
  );
}
