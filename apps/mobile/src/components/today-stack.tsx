/* eslint-disable react-hooks/immutability */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useAppStore } from "@/store/app-store";
import { mainPhases } from "@learn-workbench/content";
import { SPORT_CATALOG, formatDuration, todayISO } from "@learn-workbench/shared";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";

interface TodayCard {
  key: string;
  eyebrow: string;
  title: string;
  sub: string;
  icon: "timer" | "book" | "sunny" | "flower";
  base: string;
  blob1: string;
  blob2: string;
  action: "focus" | "none";
}

function daySeed() {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (seed * 31 + i * 17) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function TodayStack({ onStartFocus }: { onStartFocus: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tasks = useAppStore((s) => s.tasks);
  const sessions = useAppStore((s) => s.sessions);
  const sports = useAppStore((s) => s.sports);
  const aiTip = useAppStore((s) => s.aiTip);
  const progress = useAppStore((s) => s.progress);

  const today = todayISO();
  const focusStats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const todayDone = todayTasks.filter((t) => t.done).length;
  const quote = getDailyQuote();

  const studyTitle = useMemo(() => {
    const first = mainPhases[0];
    if (!first) return "从今天的学习阶段开始";
    const nextTopic = first.topics.find((t) => !progress[t.id]?.done);
    return nextTopic ? `学习《${nextTopic.title}》` : `继续《${first.title}》`;
  }, [progress]);

  const studySub = useMemo(() => {
    const first = mainPhases[0];
    if (!first) return "今天从一个章节开始，保持节奏";
    const nextTopic = first.topics.find((t) => !progress[t.id]?.done);
    return nextTopic ? "从当前阶段的下一节开始" : "当前阶段已全部完成";
  }, [progress]);

  const sportChoice = useMemo(() => {
    const key = sports[0]?.sportKey ?? SPORT_CATALOG[daySeed() % SPORT_CATALOG.length].key;
    return SPORT_CATALOG.find((s) => s.key === key) ?? SPORT_CATALOG[0];
  }, [sports]);

  const baseCards: TodayCard[] = useMemo(() => {
    const todayMinutes = focusStats.todayMinutes;
    const sportMinutes = sports.reduce((sum, r) => sum + r.minutes, 0);
    const doneTip =
      todayTasks.length === 0
        ? "今天还没有任务，去学习页添加一个吧"
        : todayDone === todayTasks.length
          ? "今天任务已全部完成"
          : `已完成 ${todayDone} / ${todayTasks.length} 件事`;
    const aiText = aiTip && aiTip.date === today ? aiTip.text : doneTip;

    return [
      {
        key: "focus",
        eyebrow: "今日焦点 · TODAY FOCUS",
        title: `今日专注 ${Math.round(todayMinutes)} 分钟`,
        sub: "目标 2.5 小时 · 点击开始专注",
        icon: "timer",
        base: "#2F74C0",
        blob1: "#F28C28",
        blob2: "#5DAE74",
        action: "focus",
      },
      {
        key: "study",
        eyebrow: "今日学习 · TODAY STUDY",
        title: studyTitle,
        sub: studySub,
        icon: "book",
        base: "#F28C28",
        blob1: "#FF8F6B",
        blob2: "#8D7BD8",
        action: "none",
      },
      {
        key: "sport",
        eyebrow: "今日运动 · MOVE",
        title: sportMinutes > 0 ? `今日运动 ${formatDuration(sportMinutes)}` : `去打${sportChoice.name}`,
        sub: sportMinutes > 0 ? "已有运动记录，继续保持" : "动一动，把能量还给身体",
        icon: "sunny",
        base: "#2FB3A6",
        blob1: "#57C7B2",
        blob2: "#8D7BD8",
        action: "none",
      },
      {
        key: "quote",
        eyebrow: "今日一句 · DAILY MOTTO",
        title: quote,
        sub: aiText,
        icon: "flower",
        base: "#8D7BD8",
        blob1: "#B39AD9",
        blob2: "#2F74C0",
        action: "none",
      },
    ];
  }, [aiTip, focusStats.todayMinutes, quote, sports, sportChoice.name, studySub, studyTitle, today, todayDone, todayTasks.length]);

  const [order, setOrder] = useState<string[]>(() => shuffled(baseCards.map((c) => c.key), daySeed()));
  const cards = order
    .map((key) => baseCards.find((c) => c.key === key))
    .filter((c): c is TodayCard => !!c);
  const topY = useSharedValue(0);
  const topOpacity = useSharedValue(1);
  const topScale = useSharedValue(1);

  const swap = (back: boolean) => {
    setOrder((prev) => (back ? [prev[prev.length - 1], ...prev.slice(0, -1)] : [...prev.slice(1), prev[0]]));
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-14, 14])
        .failOffsetX([-22, 22])
        .onUpdate((e) => {
          topY.value = e.translationY * 0.28;
          topOpacity.value = 1 - Math.min(0.35, Math.abs(e.translationY) / 420);
          topScale.value = 1 - Math.min(0.08, Math.abs(e.translationY) / 1800);
        })
        .onEnd((e) => {
          const go = Math.abs(e.translationY) > 52 && Math.abs(e.velocityY) > 120;
          if (go) {
            const back = e.translationY > 0;
            topY.value = withTiming(back ? 260 : -260, { duration: 150 }, (finished) => {
              if (finished) {
                runOnJS(swap)(back);
                topY.value = withSpring(0, { damping: 18, stiffness: 240 });
              }
            });
          } else {
            topY.value = withSpring(0, { damping: 18, stiffness: 240 });
          }
          topOpacity.value = withTiming(1, { duration: 150 });
          topScale.value = withSpring(1);
        }),
    [topOpacity, topScale, topY]
  );

  const topAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: topY.value }, { scale: topScale.value }],
    opacity: topOpacity.value,
  }));

  return (
    <View style={styles.stack}>
      {cards.map((card, index) => {
        const isTop = index === 0;
        const behind = index > 0;
        const content = (
          <Animated.View
            key={card.key}
            style={[
              styles.card,
              {
                backgroundColor: card.base,
                zIndex: 10 - index,
                opacity: behind ? 0.82 - index * 0.14 : undefined,
              },
              !behind && topAnim,
              behind ? { transform: [{ translateY: index * 9 }, { scale: 1 - index * 0.055 }] } : null,
            ]}
          >
            <View style={[styles.blob, { backgroundColor: card.blob1, top: -46, right: -24 }]} />
            <View style={[styles.blob, { backgroundColor: card.blob2, bottom: -44, left: -30 }]} />
            <View style={styles.cardBody}>
              <View style={styles.eyebrowRow}>
                <ThemedIcon name={card.icon} size={14} color="rgba(255,255,255,0.94)" />
                <Text style={styles.eyebrow}>{card.eyebrow}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
              <Text style={styles.sub} numberOfLines={2}>{card.sub}</Text>
              {card.action === "focus" ? (
                <Pressable style={styles.cta} onPress={onStartFocus}>
                  <ThemedIcon name="play" size={15} color="#2F74C0" />
                  <Text style={styles.ctaText}>开始专注</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        );
        return isTop ? (
          <GestureDetector key={card.key} gesture={pan}>
            {content}
          </GestureDetector>
        ) : (
          content
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stack: { height: 176 },
    card: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 168,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    blob: {
      position: "absolute",
      width: 170,
      height: 170,
      borderRadius: 85,
      opacity: 0.62,
    },
    cardBody: { flex: 1, padding: 18, justifyContent: "space-between" },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" },
    title: { fontSize: 20, lineHeight: 25, fontWeight: "800", color: "#ffffff", marginTop: 7 },
    sub: { fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.85)", marginTop: 3 },
    cta: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#ffffff",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 9,
    },
    ctaText: { color: "#2F74C0", fontSize: 13, fontWeight: "800" },
  });
