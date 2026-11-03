import { useEffect } from "react";
import { Tabs, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type OpaqueColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { FloatingTabBar } from "@/components/v2/floating-tab-bar";
import { haptics } from "@/lib/haptics";
import { SPRING, useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { scrollToTop } from "@/lib/scroll-to-top";

/**
 * 一级 Tab 布局（v17 阶段 B：从根 _layout.tsx 整体搬进来；阶段 C3：底栏材质升级；
 * v2.1：底栏改为自定义浮动液态玻璃胶囊 —— 见 components/v2/floating-tab-bar.tsx）。
 *
 * 存在的意义：根布局改为 <Stack> 之后，"一级 Tab" 必须有自己的嵌套布局，
 * 这样 hub → 子页 才是真正的 push（有原生转场 / 侧滑返回 / 预测性返回），
 * 而不是过去那种"所有页面平铺成 href:null 的 Tab、切换只是瞬时替换"。
 *
 * `(tabs)` 是**括号分组**，不进 URL —— /today、/learn、/career、/wellness、
 * /settings、/、/dashboard 与迁移前完全一致。
 *
 * 职责边界（v2.1）：
 *  - 本文件只负责「哪些 Tab + 图标 + 事件」，几何与材质在 floating-tab-bar.tsx；
 *  - 触觉（tabPress）与双击回顶（v19-M8）留在 screenListeners —— 自定义底栏
 *    点击时仍会 emit tabPress，所以这两条交互链路不受影响；
 *  - TabIcon 的弹簧动效保持原样（动效点数量不变，见 scripts/check-motion-budget.mjs）。
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

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
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);
  const scale = useSharedValue(1);
  /**
   * v1.44.2 曾按反馈在选中图标外加一圈白色圆环；v1.45 用户给了参考图
   * （选中态是一块更大的实色圆角块、并无圆环），据此把圆环去掉；
   * v2.1 起选中态由底栏的蓝色渐变 pill 承担，图标只负责弹簧与反白。
   */

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

/**
 * 图标盒高度参与底栏的几何标定（v1.27 真机反馈"图标与文字偏下"）。
 *
 * v2.1 底栏改为 66pt 胶囊 + 52pt 单格（components/v2/floating-tab-bar.tsx）：
 *   未选中内容高 = 图标盒 27 + 标签行高 14 = 41 → 单格 52 内上下各余 5.5pt（几何居中）
 *   选中态只剩图标盒 27，居中于 52 → 图标视觉居中于蓝色 pill
 * 三处（本高度 / 底栏标签字号与行高 / 单格高度）互为一体，改任一处都要照上式重算。
 */
const styles = StyleSheet.create({
  tabIcon: { width: 40, height: 27, alignItems: "center", justifyContent: "center" },
});

export default function TabsLayout() {
  // v19-M8：双击回顶需要经导航状态判断"按压的是否为当前已聚焦 Tab"
  const navigation = useNavigation();

  return (
    <Tabs
      /**
       * v2.1：接管 tabBar 渲染（渐变 pill + 外发光只能自绘）。
       * 内联箭头每次渲染都会新建，但组件类型不变，react-navigation 不会重建底栏。
       */
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // 底栏材质 / 圆角 / 悬浮位置全部由 floating-tab-bar.tsx 负责，这里不再写 tabBarStyle。
        sceneStyle: { backgroundColor: "transparent" },
      }}
      screenListeners={{
        // Tab 切换触觉（v17 C3）：Apple 手感里"切换"属语义化柔和反馈
        tabPress: (e) => {
          haptics.soft();
          /**
           * v19-M8 · 双击回顶：再点**已聚焦**的 Tab = 该页滚回顶部（iOS 系统级心智）。
           * 判定走导航状态而不是 pathname —— expo-router 的 Tabs.Screen options 不接受
           * per-screen listeners，且 tabPress 事件在导航发生**前**触发：此时 getState()
           * 的 index 还指向旧焦点，pressed 路由名 == 焦点路由名 即"再点了一次"。
           * hub 侧经 lib/scroll-to-top 注册滚动容器；"index/dashboard"等重定向页不注册即忽略。
           */
          const st = navigation.getState();
          const target = (e as { target?: string }).target;
          const pressed = st?.routes.find((r) => r.key === target);
          if (pressed && st && st.routes[st.index]?.name === pressed.name) {
            scrollToTop("/" + pressed.name);
          }
        },
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
          // school（学位帽）比 book 更圆润，也更贴「学习」的语义
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="school"
              outlineName="school-outline"
              iosFilled="graduationcap.fill"
              iosOutline="graduationcap"
              color={color}
              focused={focused}
            />
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
          // person-circle：圆形轮廓比人形剪影更圆润，与胶囊的形态也更统一
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-circle"
              outlineName="person-circle-outline"
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
