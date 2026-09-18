/* eslint-disable react-hooks/immutability */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
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

const CARD_H = 150;
/** 后面卡片向上露出的层高（堆叠感：后面的卡只淡淡露出上沿） */
const PEEK = 11;
/** 过渡动画时长（withTiming，**不用弹簧**：用户明确要求「不要弹跳」） */
const FLIP_MS = 330;
/** 3D 翻转最大角度：从正面（0°）转到锐角后消失 */
const FLIP_DEG = 68;

type Role = "front" | "nextTop" | "prevBottom" | "rest";

/**
 * 今日焦点卡组（v9 重做：真正的堆叠 + 3D 翻转切换）
 *
 * 交互（对齐真机反馈）：
 *  - 静止：第一张占主体；后面的卡在**后面**，缩小、上移露沿、压暗但**看得见**（空间堆叠感）；
 *  - 下滑：第一张绕 X 轴从 0° 转到锐角、缩小、向下淡出；第二张自然顶上成为主体；
 *  - 上滑：第一张反向翻转向上淡出；**上一张从下方翻回来**（角度反方向恢复）；
 *  - 全程 `withTiming` + 缓动，无弹簧、无回弹；手势过程中卡随手指做同向的渐变（有手感但不跳）。
 *
 * 实现约束（沿用 v6 踩坑 71/78/79 的规矩）：worklet 只读写共享值 + 调 Reanimated API，
 * 引用的量全部声明在用它的 worklet 之前。
 */
export function TodayStack({
  onStartFocus,
  onGestureActive,
}: {
  onStartFocus: () => void;
  onGestureActive?: (active: boolean) => void;
}) {
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

  /** 卡序：order[0] = 最上面那张；下滑把 order[0] 移到最后；上滑把最后一张提到最前 */
  const [order, setOrder] = useState<string[]>(() => shuffled(baseCards.map((c) => c.key), daySeed()));

  /** p：过渡进度（拖拽时 0..0.45，松手后 0→1）；dir：>0 下滑（下一张顶上）/<0 上滑（上一张翻回） */
  const p = useSharedValue(0);
  const dir = useSharedValue(0);

  const commit = useCallback(
    (d: number) => {
      setOrder((prev) =>
        d > 0
          ? [...prev.slice(1), prev[0]]
          : [prev[prev.length - 1], ...prev.slice(0, -1)]
      );
      p.value = 0;
      dir.value = 0;
    },
    [dir, p]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-26, 26])
        .onBegin(() => {
          if (onGestureActive) runOnJS(onGestureActive)(true);
        })
        .onUpdate((e) => {
          // 手指方向决定「哪张卡在动」，拖动幅度映射成部分进度（最多 45%，不越过临界点）
          if (e.translationY !== 0) dir.value = e.translationY > 0 ? 1 : -1;
          p.value = Math.min(0.45, Math.abs(e.translationY) / 260);
        })
        .onEnd((e) => {
          const d = e.translationY > 0 ? 1 : -1;
          const go = Math.abs(e.translationY) > 56 || Math.abs(e.velocityY) > 420;
          if (!go) {
            p.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
            if (onGestureActive) runOnJS(onGestureActive)(false);
            return;
          }
          dir.value = d;
          p.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (!finished) return;
            runOnJS(commit)(d);
          });
          if (onGestureActive) runOnJS(onGestureActive)(false);
        }),
    [commit, dir, onGestureActive, p]
  );

  const cards = order
    .map((key) => baseCards.find((c) => c.key === key))
    .filter((c): c is TodayCard => !!c);

  const roleOf = (index: number): Role =>
    index === 0 ? "front" : index === 1 ? "nextTop" : index === cards.length - 1 ? "prevBottom" : "rest";

  const topCardIndex = baseCards.findIndex((c) => c.key === order[0]);

  return (
    <View style={styles.wrap}>
      {/* 拟态托盘：固定容器，卡片只在这个托盘里切换 */}
      <View style={styles.tray}>
        <View style={styles.trayInner}>
          <View style={styles.stack}>
            {cards.map((card, index) => (
              <StackCard
                key={card.key}
                card={card}
                role={roleOf(index)}
                p={p}
                dir={dir}
                styles={styles}
                onStartFocus={onStartFocus}
                gesture={index === 0 ? pan : undefined}
              />
            ))}
          </View>
        </View>
      </View>

      {/* 「还有几张」的可发现性线索 */}
      <View style={styles.dots}>
        {baseCards.map((c, i) => (
          <View key={c.key} style={[styles.dot, i === topCardIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/**
 * 单张卡：按 role 决定它在这场过渡里的姿态。
 * role 是渲染期常量（不是共享值），p / dir 是共享值 —— worklet 定义顺序满足 v6 踩坑 78 的硬约束。
 */
function StackCard({
  card,
  role,
  p,
  dir,
  styles,
  onStartFocus,
  gesture,
}: {
  card: TodayCard;
  role: Role;
  p: SharedValue<number>;
  dir: SharedValue<number>;
  styles: ReturnType<typeof makeStyles>;
  onStartFocus: () => void;
  gesture?: ReturnType<typeof Gesture.Pan>;
}) {
  const style = useAnimatedStyle(() => {
    const prog = p.value;
    const d = dir.value;

    if (role === "front") {
      const sign = d >= 0 ? 1 : -1;
      return {
        zIndex: 30,
        opacity: Math.max(0, 1 - prog * 1.12),
        transform: [
          { perspective: 900 },
          { translateY: sign * (CARD_H + 26) * prog },
          { rotateX: `${sign * FLIP_DEG * prog}deg` },
          { scale: 1 - 0.14 * prog },
        ],
      };
    }

    if (role === "nextTop") {
      // 下滑时从背面顶上；上滑时保持背面姿态（不参与）
      const t = d > 0 ? prog : 0;
      return {
        zIndex: 20,
        opacity: 0.55 + 0.45 * t,
        transform: [
          { perspective: 900 },
          { translateY: -PEEK * (1 - t) },
          { rotateX: `${-16 * (1 - t)}deg` },
          { scale: 0.94 + 0.06 * t },
        ],
      };
    }

    if (role === "prevBottom") {
      // 上滑时从下方翻回来；下滑时保持背面姿态（不参与）
      const t = d < 0 ? prog : 0;
      return {
        zIndex: 19,
        opacity: 0.5 + 0.5 * t,
        transform: [
          { perspective: 900 },
          { translateY: PEEK * (1 - t) },
          { rotateX: `${18 * (1 - t)}deg` },
          { scale: 0.92 + 0.08 * t },
        ],
      };
    }

    // rest：只做最淡的一层空间堆叠
    return {
      zIndex: 10,
      opacity: 0.24,
      transform: [{ perspective: 900 }, { translateY: -PEEK * 2 }, { scale: 0.88 }],
    };
  });

  const content = (
    <Animated.View
      style={[styles.card, { backgroundColor: card.base }, style]}
      accessibilityLabel={`${card.eyebrow}，${card.title}`}
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
          <PressableScale haptic scaleTo={0.96} style={styles.cta} onPress={onStartFocus}>
            <ThemedIcon name="play" size={15} color="#2F74C0" />
            <Text style={styles.ctaText}>开始专注</Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );

  if (!gesture) return content;
  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    /** 拟态托盘：柔和外阴影 + 顶部高光，卡片固定在这里面切换 */
    tray: {
      borderRadius: 32,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.55)",
      borderColor: colors.border,
      shadowColor: "#6c6459",
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    trayInner: { borderRadius: 24, paddingTop: PEEK * 2, paddingHorizontal: 4 },
    stack: { height: CARD_H },
    card: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: CARD_H,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.35)",
      backfaceVisibility: "hidden",
    },
    blob: { position: "absolute", width: 170, height: 170, borderRadius: 85, opacity: 0.62 },
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
    dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { width: 16, backgroundColor: colors.primary },
  });
