import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import {
  getLearningTrack,
  knowledgePointKeyOf,
  type LearningStage,
  type LearningTopic,
  type LearningTrack,
} from "@learn-workbench/content";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { BottomSheet } from "@/components/bottom-sheet";
import { InlineToast, TOAST_DEFAULT_LIFE_MS, type ToastKind } from "@/components/toast";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import {
  isFavorite as isFavoriteIn,
  loadReadingStore,
  markTopicRead,
  readStateOf,
  toggleTopicFavorite,
  type LocalReadState,
  type ReadingPointRef,
  type ReadingStore,
} from "@/lib/reading-state";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/** 读到这个百分比即视为"读完本节"（进度条只增不减） */
const READ_COMPLETE_PERCENT = 85;

export default function KnowledgeReaderScreen() {
  const params = useLocalSearchParams<{ track?: string; stage?: string; topic?: string }>();
  const track = getLearningTrack(params.track);
  const { colors } = useTheme();

  if (!track) {
    return <MissingChapter colors={colors} />;
  }

  const stageIndex = track.stages.findIndex((item) => item.key === params.stage);
  const resolvedStageIndex = stageIndex >= 0 ? stageIndex : 0;
  const stage = track.stages[resolvedStageIndex];
  if (!stage || stage.topics.length === 0) {
    return <MissingChapter colors={colors} />;
  }
  const topicIndex = stage.topics.findIndex((topic) => topic.key === params.topic);

  return (
    <KnowledgeReader
      track={track}
      stage={stage}
      stageIndex={resolvedStageIndex}
      topicIndex={topicIndex >= 0 ? topicIndex : 0}
    />
  );
}

function KnowledgeReader({
  track,
  stage,
  stageIndex,
  topicIndex,
}: {
  track: LearningTrack;
  stage: LearningStage;
  stageIndex: number;
  topicIndex: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const entrance = useScreenEntrance();
  const tabBarSpace = useTabBarSpace();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const topic = stage.topics[topicIndex] ?? stage.topics[0];
  const topicCount = stage.topics.length;

  // ---- 阅读状态（本地优先 + 跨设备同步，见 lib/reading-state.ts） ----
  // 稳定引用：React Compiler 要求 memo 依赖可被保持（否则整个组件跳过编译优化）
  const pointRef = useMemo<ReadingPointRef>(
    () => ({
      pointKey: knowledgePointKeyOf({ trackSlug: track.slug, stageKey: stage.key, topicKey: topic.key }),
      trackSlug: track.slug,
      stageKey: stage.key,
      topicKey: topic.key,
    }),
    [track.slug, stage.key, topic.key]
  );
  const [readingStore, setReadingStore] = useState<ReadingStore | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const progressRef = useRef(0);
  const reportedRef = useRef(0);
  const readState: LocalReadState | null = readingStore ? readStateOf(readingStore, pointRef.pointKey) : null;
  const favorited = readingStore ? isFavoriteIn(readingStore, pointRef.pointKey) : false;
  const readKeys = useMemo(() => new Set(Object.keys(readingStore?.read ?? {})), [readingStore]);
  const favoriteKeys = useMemo(() => new Set(Object.keys(readingStore?.favorites ?? {})), [readingStore]);

  const notify = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DEFAULT_LIFE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * 打开本节：先读本地状态（离线也有），再记一次阅读并尽力推送。
   * 离开本节时把滚动进度补上去 —— progress 只增不减，重复上报是幂等的。
   */
  useEffect(() => {
    let alive = true;
    progressRef.current = 0;
    reportedRef.current = 0;
    const ref: ReadingPointRef = {
      pointKey: knowledgePointKeyOf({ trackSlug: track.slug, stageKey: stage.key, topicKey: topic.key }),
      trackSlug: track.slug,
      stageKey: stage.key,
      topicKey: topic.key,
    };
    loadReadingStore().then((loaded) => {
      if (alive) setReadingStore(loaded);
    });
    markTopicRead(ref).then((next) => {
      if (alive) setReadingStore(next);
    });
    return () => {
      alive = false;
      const progress = Math.round(progressRef.current);
      if (progress > reportedRef.current) void markTopicRead({ ...ref, progress });
    };
  }, [track.slug, stage.key, topic.key]);

  const onToggleFavorite = useCallback(async () => {
    const next = await toggleTopicFavorite(pointRef);
    setReadingStore(next);
    notify(isFavoriteIn(next, pointRef.pointKey) ? "已收藏本节" : "已取消收藏", "info");
  }, [pointRef, notify]);

  const handleScroll = useCallback(
    (event: Parameters<typeof header.onScroll>[0]) => {
      header.onScroll(event);
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollable = contentSize.height - layoutMeasurement.height;
      const percent = scrollable <= 0 ? 100 : Math.round((contentOffset.y / scrollable) * 100);
      progressRef.current = Math.max(progressRef.current, Math.min(100, Math.max(0, percent)));
      // 读到 85% 就立刻把"已读"记上（不必等用户退出页面）
      if (progressRef.current >= READ_COMPLETE_PERCENT && reportedRef.current < READ_COMPLETE_PERCENT) {
        reportedRef.current = progressRef.current;
        void markTopicRead({ ...pointRef, progress: progressRef.current }).then(setReadingStore);
      }
    },
    [header, pointRef]
  );

  // 扁平化的"上一节 / 下一节"：跨章节时自动落到相邻章的边界知识点
  const flat = track.stages.flatMap((item, si) =>
    item.topics.map((entry, ti) => ({ stage: item, stageIndex: si, topic: entry, topicIndex: ti }))
  );
  const cursor = flat.findIndex((entry) => entry.stageIndex === stageIndex && entry.topicIndex === topicIndex);
  const previous = cursor > 0 ? flat[cursor - 1] : null;
  const next = cursor >= 0 && cursor < flat.length - 1 ? flat[cursor + 1] : null;

  const openTopic = (stageKey: string, topicKey: string) => {
    setOutlineOpen(false);
    router.replace({
      pathname: "/quiz/read",
      params: { track: track.slug, stage: stageKey, topic: topicKey },
    } as never);
  };

  const startTopicPractice = (topicKey: string) => {
    router.push({
      pathname: "/quiz/session",
      params: {
        track: track.slug,
        stage: stage.key,
        topic: topicKey,
        mode: "stage",
      },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title={topic.title}
        scrollY={header.scrollY}
        backTo={`/quiz/${track.slug}`}
        right={
          <View style={styles.headerActions}>
            <PressableScale
              haptic
              scaleTo={0.94}
              onPress={onToggleFavorite}
              style={styles.outlineButton}
              accessibilityRole="button"
              accessibilityLabel={favorited ? "取消收藏本节" : "收藏本节"}
              accessibilityState={{ selected: favorited }}
            >
              <ThemedIcon
                name={favorited ? "star" : "star-outline"}
                size={20}
                color={favorited ? colors.warning : colors.text}
              />
            </PressableScale>
            <PressableScale
              haptic
              scaleTo={0.94}
              onPress={() => setOutlineOpen(true)}
              style={styles.outlineButton}
              accessibilityRole="button"
              accessibilityLabel="打开课程目录"
            >
              <ThemedIcon name="list-outline" size={20} color={colors.text} />
            </PressableScale>
          </View>
        }
      />
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle
          title={track.title}
          subtitle={`第 ${stageIndex + 1} 章 · ${stage.title}`}
        />

        <Animated.View entering={entrance(0)} style={styles.progressRow}>
          <View style={styles.progressLeft}>
            <View style={[styles.progressChip, { backgroundColor: trackTint }]}>
              <Text style={[styles.progressChipText, { color: track.accent }]}>
                知识点 {topicIndex + 1} / {topicCount}
              </Text>
            </View>
            {readState && readState.progress > 0 ? (
              <View style={styles.readChip} accessibilityLabel={`阅读进度 ${readState.progress}%`}>
                <ThemedIcon
                  name={readState.progress >= READ_COMPLETE_PERCENT ? "checkmark-circle" : "book-outline"}
                  size={13}
                  color={readState.progress >= READ_COMPLETE_PERCENT ? colors.success : colors.textSecondary}
                />
                <Text style={styles.readChipText}>
                  {readState.progress >= READ_COMPLETE_PERCENT ? "已读" : `读到 ${readState.progress}%`}
                </Text>
              </View>
            ) : null}
          </View>
          <PressableScale haptic onPress={() => setOutlineOpen(true)} style={styles.progressOutline}>
            <ThemedIcon name="list-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.progressOutlineText}>目录</Text>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={[styles.hero, { backgroundColor: trackTint }]}>
          <View style={styles.heroTop}>
            <View style={styles.chapterBadge}>
              <Text style={[styles.chapterBadgeText, { color: track.accent }]}>
                CHAPTER {String(stageIndex + 1).padStart(2, "0")} · {String(topicIndex + 1).padStart(2, "0")}
              </Text>
            </View>
            <Text style={styles.heroWeeks}>{stage.weeks}</Text>
          </View>
          <Text style={styles.heroTitle}>{topic.title}</Text>
          <Text style={styles.heroSummary}>{topic.summary}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <ThemedIcon name="book-outline" size={17} color={track.accent} />
              <Text style={styles.heroMetaText}>{stage.title}</Text>
            </View>
            <View style={styles.heroMetaItem}>
              <ThemedIcon name="checkmark-circle" size={17} color={track.accent} />
              <Text style={styles.heroMetaText}>读完后完成练习</Text>
            </View>
          </View>
        </Animated.View>

        {topicIndex === 0 ? (
          <Animated.View entering={entrance(2)} style={styles.outcome}>
            <Text style={styles.outcomeLabel}>本章目标</Text>
            <Text style={styles.outcomeText}>{stage.goal}</Text>
            <Text style={[styles.outcomeLabel, styles.outcomeLabelSpaced]}>本章验收</Text>
            <Text style={styles.outcomeText}>{stage.outcome}</Text>
          </Animated.View>
        ) : null}

        {topicIndex === 0 && stage.lesson ? <StageLessonCard track={track} lesson={stage.lesson} /> : null}

        <Animated.View entering={entrance(3)}>
          <TopicArticle
            track={track}
            topic={topic}
            index={topicIndex}
            onCopied={notify}
            onPractice={() => startTopicPractice(topic.key)}
          />
        </Animated.View>

        <Animated.View entering={entrance(4)} style={styles.chapterNav}>
          {previous ? (
            <PressableScale
              haptic
              onPress={() => openTopic(previous.stage.key, previous.topic.key)}
              style={styles.chapterNavButton}
            >
              <ThemedIcon name="chevron-back" size={17} color={colors.textSecondary} />
              <View style={styles.chapterNavBody}>
                <Text style={styles.chapterNavLabel}>上一节</Text>
                <Text style={styles.chapterNavTitle} numberOfLines={1}>{previous.topic.title}</Text>
              </View>
            </PressableScale>
          ) : (
            <View style={styles.chapterNavSpacer} />
          )}
          {next ? (
            <PressableScale
              haptic
              onPress={() => openTopic(next.stage.key, next.topic.key)}
              style={[styles.chapterNavButton, styles.chapterNavNext]}
            >
              <View style={[styles.chapterNavBody, styles.chapterNavBodyNext]}>
                <Text style={styles.chapterNavLabel}>下一节</Text>
                <Text style={styles.chapterNavTitle} numberOfLines={1}>{next.topic.title}</Text>
              </View>
              <ThemedIcon name="chevron-forward" size={17} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      <BottomSheet visible={outlineOpen} onClose={() => setOutlineOpen(false)} title="课程目录" height="78%">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.outlineScroll}>
          {track.stages.map((item, si) => {
            const activeStage = si === stageIndex;
            return (
              <View key={item.key} style={styles.outlineStage}>
                <PressableScale
                  haptic
                  onPress={() => openTopic(item.key, item.topics[0]?.key ?? "")}
                  style={[styles.outlineStageRow, activeStage && { backgroundColor: trackTint }]}
                >
                  <Text style={[styles.outlineStageIndex, activeStage && { color: track.accent }]}>
                    {String(si + 1).padStart(2, "0")}
                  </Text>
                  <View style={styles.outlineStageBody}>
                    <Text style={styles.outlineStageTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.outlineStageMeta}>
                      {item.topics.length} 个知识点{item.weeks ? ` · ${item.weeks}` : ""}
                    </Text>
                  </View>
                </PressableScale>
                {activeStage
                  ? item.topics.map((entry, ti) => (
                      <PressableScale
                        key={entry.key}
                        haptic
                        onPress={() => openTopic(item.key, entry.key)}
                        style={styles.outlineTopicRow}
                      >
                        <View
                          style={[
                            styles.outlineDot,
                            ti === topicIndex && { backgroundColor: track.accent },
                          ]}
                        />
                        <Text
                          style={[
                            styles.outlineTopicText,
                            ti === topicIndex && { color: track.accent, fontWeight: "800" },
                          ]}
                          numberOfLines={2}
                        >
                          {ti + 1}. {entry.title}
                        </Text>
                        {favoriteKeys.has(
                          knowledgePointKeyOf({ trackSlug: track.slug, stageKey: item.key, topicKey: entry.key })
                        ) ? (
                          <ThemedIcon name="star" size={13} color={colors.warning} />
                        ) : null}
                        {readKeys.has(
                          knowledgePointKeyOf({ trackSlug: track.slug, stageKey: item.key, topicKey: entry.key })
                        ) ? (
                          <ThemedIcon name="checkmark-circle" size={14} color={colors.success} />
                        ) : null}
                      </PressableScale>
                    ))
                  : null}
              </View>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {toast ? <InlineToast message={toast.message} kind={toast.kind} style={styles.toast} /> : null}
    </View>
  );
}

function TopicArticle({
  track,
  topic,
  index,
  onCopied,
  onPractice,
}: {
  track: LearningTrack;
  topic: LearningTopic;
  index: number;
  onCopied: (message: string, kind?: ToastKind) => void;
  onPractice: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;

  return (
    <View style={styles.article}>
      <View style={styles.articleHead}>
        <View style={[styles.articleNumber, { backgroundColor: trackTint }]}>
          <Text style={[styles.articleNumberText, { color: track.accent }]}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
        <View style={styles.articleHeadBody}>
          <Text style={styles.articleTitle}>{topic.title}</Text>
          <Text style={styles.articleSummary}>{topic.summary}</Text>
        </View>
      </View>

      {topic.lesson ? (
        <>
          <KnowledgeBlock title="深入理解" icon="layers-outline" accent={track.accent}>
            <ParagraphList items={topic.lesson.overview} />
          </KnowledgeBlock>

          <KnowledgeBlock title="运作机制" icon="git-network-outline" accent={track.accent}>
            <ParagraphList items={topic.lesson.mechanism} />
          </KnowledgeBlock>

          <CodeExample example={topic.lesson.example} accent={track.accent} onCopied={onCopied} />

          <KnowledgeBlock title="练习路径" icon="map-outline" accent={track.accent}>
            <ParagraphList items={topic.lesson.practiceSteps} />
          </KnowledgeBlock>
        </>
      ) : null}

      <KnowledgeBlock title="先建立概念" icon="bulb-outline" accent={track.accent}>
        <View style={styles.chipWrap}>
          {topic.concepts.map((concept) => (
            <View key={concept} style={[styles.conceptChip, { backgroundColor: trackTint }]}>
              <Text style={[styles.conceptChipText, { color: track.accent }]}>{concept}</Text>
            </View>
          ))}
        </View>
      </KnowledgeBlock>

      <KnowledgeBlock title="为什么这样工作" icon="git-branch-outline" accent={track.accent}>
        <ParagraphList items={topic.principles} />
      </KnowledgeBlock>

      <KnowledgeBlock title="它可以解决什么" icon="apps-outline" accent={track.accent}>
        <ParagraphList items={topic.applications} />
      </KnowledgeBlock>

      <KnowledgeBlock title="常见误区" icon="alert-circle" accent={colors.danger} danger>
        <ParagraphList items={topic.pitfalls} danger />
      </KnowledgeBlock>

      <View style={styles.method}>
        <Text style={styles.methodLabel}>怎么学</Text>
        <Text style={styles.methodText}>{topic.method}</Text>
      </View>

      <PressableScale
        haptic
        scaleTo={0.985}
        onPress={onPractice}
        accessibilityRole="button"
        accessibilityLabel={`开始${topic.title}练习`}
        style={styles.practice}
      >
        <View style={styles.practiceHead}>
          <ThemedIcon name="create-outline" size={18} color={track.accent} />
          <Text style={styles.practiceTitle}>动手练习</Text>
        </View>
        <Text style={styles.practiceText}>{topic.exercise}</Text>
        {topic.lesson ? (
          <View style={styles.masteryList}>
            {topic.lesson.masteryChecklist.map((item) => (
              <View key={item} style={styles.masteryRow}>
                <ThemedIcon name="checkmark-circle-outline" size={15} color={track.accent} />
                <Text style={styles.masteryText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.checkpoint}>
          <ThemedIcon name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.checkpointText}>掌握检查：{topic.checkpoint}</Text>
        </View>
        <View style={[styles.practiceAction, { backgroundColor: trackTint }]}>
          <Text style={[styles.practiceActionText, { color: track.accent }]}>开始本知识点练习</Text>
          <ThemedIcon name="arrow-forward" size={16} color={track.accent} />
        </View>
      </PressableScale>
    </View>
  );
}

function StageLessonCard({
  track,
  lesson,
}: {
  track: LearningTrack;
  lesson: NonNullable<LearningStage["lesson"]>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stageLesson}>
      <View style={styles.stageLessonHead}>
        <View style={styles.stageLessonIcon}>
          <ThemedIcon name="school-outline" size={19} color={track.accent} />
        </View>
        <View style={styles.stageLessonHeadBody}>
          <Text style={styles.stageLessonTitle}>这一阶段怎么学</Text>
          <Text style={styles.stageLessonMeta}>按主题拆解、动手验证、阶段交付</Text>
        </View>
      </View>
      <ParagraphList items={lesson.overview} />
      <View style={styles.stageLoop}>
        {lesson.studyLoop.map((item, index) => (
          <View key={item} style={styles.stageLoopStep}>
            <View style={[styles.stageLoopIndex, { backgroundColor: `${track.accent}18` }]}>
              <Text style={[styles.stageLoopIndexText, { color: track.accent }]}>{index + 1}</Text>
            </View>
            <Text style={styles.stageLoopText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.milestoneList}>
        {lesson.milestones.map((milestone) => (
          <View key={milestone.title} style={styles.milestoneRow}>
            <ThemedIcon name="flag-outline" size={16} color={track.accent} />
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneTitle}>{milestone.title}</Text>
              <Text style={styles.milestoneEvidence}>{milestone.evidence}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.completionBox}>
        <Text style={styles.completionLabel}>阶段完成标准</Text>
        {lesson.completionCriteria.map((item) => (
          <View key={item} style={styles.completionRow}>
            <ThemedIcon name="checkmark" size={14} color={colors.success} />
            <Text style={styles.completionText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CodeExample({
  example,
  accent,
  onCopied,
}: {
  example: NonNullable<LearningTopic["lesson"]>["example"];
  accent: string;
  onCopied: (message: string, kind?: ToastKind) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const copyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(example.code);
      onCopied("已复制代码");
    } catch {
      onCopied("复制失败，可长按选中代码", "error");
    }
  }, [example.code, onCopied]);
  return (
    <View style={styles.codeCard}>
      <View style={styles.codeHead}>
        <View style={styles.codeTitleWrap}>
          <ThemedIcon name="code-slash" size={16} color={accent} />
          <Text style={styles.codeTitle}>{example.title}</Text>
        </View>
        <View style={styles.codeHeadActions}>
          <Text style={[styles.codeLanguage, { color: accent }]}>{example.language}</Text>
          <PressableScale
            haptic
            scaleTo={0.92}
            onPress={copyCode}
            style={styles.codeCopy}
            accessibilityRole="button"
            accessibilityLabel="复制代码"
          >
            <ThemedIcon name="copy-outline" size={15} color={accent} />
            <Text style={[styles.codeCopyText, { color: accent }]}>复制</Text>
          </PressableScale>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeScroll}
      >
        <Text selectable style={styles.codeText}>{example.code}</Text>
      </ScrollView>
      <Text style={styles.codeExplanation}>{example.explanation}</Text>
    </View>
  );
}

function KnowledgeBlock({
  title,
  icon,
  accent,
  danger = false,
  children,
}: {
  title: string;
  icon: string;
  accent: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <ThemedIcon name={icon as never} size={17} color={danger ? colors.danger : accent} />
        <Text style={[styles.blockTitle, danger && { color: colors.danger }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ParagraphList({ items, danger = false }: { items: string[]; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.paragraphList}>
      {items.map((item) => (
        <View key={item} style={styles.paragraphRow}>
          <View style={[styles.paragraphDot, danger && { backgroundColor: colors.danger }]} />
          <Text style={styles.paragraphText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function MissingChapter({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.missing}>
      <View style={styles.missingIcon}>
        <ThemedIcon name="book-outline" size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.missingTitle}>没有找到这个学习章节</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz" as never)} style={styles.missingButton}>
        <Text style={styles.missingButtonText}>返回题库</Text>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    outlineButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    progressChip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
    progressLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
    readChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    readChipText: { ...typography.micro, color: colors.textSecondary, fontWeight: "600" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    toast: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl },
    progressChipText: { ...typography.caption, fontWeight: "800" },
    progressOutline: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    progressOutlineText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    outlineScroll: { paddingBottom: spacing.xl, gap: spacing.sm },
    outlineStage: { gap: 2, marginBottom: spacing.md },
    outlineStageRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, padding: spacing.sm },
    outlineStageIndex: { ...typography.caption, fontWeight: "900", color: colors.textMuted, width: 26 },
    outlineStageBody: { flex: 1, gap: 1 },
    outlineStageTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    outlineStageMeta: { ...typography.caption, color: colors.textMuted },
    outlineTopicRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 8, paddingLeft: spacing.xl },
    outlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong, marginTop: 7 },
    outlineTopicText: { flex: 1, ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    hero: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.card },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    chapterBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceStrong },
    chapterBadgeText: { ...typography.micro, letterSpacing: 0.8, fontWeight: "800" },
    heroWeeks: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroMetaText: { ...typography.caption, color: colors.textSecondary },
    outcome: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 5, ...shadows.card },
    outcomeLabel: { ...typography.micro, color: colors.primary },
    outcomeLabelSpaced: { marginTop: spacing.sm },
    outcomeText: { ...typography.callout, color: colors.text },
    stageLesson: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.md, ...shadows.card },
    stageLessonHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    stageLessonIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    stageLessonHeadBody: { flex: 1, gap: 2 },
    stageLessonTitle: { ...typography.headline, color: colors.text },
    stageLessonMeta: { ...typography.caption, color: colors.textMuted },
    stageLoop: { gap: spacing.sm },
    stageLoopStep: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stageLoopIndex: { width: 26, height: 26, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    stageLoopIndexText: { ...typography.micro, fontWeight: "800" },
    stageLoopText: { flex: 1, ...typography.callout, color: colors.textSecondary },
    milestoneList: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
    milestoneRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    milestoneBody: { flex: 1, gap: 2 },
    milestoneTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    milestoneEvidence: { ...typography.caption, color: colors.textMuted },
    completionBox: { gap: 6, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.successSoft },
    completionLabel: { ...typography.micro, color: colors.success },
    completionRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    completionText: { flex: 1, ...typography.caption, color: colors.textSecondary },
    article: { gap: spacing.lg, paddingVertical: spacing.sm },
    articleHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    articleNumber: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    articleNumberText: { ...typography.caption, fontWeight: "800" },
    articleHeadBody: { flex: 1, gap: 3 },
    articleTitle: { ...typography.title1, color: colors.text },
    articleSummary: { ...typography.body, color: colors.textSecondary },
    block: { gap: spacing.sm },
    blockHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    blockTitle: { ...typography.headline, color: colors.text },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    conceptChip: { maxWidth: "100%", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9 },
    conceptChipText: { ...typography.caption, fontWeight: "700" },
    codeCard: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
    codeHead: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    codeTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    codeTitle: { flex: 1, ...typography.caption, fontWeight: "700", color: colors.text },
    codeLanguage: { ...typography.micro, fontWeight: "700", textTransform: "uppercase" },
    codeHeadActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    codeCopy: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
    },
    codeCopyText: { ...typography.micro, fontWeight: "700" },
    codeScroll: { minWidth: "100%", padding: spacing.md },
    codeText: { ...typography.caption, lineHeight: 18, color: colors.text, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
    codeExplanation: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    paragraphList: { gap: spacing.sm },
    paragraphRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    paragraphDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.primary, marginTop: 8 },
    paragraphText: { flex: 1, ...typography.callout, color: colors.textSecondary },
    method: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.primarySoft, gap: 5 },
    methodLabel: { ...typography.micro, color: colors.primary },
    methodText: { ...typography.callout, color: colors.text },
    practice: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.sm, ...shadows.card },
    practiceHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    practiceTitle: { ...typography.headline, color: colors.text },
    practiceText: { ...typography.callout, color: colors.textSecondary },
    masteryList: { gap: 6 },
    masteryRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    masteryText: { flex: 1, ...typography.caption, color: colors.textSecondary },
    checkpoint: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    checkpointText: { flex: 1, ...typography.caption, color: colors.textMuted },
    practiceAction: { minHeight: 42, marginTop: spacing.xs, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
    practiceActionText: { ...typography.callout, fontWeight: "700" },
    chapterNav: { flexDirection: "row", gap: spacing.md },
    chapterNavSpacer: { flex: 1 },
    chapterNavButton: { flex: 1, minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    chapterNavNext: { justifyContent: "flex-end" },
    chapterNavBody: { flex: 1, gap: 2 },
    chapterNavBodyNext: { alignItems: "flex-end" },
    chapterNavLabel: { ...typography.micro, color: colors.textMuted },
    chapterNavTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
    missingIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    missingTitle: { ...typography.title2, color: colors.text },
    missingButton: { minHeight: 44, paddingHorizontal: spacing.xl, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    missingButtonText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
  });
