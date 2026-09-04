import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";

/** 单次会话时长上限：12 小时（标准倒计时最长 3 小时，续写不回退也不可无限膨胀） */
const MAX_SESSION_DURATION = 12 * 3600;

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // 兼容两组命名：新式（client_id/started_at/ended_at/task_id/duration_seconds）+ 旧式（startedAt/endedAt/taskId/durationSeconds）
  const startedAtRaw = body?.started_at ?? body?.startedAt;
  const startedAt = new Date(String(startedAtRaw ?? ""));
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "startedAt 无效" }, { status: 400 });
  }

  const endedAtRaw = body?.ended_at ?? body?.endedAt;
  const endedAt = endedAtRaw ? new Date(String(endedAtRaw)) : null;
  if (endedAt !== null && Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ error: "endedAt 无效" }, { status: 400 });
  }
  const end = endedAt ?? new Date();
  const computed = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));

  const explicitDuration = toInt(body?.duration_seconds ?? body?.durationSeconds);
  const durationSeconds = Math.min(
    MAX_SESSION_DURATION,
    explicitDuration !== null ? Math.max(0, explicitDuration) : computed
  );

  const taskId = toInt(body?.task_id ?? body?.taskId) ?? null;
  const clientId = typeof body?.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null;
  if (clientId && clientId.length > 128) {
    return NextResponse.json({ error: "client_id 过长" }, { status: 400 });
  }
  // 结算标记：仅「最终结算」请求（开始即建/期间续写不带）才累加任务 focus_minutes，
  // 保证一次会话只累加一次、且用最终时长取整。
  const isSettle = body?.settle === true;

  const uid = await currentUserId();
  const client = await pgPool.connect();
  try {
    let rows: { id: number; task_id: number | null; started_at: Date; ended_at: Date | null; duration_seconds: number; focus_minutes_applied: boolean }[];

    if (clientId) {
      // 幂等续写：同一 client_id 只保留一条，时长取「已入账的最新值」，不回退
      if (uid) {
        ({ rows } = await client.query(
          `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds, client_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL
           DO UPDATE SET
             duration_seconds = GREATEST(COALESCE(focus_sessions.duration_seconds, 0), EXCLUDED.duration_seconds),
             task_id = COALESCE(focus_sessions.task_id, EXCLUDED.task_id),
             ended_at = CASE
               WHEN focus_sessions.ended_at IS NULL OR EXCLUDED.ended_at IS NULL
                 THEN COALESCE(focus_sessions.ended_at, EXCLUDED.ended_at)
               ELSE GREATEST(focus_sessions.ended_at, EXCLUDED.ended_at)
             END
           RETURNING id, task_id, started_at, ended_at, duration_seconds, focus_minutes_applied`,
          [uid, taskId, startedAt, end, durationSeconds, clientId]
        ));
      } else {
        const anonId = await getAnonId();
        ({ rows } = await client.query(
          `INSERT INTO focus_sessions (user_id, anon_id, task_id, started_at, ended_at, duration_seconds, client_id)
           VALUES (NULL, $1, $2, $3, $4, $5, $6)
           ON CONFLICT (anon_id, client_id) WHERE anon_id IS NOT NULL AND client_id IS NOT NULL
           DO UPDATE SET
             duration_seconds = GREATEST(COALESCE(focus_sessions.duration_seconds, 0), EXCLUDED.duration_seconds),
             task_id = COALESCE(focus_sessions.task_id, EXCLUDED.task_id),
             ended_at = CASE
               WHEN focus_sessions.ended_at IS NULL OR EXCLUDED.ended_at IS NULL
                 THEN COALESCE(focus_sessions.ended_at, EXCLUDED.ended_at)
               ELSE GREATEST(focus_sessions.ended_at, EXCLUDED.ended_at)
             END
           RETURNING id, task_id, started_at, ended_at, duration_seconds, focus_minutes_applied`,
          [anonId, taskId, startedAt, end, durationSeconds, clientId]
        ));
      }
    } else if (uid) {
      ({ rows } = await client.query(
        `INSERT INTO focus_sessions (user_id, task_id, started_at, ended_at, duration_seconds)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, task_id, started_at, ended_at, duration_seconds, focus_minutes_applied`,
        [uid, taskId, startedAt, endedAt, durationSeconds]
      ));
    } else {
      const anonId = await getAnonId();
      ({ rows } = await client.query(
        `INSERT INTO focus_sessions (user_id, anon_id, task_id, started_at, ended_at, duration_seconds)
         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id, task_id, started_at, ended_at, duration_seconds, focus_minutes_applied`,
        [anonId, taskId, startedAt, endedAt, durationSeconds]
      ));
    }

    const session = rows[0];
    // 任务 focus_minutes：旧式请求（无 client_id，一条即一个会话）按原行为累加；
    // 新式续写仅在「最终结算」请求时累加一次（focus_minutes_applied 置位防重）。
    const shouldBump = uid && taskId && durationSeconds >= 60 && session && (!clientId || isSettle);
    if (shouldBump) {
      const applied = await client.query(
        `UPDATE focus_sessions SET focus_minutes_applied = true WHERE id = $1 AND focus_minutes_applied = false RETURNING id`,
        [session.id]
      );
      if (applied.rows.length) {
        await client.query(
          `UPDATE daily_tasks SET focus_minutes = focus_minutes + $1 WHERE id = $2 AND user_id IS NOT DISTINCT FROM $3`,
          [Math.round(durationSeconds / 60), taskId, uid]
        );
      }
    }

    return NextResponse.json({ session }, { status: 201 });
  } finally {
    client.release();
  }
}
