import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/tokens";

/**
 * 默认浅色画布：暖象牙白 + 顶部暖色渐晕（用两个柔光色块近似）。
 * 普通页面不再压黑遮罩，仅专注全屏保留沉浸暗色。
 */
export function DailyBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, overflow: "hidden" },
  blob: { position: "absolute", borderRadius: 999 },
  blobTop: {
    width: 420,
    height: 420,
    top: -150,
    left: -120,
    backgroundColor: "rgba(255, 243, 218, 0.95)",
  },
  blobBottom: {
    width: 480,
    height: 480,
    top: -260,
    right: -180,
    backgroundColor: "rgba(220, 236, 255, 0.85)",
  },
  content: { flex: 1 },
});
