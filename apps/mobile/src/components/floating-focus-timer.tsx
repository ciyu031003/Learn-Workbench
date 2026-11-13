import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { ThemedIcon } from "@/components/themed-icon";
import { formatFocusClock } from "@/lib/focus-clock";
import { showsTabBar, tabBarBottomFor } from "@/lib/tab-bar-metrics";
import { tabularNums, typography } from "@/theme/tokens";
import { useFocusSessionStore } from "@/store/focus-session-store";

/**
 * 专注全屏收起后的悬浮计时（根级渲染，跨 Tab / 子页可见）。
 * 只读全局快照，不持有计时引擎；点按恢复全屏，计时不会中断。
 */
export function FloatingFocusTimer() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const minimized = useFocusSessionStore((s) => s.minimized);
  // 只在收起时订阅快照：全屏展开时不因每秒更新而重渲染悬浮层
  const snapshot = useFocusSessionStore((s) => (s.minimized ? s.snapshot : null));
  const restore = useFocusSessionStore((s) => s.restore);

  const styles = useMemo(() => makeStyles(), []);

  if (!minimized || !snapshot) return null;

  const total = snapshot.totalSeconds > 0 ? snapshot.totalSeconds : 1;
  const progress =
    snapshot.timerMode === "stopwatch"
      ? 1
      : Math.max(0, Math.min(1, snapshot.remainingSeconds / total));
  const time = formatFocusClock(snapshot.remainingSeconds);
  const paused = snapshot.status === "paused";
  const statusText = paused
    ? "已暂停"
    : snapshot.sessionMode === "exercise"
      ? "运动中"
      : "专注中";
  const bottom = showsTabBar(pathname)
    ? tabBarBottomFor(insets.bottom) + 8
    : insets.bottom + 16;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom, right: Math.max(18, insets.right + 12) }]}
    >
      <PressableScale
        haptic
        scaleTo={0.96}
        hitSlop={8}
        onPress={restore}
        accessibilityRole="button"
        accessibilityLabel={statusText + " " + time + "，点按返回专注计时"}
        style={styles.pill}
      >
        <BlurView
          intensity={46}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
        <RingProgress
          size={22}
          strokeWidth={2.4}
          progress={progress}
          color="#B7D9F2"
          trackColor="rgba(255,255,255,0.20)"
        />
        <View style={styles.copy}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, paused && styles.dotPaused]} />
            <Text style={styles.status}>{statusText}</Text>
          </View>
          <Text style={styles.time}>{time}</Text>
        </View>
        <ThemedIcon name="chevron-up" size={12} color="rgba(232,244,252,0.62)" />
      </PressableScale>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    host: {
      position: "absolute",
      alignItems: "flex-end",
    },
    pill: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: "rgba(16,45,63,0.92)",
    },
    tint: { backgroundColor: "rgba(10,28,42,0.55)" },
    copy: { minWidth: 62 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#8FC3F0",
    },
    dotPaused: { backgroundColor: "rgba(232,244,252,0.45)" },
    status: {
      ...typography.eyebrow,
      lineHeight: 13,
      fontWeight: "500",
      color: "rgba(232,244,252,0.66)",
    },
    time: {
      ...typography.callout,
      fontWeight: "700",
      color: "#E8F4FC",
      ...tabularNums,
    },
  });
