import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { withRoute } from "@/lib/api/with-route";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

const KINDS = ["feynman", "review", "project", "interview"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const careerParam = url.searchParams.get("career");
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  // 领域维度：显式 career 参数优先，否则跟随用户设置（匿名默认 ICT）
  let career = "ict";
  if (careerParam) {
    career = careerParam;
  } else if (uid) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = $2`,
      [uid, "career"]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  const params: unknown[] = [uid, career, limit];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
    params.push(anonId);
  }
  const { rows } = await pgPool.query(
    `SELECT id, kind, career_key, title, content, created_at, updated_at
     FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${anonSql} AND career_key = $2 ORDER BY created_at DESC LIMIT $3`,
    params
  );
  return NextResponse.json({ logs: rows });
}

/**
 * POST /api/logs —— 新增一条学习日志。
 *
 * S2-2/S2-8：迁移到 withRoute，统一 30 次/分钟限流 + 匿名写配额（log_entries 500 条/设备）
 * + 200KB 流式体积上限 + 统一错误 envelope。
 */
export const POST = withRoute(
  {
    auth: "anon",
    bodyLimit: 200_000,
    limit: { key: "logs:post", n: 30, windowMs: 60_000 },
    anonWriteTable: "log_entries",
  },
  async ({ uid, anonId, rawBody }) => {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const kind = String(body.kind || "");
    const career = String(body.career || "ict");
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!KINDS.includes(kind)) {
      return apiError(400, "kind 无效", { code: API_ERROR_CODES.validation_failed });
    }
    if (!title || !content) {
      return apiError(400, "标题与内容不能为空", { code: API_ERROR_CODES.validation_failed });
    }
    if (uid) {
      const { rows } = await pgPool.query(
        `INSERT INTO log_entries (user_id, kind, career_key, title, content) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, kind, career_key, title, content, created_at, updated_at`,
        [uid, kind, career, title, content]
      );
      return NextResponse.json({ log: rows[0] }, { status: 201 });
    }
    const { rows } = await pgPool.query(
      `INSERT INTO log_entries (user_id, anon_id, kind, career_key, title, content) VALUES (NULL, $1, $2, $3, $4, $5)
       RETURNING id, kind, career_key, title, content, created_at, updated_at`,
      [anonId, kind, career, title, content]
    );
    return NextResponse.json({ log: rows[0] }, { status: 201 });
  }
);
