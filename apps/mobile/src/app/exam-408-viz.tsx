import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { ThemedIcon } from "@/components/themed-icon";
import {
  getExam408Demos,
  groupExam408Demos,
  type Exam408DemoSummary,
} from "@/lib/exam-408-demos";
import { recordCrumb } from "@/lib/crash-capture";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/** 408 演示目录（v1.55）：按四科分组列出逐帧演示，点开进播放器 */
export default function Exam408VizScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [demos, setDemos] = useState<Exam408DemoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDemos(await getExam408Demos());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "演示目录加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = useMemo(() => groupExam408Demos(demos), [demos]);
  const totalSteps = useMemo(
    () => demos.reduce((sum, demo) => sum + demo.stepsCount, 0),
    [demos],
  );

  const openDemo = (demo: Exam408DemoSummary) => {
    recordCrumb("408-viz-open", { key: demo.key });
    router.push(`/exam-408-viz-player?key=${encodeURIComponent(demo.key)}` as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="408 演示" scrollY={header.scrollY} backTo="/exam-408" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle
          title="408 逐帧演示"
          subtitle="播放 / 单步 / 倍速，看懂每个过程再去做题"
        />

        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon name="play" size={24} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroEyebrow}>VISUAL DEMOS</Text>
              <Text style={styles.heroTitle}>把过程拆成帧来看</Text>
              <Text style={styles.heroText}>
                演示按数据结构、组成原理、操作系统与网络分组；每帧配一句说明，可暂停后逐步查看。
              </Text>
            </View>
          </View>
          <View style={styles.stats}>
            <HeroStat value={demos.length} label="演示" styles={styles} />
            <HeroStat value={totalSteps} label="步骤" styles={styles} />
            <HeroStat value={groups.length} label="科目" styles={styles} />
          </View>
        </Animated.View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>正在加载演示目录…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.centerText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centerState}>
            <ThemedIcon name="play" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>演示正在导入</Text>
            <Text style={styles.centerText}>
              408 演示资产正在逐帧镜像，导入完成后这里会自动出现目录。
            </Text>
          </View>
        ) : (
          groups.map((group, groupIndex) => (
            <Animated.View key={group.subjectKey} entering={entrance(groupIndex + 1)} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{group.label}</Text>
                <Text style={styles.sectionMeta}>{group.demos.length} 个演示</Text>
              </View>
              {group.demos.map((demo) => (
                <PressableScale
                  key={demo.key}
                  onPress={() => openDemo(demo)}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`播放演示：${demo.title}`}
                >
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {demo.title}
                    </Text>
                    {demo.description ? (
                      <Text style={styles.cardText} numberOfLines={2}>
                        {demo.description}
                      </Text>
                    ) : null}
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMeta}>{demo.stepsCount} 步</Text>
                      <Text style={styles.cardMeta}>{demo.frameCount} 帧</Text>
                      {demo.knowledgePointKey ? (
                        <Text style={styles.cardMeta}>含关联知识点</Text>
                      ) : null}
                    </View>
                  </View>
                  <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              ))}
            </Animated.View>
          ))
        )}

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

function HeroStat({
  value,
  label,
  styles,
}: {
  value: number;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    hero: {
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.card,
    },
    heroTop: { flexDirection: "row", gap: spacing.md },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    heroBody: { flex: 1, gap: 2 },
    heroEyebrow: { ...typography.micro, color: colors.textFaint, letterSpacing: 0.8 },
    heroTitle: { ...typography.title2, color: colors.text },
    heroText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
    stats: { flexDirection: "row", gap: spacing.sm },
    stat: {
      flex: 1,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    statValue: { ...typography.headline, color: colors.text },
    statLabel: { ...typography.micro, color: colors.textMuted },
    centerState: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] },
    centerText: { ...typography.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
    emptyTitle: { ...typography.headline, color: colors.text },
    retryButton: {
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    retryText: { ...typography.micro, color: colors.primary },
    section: { gap: spacing.sm },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    sectionTitle: { ...typography.headline, color: colors.text },
    sectionMeta: { ...typography.micro, color: colors.textMuted },
    card: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    cardBody: { flex: 1, gap: 4 },
    cardTitle: { ...typography.callout, color: colors.text, lineHeight: 20 },
    cardText: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
    cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    cardMeta: { ...typography.micro, color: colors.textFaint },
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