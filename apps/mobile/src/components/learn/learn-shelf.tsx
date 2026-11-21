import { useMemo } from "react";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";

import { makeStyles } from "./learn-styles";

/**
 * ⑤ 章节管理条（原「学习架」收敛而来）。
 *
 * 旧版学习架是一张可展开的大卡（阶段行 + 长按拖拽 + 一组列表入口），默认收起；
 * v7 学习舱把它压成章节树下面的一行小 chips：新建/编辑/删除阶段、新增主题、导入 Markdown。
 * 这五个动作全部沿用既有弹层与 store 写入（use-learn-screen 里的 openCreatePhase /
 * openEditPhase / removePhase / setCustomTopicSheet / openImportMd），功能不丢、视觉不抢戏。
 */
export function LearnShelfActions({
  canManage,
  onCreatePhase,
  onEditPhase,
  onDeletePhase,
  onAddTopic,
  onImportMd,
}: {
  /** 是否有当前阶段（编辑 / 删除 / 新增主题都挂在当前阶段上） */
  canManage: boolean;
  onCreatePhase: () => void;
  onEditPhase: () => void;
  onDeletePhase: () => void;
  onAddTopic: () => void;
  onImportMd: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const disabledTextStyle = canManage ? null : styles.manageChipTextDisabled;

  return (
    <View style={styles.manageRow}>
      <Text style={styles.manageLabel}>管理</Text>

      <PressableScale
        hitSlop={10}
        scaleTo={0.94}
        onPress={onCreatePhase}
        style={styles.manageChip}
        accessibilityRole="button"
        accessibilityLabel="新建学习阶段"
      >
        <Text style={styles.manageChipText}>新建阶段</Text>
      </PressableScale>

      <PressableScale
        hitSlop={10}
        scaleTo={0.94}
        disabled={!canManage}
        onPress={onEditPhase}
        style={styles.manageChip}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canManage }}
        accessibilityLabel="编辑当前学习阶段"
      >
        <Text style={[styles.manageChipText, disabledTextStyle]}>编辑阶段</Text>
      </PressableScale>

      <PressableScale
        hitSlop={10}
        scaleTo={0.94}
        disabled={!canManage}
        onPress={onDeletePhase}
        style={styles.manageChip}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canManage }}
        accessibilityLabel="删除当前学习阶段"
      >
        <Text style={[styles.manageChipText, disabledTextStyle]}>删除阶段</Text>
      </PressableScale>

      <PressableScale
        hitSlop={10}
        scaleTo={0.94}
        disabled={!canManage}
        onPress={onAddTopic}
        style={styles.manageChip}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canManage }}
        accessibilityLabel="给当前阶段添加学习内容"
      >
        <Text style={[styles.manageChipText, disabledTextStyle]}>新增主题</Text>
      </PressableScale>

      <PressableScale
        hitSlop={10}
        scaleTo={0.94}
        onPress={onImportMd}
        style={styles.manageChip}
        accessibilityRole="button"
        accessibilityLabel="导入 Markdown 学习计划"
      >
        <Text style={styles.manageChipText}>导入 MD</Text>
      </PressableScale>
    </View>
  );
}
