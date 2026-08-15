import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type OpaqueColorValue } from "react-native";
import { DailyBackground } from "@/components/daily-background";
import { useAppStore } from "@/store/app-store";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, focused }: { name: IoniconName; color: string | OpaqueColorValue; focused?: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={name} size={22} color={color} />
      {focused ? <View style={[styles.tabDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: "center", gap: 2 },
  tabDot: { width: 4, height: 4, borderRadius: 2 },
});

export default function RootLayout() {
  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  return (
    <DailyBackground>
      <StatusBar style={backgroundEnabled ? "light" : "dark"} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#4f46e5",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: {
            backgroundColor: "rgba(255,255,255,0.92)",
            borderTopColor: "rgba(24,24,27,0.08)",
          },
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "仪表盘", tabBarIcon: ({ color, focused }) => <TabIcon name="speedometer" color={color} focused={focused} /> }} />
        <Tabs.Screen name="roadmap" options={{ title: "路线图", tabBarIcon: ({ color, focused }) => <TabIcon name="map" color={color} focused={focused} /> }} />
        <Tabs.Screen name="tasks" options={{ title: "任务", tabBarIcon: ({ color, focused }) => <TabIcon name="checkbox" color={color} focused={focused} /> }} />
        <Tabs.Screen name="logs" options={{ title: "日志", tabBarIcon: ({ color, focused }) => <TabIcon name="book" color={color} focused={focused} /> }} />
        <Tabs.Screen name="settings" options={{ title: "设置", tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} /> }} />
      </Tabs>
    </DailyBackground>
  );
}
