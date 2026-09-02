import type { RoadmapPhase, RoadmapTopic } from "@learn-workbench/shared";
import { pgPool } from "./db";
import { anonFilterSql } from "./anon";

export interface ProgressRow {
  topic_id: number;
  done: boolean;
  note: string | null;
}

interface PhaseRow {
  id: number;
  phase_key: string;
  title: string;
  weeks: string | null;
  track: "main" | "agent";
  summary: string | null;
      sort_order: number;
      is_custom: boolean;
}

interface TopicRow {
  id: number;
  phase_id: number;
  topic_key: string;
  title: string;
  summary: string | null;
  agent_task: string | null;
  sort_order: number;
  is_custom: boolean;
}

interface ResourceRow {
  id: number;
  topic_id: number;
  name: string;
  url: string | null;
  kind: "course" | "doc" | "tool" | "video";
  sort_order: number;
}

interface PracticeRow {
  id: number;
  topic_id: number;
  text: string;
  sort_order: number;
}

interface ProjectRow {
  id: number;
  topic_id: number;
  name: string;
  description: string | null;
  repo_url: string | null;
  deliverable: string | null;
  sort_order: number;
}

interface CheckpointRow {
  id: number;
  topic_id: number;
  text: string;
  sort_order: number;
}

/** 匿名数据读取作用域：登录用户不追加过滤；匿名用户按设备过滤（含遗留行） */
function anonParams(uid: string | null, anonId: string | null): { sql: string; params: unknown[] } {
  if (uid) return { sql: "", params: [uid] };
  return { sql: ` AND ${anonFilterSql(2)}`, params: [uid, anonId] };
}

export async function getProgressMap(
  uid: string | null,
  anonId: string | null = null
): Promise<Map<number, ProgressRow>> {
  const scope = anonParams(uid, anonId);
  const result = await pgPool.query<ProgressRow>(
    `SELECT topic_id, done, note FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${scope.sql}`,
    scope.params
  );
  const rows: ProgressRow[] = result.rows;
  return new Map(rows.map((r): [number, ProgressRow] => [r.topic_id, r]));
}

export async function getRoadmapWithProgress(
  uid: string | null,
  careerKey = "ict",
  anonId: string | null = null
): Promise<RoadmapPhase[]> {
  const client = await pgPool.connect();
  try {
    const phasesResult = await client.query<PhaseRow>(
      `SELECT id, phase_key, title, weeks, track, summary, sort_order, is_custom
       FROM content_phases
       WHERE career_key = $1 AND (is_custom = FALSE OR owner_id = $2)
       ORDER BY track, sort_order, id`,
      [careerKey, uid]
    );
    const topicsResult = await client.query<TopicRow>(
      `SELECT id, phase_id, topic_key, title, summary, agent_task, sort_order, is_custom
       FROM content_topics
       WHERE is_custom = FALSE OR owner_id = $1
       ORDER BY is_custom, sort_order, id`,
      [uid]
    );
    const resourcesResult = await client.query<ResourceRow>(
      `SELECT id, topic_id, name, url, kind, sort_order FROM content_resources ORDER BY sort_order, id`
    );
    const practicesResult = await client.query<PracticeRow>(
      `SELECT id, topic_id, text, sort_order FROM content_practices ORDER BY sort_order, id`
    );
    const projectsResult = await client.query<ProjectRow>(
      `SELECT id, topic_id, name, description, repo_url, deliverable, sort_order FROM content_projects ORDER BY sort_order, id`
    );
    const checkpointsResult = await client.query<CheckpointRow>(
      `SELECT id, topic_id, text, sort_order FROM content_checkpoints ORDER BY sort_order, id`
    );
    const scope = anonParams(uid, anonId);
    const progressResult = await client.query<ProgressRow>(
      `SELECT topic_id, done, note FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${scope.sql}`,
      scope.params
    );
    const progressMap = new Map(
      progressResult.rows.map((r): [number, ProgressRow] => [r.topic_id, r])
    );

    const topicMap = new Map<number, RoadmapTopic>();
    for (const t of topicsResult.rows) {
      const done = progressMap.get(t.id)?.done ?? false;
      const note = progressMap.get(t.id)?.note ?? null;
      topicMap.set(t.id, {
        id: t.id,
        topicKey: t.topic_key,
        title: t.title,
        summary: t.summary,
        agentTask: t.agent_task,
        sortOrder: t.sort_order,
        done,
        note,
        isCustom: t.is_custom,
        resources: [],
        practices: [],
        projects: [],
        checkpoints: [],
      });
    }
    for (const r of resourcesResult.rows) {
      topicMap.get(r.topic_id)?.resources.push({ id: r.id, name: r.name, url: r.url, kind: r.kind, sortOrder: r.sort_order });
    }
    for (const p of practicesResult.rows) {
      topicMap.get(p.topic_id)?.practices.push({ id: p.id, text: p.text, sortOrder: p.sort_order });
    }
    for (const p of projectsResult.rows) {
      topicMap.get(p.topic_id)?.projects.push({ id: p.id, name: p.name, description: p.description, repoUrl: p.repo_url, deliverable: p.deliverable, sortOrder: p.sort_order });
    }
    for (const c of checkpointsResult.rows) {
      topicMap.get(c.topic_id)?.checkpoints.push({ id: c.id, text: c.text, sortOrder: c.sort_order });
    }

    return phasesResult.rows.map((p): RoadmapPhase => ({
      id: p.id,
      phaseKey: p.phase_key,
      title: p.title,
      weeks: p.weeks,
      track: p.track,
      summary: p.summary,
        isCustom: p.is_custom,
        sortOrder: p.sort_order,
      topics: topicsResult.rows
        .filter((t) => t.phase_id === p.id)
        .map((t) => topicMap.get(t.id) as RoadmapTopic),
    }));
  } finally {
    client.release();
  }
}
