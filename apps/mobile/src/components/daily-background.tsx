import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 画布底色：浅色=暖象牙白 + 顶部暖色渐晕；深色=暖炭底 + 极淡的暖橙/冷蓝微光。
 * 普通页面不再压黑遮罩，仅专注全屏保留沉浸暗色。
 */
export function DailyBackground({ children }: { children: ReactNode }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.root}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas, overflow: "hidden" },
    blob: { position: "absolute", borderRadius: 999 },
    blobTop: {
      width: 420,
      height: 420,
      top: -150,
      left: -120,
      backgroundColor: dark ? "rgba(245, 160, 84, 0.09)" : "rgba(255, 243, 218, 0.95)",
    },
    blobBottom: {
      width: 480,
      height: 480,
      top: -260,
      right: -180,
      backgroundColor: dark ? "rgba(111, 168, 224, 0.08)" : "rgba(220, 236, 255, 0.85)",
    },
    content: { flex: 1 },
  });
