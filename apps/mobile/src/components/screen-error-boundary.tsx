import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ErrorBoundaryProps } from "expo-router";

import { useTheme } from "@/theme";

/**
 * 路由级错误边界（V7 上线护栏）。
 *
 * 三块重写后的屏都属于「一屏一屏的强视觉」，任何一处渲染异常都不能把整个 App
 * 直接打到闪退：Expo Router 会对每个路由文件导出的 `ErrorBoundary` 兜住该路由的
 * 渲染错误，这里给一个可重试的安静兜底页（标题 + 说明 + 重试），并把错误信息留在
 * 开发期可见的位置。
 *
 * 为什么不放在根布局：根边界一旦触发，底栏和路由状态都会一起消失；按路由兜住，
 * 用户还能切到其它 Tab 继续用。
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.canvas }]}>
      <Text style={[styles.title, { color: colors.text }]}>这一屏没画出来</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        页面渲染时遇到一个错误。可以先重试；如果一直出现，切到其它页签不影响使用。
      </Text>
      <Text style={[styles.detail, { color: colors.textFaint }]} numberOfLines={3}>
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="重新加载这一屏"
        onPress={retry}
        hitSlop={8}
        style={[styles.retry, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.retryText, { color: colors.surface }]}>重新加载</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 96, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 22 },
  detail: { fontSize: 11, lineHeight: 16 },
  retry: { marginTop: 14, alignSelf: "flex-start", paddingHorizontal: 18, height: 42, borderRadius: 13, justifyContent: "center" },
  retryText: { fontSize: 14, fontWeight: "700" },
});
