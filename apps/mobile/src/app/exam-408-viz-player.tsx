import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { DemoPlayer } from "@/components/demo-player";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { ThemedIcon } from "@/components/themed-icon";
import { getExam408Demo, type Exam408DemoDetail } from "@/lib/exam-408-demos";
import { exam408PointHref } from "@/lib/exam-408-view";
import { recordCrumb } from "@/lib/crash-capture";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { friendlyError } from "@/lib/friendly-error";

/** 408 演示播放器页（v1.55）：逐帧播放器 + 步骤说明 + 关联知识点 */
export default function Exam408VizPlayerScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ key?: string }>();
  const demoKey = params.key?.trim() ?? "";
  if (!demoKey) {
    return <MissingDemo />;
  }
  return <DemoContent demoKey={demoKey} />;
}

function DemoContent({ demoKey }: { demoKey: string }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [demo, setDemo] = useState<Exam408DemoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDemo(await getExam408Demo(demoKey));
    } catch (reason) {
      setError(friendlyError(reason, "演示加载失败"));
    } finally {
      setLoading(false);
    }
  }, [demoKey]);

  useFocusEffect(
    useCallback(() => {
      recordCrumb("408-viz-player-focus", { key: demoKey });
      void load();
    }, [load, demoKey]),
  );

  const openPoint = () => {
    if (!demo?.knowledgePointKey) return;
    setNavPendingParams("quiz-408-point", { key: demo.knowledgePointKey });
    router.push(exam408PointHref(demo.knowledgePointKey) as never);
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在加载演示…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.centerText}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.retryButton} accessibilityRole="button">
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  if (!demo) {
    return <MissingDemo />;
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="408 演示" scrollY={header.scrollY} backTo="/exam-408-viz" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title={demo.title} subtitle={demo.description || "逐帧演示"} />

        <Animated.View entering={entrance(0)} style={styles.playerWrap}>
          <DemoPlayer steps={demo.steps} title={demo.title} />
        </Animated.View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{demo.steps.length} 步</Text>
          <Text style={styles.metaText}>{demo.frameCount} 帧</Text>
          {demo.knowledgePointKey ? (
            <PressableScale onPress={openPoint} style={styles.pointButton} accessibilityRole="button">
              <ThemedIcon name="book-outline" size={14} color={colors.primary} />
              <Text style={styles.pointText}>关联知识点</Text>
            </PressableScale>
          ) : null}
        </View>

        <Animated.View entering={entrance(1)} style={styles.card}>
          <View style={styles.cardHead}>
            <ThemedIcon name="list-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>步骤说明</Text>
          </View>
          {demo.steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>
                {step.explain || "（本步无文字说明，可拖动进度条查看配图）"}
              </Text>
            </View>
          ))}
        </Animated.View>

        <PressableScale
          onPress={() => router.push("/exam-408-viz" as never)}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <ThemedIcon name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.backText}>返回演示目录</Text>
        </PressableScale>

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>内容说明</Text>
          <Text style={styles.sourceText}>
            演示来自 408card.top 的逐帧镜像（作者授权，仅个人学习使用，不再分发）。
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function MissingDemo(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <Text style={styles.centerText}>演示参数缺失，请从演示目录重新进入。</Text>
      <Pressable onPress={() => router.push("/exam-408-viz" as never)} style={styles.retryButton} accessibilityRole="button">
        <Text style={styles.retryText}>返回演示目录</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    // 小屏铺满；平板/横屏限宽 560，配合播放器帧图的 16:10 比例避免高度失控
    playerWrap: { width: "100%", maxWidth: 560, alignSelf: "center" },
    centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
    centerText: { ...typography.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
    retryButton: {
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    retryText: { ...typography.micro, color: colors.primary },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
    metaText: { ...typography.micro, color: colors.textFaint },
    pointButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    pointText: { ...typography.micro, color: colors.primary },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    cardTitle: { ...typography.headline, color: colors.text },
    stepRow: { flexDirection: "row", gap: spacing.sm },
    stepBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    stepBadgeText: { ...typography.micro, color: colors.textMuted },
    stepText: { ...typography.caption, color: colors.textSecondary, lineHeight: 20, flex: 1 },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    backText: { ...typography.micro, color: colors.textMuted },
    sourceBox: {
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      gap: 4,
    },
    sourceTitle: { ...typography.micro, color: colors.textMuted },
    sourceText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  });
}