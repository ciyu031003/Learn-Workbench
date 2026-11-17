import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { HeroCard, Panel, PrimaryButton } from "@/components/v2/home-kit";
import { ProgressBar } from "@/components/v2/progress-bar";
import { useTheme } from "@/theme";
import { tabularNums } from "@/theme/tokens";
import { withAlpha } from "@/lib/chart-math";
import type { Phase } from "@learn-workbench/shared/schemas";

import { makeStyles } from "./learn-styles";
import type { LearnContinueCard } from "./use-learn-screen";

/**
 * ② 学习 hero（对齐 demo .spotlight）：阶段 chip + 路线名 + 进度 + 继续学习 + 唯一主 CTA。
 * 无阶段时退回「先创建你的学习路线」的 HeroCard，空态与拆分前一致。
 */
export function LearnHero({
  roadmapLoading,
  roadmap,
  currentPhaseNumber,
  stageName,
  routeSummary,
  currentPhasePercent,
  continueCard,
}: {
  roadmapLoading: boolean;
  roadmap: Phase[];
  currentPhaseNumber: number;
  stageName: string;
  routeSummary: { done: number; total: number; percent: number };
  currentPhasePercent: number | null;
  continueCard: LearnContinueCard;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
        {roadmapLoading ? null : roadmap.length > 0 ? (
          <Panel spotlight style={styles.routeCard}>
            <View style={styles.routeTop}>
              <Text style={styles.routeChip}>{"当前阶段 · P" + currentPhaseNumber}</Text>
              <PressableScale
                hitSlop={10}
                scaleTo={0.94}
                onPress={() => router.push("/roadmap" as never)}
                style={styles.routeLink}
                accessibilityRole="button"
                accessibilityLabel="查看完整路线"
              >
                <Text style={styles.routeLinkText}>完整路线</Text>
                <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
              </PressableScale>
            </View>
            <Text style={styles.routeTitle} numberOfLines={2}>{stageName}</Text>
            <Text style={styles.routeMeta}>
              {routeSummary.total > 0
                ? "已完成 " + routeSummary.done + " / " + routeSummary.total + " 个主题"
                : "还没有主题，先添加一个"}
            </Text>
            <View style={styles.routeProgressMeta}>
              <Text style={styles.routeProgressLabel}>阶段进度</Text>
              <Text style={[styles.routeProgressValue, tabularNums]}>
                {currentPhasePercent === null ? "—" : currentPhasePercent + "%"}
              </Text>
            </View>
            <ProgressBar value={(currentPhasePercent ?? 0) / 100} height={6} />

            <PressableScale
              haptic
              scaleTo={0.99}
              hitSlop={4}
              style={styles.routeContinue}
              onPress={continueCard.onPress}
              accessibilityRole="button"
              accessibilityLabel={continueCard.a11y}
            >
              <View style={[styles.routeContinueIcon, { backgroundColor: withAlpha(continueCard.color, 0.14) }]}>
                <ThemedIcon
                  name={continueCard.icon}
                  ios={continueCard.icon === "star" ? "star.fill" : undefined}
                  size={19}
                  color={continueCard.color}
                />
              </View>
              <View style={styles.routeContinueCopy}>
                <Text style={styles.routeContinueTitle} numberOfLines={2}>{continueCard.title}</Text>
                <Text style={styles.routeContinueMeta} numberOfLines={1}>{continueCard.meta}</Text>
              </View>
            </PressableScale>

            <PrimaryButton label="继续学习" icon="play" onPress={continueCard.onPress} style={styles.routeCta} />
          </Panel>
        ) : (
          <HeroCard
            eyebrow="学习起点"
            eyebrowIcon="layers-outline"
            title="先创建你的学习路线"
            copy="把目标拆成阶段与主题，每次学习都知道下一步。"
            ctaLabel="创建学习路线"
            ctaIcon="add"
            onCta={() => router.push("/roadmap" as never)}
          />
        )}
    </>
  );
}
