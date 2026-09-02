import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { copyDomainContentFromRows, prefixFromKey, type Resolver } from "../../copy-domain";
import { DEFAULT_ICON, DEFAULT_PHASE_PREFIX, type DomainRow, error, serializeDomain, str } from "../../lib";

/** 与 route.ts 同构：内存负 id 分配器，保证单事务内主键唯一 */
const negBase = -(2 ** 30);
let negCursor = negBase;
async function nextNegId(): Promise<number> {
  negCursor -= 1;
  return negCursor;
}

/** 唯一 key：<prefix>-c-<random 8 hex>（全局唯一，跨 phase/topic） */
async function uniqueKey(client: PoolClient, prefix: string): Promise<string> {
  const key = `${prefix}-c-${Math.random().toString(16).slice(2, 10)}`;
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM content_phases WHERE phase_key = $1
       UNION ALL SELECT 1 FROM content_topics WHERE topic_key = $1
     ) AS exists`,
    [key]
  );
  return rows[0]?.exists ? uniqueKey(client, prefix) : key;
}

function resolverFor(client: PoolClient): Resolver {
  return {
    uniqueKey: (prefix) => uniqueKey(client, prefix),
    nextPhaseId: nextNegId,
    nextTopicId: nextNegId,
    nextChildId: nextNegId,
  };
}

const DOMAIN_SELECT = `SELECT career_key, name, description, is_locked, sort_order,
    owner_id, kind, icon, color, phase_prefix, is_archived FROM careers`;

async function loadVisibleDomain(key: string, uid: string): Promise<DomainRow | null> {
  const { rows } = await pgPool.query<DomainRow>(
    `${DOMAIN_SELECT} WHERE career_key = $1 AND is_archived = FALSE AND (owner_id IS NULL OR owner_id = $2)`,
    [key, uid]
  );
  return rows[0] ?? null;
}

/** 派生新 key：<prefix>-c-<hex>，前缀取自来源域 key 净化后的英文/数字部分 */
/** 派生新 key：<prefix>-c-<hex>，前缀取自来源域 key 净化后的英文/数字部分 */
function newKeyFor(sourceKey: string): string {
  const base = prefixFromKey(sourceKey);
  return `${base}-c-${Math.random().toString(16).slice(2, 10)}`;
}

/** 加载某领域全量内容行（仅该领域可见内容：系统内置 + 本人自定义） */
async function loadContentRows(client: PoolClient, careerKey: string) {
  const phases = await client.query<{
    id: number; phase_key: string; title: string; weeks: string | null;
    track: "main" | "agent"; summary: string | null; sort_order: number;
  }>(
    `SELECT id, phase_key, title, weeks, track, summary, sort_order
     FROM content_phases WHERE career_key = $1 ORDER BY track, sort_order, id`,
    [careerKey]
  );
  const topics = await client.query<{
    id: number; phase_id: number; topic_key: string; title: string;
    summary: string | null; agent_task: string | null; sort_order: number;
  }>(
    `SELECT id, phase_id, topic_key, title, summary, agent_task, sort_order
     FROM content_topics
     WHERE phase_id IN (SELECT id FROM content_phases WHERE career_key = $1)
     ORDER BY sort_order, id`,
    [careerKey]
  );
  const topicIds = topics.rows.map((t) => t.id);
  const inClause = topicIds.length ? topicIds.join(",") : "NULL";
  const [resources, practices, projects, checkpoints] = await Promise.all([
    client.query(
      `SELECT id, topic_id, name, url, kind, sort_order FROM content_resources WHERE topic_id IN (${inClause}) ORDER BY sort_order, id`
    ),
    client.query(
      `SELECT id, topic_id, text, sort_order FROM content_practices WHERE topic_id IN (${inClause}) ORDER BY sort_order, id`
    ),
    client.query(
      `SELECT id, topic_id, name, description, repo_url, deliverable, sort_order FROM content_projects WHERE topic_id IN (${inClause}) ORDER BY sort_order, id`
    ),
    client.query(
      `SELECT id, topic_id, text, sort_order FROM content_checkpoints WHERE topic_id IN (${inClause}) ORDER BY sort_order, id`
    ),
  ]);
  return {
    phases: phases.rows,
    topics: topics.rows,
    resources: resources.rows,
    practices: practices.rows,
    projects: projects.rows,
    checkpoints: checkpoints.rows,
  };
}

/** POST /api/domains/:key/duplicate —— 克隆一个领域（系统内置或本人自建 → 新私有副本） */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const uid = await currentUserId();
  if (!uid) return error("请先登录", 401);

  const { key } = await ctx.params;
  const sourceKey = str(key) ?? "";
  if (!sourceKey) return error("领域 key 不能为空", 400);

  const source = await loadVisibleDomain(sourceKey, uid);
  if (!source) return error("学习领域不存在", 404);
  if (source.owner_id !== null && source.owner_id !== uid) {
    return error("无权操作他人自定义领域", 403);
  }

  // 可选：自定义副本名称；默认「原名（副本）」
  const body = await req.json().catch(() => null);
  const requestedName = str(body?.name);
  const name = requestedName ?? (source.name ? `${source.name}（副本）` : "领域副本");
  const newKey = newKeyFor(source.career_key);
  const payload = {
    name,
    description: source.description,
    kind: source.kind,
    icon: source.icon || DEFAULT_ICON,
    color: source.color || "#6366f1",
    phasePrefix: source.phase_prefix || DEFAULT_PHASE_PREFIX,
  };

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    // 兜底：随机 key 极小概率冲突则重试生成（防御性）
    const existsCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM careers WHERE career_key = $1) AS exists`,
      [newKey]
    );
    if (existsCheck.rows[0]?.exists) {
      await client.query("ROLLBACK");
      return error("领域 key 冲突，请重试", 409);
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO careers (career_key, name, description, kind, icon, color, phase_prefix, owner_id, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       RETURNING id`,
      [newKey, payload.name, payload.description, payload.kind, payload.icon, payload.color, payload.phasePrefix, uid]
    );
    const newId = inserted.rows[0].id;

    const content = await loadContentRows(client, sourceKey);
    await copyDomainContentFromRows(
      client,
      sourceKey,
      newKey,
      uid,
      resolverFor(client),
      content.phases,
      content.topics,
      { resources: content.resources, practices: content.practices, projects: content.projects, checkpoints: content.checkpoints }
    );

    await client.query(`UPDATE careers SET sort_order = id WHERE id = $1`, [newId]);
    const created = await client.query<DomainRow>(
      `${DOMAIN_SELECT} WHERE career_key = $1`,
      [newKey]
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, domain: serializeDomain(created.rows[0]) }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
