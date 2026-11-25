import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { radius, tabularNums, type ThemeColors } from "@/theme/tokens";

/**
 * 3D 金属庆祝卡（对齐 demo：阶段计划 / 一本书完结时旋转弹出的金属卡）。
 *
 * - 入场：从 -70° 绕 Y 轴转到 0°，同时 0.9 → 1 缩放，像一张实体卡被推到眼前；
 * - 交互：按住拖动可左右上下倾斜，松手弹回正中；倾斜时高光带跟着位移；
 * - 内容：完成对象、日期、正确率、已刷数量与唯一编号，排版为金属铭牌式三行。
 *
 * 动效纪律：worklet 内只读写共享值 + Reanimated API。
 */
export type AwardCardData = {
  title: string;
  subtitle?: string;
  dateText: string;
  /** 0–1；null = 未统计 */
  accuracy: number | null;
  reviewed: number;
  serial: string;
};

const GOLD = "#D8B36A";

export function AwardCard3D({ data }: { data: AwardCardData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();

  const appear = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    appear.value = reduced ? 1 : withTiming(1, { duration: 620 });
  }, [appear, reduced]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      tiltY.value = Math.max(-14, Math.min(14, event.translationX / 12));
      tiltX.value = Math.max(-10, Math.min(10, -event.translationY / 14));
      shine.value = Math.max(-1, Math.min(1, event.translationX / 120));
    })
    .onEnd(() => {
      tiltX.value = withSpring(0, { damping: 18, stiffness: 160 });
      tiltY.value = withSpring(0, { damping: 18, stiffness: 160 });
      shine.value = withSpring(0, { damping: 20, stiffness: 140 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(appear.value, [0, 1], [-70, 0]) + tiltY.value}deg` },
      { rotateX: `${interpolate(appear.value, [0, 1], [6, 0]) + tiltX.value}deg` },
      { scale: 0.9 + appear.value * 0.1 },
    ],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + Math.abs(shine.value) * 0.3,
    transform: [{ translateX: shine.value * 46 }, { rotate: "-18deg" }],
  }));

  const accuracy = data.accuracy === null ? "—" : Math.round(data.accuracy * 100) + "%";

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]} accessibilityLabel={`庆祝卡：${data.title}`}>
        {/* 金属底：深色钢面 + 斜向拉丝 + 金色包边 */}
        <View pointerEvents="none" style={styles.metalBase} />
        <View pointerEvents="none" style={[styles.brushed, { top: -20, left: -30 }]} />
        <View pointerEvents="none" style={[styles.brushed, { top: 40, left: -10 }]} />
        <View pointerEvents="none" style={styles.edgeTop} />
        <View pointerEvents="none" style={styles.edgeBottom} />
        <Animated.View pointerEvents="none" style={[styles.sheen, shineStyle]} />

        <View style={styles.headRow}>
          <Text style={styles.kicker}>PROGRAM COMPLETE</Text>
          <View style={styles.serialChip}>
            <Text style={styles.serialChipText}>{data.serial}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {data.title}
        </Text>
        {data.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {data.subtitle}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>正确率</Text>
            <Text style={[styles.statValue, tabularNums]}>{accuracy}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>已刷</Text>
            <Text style={[styles.statValue, tabularNums]}>
              {data.reviewed}
              <Text style={styles.statUnit}> 张</Text>
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>完成于</Text>
            <Text style={styles.statDate}>{data.dateText}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: 286,
      maxWidth: "100%",
      borderRadius: radius.card,
      overflow: "hidden",
      padding: 18,
      gap: 6,
      backgroundColor: "#101A22",
      borderWidth: 1,
      borderColor: "rgba(216,179,106,0.36)",
      shadowColor: "#000000",
      shadowOpacity: 0.5,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 16 },
      elevation: 14,
    },
    metalBase: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0D161D" },
    brushed: {
      position: "absolute",
      width: 520,
      height: 90,
      backgroundColor: "rgba(255,255,255,0.045)",
      transform: [{ rotate: "-22deg" }],
    },
    edgeTop: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.24)" },
    edgeBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(216,179,106,0.42)" },
    sheen: {
      position: "absolute",
      top: -40,
      left: 90,
      width: 64,
      height: 320,
      backgroundColor: "rgba(255,255,255,0.10)",
    },
    headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    kicker: { fontSize: 8, lineHeight: 11, fontWeight: "800", letterSpacing: 1.8, color: GOLD },
    serialChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "rgba(216,179,106,0.4)" },
    serialChipText: { fontSize: 7, lineHeight: 10, fontWeight: "700", letterSpacing: 0.8, color: "rgba(216,179,106,0.85)" },
    title: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: 0.2, color: "#F4F7F9", marginTop: 2 },
    subtitle: { fontSize: 10, lineHeight: 14, fontWeight: "500", color: "rgba(226,236,242,0.56)" },
    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 8 },
    stats: { flexDirection: "row", alignItems: "center" },
    stat: { flex: 1, gap: 2 },
    statDivider: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.10)" },
    statLabel: { fontSize: 8, lineHeight: 11, fontWeight: "600", letterSpacing: 0.6, color: "rgba(226,236,242,0.48)" },
    statValue: { fontSize: 17, lineHeight: 21, fontWeight: "800", color: "#F4F7F9" },
    statUnit: { fontSize: 9, fontWeight: "600", color: "rgba(226,236,242,0.6)" },
    statDate: { fontSize: 11, lineHeight: 16, fontWeight: "700", color: "rgba(244,247,249,0.86)" },
  });