import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { domainTemplates, type DomainTemplate } from "@learn-workbench/content";
import { copyTemplateContent, prefixFromKey, type Resolver } from "./copy-domain";
import {
  DEFAULT_COLOR,
  DEFAULT_ICON,
  DEFAULT_KIND,
  DEFAULT_PHASE_PREFIX,
  type DomainRow,
  error,
  KIND_LABELS,
  kindOf,
  normalizeColor,
  normalizePhasePrefix,
  serializeDomain,
  str,
} from "./lib";

/** careers 与内容主键都是 serial/int，用随机负 id 避免与既有 seed 冲突 */
const negBase = -(2 ** 30);
let negCursor = negBase;
async function nextNegId(): Promise<number> {
  negCursor -= 1;
  return negCursor;
}

/** 唯一 key：<prefix>-c-<random 8 hex>（重试幂等，杜绝跨账号撞 key） */
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

/** 运行时 Resolver：真随机 key + 内存负 id（单事务内单调，满足主键唯一） */
function resolverFor(client: PoolClient): Resolver {
  return {
    uniqueKey: (prefix) => uniqueKey(client, prefix),
    nextPhaseId: nextNegId,
    nextTopicId: nextNegId,
    nextChildId: nextNegId,
  };
}

/** 模板查询辅助：GET /api/domains?templates=1 或携带 template=xxx 时读取内置模板 */
function findTemplate(key: string | null): DomainTemplate | null {
  if (!key) return null;
  return domainTemplates.find((t) => t.key === key) ?? null;
}

function templateView(t: DomainTemplate) {
  return {
    key: t.key,
    name: t.name,
    kind: t.kind,
    kindLabel: KIND_LABELS[t.kind] ?? t.kind,
    icon: t.icon,
    color: t.color,
    phasePrefix: t.phasePrefix,
    description: t.description,
    weeksNote: t.weeksNote ?? null,
    phaseCount: t.phases.length,
  };
}

/* ================= GET ================= */

/** GET /api/domains —— 领域/模板列表（登录返回全部，匿名仅系统域；templates=1 附带模板目录） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const withTemplates = url.searchParams.get("templates") === "1";
  const templateKey = url.searchParams.get("template");
  const tpl = findTemplate(templateKey);

  const uid = await currentUserId();
  const { rows } = await pgPool.query<DomainRow>(
    `SELECT career_key, name, description, is_locked, sort_order,
            owner_id, kind, icon, color, phase_prefix, is_archived
     FROM careers
     WHERE is_archived = FALSE
       AND (owner_id IS NULL OR owner_id = $1)
     ORDER BY sort_order, id`,
    [uid]
  );

  if (tpl) {
    return NextResponse.json({ template: templateView(tpl) });
  }
  const body: Record<string, unknown> = { domains: rows.map(serializeDomain) };
  if (withTemplates) body.templates = domainTemplates.map(templateView);
  return NextResponse.json(body);
}
/* ================= POST ================= */

function defaultKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-") || "domain"
  );
}

async function readCareersRow(client: PoolClient, key: string): Promise<DomainRow | null> {
  const { rows } = await client.query<DomainRow>(
    `SELECT career_key, name, description, is_locked, sort_order,
            owner_id, kind, icon, color, phase_prefix, is_archived
     FROM careers WHERE career_key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

function makeCareersPayload(
  tpl: DomainTemplate | null,
  overrides: { name?: string | null; description?: string | null }
) {
  if (tpl) {
    return {
      name: overrides.name ?? tpl.name,
      description: overrides.description ?? tpl.description,
      kind: tpl.kind,
      icon: tpl.icon,
      color: tpl.color,
      phasePrefix: tpl.phasePrefix,
    };
  }
  return {
    name: overrides.name ?? "新领域",
    description: overrides.description ?? null,
    kind: DEFAULT_KIND,
    icon: DEFAULT_ICON,
    color: DEFAULT_COLOR,
    phasePrefix: DEFAULT_PHASE_PREFIX,
  };
}

function baseKeyFor(payload: ReturnType<typeof makeCareersPayload>): string {
  const name = payload.name ?? "新领域";
  return `${prefixFromKey(defaultKey(name))}-c-${Math.random().toString(16).slice(2, 10)}`;
}
/** POST /api/domains —— 新建领域：空白 / 从模板创建 */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return error("请先登录", 401);

  const body = await req.json().catch(() => null);
  const templateKey = str(body?.template);
  const tpl = templateKey ? findTemplate(templateKey) : null;
  if (templateKey && !tpl) return error("模板不存在", 400);

  const payload = makeCareersPayload(tpl, {
    name: str(body?.name),
    description: str(body?.description),
  });
  const baseKey = baseKeyFor(payload);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const exists = await readCareersRow(client, baseKey);
    if (exists) return error("领域 key 已存在", 409);

    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO careers (career_key, name, description, kind, icon, color, phase_prefix, owner_id, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       RETURNING id`,
      [baseKey, payload.name, payload.description, payload.kind, payload.icon, payload.color, payload.phasePrefix, uid]
    );
    const newId = rows[0].id;

    if (tpl) {
      await copyTemplateContent(client, tpl, baseKey, uid, resolverFor(client));
    }

    await client.query(
      `UPDATE careers SET sort_order = id WHERE id = $1`,
      [newId]
    );
    const created = await readCareersRow(client, baseKey);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, domain: serializeDomain(created!) }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
/* ================= PATCH ================= */

function buildOwnedSets(
  body: Record<string, unknown>,
  params: unknown[]
): { sql: string[]; err: NextResponse | null } {
  const sets: string[] = [];
  const name = str(body.name);
  const description = str(body.description);
  const icon = str(body.icon);
  const kind = kindOf(body.kind);
  const color = normalizeColor(body.color);
  const phasePrefix = normalizePhasePrefix(body.phasePrefix);
  if (body.name !== undefined) {
    if (!name) return { sql: sets, err: error("领域名称不能为空", 400) };
    sets.push(`name = $${params.push(name)}`);
  }
  if (body.description !== undefined) sets.push(`description = $${params.push(description)}`);
  if (body.icon !== undefined) {
    if (!icon) return { sql: sets, err: error("图标不能为空", 400) };
    sets.push(`icon = $${params.push(icon)}`);
  }
  if (body.kind !== undefined) {
    if (!kind) return { sql: sets, err: error("领域类型无效", 400) };
    sets.push(`kind = $${params.push(kind)}`);
  }
  if (body.color !== undefined) {
    if (!color) return { sql: sets, err: error("颜色格式无效", 400) };
    sets.push(`color = $${params.push(color)}`);
  }
  if (body.phasePrefix !== undefined) {
    if (!phasePrefix) return { sql: sets, err: error("阶段前缀无效", 400) };
    sets.push(`phase_prefix = $${params.push(phasePrefix)}`);
  }
  if (body.isArchived !== undefined) {
    if (typeof body.isArchived !== "boolean") return { sql: sets, err: error("归档标记无效", 400) };
    sets.push(`is_archived = $${params.push(body.isArchived)}`);
  }
  return { sql: sets, err: null };
}

/** PATCH /api/domains —— 编辑（改名/描述/图标/类型/颜色/前缀/归档）；仅本人自建域 */
export async function PATCH(req: Request) {
  const uid = await currentUserId();
  if (!uid) return error("请先登录", 401);

  const body = await req.json().catch(() => null);
  const key = str(body?.key);
  if (!key) return error("领域 key 不能为空", 400);

  const params: unknown[] = [];
  const { sql: sets, err } = buildOwnedSets(body ?? {}, params);
  if (err) return err;
  if (sets.length === 0) return error("没有可更新的字段", 400);

  const owned = await pgPool.query<{ owner_id: string | null }>(
    `SELECT owner_id FROM careers WHERE career_key = $1`,
    [key]
  );
  const ownerId = owned.rows[0]?.owner_id;
  if (ownerId === undefined) return error("学习领域不存在", 400);
  if (ownerId === null) return error("系统内置领域不可编辑", 403);
  if (ownerId !== uid) return error("无权操作他人自定义领域", 403);

  params.push(key);
  const { rows } = await pgPool.query<DomainRow>(
    `UPDATE careers SET ${sets.join(", ")}
     WHERE career_key = $${params.length}
     RETURNING career_key, name, description, is_locked, sort_order,
               owner_id, kind, icon, color, phase_prefix, is_archived`,
    params
  );
  return NextResponse.json({ ok: true, domain: serializeDomain(rows[0]) });
}
/* ================= DELETE ================= */

/** DELETE /api/domains?key=xxx —— 删除本人自建域（级联清空其内容/主题） */
export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return error("请先登录", 401);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return error("领域 key 不能为空", 400);

  const owned = await pgPool.query<{ owner_id: string | null }>(
    `SELECT owner_id FROM careers WHERE career_key = $1`,
    [key]
  );
  const ownerId = owned.rows[0]?.owner_id;
  if (ownerId === undefined) return error("学习领域不存在", 400);
  if (ownerId === null) return error("系统内置领域不可删除", 403);
  if (ownerId !== uid) return error("无权操作他人自定义领域", 403);

  const { rows } = await pgPool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM content_phases WHERE career_key = $1`,
    [key]
  );
  const phaseCount = Number(rows[0]?.c ?? 0);
  if (phaseCount > 0) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM content_phases WHERE career_key = $1`, [key]);
      await client.query(`DELETE FROM careers WHERE career_key = $1`, [key]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } else {
    await pgPool.query(`DELETE FROM careers WHERE career_key = $1`, [key]);
  }
  return NextResponse.json({ ok: true });
}
