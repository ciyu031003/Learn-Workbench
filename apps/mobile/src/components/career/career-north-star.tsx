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
 * ① 目标方向卡（对齐 demo 的 .dw-top）。
 *
 * 「暖橙渐变底」不引入新依赖：用 react-native-svg 的 LinearGradient 铺一层
 * accentSoft → surface → primarySoft 的语义色渐变（深浅色档自动成立），
 * 卡面本体仍是 surface，圆角由卡片 overflow:hidden 兜住。
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
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={colors.accentSoft} stopOpacity={0.95} />
            <Stop offset="0.52" stopColor={colors.accentSoft} stopOpacity={0.42} />
            <Stop offset="1" stopColor={colors.primarySoft} stopOpacity={0.6} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + gradientId + ")"} />
      </Svg>

      <Text style={styles.nEyebrow}>CAREER DESK · 目标方向</Text>
      <Text style={styles.nTitle} numberOfLines={2}>
        {direction.title}
      </Text>
      <Text style={styles.nHint} numberOfLines={2}>
        {direction.hint}
      </Text>

      <View style={styles.fitRow}>
        <View
          style={styles.fitNum}
          accessible
          accessibilityLabel={"方向匹配度 " + (direction.fitScore === null ? "暂无数据" : direction.fitScore + " 分")}
        >
          <Text style={styles.fitValue}>{fitLabel}</Text>
          <Text style={styles.fitLabel}>匹配度</Text>
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
