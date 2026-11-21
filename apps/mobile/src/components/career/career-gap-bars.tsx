import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerGapBar } from "./career-model";

/**
 * ③ 技能缺口（对齐 demo 的 .gapbars）。
 *
 * 3 条横向进度条：进度 = 当前等级 / 目标 Lv3（技能画像真实 level），
 * 右侧「Lv2 → Lv3」；画像为空时回落岗位雷达的 missingSkills（显示 Lv0 → Lv3）。
 *
 * 下面一行按钮是「职业 → 学习」的唯一写操作：
 * 复用既有 enrollJobGaps / fetchJobPlan 动线（在 use-career-screen 里），
 * 生成成功由现有 toast 反馈；没有任何缺口时 toast + 跳 /tasks（见 hook）。
 */
export function CareerGapBars({
  bars,
  count,
  enrolling,
  onGenerate,
}: {
  bars: CareerGapBar[];
  count: number;
  enrolling: boolean;
  onGenerate: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /**
   * 有缺口 → 生成学习任务（唯一写操作）。
   * 没缺口时按钮**不禁用**，而是变成「去今日任务继续学习」：把空态导向真实的下一步，
   * 而不是留一个按不动的死按钮（hook 里对应 toast + 跳 /tasks 的兜底分支）。
   */
  const canGenerate = count > 0;
  const ctaLabel = enrolling ? "正在生成…" : canGenerate ? "把 " + count + " 个缺口生成学习任务" : "去今日任务继续学习";

  return (
    <View>
      {bars.length === 0 ? (
        <Text style={styles.gapEmpty}>技能画像里还没有低于 Lv3 的技能 · 先去简历页补技能</Text>
      ) : (
        bars.map((bar) => {
          const width: `${number}%` = `${Math.round(Math.max(0, Math.min(1, bar.ratio)) * 100)}%`;
          return (
            <View
              key={bar.key}
              style={styles.gapRow}
              accessible
              accessibilityLabel={bar.label + "，当前 " + bar.level + " 级，目标 " + bar.targetLevel + " 级"}
            >
              <Text style={styles.gapName} numberOfLines={1}>
                {bar.label}
              </Text>
              <View style={styles.gapTrack}>
                <View style={[styles.gapFill, { width }]} />
              </View>
              <Text style={styles.gapValue} numberOfLines={1}>
                {bar.valueLabel}
              </Text>
            </View>
          );
        })
      )}

      <PressableScale
        haptic
        scaleTo={0.99}
        hitSlop={4}
        disabled={enrolling}
        onPress={onGenerate}
        style={[styles.gapCta, enrolling && styles.gapCtaDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: enrolling, busy: enrolling }}
        accessibilityLabel={enrolling ? "正在把技能缺口生成学习任务" : canGenerate ? "把 " + count + " 个技能缺口生成学习任务" : "去今日任务继续学习"}
      >
        {enrolling ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon
            name={canGenerate ? "sparkle" : "list"}
            size={ICON_SIZE.sm}
            weight="bold"
            color={colors.primary}
          />
        )}
        <Text style={styles.gapCtaText}>{ctaLabel}</Text>
        <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color={colors.primary} />
      </PressableScale>

      {canGenerate ? <Text style={styles.gapFoot}>生成后到「今日」的任务清单里完成</Text> : null}
    </View>
  );
}
