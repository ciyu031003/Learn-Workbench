import { useMemo } from "react";
import { Text, View } from "react-native";

import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import type { MarketDecisionPayload } from "@/lib/market";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { KpiCard, MoveList } from "./market-widgets";

/**
 * What If 决策卡：目标城市 / 职能选择 + 场景 KPI + 建议 + 职能热度 / 城市机会 / 升温预警。
 * 重算的 loading / 失败态由页面模型提供（请求序号守卫在 use-market-screen.ts）。
 */
export function MarketDecisionCard({
  decision,
  decisionLoading,
  decisionError,
  decisionTarget,
  onPickCity,
  onPickFunction,
  onRetry,
}: {
  decision: MarketDecisionPayload | null;
  decisionLoading: boolean;
  decisionError: boolean;
  decisionTarget: { city: string; functionKey: string };
  onPickCity: () => void;
  onPickFunction: () => void;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card title="What If 决策" subtitle="城市迁移、职能热度与升温预警">
      <View style={styles.decisionPickers}>
        <PressableScale scaleTo={0.97} style={styles.pickerButton} onPress={onPickCity}>
          <Text style={styles.pickerText}>{decisionTarget.city || "目标城市"}</Text>
          <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
        </PressableScale>
        <PressableScale scaleTo={0.97} style={styles.pickerButton} onPress={onPickFunction}>
          <Text style={styles.pickerText}>{decisionTarget.functionKey || "目标职能"}</Text>
          <ThemedIcon name="chevron-down-outline" size={16} color={colors.textMuted} />
        </PressableScale>
      </View>
      {decisionError && !decision ? (
        /* v20-C3：失败给明确错误 + 重试（原先永远伪装成"正在计算"） */
        <View style={styles.centeredBox}>
          <ThemedIcon name="warning-outline" size={24} color={colors.textFaint} />
          <Text style={styles.mutedText}>场景计算失败</Text>
          <PressableScale style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryText}>重新计算</Text>
          </PressableScale>
        </View>
      ) : decision ? (
        <>
          <View style={styles.kpiGrid}>
            <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="目标岗位" value={String(decision.scenario.totalJobs)} color={colors.primary} />
            <KpiCard styles={styles} colors={colors} icon="cash-outline" label="薪资中位" value={decision.scenario.medianSalary != null ? `${decision.scenario.medianSalary}K` : "—"} color={colors.accent} />
          </View>
          <Text style={styles.groupTitle}>建议</Text>
          {decision.scenario.suggestions.slice(0, 4).map((suggestion) => (
            <Text key={suggestion.slice(0, 80)} style={styles.skillMeta}>{suggestion}</Text>
          ))}
          <Text style={styles.groupTitle}>职能热度</Text>
          <MoveList styles={styles} items={decision.hotspots} />
          <Text style={styles.groupTitle}>城市机会</Text>
          <MoveList styles={styles} items={decision.migrations} />
          <Text style={styles.groupTitle}>升温预警</Text>
          <MoveList styles={styles} items={decision.alerts} />
        </>
      ) : (
        <Text style={styles.mutedText}>
          {decisionLoading ? "正在计算决策场景…" : "选择目标城市 / 职能后开始计算"}
        </Text>
      )}
    </Card>
  );
}
