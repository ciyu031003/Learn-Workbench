import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import { DailyBackground } from "@/components/daily-background";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

export default function RootLayout() {
  return (
    <DailyBackground>
      <StatusBar style="light" />
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
        <Tabs.Screen name="dashboard" options={{ title: "仪表盘", tabBarIcon: () => <TabIcon emoji="📊" /> }} />
        <Tabs.Screen name="roadmap" options={{ title: "路线图", tabBarIcon: () => <TabIcon emoji="🗺️" /> }} />
        <Tabs.Screen name="tasks" options={{ title: "任务", tabBarIcon: () => <TabIcon emoji="✅" /> }} />
        <Tabs.Screen name="logs" options={{ title: "日志", tabBarIcon: () => <TabIcon emoji="📓" /> }} />
        <Tabs.Screen name="settings" options={{ title: "设置", tabBarIcon: () => <TabIcon emoji="⚙️" /> }} />
      </Tabs>
    </DailyBackground>
  );
}
