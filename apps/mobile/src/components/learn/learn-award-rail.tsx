import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PressableScale } from "@/components/pressable-scale";
import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 学习成就 · 横向金属卡轨（对齐 demo .award-rail / .award-mini）。
 *
 * 三张卡都由学习页已有的真实数据派生，不新增接口：
 *   ① 连续学习  = stats.streak
 *   ② 阶段推进  = 当前阶段 done / total
 *   ③ 知识积累  = 408 知识点数
 *
 * 视觉：深色钢面 + 金色折角 + 拉丝高光 + 齿孔条；文字全部走 typography token，
 * 不做 demo 里 5–6px 的桌面缩放字号（手机上不可读）。
 */

type AwardTone = "gold" | "silver" | "blue";

/** 折角/主字的金属色（三张卡用同一套材质，只换冷暖和识别色） */
const TONE: Record<AwardTone, { accent: string }> = {
  gold: { accent: "#E9C67E" },
  silver: { accent: "#D7DFE6" },
  blue: { accent: "#9FC6F5" },
};

type AwardItem = {
  key: string;
  word: string;
  title: string;
  sub: string;
  statValue: string;
  statLabel: string;
  serial: string;
  tone: AwardTone;
  onPress: () => void;
};

function pad2(value: number): string {
  const n = Math.max(0, Math.round(value));
  return n < 10 ? "0" + n : String(n);
}

export function LearnAwardRail({
  streak,
  phaseDone,
  phaseTotal,
  phasePercent,
  exam408PointCount,
}: {
  streak: number;
  phaseDone: number;
  phaseTotal: number;
  phasePercent: number;
  exam408PointCount: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const today = new Date();
  const dateLabel = pad2(today.getMonth() + 1) + " / " + pad2(today.getDate());

  const items: AwardItem[] = [
    {
      key: "streak",
      word: pad2(streak),
      title: "连续学习",
      sub: "STREAK AWARD",
      statValue: streak + " 天",
      statLabel: "当前连续",
      serial: "LW-STR",
      tone: "gold",
      onPress: () => router.push("/certificates" as never),
    },
    {
      key: "phase",
      word: phasePercent + "%",
      title: "阶段推进",
      sub: "PHASE AWARD",
      statValue: phaseDone + " / " + phaseTotal,
      statLabel: "已完成主题",
      serial: "LW-PH",
      tone: "silver",
      onPress: () => router.push("/roadmap" as never),
    },
    {
      key: "knowledge",
      word: String(exam408PointCount),
      title: "知识积累",
      sub: "KNOWLEDGE AWARD",
      statValue: exam408PointCount + " 点",
      statLabel: "408 精读",
      serial: "LW-KN",
      tone: "blue",
      onPress: () => router.push("/exam-408" as never),
    },
  ];

  return (
    <>
      <SectionTitle
        title="学习成就"
        right={<Text style={styles.meta}>{items.length} 张</Text>}
        actionLabel="全部"
        onAction={() => router.push("/certificates" as never)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={AWARD_WIDTH + 10}
        contentContainerStyle={styles.rail}
        accessibilityLabel="学习成就卡片"
      >
        {items.map((item) => {
          const tone = TONE[item.tone];
          return (
            <PressableScale
              key={item.key}
              haptic
              hitSlop={4}
              scaleTo={0.97}
              onPress={item.onPress}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={item.title + "成就卡，" + item.statValue}
            >
              <View style={styles.card}>
                <View pointerEvents="none" style={styles.gloss} />
                <View pointerEvents="none" style={[styles.corner, { backgroundColor: tone.accent }]} />

                <View style={styles.head}>
                  <Text style={styles.brand}>LEARN WORKBENCH</Text>
                  <Text style={styles.date}>{dateLabel}</Text>
                </View>

                <Text style={[styles.word, { color: tone.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {item.word}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.sub}
                </Text>

                <View style={styles.statRow}>
                  <Text style={styles.statValue} numberOfLines={1}>
                    {item.statValue}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {item.statLabel}
                  </Text>
                </View>

                <View style={styles.bars} pointerEvents="none">
                  {Array.from({ length: 22 }).map((_, index) => (
                    <View key={index} style={styles.bar} />
                  ))}
                </View>

                <View style={styles.foot}>
                  <Text style={styles.footText}>№ {item.serial}</Text>
                  <Text style={styles.footText}>LW</Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </>
  );
}

const AWARD_WIDTH = 138;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    meta: { ...typography.meta, color: colors.textMuted },
    rail: { gap: 10, paddingRight: spacing.xs, paddingVertical: 2 },
    cell: { width: AWARD_WIDTH },

    card: {
      width: AWARD_WIDTH,
      height: 206,
      borderRadius: 15,
      padding: 11,
      overflow: "hidden",
      backgroundColor: "#0B0C0E",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      shadowColor: "#09141A",
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    /** 左上到右下的镜面：一条低透明度斜带 */
    gloss: {
      position: "absolute",
      top: -40,
      left: 34,
      width: 34,
      height: 300,
      backgroundColor: "rgba(255,255,255,0.05)",
      transform: [{ rotate: "18deg" }],
    },
    /** 右上金色折角 */
    corner: {
      position: "absolute",
      top: -13,
      right: -13,
      width: 26,
      height: 26,
      transform: [{ rotate: "45deg" }],
      opacity: 0.92,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
    brand: { ...typography.eyebrow, letterSpacing: 0.8, color: "rgba(245,240,228,0.58)" },
    date: { ...typography.eyebrow, letterSpacing: 0.4, color: "rgba(245,240,228,0.76)" },

    word: { ...typography.numXl, marginTop: 16 },
    title: { ...typography.caption, fontWeight: "800", color: "#F5F0E4", marginTop: 8 },
    sub: { ...typography.eyebrow, letterSpacing: 0.7, color: "rgba(245,240,228,0.44)", marginTop: 3 },

    statRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 5,
      marginTop: "auto",
      paddingTop: 7,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.12)",
    },
    statValue: { ...typography.caption, fontWeight: "800", color: "#F5F0E4" },
    statLabel: { ...typography.eyebrow, color: "rgba(245,240,228,0.46)" },

    bars: { flexDirection: "row", gap: 2, height: 9, alignItems: "stretch", marginTop: 5 },
    bar: { flex: 1, backgroundColor: "rgba(239,234,220,0.42)" },

    foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
    footText: { ...typography.eyebrow, letterSpacing: 0.6, color: "rgba(245,240,228,0.38)" },
  });
