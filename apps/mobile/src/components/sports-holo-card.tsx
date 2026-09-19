import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SportsCardModel } from "@learn-workbench/shared";
import { holoImages } from "@/lib/holo-images";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 移动端闪光卡 v2（对齐 v11 方案 §2）：
 * - 正面把**荣誉放到主视觉**（主荣誉大字 + 副荣誉小字），战绩/绝技在下方；
 * - 卡背重做成「荣誉背面」（荣誉清单 + 装备清单 + 编号），**不再依赖 backfaceVisibility**
 *   —— 翻面用两段 rotateY + 交叉淡入，Android/iOS 行为一致（v1.9.0 真机卡背全黑的根因）；
 * - 拖动看视差 + 扫光条模拟镭射；worklet 只读写共享值（见 apps/mobile/CLAUDE.md 硬约束）。
 */
export function SportsHoloCard({
  model,
  style,
  hint = true,
}: {
  model: SportsCardModel;
  style?: StyleProp<ViewStyle>;
  hint?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const images = holoImages(model.sportKey);

  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const flip = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    sheen.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [sheen]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tiltY.value = Math.max(-1, Math.min(1, e.translationX / 120));
      tiltX.value = Math.max(-1, Math.min(1, e.translationY / 160));
    })
    .onEnd(() => {
      tiltY.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
      tiltX.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    });

  const tap = Gesture.Tap().onEnd(() => {
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: 620, easing: Easing.inOut(Easing.cubic) });
  });

  const gesture = Gesture.Exclusive(pan, tap);

  // 卡片整体：拖动倾斜 + 轻微透视
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${tiltY.value * 10}deg` },
      { rotateX: `${-tiltX.value * 8}deg` },
    ],
  }));

  // 翻面：正面 0→-90° 且淡出；背面 90→0° 且淡入（中点两者都侧对屏幕，无需 backfaceVisibility）
  const frontFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 1], [1, 0, 0]),
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, -90])}deg` }],
  }));
  const backFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [90, 0])}deg` }],
  }));

  const subjectStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tiltY.value * 12 },
      { translateY: tiltX.value * 10 },
      { scale: 1.06 },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (sheen.value * 2 - 1) * 170 }, { rotate: "18deg" }],
  }));

  return (
    <View style={style}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          {/* 正面 */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.face, frontFaceStyle]}>
            {images ? (
              <>
                <Image source={images.background} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                <Animated.View style={[StyleSheet.absoluteFill, subjectStyle]}>
                  <Image source={images.subject} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                </Animated.View>
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.artFallback]} />
            )}

            <Animated.View style={[styles.sheen, sheenStyle]} pointerEvents="none">
              <View style={[styles.sheenBar, { backgroundColor: colors.primary }]} />
              <View style={[styles.sheenBar, { backgroundColor: "#ffd76a" }]} />
              <View style={[styles.sheenBar, { backgroundColor: "#49a7ff" }]} />
            </Animated.View>

            <View style={styles.overlay} pointerEvents="none">
              {/* 荣誉：卡面主视觉 */}
              <View style={styles.honorBlock}>
                {model.mainHonor ? (
                  <>
                    <View style={styles.honorMainRow}>
                      <Text style={styles.honorCup}>🏆</Text>
                      <Text style={styles.honorTitle} numberOfLines={1}>
                        {model.mainHonor.title}
                      </Text>
                    </View>
                    {model.mainHonor.detail ? (
                      <Text style={styles.honorDetail} numberOfLines={1}>
                        {model.mainHonor.detail}
                      </Text>
                    ) : null}
                    {model.honors.map((honor) => (
                      <Text key={honor.title + honor.detail} style={styles.honorSub} numberOfLines={1}>
                        {honor.detail ? honor.title + " · " + honor.detail : honor.title}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.honorEmpty}>还没有公开成绩，去档案里加一条</Text>
                )}
              </View>

              <View>
                <Text style={styles.en} numberOfLines={1}>{model.subtitle}</Text>
                <Text style={styles.title} numberOfLines={1}>{model.title}</Text>
                <Text style={styles.collection} numberOfLines={1}>
                  {model.collection} · {model.memberNo}
                </Text>
              </View>

              <View style={styles.panel}>
                <View style={styles.statRow}>
                  {model.rowsRight.map(([label, value]) => (
                    <View key={label} style={styles.statCell}>
                      <Text style={styles.statLabel}>{label}</Text>
                      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.bottom}>
                <Text style={styles.tagline} numberOfLines={1}>{model.tagline}</Text>
                <Text style={styles.technique} numberOfLines={1}>{model.technique}</Text>
              </View>
            </View>
          </Animated.View>

          {/* 卡背：荣誉背面（有内容，不再是黑卡） */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.back, backFaceStyle]}>
            <View style={styles.backFrame}>
              <Text style={styles.backLabel}>HONORS · 荣誉</Text>
              {model.mainHonor ? (
                <Text style={styles.backHonorMain} numberOfLines={2}>
                  {model.mainHonor.detail
                    ? model.mainHonor.title + " · " + model.mainHonor.detail
                    : model.mainHonor.title}
                </Text>
              ) : (
                <Text style={styles.backMuted}>暂无公开成绩</Text>
              )}
              {model.honors.map((honor) => (
                <Text key={honor.title + honor.detail} style={styles.backHonorSub} numberOfLines={1}>
                  {honor.detail ? honor.title + " · " + honor.detail : honor.title}
                </Text>
              ))}

              <Text style={[styles.backLabel, styles.backLabelGap]}>GEAR · 装备</Text>
              {model.gear.length > 0 ? (
                model.gear.slice(0, 5).map((item) => (
                  <View key={item.label} style={styles.backGearRow}>
                    <Text style={styles.backGearLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.backGearValue} numberOfLines={1}>{item.value || "—"}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.backMuted}>还没有填装备</Text>
              )}

              <View style={styles.backFooter}>
                <Text style={styles.backCode}>{model.memberNo}</Text>
                <Text style={styles.backCode}>HOLOGRAPHIC</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {hint ? <Text style={styles.hint}>点按翻面 · 拖动看镭射与景深</Text> : null}
    </View>
  );
}

const CARD_RATIO = 1728 / 2368;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: "100%",
      aspectRatio: CARD_RATIO,
      borderRadius: radius.xl,
      backgroundColor: "#0b1017",
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.55)",
      overflow: "hidden",
    },
    face: { overflow: "hidden" },
    artFallback: { backgroundColor: colors.surfaceStrong },
    sheen: {
      position: "absolute",
      top: -120,
      bottom: -120,
      left: "30%",
      width: 120,
      flexDirection: "row",
      opacity: 0.22,
    },
    sheenBar: { flex: 1 },
    overlay: { flex: 1, padding: 16, justifyContent: "space-between" },
    honorBlock: { gap: 2, paddingRight: 8 },
    honorMainRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    honorCup: { fontSize: 20 },
    honorTitle: { flex: 1, fontSize: 26, fontWeight: "800", color: "#ffd98a", letterSpacing: 0.5 },
    honorDetail: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
    honorSub: { fontSize: 11, color: "#e7d9bd" },
    honorEmpty: { fontSize: 11, color: "#d8d2c6" },
    en: { fontSize: 9, letterSpacing: 2.4, color: "#f0d9a4" },
    title: { fontSize: 21, fontWeight: "800", color: "#ffffff", marginTop: 1, letterSpacing: 1 },
    collection: { fontSize: 9, color: "#e8c98c", marginTop: 1, letterSpacing: 0.4 },
    panel: {
      backgroundColor: "rgba(18,24,32,0.7)",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.32)",
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    statRow: { flexDirection: "row", gap: 8 },
    statCell: { flex: 1 },
    statLabel: { fontSize: 9, color: "#b9c2cc" },
    statValue: { fontSize: 13, fontWeight: "800", color: "#ffffff", marginTop: 1 },
    bottom: { gap: 1 },
    tagline: { fontSize: 10, color: "#e8c98c", textAlign: "center" },
    technique: { fontSize: 22, fontWeight: "800", color: "#ffffff", textAlign: "center", letterSpacing: 3 },
    back: {
      backgroundColor: "#0a0f16",
      padding: 14,
    },
    backFrame: {
      flex: 1,
      borderWidth: 1,
      borderColor: "rgba(194,163,104,0.75)",
      borderRadius: radius.md,
      padding: 14,
      gap: 4,
    },
    backLabel: { fontSize: 9, letterSpacing: 2, color: "#dbc18b" },
    backLabelGap: { marginTop: 12 },
    backHonorMain: { fontSize: 20, fontWeight: "800", color: "#ffd98a", lineHeight: 26 },
    backHonorSub: { fontSize: 12, color: "#e7d9bd" },
    backMuted: { fontSize: 11, color: "#8d9196" },
    backGearRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    backGearLabel: { fontSize: 11, color: "#9aa3ad" },
    backGearValue: { flex: 1, fontSize: 12, fontWeight: "600", color: "#f2ede4", textAlign: "right" },
    backFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: "auto" },
    backCode: { fontSize: 9, letterSpacing: 1.6, color: "#cfd6de" },
    hint: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 6 },
  });
