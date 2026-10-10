/**
 * 统一内容模型与稳定 ID（组二 · 阶段 7 = V3 Phase A）。
 *
 * 背景（V3 §0.2）：仓库里一直并存两套内容模型 ——
 *   1) DB 路线图模型：`content_phases` → `content_topics`（职业路线 / 勾选进度）；
 *   2) TS 学习库模型：`LearningTrack → LearningStage → LearningTopic → LearningQuestion`（技术课程深内容）。
 * 两套模型**不做物理合并**（生命周期与归属不同：路线图是个人职业路线 + 用户自建，学习库是版本化公开内容），
 * 但必须共用同一套字段词汇与稳定 ID 规则，并由"桥"打通：知识点↔题、知识点↔知识点、作答记录统一视图。
 * 决策与备选见 `content-platform/adr/ADR-001-内容模型与稳定ID.md`。
 *
 * 本文件是**纯逻辑**：给一组 `LearningTrack` 就产出可入库的行（知识点 / 关系 / 前置 / 题关联）与统计，
 * 不碰数据库、不碰文件系统 —— 便于单测，也便于后续 Phase C 的校验门禁与 Phase F 的导入管线复用。
 *
 * 稳定 ID 规则（**禁止用数组下标做持久 ID**）：
 *   - 知识点：`<trackSlug>/<stageKey>/<topicKey>`
 *   - 题目沿用内容包里已有的全局唯一 `questionKey`（`learning_review_cards` 的主键已依赖它的全局唯一性）
 */
import type {
  LearningDifficulty,
  LearningLevel,
  LearningStage,
  LearningTopic,
  LearningTrack,
} from "./types";

export const KNOWLEDGE_KEY_SEP = "/";

export interface KnowledgePointKeyInput {
  trackSlug: string;
  stageKey: string;
  topicKey: string;
}

/** 知识点稳定 ID：`<trackSlug>/<stageKey>/<topicKey>`（三段都来自内容包，不由下标推导）。 */
export function knowledgePointKeyOf(input: KnowledgePointKeyInput): string {
  return [input.trackSlug, input.stageKey, input.topicKey]
    .map((part) => String(part ?? "").trim())
    .join(KNOWLEDGE_KEY_SEP);
}

export const QUALITY_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;
export type KnowledgeQualityLevel = (typeof QUALITY_LEVELS)[number];

/** 质量分级含义（UI 与校验脚本共用这一份口径）：
 *  - L0 占位/不完整（连标题或摘要都缺）——**不进正式学习列表**
 *  - L1 只有摘要级（无深度字段）
 *  - L2 有概念层（concepts/principles/applications/pitfalls 至少 3 项），但还没有 lesson 讲解
 *  - L3 有 lesson，但模板仍有缺项（缺哪项由 `missing` 给出）
 *  - L4 模板全齐 + 至少 2 道关联题 + 来源许可已知
 */
export const QUALITY_LEVEL_HINT: Record<KnowledgeQualityLevel, string> = {
  L0: "占位/不完整，不进正式学习列表",
  L1: "仅摘要，待补深度内容",
  L2: "有概念层，待补讲解（lesson）",
  L3: "有讲解，模板尚有缺项",
  L4: "模板齐全，可正式学习",
};

export interface KnowledgeQuality {
  level: KnowledgeQualityLevel;
  missing: string[];
}

const nonEmpty = (value: string | undefined | null): boolean => String(value ?? "").trim().length > 0;
const nonEmptyList = (value: string[] | undefined | null): string[] =>
  (value ?? []).map((item) => String(item ?? "")).filter((item) => item.trim().length > 0);

function countChars(text: string): number {
  return text.replace(/\s+/g, "").length;
}

/** 「入门/进阶/综合」→ easy/medium/hard（已有元数据映射，不是拍脑袋分级）。 */
export const LEVEL_TO_DIFFICULTY: Record<LearningLevel, LearningDifficulty> = {
  入门: "easy",
  进阶: "medium",
  综合: "hard",
};

/**
 * 阅读时长估算（可复算）：
 *   中文技术文本约 350 字/分钟；代码按 0.6 分钟/非空行计；再加 1 分钟起步（进入 + 回看）。
 *   夹在 [3, 60] 分钟，避免极端值把课程总时长带偏。
 */
export function estimateReadingMinutes(topic: LearningTopic): number {
  const prose = [
    topic.summary,
    topic.method,
    topic.exercise,
    topic.checkpoint,
    ...nonEmptyList(topic.concepts),
    ...nonEmptyList(topic.principles),
    ...nonEmptyList(topic.applications),
    ...nonEmptyList(topic.pitfalls),
    ...nonEmptyList(topic.lesson?.overview),
    ...nonEmptyList(topic.lesson?.mechanism),
    ...nonEmptyList(topic.lesson?.practiceSteps),
    ...nonEmptyList(topic.lesson?.masteryChecklist),
    topic.lesson?.example?.explanation ?? "",
  ].join("");
  const codeLines = String(topic.lesson?.example?.code ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
  const minutes = countChars(prose) / 350 + codeLines * 0.6 + 1;
  return Math.min(60, Math.max(3, Math.round(minutes)));
}

/** 内容指纹：用于导入去重与"内容有没有变"的判定（同一份内容必须得到同一个指纹）。 */
export function knowledgeContentFingerprint(topic: LearningTopic): string {
  const parts = [
    topic.title,
    topic.summary,
    ...nonEmptyList(topic.concepts),
    ...nonEmptyList(topic.principles),
    ...nonEmptyList(topic.applications),
    ...nonEmptyList(topic.pitfalls),
    topic.method,
    topic.exercise,
    topic.checkpoint,
    topic.lesson?.example?.code ?? "",
  ];
  // 简易 32 位 FNV-1a（纯函数、跨端一致，不用 node crypto，移动端也能算）
  let hash = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x1f; // 分隔符，避免 ["ab","c"] 与 ["a","bc"] 撞指纹
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * 知识点质量分级：模板缺项 → 等级。
 * `linkedQuestions` 与 `licenseKnown` 由调用方给出（前者来自题关联，后者来自来源注册表）。
 */
export function gradeKnowledgeTopic(
  topic: LearningTopic,
  extra: { linkedQuestions: number; licenseKnown: boolean }
): KnowledgeQuality {
  const missing: string[] = [];
  if (!nonEmpty(topic.title)) missing.push("title");
  if (!nonEmpty(topic.summary)) missing.push("summary");
  if (!nonEmpty(topic.method)) missing.push("method");
  if (!nonEmpty(topic.exercise)) missing.push("exercise");
  if (!nonEmpty(topic.checkpoint)) missing.push("checkpoint");
  if (nonEmptyList(topic.concepts).length === 0) missing.push("concepts");
  if (nonEmptyList(topic.principles).length === 0) missing.push("principles");
  if (nonEmptyList(topic.applications).length === 0) missing.push("applications");
  if (nonEmptyList(topic.pitfalls).length === 0) missing.push("pitfalls");

  const lesson = topic.lesson;
  if (!lesson) {
    missing.push("lesson");
  } else {
    if (nonEmptyList(lesson.overview).length === 0) missing.push("lesson.overview");
    if (nonEmptyList(lesson.mechanism).length === 0) missing.push("lesson.mechanism");
    if (!nonEmpty(lesson.example?.code)) missing.push("lesson.example.code");
    if (!nonEmpty(lesson.example?.language)) missing.push("lesson.example.language");
    if (nonEmptyList(lesson.practiceSteps).length === 0) missing.push("lesson.practiceSteps");
    if (nonEmptyList(lesson.masteryChecklist).length === 0) missing.push("lesson.masteryChecklist");
  }
  if (extra.linkedQuestions < 2) missing.push("questions>=2");
  if (!extra.licenseKnown) missing.push("license");

  const conceptDepth =
    nonEmptyList(topic.concepts).length +
    nonEmptyList(topic.principles).length +
    nonEmptyList(topic.applications).length +
    nonEmptyList(topic.pitfalls).length;

  let level: KnowledgeQualityLevel;
  if (!nonEmpty(topic.title) || !nonEmpty(topic.summary)) level = "L0";
  else if (!lesson) level = conceptDepth >= 3 ? "L2" : "L1";
  else level = missing.length === 0 ? "L4" : "L3";

  return { level, missing };
}

export interface KnowledgePointRecord {
  key: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
  title: string;
  summary: string;
  trackTitle: string;
  stageTitle: string;
  /** 课程内全局顺序（跨阶段连续），关系的"下一节"依赖它 */
  sortOrder: number;
  stageOrder: number;
  topicOrder: number;
  difficulty: LearningDifficulty;
  estimatedMinutes: number;
  qualityLevel: KnowledgeQualityLevel;
  qualityMissing: string[];
  fingerprint: string;
  tags: string[];
  sourceKey: string | null;
}

export type KnowledgeRelationKind = "next" | "related";
export type KnowledgeRelationSource = "derived" | "curated";

export interface KnowledgeRelationRecord {
  fromKey: string;
  toKey: string;
  kind: KnowledgeRelationKind;
  relationSource: KnowledgeRelationSource;
}

export interface KnowledgePrerequisiteRecord {
  knowledgePointKey: string;
  prerequisiteKey: string;
  relationSource: KnowledgeRelationSource;
}

export interface QuestionKnowledgeLinkRecord {
  questionKey: string;
  knowledgePointKey: string;
  trackSlug: string;
  stageKey: string;
  topicKey: string;
  /** explicit = 题目自带 topicKey；stage-fallback = 该阶段只有一个知识点时按阶段归属 */
  linkSource: "explicit" | "stage-fallback";
}

export interface KnowledgeModelStats {
  tracks: number;
  stages: number;
  points: number;
  questions: number;
  linkedQuestions: number;
  unlinkedQuestions: number;
  links: number;
  relations: number;
  prerequisites: number;
  minutes: number;
  byQuality: Record<KnowledgeQualityLevel, number>;
  byDifficulty: Record<LearningDifficulty, number>;
  pointsPerTrack: Record<string, number>;
}

export interface KnowledgeModel {
  points: KnowledgePointRecord[];
  relations: KnowledgeRelationRecord[];
  prerequisites: KnowledgePrerequisiteRecord[];
  questionLinks: QuestionKnowledgeLinkRecord[];
  stats: KnowledgeModelStats;
  /** 没能在模型里找到归属的题（题干仍在，只是暂未关联知识点 → 待分类） */
  unlinkedQuestionKeys: string[];
}

/** 主来源：优先 usage='import' 的来源键（真正被导入引用的那份许可），否则第一份。 */
function primarySourceKey(track: LearningTrack): string | null {
  const sources = track.sources ?? [];
  const imported = sources.find((source) => source.usage === "import");
  return (imported ?? sources[0])?.key ?? null;
}

function knowledgePointTags(track: LearningTrack, stage: LearningStage): string[] {
  return [...new Set([track.category, stage.title].map((tag) => String(tag).trim()).filter(Boolean))];
}

/**
 * 由内容包构建统一模型。
 *
 * 硬不变量（违反直接抛错，让问题在测试/CI 就暴露，而不是写进库）：
 *   1. 知识点 ID 全局唯一；
 *   2. 题目 key 全局唯一（`learning_review_cards` 的主键已依赖这一点）。
 */
export function buildKnowledgeModel(tracks: LearningTrack[]): KnowledgeModel {
  const points: KnowledgePointRecord[] = [];
  const seenPointKeys = new Set<string>();
  const seenQuestionKeys = new Set<string>();
  const unlinkedQuestionKeys: string[] = [];

  // ---- 第一轮：知识点骨架（不含质量分级，分级依赖关联题数） ----
  interface Skeleton {
    topic: LearningTopic;
    stage: LearningStage;
    track: LearningTrack;
    key: string;
    sortOrder: number;
    stageOrder: number;
    topicOrder: number;
  }
  const skeletons: Skeleton[] = [];
  let stageCount = 0;

  for (const track of tracks) {
    let sortOrder = 0;
    track.stages.forEach((stage, stageOrder) => {
      stageCount += 1;
      stage.topics.forEach((topic, topicOrder) => {
        const key = knowledgePointKeyOf({ trackSlug: track.slug, stageKey: stage.key, topicKey: topic.key });
        if (seenPointKeys.has(key)) throw new Error(`知识点 ID 重复：${key}`);
        seenPointKeys.add(key);
        skeletons.push({ topic, stage, track, key, sortOrder, stageOrder, topicOrder });
        sortOrder += 1;
      });
    });
  }

  // ---- 第二轮：题 ↔ 知识点关联（先有关联，才能算质量分级） ----
  const questionLinks: QuestionKnowledgeLinkRecord[] = [];
  const linkedCount = new Map<string, number>();
  const pointByStageTopic = new Map<string, string>();
  for (const skeleton of skeletons) {
    pointByStageTopic.set(`${skeleton.track.slug}#${skeleton.stage.key}#${skeleton.topic.key}`, skeleton.key);
  }

  for (const track of tracks) {
    for (const question of track.questions) {
      if (seenQuestionKeys.has(question.key)) throw new Error(`题目 key 重复：${question.key}`);
      seenQuestionKeys.add(question.key);
      const stage = track.stages.find((item) => item.key === question.stageKey);
      let target: { key: string; topicKey: string; linkSource: QuestionKnowledgeLinkRecord["linkSource"] } | null = null;
      if (question.topicKey) {
        const key = pointByStageTopic.get(`${track.slug}#${question.stageKey}#${question.topicKey}`);
        if (key) target = { key, topicKey: question.topicKey, linkSource: "explicit" };
      }
      if (!target && stage && stage.topics.length === 1) {
        const topicKey = stage.topics[0].key;
        const key = pointByStageTopic.get(`${track.slug}#${question.stageKey}#${topicKey}`);
        if (key) target = { key, topicKey, linkSource: "stage-fallback" };
      }
      if (!target) {
        unlinkedQuestionKeys.push(question.key);
        continue;
      }
      questionLinks.push({
        questionKey: question.key,
        knowledgePointKey: target.key,
        trackSlug: track.slug,
        stageKey: question.stageKey,
        topicKey: target.topicKey,
        linkSource: target.linkSource,
      });
      linkedCount.set(target.key, (linkedCount.get(target.key) ?? 0) + 1);
    }
  }

  // ---- 第三轮：质量分级 + 落知识点记录（顺序与内容包一致） ----
  for (const skeleton of skeletons) {
    const { topic, stage, track } = skeleton;
    const quality = gradeKnowledgeTopic(topic, {
      linkedQuestions: linkedCount.get(skeleton.key) ?? 0,
      licenseKnown: primarySourceKey(track) !== null,
    });
    points.push({
      key: skeleton.key,
      trackSlug: track.slug,
      stageKey: stage.key,
      topicKey: topic.key,
      title: topic.title,
      summary: topic.summary ?? "",
      trackTitle: track.title,
      stageTitle: stage.title,
      sortOrder: skeleton.sortOrder,
      stageOrder: skeleton.stageOrder,
      topicOrder: skeleton.topicOrder,
      difficulty: LEVEL_TO_DIFFICULTY[track.level] ?? "medium",
      estimatedMinutes: estimateReadingMinutes(topic),
      qualityLevel: quality.level,
      qualityMissing: quality.missing,
      fingerprint: knowledgeContentFingerprint(topic),
      tags: knowledgePointTags(track, stage),
      sourceKey: primarySourceKey(track),
    });
  }

  // ---- 关系：同课程 next；同章节 related（不含相邻对，避免与 next 重复） ----
  const relations: KnowledgeRelationRecord[] = [];
  const prerequisites: KnowledgePrerequisiteRecord[] = [];
  for (const track of tracks) {
    const ordered = points.filter((point) => point.trackSlug === track.slug);
    for (let i = 0; i < ordered.length - 1; i++) {
      relations.push({
        fromKey: ordered[i].key,
        toKey: ordered[i + 1].key,
        kind: "next",
        relationSource: "derived",
      });
    }
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        if (ordered[i].stageKey !== ordered[j].stageKey) continue;
        if (j === i + 1) continue; // 相邻兄弟已有 next 边
        relations.push({
          fromKey: ordered[i].key,
          toKey: ordered[j].key,
          kind: "related",
          relationSource: "derived",
        });
      }
    }
    // 前置：每个阶段的第一个知识点，前置 = 上一阶段的最后一个知识点（结构推导，非人工审定）
    const stages: string[] = [];
    for (const point of ordered) if (!stages.includes(point.stageKey)) stages.push(point.stageKey);
    for (let i = 1; i < stages.length; i++) {
      const first = ordered.find((point) => point.stageKey === stages[i]);
      const previous = [...ordered].reverse().find((point) => point.stageKey === stages[i - 1]);
      if (first && previous && first.key !== previous.key) {
        prerequisites.push({
          knowledgePointKey: first.key,
          prerequisiteKey: previous.key,
          relationSource: "derived",
        });
      }
    }
  }

  const byQuality = Object.fromEntries(QUALITY_LEVELS.map((level) => [level, 0])) as Record<
    KnowledgeQualityLevel,
    number
  >;
  const byDifficulty: Record<LearningDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const pointsPerTrack: Record<string, number> = {};
  let minutes = 0;
  for (const point of points) {
    byQuality[point.qualityLevel] += 1;
    byDifficulty[point.difficulty] += 1;
    pointsPerTrack[point.trackSlug] = (pointsPerTrack[point.trackSlug] ?? 0) + 1;
    minutes += point.estimatedMinutes;
  }

  const questions = tracks.reduce((total, track) => total + track.questions.length, 0);
  return {
    points,
    relations,
    prerequisites,
    questionLinks,
    unlinkedQuestionKeys,
    stats: {
      tracks: tracks.length,
      stages: stageCount,
      points: points.length,
      questions,
      linkedQuestions: questionLinks.length,
      unlinkedQuestions: unlinkedQuestionKeys.length,
      links: questionLinks.length,
      relations: relations.length,
      prerequisites: prerequisites.length,
      minutes,
      byQuality,
      byDifficulty,
      pointsPerTrack,
    },
  };
}
