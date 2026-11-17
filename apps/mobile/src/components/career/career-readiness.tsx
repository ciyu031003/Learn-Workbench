import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { PressableScale } from "@/components/pressable-scale";
import { Skeleton } from "@/components/skeleton";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { ProgressBar } from "@/components/v2/progress-bar";
import { useTheme } from "@/theme";
import { tabularNums } from "@/theme/tokens";
import { withAlpha } from "@/lib/chart-math";

import { makeStyles } from "./career-styles";
import type { CareerDimension, CareerFunnelStage } from "./career-model";

/**
 * ③ 求职准备卡：目标方向 + 综合准备度 + 短板 chip + 四维进度 + 报告入口 + 投递漏斗。
 *
 * 三态（与拆分前一致）：加载中 → Skeleton card；有数据 → 卡片；无投递数据 → 不渲染漏斗块。
 * 漏斗占比条的分母是 submittedCount（已投递及之后各阶段的累计），每阶段至少 8% 宽以免看不见。
 */
export function CareerReadiness({
  showSkeleton,
  targetRole,
  overall,
  goalVerdict,
  weakestScore,
  weakestChip,
  weakStrong,
  weakSoft,
  dimensions,
  showFunnel,
  activeApplications,
  submittedCount,
  funnelStages,
}: {
  showSkeleton: boolean;
  targetRole: string;
  overall: number;
  goalVerdict: string;
  weakestScore: number;
  weakestChip: string;
  weakStrong: string;
  weakSoft: string;
  dimensions: CareerDimension[];
  showFunnel: boolean;
  activeApplications: number | null;
  submittedCount: number | null;
  funnelStages: CareerFunnelStage[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
      {false ? (
        null
      ) : showSkeleton ? (
        <Skeleton variant="card" style={styles.prepSkeleton} />
      ) : (
        <Surface style={styles.prepCard}>
          <View style={styles.prepTop}>
            <View style={styles.prepTopText}>
              <Text style={styles.prepLabel}>目标方向</Text>
              <Text style={styles.prepGoal}>{targetRole}</Text>
            </View>
            <View style={styles.prepScoreBox}>
              <Text style={[styles.prepScore, tabularNums]}>
                {overall}
                <Text style={styles.prepScoreUnit}>%</Text>
              </Text>
              <Text style={styles.prepScoreLabel}>综合准备度</Text>
            </View>
          </View>
          <Text style={styles.prepVerdict}>{goalVerdict}</Text>
          <View style={[styles.weakChip, { backgroundColor: weakSoft, borderColor: withAlpha(weakStrong, 0.28) }]}>
            <ThemedIcon
              name={weakestScore >= 100 ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={13}
              color={weakStrong}
            />
            <Text style={styles.weakChipText}>{weakestChip}</Text>
          </View>
          <View style={styles.dimList}>
            {dimensions.map((dimension) => (
              <View key={dimension.key} style={styles.dimRow}>
                <View style={styles.dimHead}>
                  <Text style={styles.dimLabel}>{dimension.label}</Text>
                  <Text style={[styles.dimScore, tabularNums]}>{dimension.score}%</Text>
                </View>
                <ProgressBar
                  value={Math.max(0, dimension.score) / 100}
                  tone={dimension.score >= 80 ? "success" : dimension.score >= 55 ? "primary" : "warning"}
                  height={6}
                />
                {dimension.detail ? <Text style={styles.dimDetail} numberOfLines={1}>{dimension.detail}</Text> : null}
              </View>
            ))}
          </View>

          <PressableScale
            hitSlop={4}
            scaleTo={0.98}
            onPress={() => router.push("/radar" as never)}
            style={styles.reportLink}
            accessibilityRole="button"
            accessibilityLabel="查看准备度报告"
          >
            <Text style={styles.reportLinkText}>查看准备度报告</Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
          </PressableScale>

          {showFunnel ? (
            <View style={styles.funnelBlock}>
              <View style={styles.funnelHead}>
                <Text style={styles.funnelTitle}>投递漏斗</Text>
                <Text style={styles.funnelMeta}>{activeApplications && activeApplications > 0 ? activeApplications + " 个进行中" : "暂无进行中的投递"}</Text>
              </View>
              <View style={styles.funnelRow}>
                {funnelStages.map((stage) => {
                  const base = Math.max(1, submittedCount ?? 0);
                  const ratio = stage.count === null ? 0 : Math.min(1, stage.count / base);
                  const width = ((stage.count && stage.count > 0 ? Math.max(0.08, ratio) : 0) * 100 + "%") as `${number}%`;
                  return (
                    <View key={stage.key} style={styles.funnelStep}>
                      <View style={styles.funnelBar}>
                        <View style={[styles.funnelFill, { width }]} />
                      </View>
                      <Text style={styles.funnelLabel} numberOfLines={1}>{stage.label}</Text>
                      <Text style={[styles.funnelCount, tabularNums]}>{stage.count && stage.count > 0 ? stage.count : "—"}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Surface>
      )}
    </>
  );
}
