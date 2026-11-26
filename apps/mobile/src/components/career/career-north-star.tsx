import { useId, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PressableScale } from "@/components/pressable-scale";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerDirection } from "./career-model";

/**
 * ① 目标方向（对齐 demo 的 .dw-top）。
 *
 * 视觉：一层暖橙 → 冷蓝的**无边渐变洗**（不描边、不投影、不用实心卡片底），
 * 让目标方向直接长在页面画布上，而不是一块贴上去的矩形贴片。
 *
 * 数据全部来自 buildDirection（radar counts/top + 画像 + 技能），
 * 缺失维度显示「—」，不估算；CTA 走岗位雷达的目标岗位编辑弹层（唯一真实入口）。
 */
export function CareerNorthStar({ direction }: { direction: CareerDirection }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /** SVG 渐变 id 全局可见：每个实例独立 id，避免多实例串色 */
  const rawId = useId();
  const gradientId = useMemo(() => "careerNorthStar" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);

  const fitLabel = direction.fitScore === null ? "—" : String(direction.fitScore);
  const ctaLabel = direction.hasTarget ? "调整目标方向" : "设置目标方向";

  return (
    <View style={styles.northStar}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accentSoft} stopOpacity={0.9} />
            <Stop offset="0.55" stopColor={colors.accentSoft} stopOpacity={0.34} />
            <Stop offset="1" stopColor={colors.primarySoft} stopOpacity={0.66} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + gradientId + ")"} />
      </Svg>

      <View style={styles.nHeadRow}>
        <View style={styles.nHeadText}>
          <Text style={styles.nEyebrow}>CAREER DESK · 目标方向</Text>
          <Text style={styles.nTitle} numberOfLines={2}>
            {direction.title}
          </Text>
          <Text style={styles.nHint} numberOfLines={1}>
            {direction.hint}
          </Text>
        </View>
        <View
          style={styles.fitBadge}
          accessible
          accessibilityLabel={"方向匹配度 " + (direction.fitScore === null ? "暂无数据" : direction.fitScore + " 分")}
        >
          <Text style={styles.fitValue}>{fitLabel}</Text>
          <Text style={styles.fitLabel}>匹配度</Text>
        </View>
      </View>

      <View style={styles.bars}>
        {direction.bars.map((bar) => {
          const width: `${number}%` = `${Math.round(Math.max(0, Math.min(1, bar.ratio)) * 100)}%`;
          return (
            <View
              key={bar.key}
              style={styles.barRow}
              accessible
              accessibilityLabel={bar.label + " " + bar.valueLabel}
            >
              <Text style={styles.barLabel}>{bar.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width }]} />
              </View>
              <Text style={styles.barValue} numberOfLines={1}>
                {bar.valueLabel}
              </Text>
            </View>
          );
        })}
      </View>

      <PressableScale
        haptic
        scaleTo={0.99}
        hitSlop={4}
        onPress={() => router.push("/radar?editTarget=1" as never)}
        style={styles.nCta}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel + "，打开岗位雷达的目标岗位设置"}
      >
        <Text style={styles.nCtaText}>{ctaLabel}</Text>
        <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color={colors.focusCanvas} />
      </PressableScale>
    </View>
  );
}
