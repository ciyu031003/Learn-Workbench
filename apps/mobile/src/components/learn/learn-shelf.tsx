import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeOutUp, LinearTransition, type SharedValue } from "react-native-reanimated";

import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { GroupLabel } from "@/components/group-label";
import { ListGroup, ListRow } from "@/components/list-row";
import { LearningShelfHeader } from "@/components/learning-entry-cards";
import { useTheme } from "@/theme";
import type { Phase } from "@learn-workbench/shared/schemas";

import { StageCard } from "./learn-widgets";
import { makeStyles } from "./learn-styles";

/**
 * ⑥ 学习架与管理入口：默认收起为折叠条（LearningShelfHeader 自带开合），展开后保留原列表。
 * 阶段行仍是可长按拖拽的 StageCard，拖拽状态用共享值在 UI 线程流转（禁止每帧 runOnJS(setState)）。
 */
export function LearnShelf({
  shelfOpen,
  setShelfOpen,
  routeSummary,
  roadmap,
  roadmapLoading,
  selectedPhase,
  selectedPhaseId,
  phaseDone,
  swapPhase,
  removePhase,
  openEditPhase,
  stageDragIndex,
  stageDragTarget,
  stageDragY,
  stageHeights,
  measureStage,
  onStageDragChange,
  motionActive,
  setMdText,
  setMdPreview,
  setMdMsg,
  setMdSheet,
  setEditingPhase,
  setCustomPhaseTitle,
  setCustomPhaseSummary,
  setCustomPhaseSheet,
  setCustomTopicSheet,
}: {
  shelfOpen: boolean;
  setShelfOpen: Dispatch<SetStateAction<boolean>>;
  routeSummary: { done: number; total: number; percent: number };
  roadmap: Phase[];
  roadmapLoading: boolean;
  selectedPhase: Phase | undefined;
  selectedPhaseId: number | null;
  phaseDone: (phase: Phase) => { done: number; total: number };
  swapPhase: (from: number, to: number) => void;
  removePhase: (phase: Phase) => void;
  openEditPhase: (phase: Phase) => void;
  stageDragIndex: SharedValue<number>;
  stageDragTarget: SharedValue<number>;
  stageDragY: SharedValue<number>;
  stageHeights: SharedValue<number[]>;
  measureStage: (index: number, height: number) => void;
  onStageDragChange: (index: number | null) => void;
  motionActive: boolean;
  setMdText: (value: string) => void;
  setMdPreview: (value: null) => void;
  setMdMsg: (value: string | null) => void;
  setMdSheet: (value: boolean) => void;
  setEditingPhase: (value: Phase | null) => void;
  setCustomPhaseTitle: (value: string) => void;
  setCustomPhaseSummary: (value: string) => void;
  setCustomPhaseSheet: (value: boolean) => void;
  setCustomTopicSheet: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
        <LearningShelfHeader
          open={shelfOpen}
          onToggle={() => setShelfOpen((value) => !value)}
          percent={routeSummary.percent}
          stageCount={roadmap.length}
        />
        {shelfOpen ? (
          <Animated.View
            entering={motionActive ? FadeInDown.duration(180) : undefined}
            exiting={motionActive ? FadeOutUp.duration(120) : undefined}
            layout={motionActive ? LinearTransition.duration(180) : undefined}
            style={styles.shelfContent}
          >
            {!roadmapLoading && roadmap.length === 0 ? (
              <Surface tier="surface" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>还没有学习阶段</Text>
                <Text style={styles.emptyHint}>
                  这个学习领域下还没有任何阶段。可以自己新建，也可以导入 Markdown：
                  # 一级标题 = 学习阶段，## 二级 = 阶段里的主题，### 三级 = 主题下的学习内容。
                </Text>
                <PressableScale
                  haptic
                  scaleTo={0.98}
                  hitSlop={6}
                  style={styles.emptyPrimaryCta}
                  onPress={() => router.push("/domain-manager" as never)}
                  accessibilityRole="button"
                  accessibilityLabel="创建学习路线"
                >
                  <ThemedIcon name="layers-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyPrimaryText}>创建学习路线</Text>
                  <ThemedIcon name="chevron-forward" size={14} color="rgba(255,255,255,0.72)" />
                </PressableScale>
                <View style={styles.emptyActions}>
                  <PressableScale
                    haptic
                    hitSlop={6}
                    style={styles.emptyAction}
                    onPress={() => {
                      setMdText("");
                      setMdPreview(null);
                      setMdMsg(null);
                      setMdSheet(true);
                    }}
                  >
                    <ThemedIcon name="document-text-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>导入 MD</Text>
                  </PressableScale>
                  <PressableScale
                    haptic
                    hitSlop={6}
                    style={styles.emptyAction}
                    onPress={() => {
                      setEditingPhase(null);
                      setCustomPhaseTitle("");
                      setCustomPhaseSummary("");
                      setCustomPhaseSheet(true);
                    }}
                  >
                    <ThemedIcon name="add" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>新建阶段</Text>
                  </PressableScale>
                  <PressableScale
                    haptic
                    hitSlop={6}
                    style={styles.emptyAction}
                    onPress={() => router.push("/domain-manager" as never)}
                  >
                    <ThemedIcon name="layers-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>从模板创建</Text>
                  </PressableScale>
                </View>
              </Surface>
            ) : null}

            {roadmap.map((phase, i) => {
              const progressInfo = phaseDone(phase);
              const active = phase.id === selectedPhaseId;
              return (
                <StageCard
                  key={phase.id}
                  phase={phase}
                  index={i}
                  total={roadmap.length}
                  active={active}
                  progressInfo={progressInfo}
                  onSelect={() => router.push(("/phase/" + phase.id) as never)}
                  onMove={swapPhase}
                  onDelete={() => removePhase(phase)}
                  onEdit={() => openEditPhase(phase)}
                  dragIndex={stageDragIndex}
                  dragTarget={stageDragTarget}
                  dragY={stageDragY}
                  heights={stageHeights}
                  onMeasure={measureStage}
                  onDragChange={onStageDragChange}
                />
              );
            })}

            <GroupLabel>管理</GroupLabel>
            <ListGroup>
              <ListRow
                icon="create-outline"
                title="学习日志"
                subtitle="记录今天学了什么"
                showChevron
                onPress={() => router.push("/logs" as never)}
              />
              <ListRow
                icon="stats-chart-outline"
                title="学习统计 · 分享闪光卡"
                subtitle="热力图 · 内容维度 · 生成分享卡"
                showChevron
                onPress={() => router.push("/study-stats" as never)}
              />
              <ListRow
                icon="add-circle-outline"
                title="新建阶段"
                subtitle="给路线图加一个阶段"
                showChevron
                onPress={() => {
                  setEditingPhase(null);
                  setCustomPhaseTitle("");
                  setCustomPhaseSummary("");
                  setCustomPhaseSheet(true);
                }}
              />
              <ListRow
                icon="document-text-outline"
                title="导入 Markdown"
                subtitle="一级阶段 / 二级主题 / 三级内容"
                showChevron
                onPress={() => {
                  setMdText("");
                  setMdPreview(null);
                  setMdMsg(null);
                  setMdSheet(true);
                }}
              />
              <ListRow
                icon="bookmark-outline"
                title="添加学习内容"
                subtitle={selectedPhase ? `加到「${selectedPhase.title}」` : "先建一个阶段"}
                showChevron
                disabled={!selectedPhase}
                onPress={() => setCustomTopicSheet(true)}
              />
              <ListRow
                icon="trash-outline"
                title="删除阶段"
                subtitle={selectedPhase ? `当前：${selectedPhase.title}` : "暂无可删除阶段"}
                showChevron
                disabled={!selectedPhase}
                onPress={() => {
                  if (selectedPhase) removePhase(selectedPhase);
                }}
              />
              <ListRow
                icon="checkbox-outline"
                title="今日任务"
                subtitle="勾选今天要完成的事"
                showChevron
                onPress={() => router.push("/tasks" as never)}
              />
              <ListRow
                icon="pulse-outline"
                title="领域记录"
                subtitle="通用计量与按日打卡"
                showChevron
                last
                onPress={() => router.push("/trackers" as never)}
              />
            </ListGroup>
          </Animated.View>
        ) : null}
    </>
  );
}
