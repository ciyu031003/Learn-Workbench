import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
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
 * 移动端闪光卡（对齐 Web 三维卡的信息设计，但不在 RN 里跑 three.js）：
 * 主体 / 背景两层贴图做视差，扫光条 + 虹彩描边模拟镭射，点按翻面看卡背。
 *
 * worklet 约束（见 apps/mobile/CLAUDE.md）：共享值全部声明在手势与 useAnimatedStyle 之前，
 * worklet 内只读写共享值与 Reanimated API，不调用普通函数。
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

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${flip.value * 180 + tiltY.value * 14}deg` },
      { rotateX: `${-tiltX.value * 10}deg` },
    ],
  }));

  const frontStyle = useAnimatedStyle(() => ({ opacity: flip.value > 0.5 ? 0 : 1 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.value > 0.5 ? 1 : 0 }));

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
          <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
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
              <View>
                <Text style={styles.en} numberOfLines={1}>{model.subtitle}</Text>
                <Text style={styles.title} numberOfLines={1}>{model.title}</Text>
                <Text style={styles.collection} numberOfLines={1}>{model.collection}</Text>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle} numberOfLines={1}>{model.panelTitle}</Text>
                <View style={styles.statRow}>
                  {model.rowsRight.map(([label, value]) => (
                    <View key={label} style={styles.statCell}>
                      <Text style={styles.statLabel}>{label}</Text>
                      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
                {model.flags.length > 0 ? (
                  <View style={styles.flagRow}>
                    {model.flags.slice(0, 3).map((flag) => (
                      <Text key={flag} style={styles.flag} numberOfLines={1}>{flag}</Text>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.bottom}>
                <Text style={styles.tagline} numberOfLines={1}>{model.tagline}</Text>
                <Text style={styles.technique} numberOfLines={1}>{model.technique}</Text>
                <View style={styles.footerRow}>
                  <Text style={styles.footer}>{model.edition}</Text>
                  <Text style={styles.footer}>HOLOGRAPHIC</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, styles.back, backStyle]}>
            <View style={styles.backSealBox}>
              <Text style={styles.backSeal}>幻</Text>
            </View>
            <Text style={styles.backCollection} numberOfLines={1}>{model.collection}</Text>
            <Text style={styles.backEn} numberOfLines={1}>{model.subtitle}</Text>
            <Text style={styles.backEdition} numberOfLines={1}>{model.edition}</Text>
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
    overlay: {
      flex: 1,
      padding: 16,
      justifyContent: "space-between",
    },
    en: { fontSize: 9, letterSpacing: 2.4, color: "#f0d9a4", fontFamily: undefined },
    title: { fontSize: 25, fontWeight: "800", color: "#ffffff", marginTop: 2, letterSpacing: 1 },
    collection: { fontSize: 9, color: "#e8c98c", marginTop: 2, letterSpacing: 0.6 },
    panel: {
      backgroundColor: "rgba(20,26,34,0.72)",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.35)",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    panelTitle: { fontSize: 10, letterSpacing: 1.2, color: "#e8c98c" },
    statRow: { flexDirection: "row", gap: 8 },
    statCell: { flex: 1 },
    statLabel: { fontSize: 9, color: "#b9c2cc" },
    statValue: { fontSize: 14, fontWeight: "800", color: "#ffffff", marginTop: 1 },
    flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    flag: {
      fontSize: 9,
      color: "#e8c98c",
      borderWidth: 1,
      borderColor: "rgba(217,185,120,0.55)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    bottom: { gap: 2 },
    tagline: { fontSize: 11, color: "#e8c98c", textAlign: "center" },
    technique: { fontSize: 24, fontWeight: "800", color: "#ffffff", textAlign: "center", letterSpacing: 3 },
    footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    footer: { fontSize: 8, letterSpacing: 1.6, color: "#cfd6de" },
    back: {
      backgroundColor: "#0a0f16",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      transform: [{ rotateY: "180deg" }],
      backfaceVisibility: "hidden",
    },
    backSealBox: {
      width: 74,
      height: 74,
      borderWidth: 1,
      borderColor: "#c2a368",
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "45deg" }],
      marginBottom: 12,
    },
    backSeal: { fontSize: 30, color: "#dbc18b", transform: [{ rotate: "-45deg" }] },
    backCollection: { fontSize: 12, color: "#dbc18b", letterSpacing: 1 },
    backEn: { fontSize: 9, letterSpacing: 2, color: "#8d9196" },
    backEdition: { fontSize: 9, letterSpacing: 2, color: "#8d9196" },
    hint: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 6 },
  });
