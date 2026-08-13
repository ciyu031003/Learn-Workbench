// load.mjs — 加载层：写入 Learn-Workbench PostgreSQL（幂等 upsert）
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.join(process.cwd(), "migration/source/travel-notes");
const ASSET_DEST_ROOT = path.join(process.cwd(), "content/migrated");

/** 确定目标用户：默认取 accounts 中第一个账号对应的 user_id；无账号则 NULL（匿名） */
export async function resolveTargetUser(pool) {
  const { rows } = await pool.query(
    `SELECT user_id FROM accounts ORDER BY id LIMIT 1`
  );
  return rows[0]?.user_id ?? null;
}

export async function upsertTags(pool, userId, tags) {
  const ids = new Map(); // slug -> id
  for (const name of tags || []) {
    const slug = String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "");
    if (!slug) continue;
    const { rows } = await pool.query(
      `INSERT INTO knowledge_tags (user_id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [userId, String(name).trim(), slug]
    );
    let id = rows[0]?.id;
    if (!id) {
      const existing = await pool.query(
        `SELECT id FROM knowledge_tags
         WHERE user_id IS NOT DISTINCT FROM $1 AND slug = $2`,
        [userId, slug]
      );
      id = existing.rows[0]?.id;
    }
    if (id) ids.set(slug, id);
  }
  return ids;
}

export async function upsertNote(pool, userId, dto, publishedAt) {
  const { rows } = await pool.query(
    `INSERT INTO knowledge_notes
       (user_id, title, slug, content, summary, type, status, source, source_path, source_id, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9, $10)
     ON CONFLICT (user_id, slug) WHERE user_id IS NOT NULL
     DO UPDATE SET
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       summary = EXCLUDED.summary,
       type = EXCLUDED.type,
       source = EXCLUDED.source,
       source_path = EXCLUDED.source_path,
       source_id = EXCLUDED.source_id,
       published_at = EXCLUDED.published_at
     RETURNING id, created_at, updated_at`,
    [
      userId,
      dto.title,
      dto.slug,
      dto.content,
      dto.metadata?.description || null,
      dto.type,
      dto.metadata?.sourceProject || "manual",
      dto.sourcePath || null,
      dto.sourceId || null,
      publishedAt,
    ]
  );
  return rows[0];
}

export async function linkTags(pool, noteId, tagIds) {
  await pool.query(`DELETE FROM knowledge_note_tags WHERE note_id = $1`, [noteId]);
  for (const tagId of tagIds) {
    await pool.query(
      `INSERT INTO knowledge_note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [noteId, tagId]
    );
  }
}

/** 将 repo 资产文件复制到 Learn-Workbench content/migrated/ 下，返回新路径列表 */
export function copyAssets(dto) {
  const copied = [];
  for (const asset of dto.metadata?.assets || []) {
    const src = path.join(SOURCE_ROOT, asset.source);
    if (!fs.existsSync(src)) continue;
    // 相对 repo 根（sourcePath 所在目录）的路径，目标为 content/migrated/<slug>/<rel>
    const repoRoot = path.dirname(path.join(SOURCE_ROOT, dto.sourcePath));
    const rel = path.relative(repoRoot, src);
    const dest = path.join(ASSET_DEST_ROOT, dto.slug, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied.push(path.relative(process.cwd(), dest).replace(/\\/g, "/"));
  }
  return copied;
}

export async function loadAll(pool, dtos, opts = {}) {
  const userId = opts.userId !== undefined ? opts.userId : await resolveTargetUser(pool);
  const results = { userId, notes: [], tags: 0, errors: [] };
  const allTagIds = [];
  for (const dto of dtos) {
    try {
      const publishedAt = dto.date || null;
      const tagIds = await upsertTags(pool, userId, dto.tags);
      const note = await upsertNote(pool, userId, dto, publishedAt);
      await linkTags(pool, note.id, [...tagIds.values()]);
      const assets = copyAssets(dto);
      results.notes.push({ slug: dto.slug, id: note.id, type: dto.type, title: dto.title, assets });
      results.tags += tagIds.size;
      allTagIds.push(...tagIds.values());
    } catch (e) {
      results.errors.push({ slug: dto.slug, error: e.message });
    }
  }
  return results;
}
