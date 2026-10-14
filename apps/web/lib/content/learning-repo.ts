/**
 * 学习内容读取层（075）：数据库 → `LearningTrack[]`。
 *
 * 内容是**入库**的（不再是编译进 Web 包的内容包），运行时统一走这里；
 * 返回结构与 `@learn-workbench/content` 的 `LearningTrack` 完全一致，
 * 因此 lib 里的纯函数（flattenLearningQuestions / filterLearningQuestions /
 * learningQuestionFacets / learningStats 等）与页面模板**无需改动**。
 *
 * 只读口径：
 *   - 课程 status <> 'archived'；知识点 status <> 'archived'；题目**只取 status = 'published'**
 *     （draft/review/archived 一律不上前台 —— 运营在后台把题置为待审/已下线，前台立即不可见）；
 *   - 顺序按 sort_order（同步时写入内容包里的原始顺序）。
 */
import type {
  LearningCategory,
  LearningDifficulty,
  LearningLevel,
  LearningQuestion,
  LearningQuestionType,
  LearningSource,
  LearningStage,
  LearningStageLesson,
  LearningTopic,
  LearningTopicLesson,
  LearningTrack,
} from "@learn-workbench/content";
import { learningTracks as staticLearningTracks } from "@learn-workbench/content";
import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";

interface TrackRow {
  slug: string; title: string; category: string; level: string;
  accent: string; soft_accent: string; icon: string; summary: string; why_learn: string;
  prerequisites: unknown; study_method: unknown; estimated_hours: number; featured: boolean;
}
interface StageRow {
  track_slug: string; key: string; title: string; weeks: string; goal: string; outcome: string;
  lesson: unknown; sort_order: number;
}
interface TopicRow {
  track_slug: string; key: string; stage_key: string; title: string; summary: string;
  concepts: unknown; principles: unknown; applications: unknown; pitfalls: unknown;
  method: string; exercise: string; checkpoint: string; lesson: unknown; animations: unknown; sort_order: number;
}
interface SourceRow {
  track_slug: string; key: string; name: string; url: string; license: string; usage: string; note: string; sort_order: number;
}
interface QuestionRow {
  key: string; track_slug: string; stage_key: string; topic_key: string | null; type: string;
  difficulty: string; source_key: string | null; stem: string; options: unknown; answer: unknown;
  explanation: string; tags: unknown; level: string | null; sort_order: number;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

let cache: { at: number; tracks: LearningTrack[] } | null = null;
const CACHE_TTL_MS = 30_000;

/** 清空进程内缓存（内容同步/后台改题后调用）。 */
export function invalidateLearningTracksCache(): void {
  cache = null;
}

/** 从数据库装配全部课程（含阶段 / 知识点 / 题目 / 来源）。 */
async function queryTracksFromDb(): Promise<LearningTrack[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.tracks;

  const trackRes = await pgPool.query<TrackRow>(
    "SELECT slug, title, category, level, accent, soft_accent, icon, summary, why_learn, prerequisites, study_method, estimated_hours, featured FROM learning_tracks WHERE status <> 'archived' ORDER BY sort_order, slug"
  );
  const tracks = trackRes.rows;
  if (tracks.length === 0) {
    cache = { at: Date.now(), tracks: [] };
    return [];
  }
  const slugs = tracks.map((row) => row.slug);
  const [stageRes, topicRes, sourceRes, questionRes] = await Promise.all([
    pgPool.query<StageRow>("SELECT track_slug, key, title, weeks, goal, outcome, lesson, sort_order FROM learning_stages WHERE track_slug = ANY($1::text[]) ORDER BY track_slug, sort_order", [slugs]),
    pgPool.query<TopicRow>("SELECT track_slug, key, stage_key, title, summary, concepts, principles, applications, pitfalls, method, exercise, checkpoint, lesson, animations, sort_order FROM learning_topics WHERE track_slug = ANY($1::text[]) AND status <> 'archived' ORDER BY track_slug, sort_order", [slugs]),
    pgPool.query<SourceRow>("SELECT track_slug, key, name, url, license, usage, note, sort_order FROM learning_sources WHERE track_slug = ANY($1::text[]) ORDER BY track_slug, sort_order", [slugs]),
    pgPool.query<QuestionRow>("SELECT key, track_slug, stage_key, topic_key, type, difficulty, source_key, stem, options, answer, explanation, tags, level, sort_order FROM learning_questions WHERE track_slug = ANY($1::text[]) AND status = 'published' ORDER BY track_slug, sort_order", [slugs]),
  ]);

  const stagesByTrack = new Map<string, StageRow[]>();
  const topicsByTrack = new Map<string, TopicRow[]>();
  const sourcesByTrack = new Map<string, SourceRow[]>();
  const questionsByTrack = new Map<string, QuestionRow[]>();
  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key);
    if (list) list.push(value); else map.set(key, [value]);
  };
  for (const row of stageRes.rows) push(stagesByTrack, row.track_slug, row);
  for (const row of topicRes.rows) push(topicsByTrack, row.track_slug, row);
  for (const row of sourceRes.rows) push(sourcesByTrack, row.track_slug, row);
  for (const row of questionRes.rows) push(questionsByTrack, row.track_slug, row);

  const assembled: LearningTrack[] = tracks.map((track) => {
    const questionRows = questionsByTrack.get(track.slug) ?? [];
    const questions: LearningQuestion[] = questionRows.map((row) => ({
      key: row.key,
      stageKey: row.stage_key,
      topicKey: row.topic_key ?? undefined,
      level: (row.level ?? undefined) as LearningLevel | undefined,
      type: row.type as LearningQuestionType,
      stem: row.stem,
      options: asArray(row.options),
      answer: asArray(row.answer),
      explanation: row.explanation,
      difficulty: row.difficulty as LearningDifficulty,
      tags: asArray(row.tags),
      sourceKey: row.source_key ?? "",
    }));

    const topicRows = topicsByTrack.get(track.slug) ?? [];
    const stages: LearningStage[] = (stagesByTrack.get(track.slug) ?? []).map((stage) => {
      const topics: LearningTopic[] = topicRows
        .filter((topic) => topic.stage_key === stage.key)
        .map((topic) => ({
          key: topic.key,
          title: topic.title,
          summary: topic.summary,
          concepts: asArray(topic.concepts),
          principles: asArray(topic.principles),
          applications: asArray(topic.applications),
          pitfalls: asArray(topic.pitfalls),
          method: topic.method,
          exercise: topic.exercise,
          checkpoint: topic.checkpoint,
          lesson: (topic.lesson ?? undefined) as LearningTopicLesson | undefined,
          animations: asArray(topic.animations),
        }));
      return {
        key: stage.key,
        title: stage.title,
        weeks: stage.weeks,
        goal: stage.goal,
        outcome: stage.outcome,
        topics,
        questionKeys: questions.filter((question) => question.stageKey === stage.key).map((question) => question.key),
        lesson: (stage.lesson ?? undefined) as LearningStageLesson | undefined,
      };
    });

    const sources: LearningSource[] = (sourcesByTrack.get(track.slug) ?? []).map((source) => ({
      key: source.key,
      name: source.name,
      url: source.url,
      license: source.license,
      usage: (source.usage === "import" ? "import" : "reference") as LearningSource["usage"],
      note: source.note,
    }));

    return {
      slug: track.slug,
      title: track.title,
      category: track.category as LearningCategory,
      level: track.level as LearningLevel,
      accent: track.accent,
      softAccent: track.soft_accent,
      icon: track.icon,
      summary: track.summary,
      whyLearn: track.why_learn,
      prerequisites: asArray(track.prerequisites),
      studyMethod: asArray(track.study_method),
      estimatedHours: track.estimated_hours,
      featured: track.featured,
      stages,
      questions,
      sources,
    };
  });

  cache = { at: Date.now(), tracks: assembled };
  return assembled;
}

/**
 * 前台读取入口：优先数据库。
 *
 * 兜底口径：库为空（还没跑第一次内容同步）或数据库短时不可用 → 回退内容包，
 * 保证站点不白屏；一旦同步过，内容改动立即生效、无需重新发版。
 */
export async function loadLearningTracks(): Promise<LearningTrack[]> {
  try {
    const tracks = await queryTracksFromDb();
    if (tracks.length > 0) return tracks;
    logger.warn("[learning-repo] learning_tracks 为空（尚未同步内容）→ 暂用内容包兜底");
  } catch (error) {
    logger.error("[learning-repo] 读取数据库失败 → 暂用内容包兜底", error);
  }
  return staticLearningTracks as LearningTrack[];
}

/** 单门课程（含阶段/知识点/题目）。 */
export async function loadLearningTrack(slug: string): Promise<LearningTrack | null> {
  const tracks = await loadLearningTracks();
  return tracks.find((track) => track.slug === slug) ?? null;
}

export interface LearningAnimationFrame {
  caption: string;
  svg: string;
}

/** 算法演示动图注册表（key → 帧）。 */
export async function loadAlgorithmAnimations(): Promise<Record<string, LearningAnimationFrame[]>> {
  const { rows } = await pgPool.query<{ key: string; frames: unknown }>(
    "SELECT key, frames FROM learning_animations"
  );
  const out: Record<string, LearningAnimationFrame[]> = {};
  for (const row of rows) out[row.key] = asArray<LearningAnimationFrame>(row.frames);
  return out;
}
