/* eslint-disable react-hooks/immutability -- 液面/波浪都靠共享值在 UI 线程驱动（与 today-stack 等既有写法一致） */
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { groupThousands } from "@/lib/nutrition-views";
import { useTheme } from "@/theme";
import { radius, shadows, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 水杯（v4 P4-c）——复刻参考图 8 的喝水界面：
 * 玻璃杯 + 蓝色液面 + 波浪 + 右侧刻度 + 底部快捷水量 + 加水时液面**上升动画**。
 *
 * 实现要点（性能优先）：
 *  - 液面高度**不用 height 动画**（每帧触发布局，低端机必掉帧），而是让水层固定为杯内高度，
 *    用 `translateY` 把整层往下推 —— 位移走 GPU 合成，和 P4-c 的曲线/热力图同样的思路。
 *  - 波浪是一张静态 SVG（两倍杯宽的重复波形），靠外层 `translateX` 循环滚动形成流动感；
 *    同样只动 transform，不重绘 path。
 *  - 尊重系统「减弱动态效果」（`useReducedMotion`）：波浪停止滚动、液面直接跳到位。
 *  - 弹层关闭时**取消动画**（`cancelAnimation`），避免后台空转耗电。
 */
export function WaterCupSheet({
  visible,
  totalMl,
  targetMl,
  lastLogId,
  lastTime,
  busy = false,
  onAdd,
  onUndo,
}: {
  visible: boolean;
  totalMl: number;
  targetMl: number;
  lastLogId?: number | null;
  /** 最近一次饮水时间（ISO），用于底部"现在 16:29"这类时间戳 */
  lastTime?: string | null;
  busy?: boolean;
  onAdd: (amountMl: number) => void;
  onUndo: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  /**
   * 杯子的尺寸按**可用高度**反推，而不是只看宽度：
   * 弹层里还有刻度、＋ 按钮、底部快捷值，若只按屏宽算（例如 230pt 宽 → 500pt 高），
   * 在小屏（可视高度 700pt 出头）会把底部按钮顶出屏幕。这里按弹层高度估算剩余空间，
   * 再换算杯宽（杯身比例 2.18:1），并夹在 140~220pt 之间保证"一眼是大杯子"。
   */
  const cupH = Math.round(Math.min(430, Math.max(240, height * 0.86 - 320)));
  const cupW = Math.min(220, Math.max(140, Math.round(cupH / 2.18)));
  const innerH = cupH - 12;
  const waveW = cupW * 2;

  const ratio = targetMl > 0 ? Math.min(1, Math.max(0, totalMl / targetMl)) : 0;
  const done = ratio >= 1;
  const remain = Math.max(0, targetMl - totalMl);

  /** 液面动画（0..1）；初值直接用当前比例，避免首次打开时从 0 涨上来像"新倒了一杯" */
  const level = useSharedValue(ratio);
  const scroll = useSharedValue(0);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(level);
      cancelAnimation(scroll);
      return;
    }
    level.value = reduced ? ratio : withTiming(ratio, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [visible, ratio, reduced, level, scroll]);

  useEffect(() => {
    if (!visible || reduced) {
      cancelAnimation(scroll);
      return;
    }
    scroll.value = 0;
    // 一个完整波形宽 = cupW，来回滚动看不出接缝（波形是 2 倍宽、首尾同相）
    scroll.value = withRepeat(withTiming(-cupW, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(scroll);
  }, [visible, reduced, scroll, cupW]);

  /** 达标时闪一下（不是撒花，只在杯沿高亮一次） */
  useEffect(() => {
    if (!visible || !done) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 达标高亮是"数据派生的一次性提示"，沿用既有模式
      setCelebrate(false);
      return;
    }
    setCelebrate(true);
    const t = setTimeout(() => setCelebrate(false), 1200);
    return () => clearTimeout(t);
  }, [visible, done]);

  const waterStyle = useAnimatedStyle(() => {
    const clamped = Math.min(1, Math.max(0, level.value));
    return { transform: [{ translateY: (1 - clamped) * innerH }] };
  });

  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: scroll.value }] }));

  const presets = useMemo(() => [200, 250, 300, 500], []);
  const clock = formatClock(lastTime ?? null);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={[styles.cup, { width: cupW, height: cupH }, celebrate && styles.cupDone]}>
          {/* 水层：固定杯内高度，靠 translateY 表示液面 */}
          <Animated.View style={[styles.waterLayer, { width: cupW, height: innerH }, waterStyle]}>
            <Animated.View style={[styles.waveWrap, { width: waveW, height: 12 }, waveStyle]}>
              <Svg width={waveW} height={12}>
                <Path
                  d={`M 0 8 Q ${cupW * 0.25} 2 ${cupW * 0.5} 8 T ${cupW} 8 T ${cupW * 1.5} 8 T ${waveW} 8 V 12 H 0 Z`}
                  fill={colors.teal}
                  opacity={0.92}
                />
                <Path
                  d={`M 0 8 Q ${cupW * 0.25} 2 ${cupW * 0.5} 8 T ${cupW} 8 T ${cupW * 1.5} 8 T ${waveW} 8`}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.6}
                />
              </Svg>
            </Animated.View>
            <View style={styles.waterBody} />
          </Animated.View>

          {/* 杯身高光与杯沿：放在水层之上，做出玻璃质感 */}
          <View pointerEvents="none" style={styles.glassSheen} />
          <View pointerEvents="none" style={styles.rim} />

          {/* 杯内中央读数 */}
          <View pointerEvents="none" style={styles.centerReadout}>
            <Text style={styles.centerValue}>{groupThousands(totalMl)}</Text>
            <Text style={styles.centerUnit}>/ {groupThousands(targetMl)} ml</Text>
            <Text style={styles.centerHint}>{done ? "今天的水够了 👍" : `还差 ${remain} ml`}</Text>
          </View>
        </View>

        {/* 刻度放在杯子**右侧**（与参考图一致）：刻度线紧贴杯子，数字在外侧 */}
        <View style={[styles.scale, { height: innerH }]}>
          {[1, 0.75, 0.5, 0.25].map((r) => (
            <View key={r} style={[styles.scaleRow, { bottom: innerH * r - 7 }]}>
              <View style={[styles.scaleTick, r === 1 && styles.scaleTickStrong]} />
              <Text style={[styles.scaleLabel, r === 1 && styles.scaleLabelStrong]}>
                {groupThousands(targetMl * r)}ml
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 中间的大 ＋：参考图里唯一的主操作 */}
      <View style={styles.addRow}>
        <PressableScale
          haptic
          disabled={busy}
          scaleTo={0.9}
          onPress={() => onAdd(250)}
          style={[styles.addBtn, busy && styles.addBtnBusy]}
          accessibilityLabel="加 250 毫升水"
        >
          <ThemedIcon name="add" size={30} color="#fff" />
        </PressableScale>
        <Text style={styles.addHint}>点 ＋ 记 250 ml</Text>
      </View>

      {/* 底部：水量快捷值 + 时间戳 + 撤销 */}
      <View style={styles.footer}>
        <View style={styles.footerHead}>
          <Text style={styles.footerTitle}>选择水量</Text>
          <View style={styles.timeChip}>
            <ThemedIcon name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.timeText}>{clock ?? "今天还没有记录"}</Text>
          </View>
        </View>
        <View style={styles.presetRow}>
          {presets.map((p) => (
            <PressableScale
              key={p}
              haptic
              disabled={busy}
              scaleTo={0.94}
              onPress={() => onAdd(p)}
              style={[styles.preset, p === 250 && styles.presetActive]}
            >
              <Text style={[styles.presetText, p === 250 && styles.presetTextActive]}>{p}</Text>
              <Text style={[styles.presetUnit, p === 250 && styles.presetTextActive]}>ml</Text>
            </PressableScale>
          ))}
          <Pressable
            hitSlop={8}
            disabled={!lastLogId || busy}
            onPress={() => {
              haptics.warning();
              onUndo();
            }}
            style={[styles.undo, !lastLogId && styles.undoOff]}
            accessibilityLabel="撤销最近一次饮水"
          >
            <ThemedIcon name="arrow-undo-outline" size={17} color={lastLogId ? colors.textMuted : colors.textFaint} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** ISO → 「现在 16:29」/「昨天 20:04」；解析失败返回 null（不显示假时间） */
function formatClock(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return `${sameDay ? "现在" : `${d.getMonth() + 1}/${d.getDate()}`} ${hh}:${mm}`;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 14, alignItems: "center" },
    stage: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    cup: {
      borderWidth: 2.5,
      borderColor: colors.borderStrong,
      borderTopWidth: 0,
      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      overflow: "hidden",
      backgroundColor: "rgba(47,179,166,0.06)",
      justifyContent: "flex-end",
      ...shadows.card,
    },
    cupDone: { borderColor: colors.success },
    /**
     * 水层贴着**杯底**（bottom: 0）而不是杯顶：液面高度靠 translateY 表达
     * —— ratio=1 时位移 0（水从底满到杯口），ratio=0 时整层被推到杯子下方（被 overflow 裁掉）。
     * 若写成 top: 0，满杯时水会悬在杯子上半部、底部留一条空隙。
     */
    waterLayer: { position: "absolute", bottom: 0, left: 0 },
    waveWrap: { position: "absolute", top: -6, left: 0 },
    waterBody: { flex: 1, backgroundColor: colors.teal, opacity: 0.86 },
    glassSheen: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 14,
      width: 16,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.28)",
    },
    rim: {
      position: "absolute",
      top: -1,
      left: -2,
      right: -2,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
    },
    centerReadout: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 1 },
    centerValue: { ...typography.title1, fontSize: 30, color: "#0B3A36", ...tabularNums },
    centerUnit: { ...typography.caption, color: "rgba(11,58,54,0.7)", fontWeight: "700", ...tabularNums },
    centerHint: { ...typography.micro, color: "rgba(11,58,54,0.75)", marginTop: 2 },
    scale: { width: 74, justifyContent: "flex-start" },
    /** 绝对定位在刻度列里：left:0 让刻度线贴住杯子，数字排在外侧 */
    scaleRow: { position: "absolute", left: 0, flexDirection: "row", alignItems: "center", gap: 5 },
    scaleLabel: { ...typography.micro, fontSize: 10, color: colors.textFaint, fontWeight: "600", ...tabularNums },
    scaleLabelStrong: { color: colors.textMuted, fontWeight: "800" },
    scaleTick: { width: 12, height: 1.5, borderRadius: 1, backgroundColor: colors.border },
    scaleTickStrong: { width: 18, height: 2, backgroundColor: colors.borderStrong },
    addRow: { alignItems: "center", gap: 6 },
    addBtn: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.teal,
      ...shadows.floating,
    },
    addBtnBusy: { opacity: 0.6 },
    addHint: { ...typography.micro, color: colors.textMuted, fontWeight: "600" },
    footer: {
      alignSelf: "stretch",
      gap: 10,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerTitle: { ...typography.headline, color: colors.text },
    timeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    timeText: { ...typography.micro, color: colors.textMuted, fontWeight: "600" },
    presetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    preset: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: "rgba(47,179,166,0.12)",
    },
    presetActive: { backgroundColor: colors.teal },
    presetText: { ...typography.headline, color: colors.teal, ...tabularNums },
    presetUnit: { ...typography.micro, fontSize: 9, color: colors.teal, fontWeight: "600" },
    presetTextActive: { color: "#fff" },
    undo: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    undoOff: { opacity: 0.45 },
  });
