import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { recordCrumb } from "@/lib/crash-capture";
import { useTheme } from "@/theme";
import { friendlyError } from "@/lib/friendly-error";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 全局渲染兜底（P13）：408 精读的 SVG 崩溃暴露了「一处渲染异常 = 整屏白屏」的问题。
 * 原生 FATAL 已经由 lib/svg-sanitize.ts 从源头堵住；这里再兜住 JS 渲染异常：
 * - 显示可读的「页面加载出错 / 重试」，而不是空白；
 * - 记录面包屑（不含用户内容），便于线上诊断；
 * - 重试 = 清空 error state，让子树重新渲染（导航状态保留）。
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      recordCrumb("app-render-error", {
        message: error.message.slice(0, 180),
        stack: (info.componentStack ?? "").slice(0, 400),
      });
    } catch {
      // 诊断失败不能再次影响渲染
    }
    this.props.onError?.(error);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback
        ? this.props.fallback(this.state.error, this.reset)
        : <DefaultErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <ThemedIcon name="alert-circle-outline" size={30} color={colors.danger} />
        <Text style={styles.title}>页面加载出错</Text>
        <Text style={styles.text}>
          已拦截渲染异常，不会再白屏。可以重试；如果反复出现，请重启 App 并反馈这一页。
        </Text>
        <Text style={styles.detail} numberOfLines={3}>
          {friendlyError(error, "未知错误")}
        </Text>
        <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button" accessibilityLabel="重试">
          <Text style={styles.buttonText}>重试</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: colors.canvas,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      padding: spacing.xl,
    },
    title: { ...typography.title2, color: colors.text },
    text: { ...typography.caption, color: colors.textSecondary, textAlign: "center", lineHeight: 19 },
    detail: { ...typography.micro, color: colors.textFaint, textAlign: "center" },
    button: {
      marginTop: spacing.sm,
      minHeight: 44,
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xl,
    },
    buttonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
  });
}
