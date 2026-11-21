import { useMemo } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { useTheme } from "@/theme";
import { tabularNums } from "@/theme/tokens";

import { LearnPageHead } from "./learn-page-head";
import { makeStyles } from "./learn-styles";
import type { LearnCabinModel } from "./use-learn-screen";

/**
 * ② 学习舱头部卡（对齐 demo .lc-hero）：
 * 页头（eyebrow + 两行标题）→ 84px 环形进度（点按进阶段路线）+ 两句说明 + chips
 * → 蓝色通栏 CTA「继续学习 · 第 N 节 →」。
 *
 * 数据全部来自 hook 的 cabin 模型（roadmap / progress 派生），本组件只负责摆位与取色。
 */
export function LearnCabinHero({ cabin }: { cabin: LearnCabinModel }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasTopics = cabin.ring.total > 0;

  return (
    <View style={styles.heroCard}>
      {/* 装饰光斑（纯色温，不承载信息） */}
      <View pointerEvents="none" style={styles.heroGlow} />
      <View pointerEvents="none" style={styles.heroGlowWarm} />

      <LearnPageHead eyebrow={cabin.eyebrow} title={cabin.title} />

      <View style={styles.heroRow}>
        <PressableScale
          hitSlop={8}
          scaleTo={0.94}
          onPress={cabin.onRingPress}
          style={styles.ringPress}
          accessibilityRole="button"
          accessibilityLabel={cabin.ringA11y}
        >
          <RingProgress
            size={84}
            strokeWidth={6}
            progress={Math.max(0, Math.min(1, cabin.ring.percent / 100))}
            trackColor={colors.chartTrack}
          >
            <Text style={[styles.ringValue, tabularNums]}>
              {hasTopics ? cabin.ring.done + "/" + cabin.ring.total : "—"}
            </Text>
            <Text style={styles.ringLabel}>主题</Text>
          </RingProgress>
        </PressableScale>

        <View style={styles.heroMeta}>
          <Text style={styles.heroCopy} numberOfLines={3}>
            {cabin.copy}
          </Text>
          <View style={styles.chips}>
            <Text style={[styles.chip, styles.chipLead]} numberOfLines={1}>
              {cabin.weeksChip}
            </Text>
            <Text style={styles.chip} numberOfLines={1}>
              {cabin.pointChip}
            </Text>
            <Text style={styles.chip} numberOfLines={1}>
              {cabin.percentChip}
            </Text>
          </View>
        </View>
      </View>

      <PressableScale
        haptic
        hitSlop={6}
        scaleTo={0.99}
        onPress={cabin.onCta}
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel={cabin.ctaA11y}
      >
        <Text style={styles.ctaText} numberOfLines={1}>
          {cabin.ctaLabel}
        </Text>
        <Icon name="chevron" size={16} weight="bold" color="#FFFFFF" />
      </PressableScale>
    </View>
  );
}
