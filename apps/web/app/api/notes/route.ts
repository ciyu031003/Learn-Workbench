import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

// 知识库：GET /api/notes?limit=100 —— 列出当前用户（或匿名）的知识笔记（含标签）
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT
        n.id,
        n.topic_id AS "topicId",
        n.title,
        n.slug,
        n.content,
        n.summary,
        n.type,
        n.status,
        n.source,
        n.source_path AS "sourcePath",
        n.source_id AS "sourceId",
        n.created_at AS "createdAt",
        n.updated_at AS "updatedAt",
        n.published_at AS "publishedAt",
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
            ORDER BY t.name
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS tags
      FROM knowledge_notes n
      LEFT JOIN knowledge_note_tags nt ON nt.note_id = n.id
      LEFT JOIN knowledge_tags t ON t.id = nt.tag_id
      WHERE n.user_id IS NOT DISTINCT FROM $1
      GROUP BY n.id
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2`,
    [uid, limit]
  );
  return NextResponse.json({ notes: rows });
}
