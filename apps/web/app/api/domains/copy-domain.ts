import type { PoolClient } from "pg";
import type { Phase, Topic } from "@learn-workbench/shared";
import type { DomainTemplate } from "@learn-workbench/content";

export interface Resolver {
  uniqueKey(prefix: string): Promise<string>;
  nextPhaseId(): Promise<number>;
  nextTopicId(): Promise<number>;
  nextChildId(): Promise<number>;
}

export function prefixFromKey(templateKey: string): string {
  const clean = templateKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "domain";
}

/**
 * 把模板结构复制为当前用户私有内容（service 专用，不处理 careers 行本身）。
 * phase_key / topic_key / child ids 全部重写为 <prefix>-c-<suffix>，保证全局唯一。
 * 需要 Resolver 在单个事务里实现唯一性（gen_random_uuid 等）。
 */
export async function copyTemplateContent(
  client: PoolClient,
  template: DomainTemplate,
  careerKey: string,
  uid: string,
  resolver: Resolver
): Promise<void> {
  const prefix = prefixFromKey(template.key);
  for (const phase of template.phases) {
    const newPhaseKey = await resolver.uniqueKey(`${prefix}-p`);
    const phaseId = await resolver.nextPhaseId();
    await client.query(
      `INSERT INTO content_phases
         (id, phase_key, career_key, title, weeks, track, summary, sort_order, is_custom, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)`,
      [phaseId, newPhaseKey, careerKey, phase.title, phase.weeks, phase.track, phase.summary, phase.sortOrder, uid]
    );
    await copyPhaseTopics(client, phase, careerKey, uid, phaseId, resolver);
  }
}

async function copyPhaseTopics(
  client: PoolClient,
  phase: Phase,
  careerKey: string,
  uid: string,
  phaseId: number,
  resolver: Resolver
): Promise<void> {
  const prefix = prefixFromKey(careerKey);
  for (const topic of phase.topics) {
    const newTopicKey = await resolver.uniqueKey(`${prefix}-t`);
    const topicId = await resolver.nextTopicId();
    await client.query(
      `INSERT INTO content_topics
         (id, phase_id, topic_key, title, summary, agent_task, sort_order, is_custom, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
      [topicId, phaseId, newTopicKey, topic.title, topic.summary, topic.agentTask, topic.sortOrder, uid]
    );
    await copyTopicChildren(client, topic, topicId, resolver);
  }
}

async function copyTopicChildren(
  client: PoolClient,
  topic: Topic,
  topicId: number,
  resolver: Resolver
): Promise<void> {
  for (const r of topic.resources) {
    await client.query(
      `INSERT INTO content_resources (id, topic_id, name, url, kind, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [await resolver.nextChildId(), topicId, r.name, r.url, r.kind, r.sortOrder]
    );
  }
  for (const p of topic.practices) {
    await client.query(
      `INSERT INTO content_practices (id, topic_id, text, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [await resolver.nextChildId(), topicId, p.text, p.sortOrder]
    );
  }
  for (const p of topic.projects) {
    await client.query(
      `INSERT INTO content_projects (id, topic_id, name, description, repo_url, deliverable, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [await resolver.nextChildId(), topicId, p.name, p.description, p.repoUrl, p.deliverable, p.sortOrder]
    );
  }
  for (const c of topic.checkpoints) {
    await client.query(
      `INSERT INTO content_checkpoints (id, topic_id, text, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [await resolver.nextChildId(), topicId, c.text, c.sortOrder]
    );
  }
}


/** 领域内容行的轻量接口（与 content_* 表对齐） */
interface DbPhaseRow {
  id: number;
  phase_key: string;
  title: string;
  weeks: string | null;
  track: "main" | "agent";
  summary: string | null;
  sort_order: number;
}
interface DbTopicRow {
  id: number;
  phase_id: number;
  topic_key: string;
  title: string;
  summary: string | null;
  agent_task: string | null;
  sort_order: number;
}
interface DbChildRow {
  id: number;
  topic_id: number;
  name?: string;
  url?: string | null;
  kind?: string;
  text?: string;
  description?: string | null;
  repo_url?: string | null;
  deliverable?: string | null;
  sort_order: number;
}

/**
 * 把一个「现有领域」的内容（阶段/主题/资源/实操/项目/检查点）整体复制为
 * 新 owner 的私有内容。来源可以是系统内置域（owner_id IS NULL）或用户自建域。
 * 所有 phase_key/topic_key 用 resolver 重写为 <prefix>-c-<hex> 以保全局唯一；
 * 主键用 resolver 分配（调用方应保证同一事务内单调不重复）。
 * 返回新领域内复制的阶段数（便于接口回显）。
 */
export async function copyDomainContentFromRows(
  client: PoolClient,
  sourceCareerKey: string,
  newCareerKey: string,
  uid: string,
  resolver: Resolver,
  sourcePhases: DbPhaseRow[],
  sourceTopics: DbTopicRow[],
  sourceChildren: { resources: DbChildRow[]; practices: DbChildRow[]; projects: DbChildRow[]; checkpoints: DbChildRow[] }
): Promise<number> {
  const prefix = prefixFromKey(sourceCareerKey);
  const topicMap = new Map<number, DbTopicRow>();
  for (const t of sourceTopics) topicMap.set(t.id, t);

  let phaseCount = 0;
  for (const p of sourcePhases) {
    const newPhaseKey = await resolver.uniqueKey(prefix + "-p");
    const phaseId = await resolver.nextPhaseId();
    await client.query(
      `INSERT INTO content_phases
         (id, phase_key, career_key, title, weeks, track, summary, sort_order, is_custom, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)`,
      [phaseId, newPhaseKey, newCareerKey, p.title, p.weeks, p.track, p.summary, p.sort_order, uid]
    );
    phaseCount += 1;
    for (const [oldTopicId, topic] of topicMap) {
      if (topic.phase_id !== p.id) continue;
      const newTopicKey = await resolver.uniqueKey(prefix + "-t");
      const topicId = await resolver.nextTopicId();
      await client.query(
        `INSERT INTO content_topics
           (id, phase_id, topic_key, title, summary, agent_task, sort_order, is_custom, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
        [topicId, phaseId, newTopicKey, topic.title, topic.summary, topic.agent_task, topic.sort_order, uid]
      );
      for (const r of sourceChildren.resources) {
        if (r.topic_id !== oldTopicId) continue;
        await client.query(
          `INSERT INTO content_resources (id, topic_id, name, url, kind, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [await resolver.nextChildId(), topicId, r.name, r.url ?? null, r.kind ?? "doc", r.sort_order]
        );
      }
      for (const pr of sourceChildren.practices) {
        if (pr.topic_id !== oldTopicId) continue;
        await client.query(
          `INSERT INTO content_practices (id, topic_id, text, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [await resolver.nextChildId(), topicId, pr.text, pr.sort_order]
        );
      }
      for (const pj of sourceChildren.projects) {
        if (pj.topic_id !== oldTopicId) continue;
        await client.query(
          `INSERT INTO content_projects (id, topic_id, name, description, repo_url, deliverable, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [await resolver.nextChildId(), topicId, pj.name, pj.description ?? null, pj.repo_url ?? null, pj.deliverable ?? null, pj.sort_order]
        );
      }
      for (const c of sourceChildren.checkpoints) {
        if (c.topic_id !== oldTopicId) continue;
        await client.query(
          `INSERT INTO content_checkpoints (id, topic_id, text, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [await resolver.nextChildId(), topicId, c.text, c.sort_order]
        );
      }
    }
  }
  return phaseCount;
}
