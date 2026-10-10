import {
  learningTracks,
  type LearningDifficulty,
  type LearningQuestionOption,
  type LearningQuestionType,
  type LearningTrack,
} from "@learn-workbench/content";

/**
 * 题库统一视图（组二 · 阶段 12 剩余）。
 *
 * 学习库题目一直直接来自内容包（`@learn-workbench/content`），没有「统一浏览入口」。
 * 这里把「课程 → 阶段 → 知识点 → 题」拍平成可筛选的列表，筛选维度覆盖
 * 知识点 / 题型 / 难度 / 标签 / 来源 / 关键词，前端不编造任何数字。
 *
 * 纯函数：不碰数据库、不发请求 —— 便于单测，也便于后续换数据源（库侧 status 叠加上来）。
 */

export interface LearningQuestionItem {
  key: string;
  trackSlug: string;
  trackTitle: string;
  accent: string;
  softAccent: string;
  stageKey: string;
  stageTitle: string;
  topicKey: string | null;
  topicTitle: string | null;
  type: LearningQuestionType;
  difficulty: LearningDifficulty;
  stem: string;
  options: LearningQuestionOption[];
  answer: string[];
  explanation: string;
  tags: string[];
  sourceKey: string;
  sourceName: string | null;
}

/** 拍平全部题：一条题目携带足够的定位信息，供筛选与「回知识点」双向跳转。 */
export function flattenLearningQuestions(tracks: readonly LearningTrack[] = learningTracks): LearningQuestionItem[] {
  const items: LearningQuestionItem[] = [];
  for (const track of tracks) {
    const topicTitleOf = new Map<string, string>();
    const stageTitleOf = new Map<string, string>();
    for (const stage of track.stages) {
      stageTitleOf.set(stage.key, stage.title);
      for (const topic of stage.topics) topicTitleOf.set(topic.key, topic.title);
    }
    const sourceNameOf = new Map(track.sources.map((source) => [source.key, source.name]));
    for (const question of track.questions) {
      items.push({
        key: question.key,
        trackSlug: track.slug,
        trackTitle: track.title,
        accent: track.accent,
        softAccent: track.softAccent,
        stageKey: question.stageKey,
        stageTitle: stageTitleOf.get(question.stageKey) ?? question.stageKey,
        topicKey: question.topicKey ?? null,
        topicTitle: question.topicKey ? (topicTitleOf.get(question.topicKey) ?? null) : null,
        type: question.type,
        difficulty: question.difficulty,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        tags: question.tags,
        sourceKey: question.sourceKey,
        sourceName: sourceNameOf.get(question.sourceKey) ?? null,
      });
    }
  }
  return items;
}

export interface LearningQuestionFilters {
  track?: string | null;
  stage?: string | null;
  topic?: string | null;
  type?: LearningQuestionType | null;
  difficulty?: LearningDifficulty | null;
  tag?: string | null;
  source?: string | null;
  keyword?: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** 关键词命中面：题干 / 标签 / 知识点标题 / 阶段标题 / 课程标题（不搜答案，避免无意泄漏）。 */
function matchesKeyword(item: LearningQuestionItem, keyword: string): boolean {
  const needle = normalize(keyword);
  if (!needle) return true;
  return [
    item.stem,
    item.trackTitle,
    item.stageTitle,
    item.topicTitle ?? "",
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function filterLearningQuestions(
  items: readonly LearningQuestionItem[],
  filters: LearningQuestionFilters = {}
): LearningQuestionItem[] {
  const keyword = filters.keyword?.trim() ?? "";
  return items.filter((item) => {
    if (filters.track && item.trackSlug !== filters.track) return false;
    if (filters.stage && item.stageKey !== filters.stage) return false;
    if (filters.topic && item.topicKey !== filters.topic) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.difficulty && item.difficulty !== filters.difficulty) return false;
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    if (filters.source && item.sourceKey !== filters.source) return false;
    if (keyword && !matchesKeyword(item, keyword)) return false;
    return true;
  });
}

export interface FacetCount<T extends string = string> {
  key: T;
  label: string;
  count: number;
}

export interface LearningQuestionFacets {
  tracks: FacetCount[];
  stages: FacetCount[];
  types: FacetCount[];
  difficulties: FacetCount[];
  tags: FacetCount[];
  sources: FacetCount[];
}

const TYPE_LABEL: Record<LearningQuestionType, string> = { single: "单选", judge: "判断" };
const DIFFICULTY_LABEL: Record<LearningDifficulty, string> = { easy: "易", medium: "中", hard: "难" };

function countBy<T extends string>(
  items: readonly LearningQuestionItem[],
  pick: (item: LearningQuestionItem) => T[],
  label: (key: T) => string
): FacetCount<T>[] {
  const counts = new Map<T, number>();
  for (const item of items) {
    for (const key of new Set(pick(item))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * 可选项与计数。**按当前已选中的其他维度收窄**（facet 联动），
 * 所以「选了课程后再看阶段列表」只会列出该课程下的阶段。
 */
export function learningQuestionFacets(items: readonly LearningQuestionItem[]): LearningQuestionFacets {
  const trackTitle = new Map<string, string>();
  const stageTitle = new Map<string, string>();
  for (const item of items) {
    trackTitle.set(item.trackSlug, item.trackTitle);
    stageTitle.set(item.stageKey, item.stageTitle);
  }
  return {
    tracks: countBy(items, (item) => [item.trackSlug as string], (key) => trackTitle.get(key) ?? key),
    stages: countBy(items, (item) => [item.stageKey as string], (key) => stageTitle.get(key) ?? key),
    types: countBy(items, (item) => [item.type], (key) => TYPE_LABEL[key]),
    difficulties: countBy(items, (item) => [item.difficulty], (key) => DIFFICULTY_LABEL[key]),
    tags: countBy(items, (item) => item.tags, (key) => key),
    sources: countBy(items, (item) => [item.sourceKey as string], (key) => key),
  };
}
