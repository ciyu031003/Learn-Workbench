import { useMemo } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { ThemedIcon } from "@/components/themed-icon";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetSection, SheetStickyCta } from "@/components/sheet";
import { useTheme } from "@/theme";
import type { Phase, Topic } from "@learn-workbench/shared/schemas";
import type { MdImportResult } from "@/lib/roadmap";

import { makeStyles } from "./learn-styles";

/**
 * 学习页的四个弹层（原 learn.tsx 内联，逐行搬出，字段/高度/回调全未改）：
 *   1. 添加学习内容（自定义主题）
 *   2. 新建 / 编辑学习阶段
 *   3. 导入 Markdown 学习计划（粘贴 → 预览 → 确认导入）
 *   4. 知识点详情 Modal（阶段主题点开后的练习任务 / 阶段验收）
 * 每个弹层都是独立组件，显隐与回调由页面模型显式传入。
 */

/** 1. 添加学习内容：写进当前阶段的主题列表。 */
export function LearnCustomTopicSheet({
  customTopicSheet,
  setCustomTopicSheet,
  selectedPhase,
  customTopicTitle,
  setCustomTopicTitle,
  customTopicSummary,
  setCustomTopicSummary,
  submitCustomTopic,
}: {
  customTopicSheet: boolean;
  setCustomTopicSheet: (value: boolean) => void;
  selectedPhase: Phase | undefined;
  customTopicTitle: string;
  setCustomTopicTitle: (value: string) => void;
  customTopicSummary: string;
  setCustomTopicSummary: (value: string) => void;
  submitCustomTopic: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
      <BottomSheet
        visible={customTopicSheet}
        onClose={() => setCustomTopicSheet(false)}
        title="添加学习内容"
        subtitle={selectedPhase ? `加到「${selectedPhase.title}」` : "先选一个学习阶段"}
        icon="bookmark-outline"
        height="54%"
        footer={
          <SheetStickyCta
            label="保存并同步"
            icon="checkmark"
            onPress={submitCustomTopic}
            disabled={!customTopicTitle.trim()}
          />
        }
        footerHint="保存后会出现在该阶段的主题列表里，可继续编辑"
      >
        <SheetSection title="主题标题" hint="必填，越长越具体越好">
          <TextInput
            style={styles.formInput}
            value={customTopicTitle}
            onChangeText={setCustomTopicTitle}
            placeholder="例如：网络安全命令速查"
            placeholderTextColor={colors.textFaint}
          />
        </SheetSection>
        <SheetSection title="一句话说明" hint="选填" last>
          <TextInput
            style={[styles.formInput, styles.formInputArea]}
            value={customTopicSummary}
            onChangeText={setCustomTopicSummary}
            placeholder="这个阶段要掌握什么"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </SheetSection>
      </BottomSheet>
  );
}

/** 2. 新建 / 编辑学习阶段（editingPhase 非空 = 编辑）。 */
export function LearnCustomPhaseSheet({
  customPhaseSheet,
  setCustomPhaseSheet,
  editingPhase,
  customPhaseTitle,
  setCustomPhaseTitle,
  customPhaseSummary,
  setCustomPhaseSummary,
  roadmapLoading,
  submitCustomPhase,
}: {
  customPhaseSheet: boolean;
  setCustomPhaseSheet: (value: boolean) => void;
  editingPhase: Phase | null;
  customPhaseTitle: string;
  setCustomPhaseTitle: (value: string) => void;
  customPhaseSummary: string;
  setCustomPhaseSummary: (value: string) => void;
  roadmapLoading: boolean;
  submitCustomPhase: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
      <BottomSheet
        visible={customPhaseSheet}
        onClose={() => setCustomPhaseSheet(false)}
        title={editingPhase ? "编辑学习阶段" : "新建学习阶段"}
        subtitle={editingPhase ? "改完保存会同步到所有端" : "阶段是路线图里的一层，下面可以放主题"}
        icon="layers-outline"
        height="52%"
        footer={
          <SheetStickyCta
            label={editingPhase ? "保存并同步" : "创建并同步"}
            icon="checkmark"
            loading={roadmapLoading}
            disabled={!customPhaseTitle.trim()}
            onPress={() => void submitCustomPhase()}
          />
        }
        footerHint="空阶段也可以先建，之后再补主题"
      >
        <SheetSection title="阶段标题" hint="必填">
          <TextInput
            style={styles.formInput}
            value={customPhaseTitle}
            onChangeText={setCustomPhaseTitle}
            placeholder="例如：项目实战冲刺"
            placeholderTextColor={colors.textFaint}
          />
        </SheetSection>
        <SheetSection title="阶段说明" hint="选填" last>
          <TextInput
            style={[styles.formInput, styles.formInputArea]}
            value={customPhaseSummary}
            onChangeText={setCustomPhaseSummary}
            placeholder="这个阶段要掌握什么"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </SheetSection>
      </BottomSheet>
  );
}

/** 3. 导入 Markdown（v6 P3-2：粘贴 → 服务端解析预览 → 确认导入）。 */
export function LearnMdSheet({
  mdSheet,
  setMdSheet,
  mdBusy,
  mdPreview,
  mdText,
  setMdText,
  setMdPreview,
  setMdMsg,
  mdMsg,
  previewMd,
  confirmMd,
}: {
  mdSheet: boolean;
  setMdSheet: (value: boolean) => void;
  mdBusy: boolean;
  mdPreview: MdImportResult | null;
  mdText: string;
  setMdText: (value: string) => void;
  setMdPreview: (value: null) => void;
  setMdMsg: (value: string | null) => void;
  mdMsg: string | null;
  previewMd: () => Promise<void>;
  confirmMd: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
      <BottomSheet
        visible={mdSheet}
        onClose={() => setMdSheet(false)}
        title="导入 Markdown 学习计划"
        subtitle="一级标题=阶段，二级=主题，三级=学习内容"
        icon="document-text-outline"
        height="86%"
        expandable
        footer={
          <SheetStickyCta
            label="确认导入"
            icon="add"
            loading={mdBusy}
            disabled={!mdPreview}
            onPress={() => void confirmMd()}
            secondaryLabel="先预览解析结果"
            onSecondary={() => void previewMd()}
          />
        }
        footerHint="导入按标题去重，可重复执行"
      >
        <View style={styles.formSheet}>
          <Text style={styles.mdHint}>
            # 一级标题 = 学习阶段；## 二级 = 阶段里的主题；### 三级 = 主题下的学习内容（正文一起导入）。
          </Text>
          <TextInput
            style={styles.mdInput}
            value={mdText}
            onChangeText={(v) => {
              setMdText(v);
              setMdPreview(null);
              setMdMsg(null);
            }}
            placeholder={"# 阶段一：基础\n## 主题 A\n### 学习内容 1\n具体说明…"}
            placeholderTextColor={colors.textFaint}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
          />
          {mdMsg ? <Text style={styles.mdMsg}>{mdMsg}</Text> : null}
          {mdPreview ? (
            <View style={styles.mdPreview}>
              <Text style={styles.mdPreviewTitle}>
                预览：{mdPreview.counts?.phases ?? 0} 个阶段 · {mdPreview.counts?.topics ?? 0} 个主题 ·{" "}
                {mdPreview.counts?.items ?? 0} 条学习内容
              </Text>
              {(mdPreview.preview ?? []).slice(0, 6).map((p) => (
                <View key={p.title} style={styles.mdPreviewPhase}>
                  <Text style={styles.mdPreviewPhaseTitle} numberOfLines={1}># {p.title}</Text>
                  {p.topics.slice(0, 4).map((t) => (
                    <Text key={t.title} style={styles.mdPreviewTopic} numberOfLines={1}>
                      ## {t.title}（{t.items.length} 条）
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </BottomSheet>
  );
}

/** 4. 知识点详情（自定义主题额外带「删除该主题」）。 */
export function LearnTopicModal({
  activeTopic,
  contentTopic,
  setContentTopic,
  removeCustomTopic,
}: {
  activeTopic: (Topic & { isCustomSubject?: boolean }) | null;
  contentTopic: { topicId: number; phaseId: number } | null;
  setContentTopic: (value: { topicId: number; phaseId: number } | null) => void;
  removeCustomTopic: (topicId: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
      <Modal visible={!!activeTopic} transparent animationType="fade" onRequestClose={() => setContentTopic(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setContentTopic(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {activeTopic ? (
              <>
                <View style={styles.modalHead}>
                  <View style={[styles.modalDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.modalTitle}>{activeTopic.title}</Text>
                  <Pressable
                    hitSlop={10}
                    style={styles.modalClose}
                    onPress={() => setContentTopic(null)}
                    accessibilityRole="button"
                    accessibilityLabel="关闭知识点详情"
                  >
                    <ThemedIcon name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Text style={styles.modalSub}>{activeTopic.summary || "这个阶段的学习内容会在这里展开。"}</Text>
                {(activeTopic.practices?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>练习任务</Text>
                ) : null}
                {(activeTopic.practices ?? []).map((pr) => (
                  <View key={pr.id} style={styles.modalRow}>
                    <ThemedIcon name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.modalRowText}>{pr.text}</Text>
                  </View>
                ))}
                {(activeTopic.checkpoints?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>阶段验收</Text>
                ) : null}
                {(activeTopic.checkpoints ?? []).map((cp) => (
                  <View key={cp.id} style={styles.modalRow}>
                    <ThemedIcon name="flag" size={16} color={colors.accent} />
                    <Text style={styles.modalRowText}>{cp.text}</Text>
                  </View>
                ))}
                {"isCustomSubject" in activeTopic ? (
                  <Pressable
                    hitSlop={8}
                    style={styles.deleteTopicBtn}
                    onPress={() => {
                      removeCustomTopic(contentTopic?.topicId ?? 0);
                      setContentTopic(null);
                    }}
                  >
                    <ThemedIcon name="trash-outline" size={15} color={colors.danger} />
                    <Text style={styles.deleteTopicText}>删除该主题</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
  );
}
