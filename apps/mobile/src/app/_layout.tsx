import { useEffect, useMemo } from "react";
import { Stack, usePathname } from "expo-router";
import { InteractionManager, StatusBar as RNStatusBar, StyleSheet, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { DailyBackground } from "@/components/daily-background";
import { ThemeProvider } from "@/theme";
import { useTheme } from "@/theme";
import { noteScreenPath } from "@/lib/back-target";
import type { ThemeColors } from "@/theme/tokens";
import { startSyncEngine } from "@/lib/sync-engine";
import { silentCheckForUpdate } from "@/lib/ota";
import { useUpdateStore } from "@/store/update-store";
import { UpdateSheet } from "@/components/update-sheet";
import { secureToken } from "@/lib/secure-token";
import { useAppStore } from "@/store/app-store";
import { migrateLegacySports } from "@/store/sport-legacy";

/**
 * 根布局（v17 阶段 B：导航栈重构）。
 *
 * 迁移前：根布局就是 <Tabs>，app/ 下**所有**路由都被注册成 Tab（次级页只是 href:null），
 * 于是 hub → 子页只是"切 Tab"：没有 push/pop 转场、没有原生侧滑返回，
 * `router.back()` 回的是"上一个看过的 Tab"（真机表现为"返回却回到今日首页"）。
 *
 * 迁移后：根 <Stack> 包住 `(tabs)` 分组 + 全部子页 —— 子页是真正的 push，
 * 拿到原生转场 / iOS 侧滑返回 / Android 预测性返回（app.json 已开）。
 * **URL 完全不变**（`(tabs)` 是括号分组，不进路径），有 route-manifest 快照测试守住。
 */

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    // 状态栏兜底底色：绝对定位贴顶，不参与布局（v12 P0-5；阶段 C1 边到边时移除）
    statusBarFill: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
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
      // v11 起：有新版本时弹「应用内升级」弹层（不跳浏览器）；延后 1.5s
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

/** 壳层（吃主题）：导航栈 / StatusBar / 每日背景 */
function ThemedShell() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // 记住"上一个展示过的页面"，供 resolveBackTarget 在无栈历史时兜底（v1.22）
  const pathname = usePathname();
  useEffect(() => {
    noteScreenPath(pathname);
  }, [pathname]);
  return (
    <DailyBackground>
      {/*
        状态栏：底色必须跟随**App 内主题**，不能只靠 Android 主题里的 @color/app_bar_color
        —— 它是 DayNight 资源，会跟随**系统**深色模式；系统深色 + App 浅色时就会出现
        "浅色页面顶上一条黑带"（v12 P0-5）。这里运行时指定底色 + 非透明。
        （阶段 C1 会改为边到边并去掉这条底色带。）
      */}
      <RNStatusBar
        backgroundColor={colors.canvas}
        barStyle={dark ? "light-content" : "dark-content"}
        translucent={false}
      />
      {/* 兜底：即使系统忽略上面的底色（部分 ROM / 边到边），也用主题色铺一条状态栏高度的底 */}
      <View pointerEvents="none" style={[styles.statusBarFill, { height: insets.top, backgroundColor: colors.canvas }]} />
      {/*
        导航栈：`(tabs)` 承载 5 个一级 Tab（自带底栏），其余页面都是它的 push 目标 ——
        子页天然盖住底栏（D2 期望的 iOS 层级气质），因此 useTabBarSpace() 在子页返回 0。
        contentStyle 透明是必须的：Stack 场景默认带不透明底，会盖住 DailyBackground。
      */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "default",
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* 学习线 */}
        <Stack.Screen name="roadmap" />
        <Stack.Screen name="tasks" />
        <Stack.Screen name="logs" />
        <Stack.Screen name="trackers" />
        <Stack.Screen name="phase/[id]" />
        {/* 职业线 */}
        <Stack.Screen name="jobs" />
        <Stack.Screen name="market" />
        <Stack.Screen name="radar" />
        <Stack.Screen name="applications" />
        <Stack.Screen name="resume" />
        <Stack.Screen name="certificates" />
        <Stack.Screen name="interview" />
        {/* 健康线 */}
        <Stack.Screen name="habits" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="sports-card" />
        {/* 我的 */}
        <Stack.Screen name="account-security" />
        <Stack.Screen name="domain-manager" />
        {/* 预览类：从下方淡入更像"查看器" */}
        <Stack.Screen name="resume-preview" options={{ animation: "fade_from_bottom" }} />
        <Stack.Screen name="diagnostics" options={{ animation: "fade_from_bottom" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <UpdateSheet />
    </DailyBackground>
  );
}
