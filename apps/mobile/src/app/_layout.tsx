import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { OpaqueColorValue } from "react-native";
import { DailyBackground } from "@/components/daily-background";
import { useAppStore } from "@/store/app-store";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color }: { name: IoniconName; color: string | OpaqueColorValue }) {
  return <Ionicons name={name} size={22} color={color} />;
}

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
        <Tabs.Screen name="dashboard" options={{ title: "仪表盘", tabBarIcon: ({ color }) => <TabIcon name="speedometer" color={color} /> }} />
        <Tabs.Screen name="roadmap" options={{ title: "路线图", tabBarIcon: ({ color }) => <TabIcon name="map" color={color} /> }} />
        <Tabs.Screen name="tasks" options={{ title: "任务", tabBarIcon: ({ color }) => <TabIcon name="checkbox" color={color} /> }} />
        <Tabs.Screen name="logs" options={{ title: "日志", tabBarIcon: ({ color }) => <TabIcon name="book" color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: "设置", tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} /> }} />
      </Tabs>
    </DailyBackground>
  );
}
