import { useMemo } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type OpaqueColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/lib/use-tab-bar-space";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 一级 Tab 布局（v17 阶段 B：从根 _layout.tsx 整体搬进来）。
 *
 * 存在的意义：根布局改为 <Stack> 之后，"一级 Tab" 必须有自己的嵌套布局，
 * 这样 hub → 子页 才是真正的 push（有原生转场 / 侧滑返回 / 预测性返回），
 * 而不是过去那种"所有页面平铺成 href:null 的 Tab、切换只是瞬时替换"。
 *
 * `(tabs)` 是**括号分组**，不进 URL —— /today、/learn、/career、/wellness、
 * /settings、/、/dashboard 与迁移前完全一致。
 */

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
      <ThemedIcon ios={undefined} name={focused ? name : outlineName} size={24} color={typeof color === "string" ? color : undefined} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /**
     * 图标盒高度参与 TabBar 的几何标定（v1.27 真机反馈"图标与文字偏下"）：
     * 内容高 = 图标盒 28 + 标签间距 2 + 标签行高 12 = 42；
     * item 高 = 56 − 2×4(marginVertical) = 48；可用内高 = 48 − 2×2(paddingVertical) = 44；
     * 余量 2pt 由 justifyContent:center 均分 → 上下各 ≈1pt，**几何居中**。
     * 三处数字（本高度 / paddingVertical / lineHeight+marginTop）互为一体，改任一处都要重算。
     */
    tabIcon: { width: 40, height: 28, alignItems: "center", justifyContent: "center" },
    tabBarTint: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      backgroundColor: colors.primary + "1A",
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
    // 悬空玻璃底栏的底：半透明 + 高光描边 + 柔和投影（浅色亮玻璃 / 深色暗玻璃）
    tabBarGlass: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      backgroundColor: colors.canvas.length === 7 ? colors.canvas + "E0" : colors.canvas,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.borderStrong,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  });

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.textMuted,
        // 选中项是一枚浅色圆角胶囊 + 主色文字（不是整块变色）
        tabBarActiveBackgroundColor: colors.surface + "E6",
        tabBarInactiveBackgroundColor: "transparent",
        /**
         * 悬空玻璃底栏：浮动圆角胶囊 + 半透明底 + 高光描边 + 柔和投影。
         * 真实模糊材质是阶段 C3 的事（含 iOS GlassView 可用性判断）。
         */
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
        tabBarBackground: () => (
          <View style={styles.tabBarGlass} pointerEvents="none">
            <View style={styles.tabBarTint} pointerEvents="none" />
            <View style={styles.tabBarHighlight} pointerEvents="none" />
          </View>
        ),
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", lineHeight: 12, marginTop: 2, marginBottom: 0 },
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

      {/* 重定向页：不占底部导航，但仍在 Tab 组内（底栏可见，与迁移前一致） */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}
