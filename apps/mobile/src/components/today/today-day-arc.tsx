import { useId, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * ② 今日时间弧（V7 Day Sheet 的核心视觉）。
 *
 * 06:00–24:00 的半圆弧：底轨 + 橙色→蓝色渐变进度弧；弧上圆点是「今日已发生的专注块」
 * （由 sessions 派生的 focusDots，开始时刻映射到弧角度），当前时刻是橙色点 + 圆环，
 * 弧内浮一个胶囊显示当前时间 +「现在」。弧下是 06/12/18/24 时间刻度，再下一行是
 * 今日专注 / 任务完成 / 连续天数三格，最后是页面上唯一的黑色主 CTA。
 *
 * 约束（门禁）：
 * - 颜色一律来自 useTheme().colors（渐变用 accent → primary → chart[2]，等价 demo 的 #e58a35 → #347bc1 → #8bc4eb）；
 * - 不做无限循环动画、不手写时序动画；主卡不做入场淡入（避免重渲染把透明度卡在中间）；
 * - 所有几何量在 viewBox(320×168) 里算，按实测宽度等比缩放到屏幕。
 */

const VB_W = 320;
const VB_H = 168;
/** 半圆：圆心在弦中点，半径 140 → 左端点 (20,150)、右端点 (300,150) */
const ARC_R = 140;
const ARC_CX = VB_W / 2;
const ARC_CY = 150;
const ASPECT = VB_H / VB_W;

/** 胶囊（现在）的换算：顶部离弧框顶 84（viewBox 单位），并留出自身宽度的一半用于左右夹紧 */
const CAPSULE_TOP = 84;
const CAPSULE_HALF = 46;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** 进度 0..1 → 弧上的点（0 = 06:00 左端，1 = 24:00 右端，走上方） */
function arcPoint(progress: number): { x: number; y: number } {
  const t = clamp01(progress);
  const angle = Math.PI - Math.PI * t;
  return { x: ARC_CX + ARC_R * Math.cos(angle), y: ARC_CY - ARC_R * Math.sin(angle) };
}

/** 从 06:00 画到 progress 的弧线 d（半圆以内，largeArc 恒为 0，sweep=1 从左上绕过头顶到右侧） */
function arcPathTo(progress: number): string {
  const end = arcPoint(progress);
  return "M " + (ARC_CX - ARC_R) + " " + ARC_CY + " A " + ARC_R + " " + ARC_R + " 0 0 1 " + end.x + " " + end.y;
}

export type TodayFocusDot = { key: string; progress: number; minutes: number };

export function TodayDayArc({
  dots,
  nowProgress,
  nowLabel,
  focusLabel,
  taskRatio,
  streak,
  onStartFocus,
}: {
  /** 今日专注块的圆点（不超过 3 个） */
  dots: TodayFocusDot[];
  /** 当前时刻在 06:00–24:00 上的进度 0..1 */
  nowProgress: number;
  /** 当前时刻 HH:MM */
  nowLabel: string;
  /** 今日专注分钟（1h 22m / 25m） */
  focusLabel: string;
  /** 任务完成（2/3，没任务时「—」） */
  taskRatio: string;
  streak: number;
  onStartFocus: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rawId = useId();
  const gradientId = useMemo(() => "lwbDayArc" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  /** 时间弧按实测宽度等比缩放：画布宽度 = 卡片内容宽度 */
  const [arcW, setArcW] = useState(0);

  const now = arcPoint(nowProgress);
  const scale = arcW / VB_W;
  /** 胶囊水平跟随当前时刻，并按自身半宽夹紧，避免贴边被裁掉 */
  const maxShift = Math.max(0, arcW / 2 - CAPSULE_HALF);
  const rawShift = (now.x - ARC_CX) * scale;
  const capsuleShift = Math.max(-maxShift, Math.min(maxShift, rawShift));

  return (
    <View style={styles.card}>
      <View
        style={styles.arcBox}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== arcW) setArcW(w);
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={"今日时间弧，06 点到 24 点，现在 " + nowLabel + "，已专注 " + focusLabel}
      >
        {arcW > 0 ? (
          <Svg width={arcW} height={arcW * ASPECT} viewBox={"0 0 " + VB_W + " " + VB_H}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.accent} />
                <Stop offset="0.5" stopColor={colors.primary} />
                <Stop offset="1" stopColor={colors.chart[2]} />
              </LinearGradient>
            </Defs>
            {/* 底轨 */}
            <Path
              d={arcPathTo(1)}
              fill="none"
              stroke={colors.chartTrack}
              strokeWidth={12}
              strokeLinecap="round"
            />
            {/* 进度弧：从 06:00 画到此刻 */}
            {nowProgress > 0.005 ? (
              <Path
                d={arcPathTo(nowProgress)}
                fill="none"
                stroke={"url(#" + gradientId + ")"}
                strokeWidth={12}
                strokeLinecap="round"
              />
            ) : null}
            {/* 今日已发生的专注块 */}
            {dots.map((dot) => {
              const p = arcPoint(dot.progress);
              return <Circle key={dot.key} cx={p.x} cy={p.y} r={4.5} fill={colors.primary} opacity={0.62} />;
            })}
            {/* 现在：橙色点 + 圆环 */}
            <Circle cx={now.x} cy={now.y} r={10.5} fill="none" stroke={colors.accent} strokeOpacity={0.3} strokeWidth={2} />
            <Circle cx={now.x} cy={now.y} r={5.5} fill={colors.accent} />
          </Svg>
        ) : null}

        {/* 弧内「现在」胶囊：只跟随、不拦截手势 */}
        {arcW > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.nowWrap, { top: CAPSULE_TOP * scale }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.nowCapsule, { transform: [{ translateX: capsuleShift }] }]}>
              <Text style={styles.nowTime} {...TEXT_SCALE_POLICY.chrome}>
                {nowLabel}
              </Text>
              <Text style={styles.nowTag} {...TEXT_SCALE_POLICY.chrome}>
                现在
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* 06:00 / 12:00 / 18:00 / 24:00 */}
      <View style={styles.axisRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {["06:00", "12:00", "18:00", "24:00"].map((label) => (
          <Text key={label} style={styles.axisLabel} {...TEXT_SCALE_POLICY.chrome}>
            {label}
          </Text>
        ))}
      </View>

      {/* 今日专注 / 任务完成 / 连续天数 */}
      <View style={styles.figures}>
        <View style={styles.figureCell}>
          <Text style={styles.figureValue} {...TEXT_SCALE_POLICY.chrome}>
            {focusLabel}
          </Text>
          <Text style={styles.figureLabel} {...TEXT_SCALE_POLICY.chrome}>
            今日专注
          </Text>
        </View>
        <View style={styles.figureDivider} />
        <View style={styles.figureCell}>
          <Text style={styles.figureValue} {...TEXT_SCALE_POLICY.chrome}>
            {taskRatio}
          </Text>
          <Text style={styles.figureLabel} {...TEXT_SCALE_POLICY.chrome}>
            任务完成
          </Text>
        </View>
        <View style={styles.figureDivider} />
        <View style={styles.figureCell}>
          <View style={styles.figureStreak}>
            <Icon name="flame" size={ICON_SIZE.sm} weight="fill" color={colors.accent} />
            <Text style={styles.figureValue} {...TEXT_SCALE_POLICY.chrome}>
              {streak > 0 ? String(streak) : "—"}
            </Text>
          </View>
          <Text style={styles.figureLabel} {...TEXT_SCALE_POLICY.chrome}>
            连续天数
          </Text>
        </View>
      </View>

      {/* 页面上唯一的主 CTA：黑底白字（深色模式下自动反转成浅底深字，保证对比度） */}
      <Pressable
        hitSlop={6}
        onPress={() => {
          haptics.light();
          onStartFocus();
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="开始 25 分钟专注"
      >
        <Text style={styles.ctaText}>开始 25 分钟专注</Text>
        <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.panel,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    arcBox: { width: "100%", aspectRatio: VB_W / VB_H },
    nowWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
    nowCapsule: {
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.control,
      backgroundColor: colors.surfaceStrong,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    nowTime: { ...typography.headline, ...tabularNums, color: colors.text },
    nowTag: { ...typography.eyebrow, letterSpacing: 1.4, color: colors.textMuted, marginTop: 1 },
    axisRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginTop: spacing.xs },
    axisLabel: { ...typography.eyebrow, ...tabularNums, color: colors.textMuted },
    figures: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
    },
    figureCell: { flex: 1, alignItems: "center" },
    figureStreak: { flexDirection: "row", alignItems: "center", gap: 3 },
    figureValue: { ...typography.num, ...tabularNums, color: colors.text },
    figureLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted, marginTop: 3 },
    figureDivider: { width: 1, height: 26, backgroundColor: colors.border },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 46,
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.control,
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { ...typography.callout, fontWeight: "700", color: "#FFFFFF" },
  });
