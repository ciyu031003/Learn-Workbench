/* eslint-disable react-hooks/immutability -- 阶段卡拖拽靠共享值在 UI 线程驱动（拖拽态写 .value，与 pressable-scale.tsx 同约定） */
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ProgressBar } from "@/components/v2/progress-bar";
import { getLearningTrackNow } from "@/lib/content-store";
import { useTheme } from "@/theme";
import { pct } from "@learn-workbench/shared/dates";
import type { Phase } from "@learn-workbench/shared/schemas";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { makeStyles } from "./learn-styles";

/** 阶段卡之间的间距，必须与 `styles.shelfContent` 的 gap 一致（拖拽让位的位移量按"实测高度 + 这个值"算） */
const STAGE_CARD_GAP = 12;
export const DAILY_QUESTION_GOAL = 20;
/** 近 7 天面积图/轴的星期标签（getDay() 下标：0 = 周日） */
export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/** 阅读卡片用的标题查表（找不到就退回 key，界面不会出现空白行） */
export function readingTitle(trackSlug: string, stageKey: string, topicKey: string): string {
  const track = getLearningTrackNow(trackSlug);
  const stage = track?.stages.find((entry) => entry.key === stageKey);
  const topic = stage?.topics.find((entry) => entry.key === topicKey);
  return topic?.title ?? topicKey;
}

/** 紧凑时长（8h 12m / 70m）：只做展示格式，不改任何统计口径 */
export function compactDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? h + "h " + m + "m" : m + "m";
}

export function StageCard({
  phase,
  index,
  total,
  active,
  progressInfo,
  onSelect,
  onMove,
  onDelete,
  onEdit,
  dragIndex,
  dragTarget,
  dragY,
  heights,
  onMeasure,
  onDragChange,
}: {
  phase: Phase;
  index: number;
  total: number;
  active: boolean;
  progressInfo: { done: number; total: number };
  onSelect: () => void;
  onMove: (from: number, to: number) => void;
  onDelete: () => void;
  onEdit: () => void;
  /** 拖拽状态全部用共享值在 UI 线程流转（禁止每帧 runOnJS(setState)，否则必掉帧） */
  dragIndex: SharedValue<number>;
  dragTarget: SharedValue<number>;
  dragY: SharedValue<number>;
  /** 各卡片实测高度（下标对齐 roadmap），onLayout 时写入 */
  heights: SharedValue<number[]>;
  onMeasure: (index: number, height: number) => void;
  onDragChange: (index: number | null) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const percent = progressInfo.total > 0 ? pct(progressInfo.done, progressInfo.total) : 0;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(260)
        .onStart(() => {
          dragIndex.value = index;
          dragTarget.value = index;
          dragY.value = 0;
          runOnJS(onDragChange)(index);
        })
        .onUpdate((e) => {
          dragY.value = e.translationY;
          // 目标下标：把"被拖卡片的中心"换算成落在哪张卡的中线上（按实测高度累加，长标题也不会错位）。
          const hs = heights.value;
          let above = 0;
          for (let i = 0; i < index; i++) above += (hs[i] ?? 0) + STAGE_CARD_GAP;
          const center = above + (hs[index] ?? 0) / 2 + e.translationY;
          let acc = 0;
          let target = 0;
          for (let i = 0; i < total; i++) {
            if (center > acc + (hs[i] ?? 0) / 2) target = i;
            acc += (hs[i] ?? 0) + STAGE_CARD_GAP;
          }
          dragTarget.value = target;
        })
        .onEnd(() => {
          const target = dragTarget.value;
          dragIndex.value = -1;
          dragTarget.value = -1;
          dragY.value = 0;
          runOnJS(onDragChange)(null);
          if (target !== index) runOnJS(onMove)(index, target);
        })
        .onFinalize(() => {
          dragIndex.value = -1;
          dragTarget.value = -1;
          dragY.value = 0;
          runOnJS(onDragChange)(null);
        }),
    [dragIndex, dragTarget, dragY, heights, index, onDragChange, onMove, total]
  );

  /**
   * 拖拽表现（全部在 UI 线程）：被拖的卡片跟手 + 轻微放大 + 浮到兄弟卡片之上
   * （Android 同 elevation 按子视图顺序绘制，所以必须同时抬 zIndex 与 elevation）；
   * 其它卡片在被拖卡片越过的区间里实时让位。
   */
  const cardStyle = useAnimatedStyle(() => {
    const from = dragIndex.value;
    const to = dragTarget.value;
    const isDragged = from === index;
    let shift = 0;
    if (from >= 0 && !isDragged) {
      const draggedStep = (heights.value[from] ?? 0) + STAGE_CARD_GAP;
      if (from < to && index > from && index <= to) shift = -draggedStep;
      else if (from > to && index >= to && index < from) shift = draggedStep;
    }
    return {
      zIndex: isDragged ? 30 : 0,
      elevation: isDragged ? 18 : 0,
      transform: [
        {
          translateY: isDragged
            ? dragY.value
            : withTiming(shift, { duration: 160, easing: Easing.out(Easing.quad) }),
        },
        { scale: isDragged ? 1.02 : 1 },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.stageRowWrap, cardStyle]}
        onLayout={(e) => onMeasure(index, e.nativeEvent.layout.height)}
      >
        <PressableScale
          haptic
          scaleTo={0.99}
          onPress={onSelect}
          style={[styles.stageRow, active && styles.stageRowActive]}
          accessibilityRole="button"
          accessibilityLabel={
            "阶段 " + (index + 1) + "，" + phase.title + "，已完成 " + progressInfo.done + "/" + progressInfo.total + " 个主题，打开详情"
          }
        >
          <View style={[styles.stageRowBadge, active && styles.stageRowBadgeActive]}>
            <Text style={[styles.stageRowBadgeText, active && styles.stageRowBadgeTextActive]}>{"P" + (index + 1)}</Text>
          </View>
          <View style={styles.stageRowBody}>
            <Text style={styles.stageRowTitle} numberOfLines={1}>{phase.title}</Text>
            <Text style={styles.stageRowMeta} numberOfLines={1}>
              {(phase.weeks ?? "周期未设置") + " · " + progressInfo.done + "/" + progressInfo.total + " 主题 · " + percent + "%"}
            </Text>
            <ProgressBar value={percent / 100} height={4} style={styles.stageRowBar} />
          </View>
          <View style={styles.stageRowSide}>
            <Pressable
              hitSlop={8}
              style={styles.stageRowIconBtn}
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={"编辑阶段 " + phase.title}
            >
              <ThemedIcon name="create-outline" ios="square.and.pencil" size={15} color={colors.textMuted} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.stageRowIconBtn}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={"删除阶段 " + phase.title}
            >
              <ThemedIcon name="trash-outline" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        </PressableScale>
      </Animated.View>
    </GestureDetector>
  );
}
