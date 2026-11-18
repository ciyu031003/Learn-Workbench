import { useEffect, useId, useMemo, useState, type ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { SheetStickyCta } from "@/components/sheet";
import { SportThemedIcon, ThemedIcon } from "@/components/themed-icon";
import { useAppStore } from "@/store/app-store";
import { haptics } from "@/lib/haptics";
import { getDailyQuote } from "@/lib/quotes";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { sportAnimOf, sportColorsOf, sportIconOf, sportSfOf } from "@/lib/sport-view";
import { tabularNums } from "@/theme/tokens";
import { withAlpha } from "@/lib/chart-math";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { SPORT_CATALOG, exerciseTypeOptions } from "@learn-workbench/shared/labels";
import type { SportItem } from "@learn-workbench/shared/types";
import type { ExerciseType } from "@learn-workbench/shared/schemas";
import { makeStyles } from "./today-styles";

/**
 * 每日目标（v1.62 P0-2）：题库 20 题与学习页 DAILY_QUESTION_GOAL 同值（learn.tsx 内部常量，
 * 这里只做展示，不改口径）；运动 30 分钟是目标条「训练」的参考线，同样只用于展示进度。
 */
export const DAILY_QUESTION_GOAL = 20;
/** 每日专注目标默认值（v2.6.12 起可在「设置 → 每日专注目标」人为调整） */
export const DEFAULT_FOCUS_GOAL_MINUTES = 180;
/* P1 拆分清理：SCENE_TIME 原本就是未引用的死常量，随拆分删除 */

/** ISO 周号（与原型「第 46 周」同口径） */
export function isoWeekNo(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;
/** 本周 7 格：周一起（中文习惯），与原型 V3 一致 */
const WEEK_INITIALS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

/**
 * 「减弱动态」的唯一解析口（与 lib/motion + theme/motion 同源）：
 * 入场错峰用 `reduced`（减弱时直接不挂 entering），循环动画用 `motionActive`。
 * 放在 SportIcon / SportSheet 旁边，保证本文件里「循环动效」永远伴随可见性/无障碍开关
 * （check-motion-budget 的 R2 口径），而不是把这个判断散落在页面里。
 */
export function useTodayMotion() {
  const reduced = useReducedMotion();
  return { reduced, motionActive: isMotionActive(reduced) };
}

/**
 * 本周 7 格（周一起）的日期键。
 * 业务日期来自 todayISOInZone()（东八区口径），这里只在**日期字符串**上做算术：
 * 先归一成 UTC 正午再逐日偏移，避免设备时区 / 夏令时把格子挪错一天。
 */
export function buildWeekGrid(todayIso: string): { iso: string; label: string }[] {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  const base = parts
    ? Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : Date.now();
  const monday = base - ((new Date(base).getUTCDay() + 6) % 7) * DAY_MS;
  return WEEK_INITIALS.map((label, i) => ({
    iso: new Date(monday + i * DAY_MS).toISOString().slice(0, 10),
    label,
  }));
}

/** 专注模式胶囊（刷题 / 阅读 / 训练）：沿用原焦点卡的三个入口，点击跳到对应页面 */
export function ModePill({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      onPress={onPress}
      hitSlop={8}
      style={styles.pill}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <ThemedIcon name={icon} size={14} color={colors.primary} />
      <Text style={styles.pillText} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * 双列小卡（今日学习 / 今日饮水）：整张卡可点。
 * v2.2：语义色图标芯片 + 顶部轻微渐变 + 同色描边，环加粗（6→10）并放大到 86，
 * 环心主数值提到 typography.num（20/800）；无数据仍显示「—」，颜色降到 textSecondary 保证可读。
 * 数值是「环内徽标」性质的紧凑 UI，按 lib/text-scale 的 chrome 策略封顶 1.3 倍，
 * 保证 130% 系统字号下仍完整落在环心里（不截断）。
 */
export function MiniStatCard({
  label,
  percent,
  hint,
  icon,
  tone = "primary",
  onPress,
  accessibilityLabel,
}: {
  label: string;
  /** 0–100 的百分比；null = 没有数据（环心显示「—」） */
  percent: number | null;
  hint: string;
  icon: ComponentProps<typeof ThemedIcon>["name"];
  tone?: "primary" | "accent";
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratio = percent === null ? 0 : Math.max(0, Math.min(100, percent)) / 100;
  const isAccent = tone === "accent";
  const strong = isAccent ? colors.accent : colors.primary;
  const soft = isAccent ? colors.accentSoft : colors.primarySoft;
  /** 每个实例独立 id：SVG 渐变 id 全局可见，固定 id 在多实例复用时会串色 */
  const rawId = useId();
  const gradientId = useMemo(() => "miniCard" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.miniCard, pressed && styles.miniCardPressed]}
    >
      {/* 轻微渐变：语义 soft 从左上淡出到卡面（只用 token，卡片 overflow:hidden 兜住圆角） */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
            {/* v2.7：原来是 1 → 0 的全饱和 soft 渐变，深色下读起来像两块蓝/橙色块；
                收敛到 0.55 → 0，只留一层色温，卡片主体回到 surface。 */}
            <Stop offset="0" stopColor={soft} stopOpacity={0.55} />
            <Stop offset="1" stopColor={soft} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + gradientId + ")"} />
      </Svg>

      <View style={styles.miniHead}>
        <View style={[styles.miniIcon, { backgroundColor: soft, borderColor: withAlpha(strong, 0.22) }]}>
          <ThemedIcon name={icon} size={14} color={strong} />
        </View>
        <Text style={styles.miniLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.miniRing}>
        <RingProgress
          size={64}
          strokeWidth={8}
          progress={ratio}
          trackColor={colors.surfaceMuted}
          from={isAccent ? colors.accent : colors.primary}
          to={isAccent ? colors.sun : colors.chart[1]}
        />
        <View pointerEvents="none" style={styles.miniRingLabel}>
          <Text
            style={[styles.miniRingValue, tabularNums, percent === null && styles.miniRingMuted]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            {...TEXT_SCALE_POLICY.chrome}
          >
            {percent === null ? "—" : percent + "%"}
          </Text>
        </View>
      </View>

      {/* 不设 numberOfLines：130% 系统字号下长 hint 换行而不是被省略号截断 */}
      <Text style={styles.miniHint}>
        {hint}
      </Text>
    </Pressable>
  );
}
export function SportIcon({
  sportKey,
  name,
  type,
  color,
  active,
  motionActive,
}: {
  sportKey: string;
  name?: string;
  type: ExerciseType;
  color?: string;
  active: boolean;
  motionActive: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const icon = sportIconOf(sportKey, name);
  const c = color ?? sportColorsOf(type).c1;
  const preset = sportAnimOf(sportKey);

  useEffect(() => {
    if (!motionActive) {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(rotate);
      cancelAnimation(scale);
      tx.value = 0;
      ty.value = 0;
      rotate.value = 0;
      scale.value = 1;
      return;
    }
    if (!active) {
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      rotate.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      return;
    }

    // 动画词汇表：与 Web 端 sport-animated-icon 的 keyframes 分组同源
    switch (preset) {
      case "ball-bounce":
        scale.value = withSequence(withSpring(1.18, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withSequence(withTiming(-18, { duration: 340 }), withTiming(0, { duration: 400 }));
        rotate.value = withSequence(withTiming(-140, { duration: 700 }), withTiming(0, { duration: 0 }));
        break;
      case "racket-sway":
        scale.value = withSequence(withSpring(1.14, { damping: 9, stiffness: 220 }), withSpring(1));
        tx.value = withSequence(
          withRepeat(withSequence(withTiming(-6, { duration: 170 }), withTiming(6, { duration: 170 })), 3, true),
          withTiming(0, { duration: 160 })
        );
        ty.value = withRepeat(withSequence(withTiming(-4, { duration: 170 }), withTiming(4, { duration: 170 })), 3, true);
        break;
      case "stroll":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
        rotate.value = withSequence(
          withRepeat(withSequence(withTiming(-12, { duration: 220 }), withTiming(12, { duration: 220 })), 2, true),
          withTiming(0, { duration: 200 })
        );
        ty.value = withRepeat(withSequence(withTiming(-3, { duration: 220 }), withTiming(3, { duration: 220 })), 2, true);
        break;
      case "run-bounce":
        scale.value = withSequence(withSpring(1.16, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "ride":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
        tx.value = withRepeat(withSequence(withTiming(-4, { duration: 160 }), withTiming(4, { duration: 160 })), 4, true);
        ty.value = withRepeat(withSequence(withTiming(-3, { duration: 160 }), withTiming(0, { duration: 160 })), 4, true);
        break;
      case "swim":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 200 }), withSpring(1));
        ty.value = withSequence(withTiming(-5, { duration: 320 }), withTiming(0, { duration: 320 }), withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 }));
        rotate.value = withSequence(withTiming(6, { duration: 320 }), withTiming(-6, { duration: 320 }), withTiming(0, { duration: 260 }));
        break;
      case "rope":
        scale.value = withSequence(withSpring(1.16, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "strength":
        scale.value = withSequence(withSpring(1.15, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "tremble":
        scale.value = withSequence(withSpring(1.08, { damping: 12, stiffness: 220 }), withSpring(1));
        break;
      case "breath":
        scale.value = withRepeat(withSequence(withTiming(1.07, { duration: 700 }), withTiming(0.97, { duration: 700 })), 2, true);
        break;
      case "climb":
        scale.value = withSequence(withSpring(1.08, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withRepeat(
          withSequence(withTiming(-7, { duration: 170 }), withTiming(0, { duration: 90 })),
          3,
          false
        );
        break;
      default:
        scale.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
    }
  }, [active, motionActive, preset, rotate, scale, tx, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: rotate.value + "deg" },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <SportThemedIcon name={icon} sf={sportSfOf(sportKey)} size={22} color={c} />
    </Animated.View>
  );
}

export function SportSheet({
  visible,
  onClose,
  motionActive,
}: {
  visible: boolean;
  onClose: () => void;
  motionActive: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sports = useAppStore((s) => s.sports);
  const addSport = useAppStore((s) => s.addSport);
  const [tab, setTab] = useState<"recent" | ExerciseType>("recent");
  const [sportKey, setSportKey] = useState("basketball");
  const [minutes, setMinutes] = useState(30);

  // 最近：按记录时间倒序取 distinct 项目（不足时回退常用 featured）
  const items = useMemo(() => {
    if (tab === "recent") {
      const seen: string[] = [];
      for (const r of [...sports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        if (!seen.includes(r.sportKey)) seen.push(r.sportKey);
        if (seen.length >= 6) break;
      }
      const recent = seen
        .map((k) => SPORT_CATALOG.find((i) => i.key === k))
        .filter((i): i is SportItem => !!i);
      return recent.length > 0 ? recent : SPORT_CATALOG.filter((i) => i.featured);
    }
    return SPORT_CATALOG.filter((i) => i.type === tab);
  }, [tab, sports]);

  const current = SPORT_CATALOG.find((i) => i.key === sportKey) ?? items[0] ?? SPORT_CATALOG[0];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="添加运动记录"
      subtitle="选项目 → 调时长 → 记录；想看得更全可拖动顶部把手继续上拉"
      icon="barbell-outline"
      // 真机反馈：默认高度不够、内容看不全，必须下滑才见到确认按钮。
      // expandable 的手势只挂在**顶部把手**上，用户不会去拖它，所以把默认高度直接抬高到内容装得下。
      height="88%"
      // 真机反馈：原来不能上拖、内容看不全、必须下滑才能看到确认按钮。
      // 打开 expandable（上拖到 94%）+ 把确认按钮移到吸底 CTA。
      expandable
      footer={
        <SheetStickyCta
          label={"记录 " + (current?.name ?? "—") + " " + minutes + " 分钟"}
          icon="checkmark"
          onPress={() => {
            if (!current) return;
            addSport(current.key, minutes);
            onClose();
          }}
        />
      }
      footerHint="选中的项目与时长会写进今天的运动记录"
    >
      <View style={styles.sportTabRow}>
        <Pressable onPress={() => setTab("recent")} style={[styles.sportTab, tab === "recent" && styles.sportTabActive]}>
          <Text style={[styles.sportTabText, tab === "recent" && styles.sportTabTextActive]}>最近</Text>
        </Pressable>
        {exerciseTypeOptions.map((o) => (
          <Pressable key={o.type} onPress={() => setTab(o.type)} style={[styles.sportTab, tab === o.type && styles.sportTabActive]}>
            <Text style={[styles.sportTabText, tab === o.type && styles.sportTabTextActive]}>
              {o.label.replace("运动", "").replace("训练", "").replace("放松", "").replace("活动", "")}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.sportGridScroll} contentContainerStyle={styles.sportTypeGrid} showsVerticalScrollIndicator={false}>
        {items.map((t) => {
          const active = t.key === current?.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setSportKey(t.key);
                setMinutes(t.defaultMinutes);
              }}
              style={[styles.sportType, active && styles.sportTypeActive]}
            >
              <View style={[styles.sportTypeIcon, { backgroundColor: sportColorsOf(t.type).c1 + "22" }]}>
                <SportIcon sportKey={t.key} type={t.type} active={active} motionActive={motionActive} />
              </View>
              <Text style={[styles.sportTypeName, active && styles.sportTypeNameActive]} numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.max(5, m - 5))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.stepperVal}>
          <Text style={styles.stepperNum}>{minutes}</Text>
          <Text style={styles.stepperUnit}>分钟</Text>
        </View>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.min(240, m + 5))}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.quickRow}>
        {[15, 30, 45, 60].map((m) => (
          <Pressable
            key={m}
            onPress={() => setMinutes(m)}
            style={[styles.quickChip, minutes === m && styles.quickChipActive]}
          >
            <Text style={[styles.quickChipText, minutes === m && styles.quickChipTextActive]}>{m} 分</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
