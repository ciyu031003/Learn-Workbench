import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { renumberTrack, type RoadmapTrack } from "@/lib/roadmap-admin";

const TRACKS: RoadmapTrack[] = ["main", "agent"];

/** 校验目标领域归属：系统内置域或当前用户自建域 */
async function canEditCareer(career: string, uid: string): Promise<NextResponse | null> {
  const { rows } = await pgPool.query<{ owner_id: string | null }>(
    `SELECT owner_id FROM careers WHERE career_key = $1 AND is_archived = FALSE`,
    [career]
  );
  const ownerId = rows[0]?.owner_id;
  if (ownerId === undefined) return NextResponse.json({ error: "学习领域不存在" }, { status: 400 });
  if (ownerId !== null && ownerId !== uid) {
    return NextResponse.json({ error: "无权操作他人自定义领域" }, { status: 403 });
  }
  return null;
}

/** 拖动排序：order 为该轨道阶段 id 的新顺序（事务内校验 + 重排 sort_order） */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const career = typeof body?.career === "string" && body.career.trim() ? body.career.trim() : "ict";
  const track = TRACKS.includes(body?.track) ? (body.track as RoadmapTrack) : "main";
  const order: unknown = body?.order;
  if (!Array.isArray(order) || order.length === 0 || !order.every((n) => Number.isFinite(Number(n)))) {
    return NextResponse.json({ error: "order 无效" }, { status: 400 });
  }
  const err = await canEditCareer(career, uid);
  if (err) return err;
  const ids = order.map((n) => Number(n));

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM content_phases
       WHERE career_key = $1 AND track = $2
       ORDER BY sort_order, id`,
      [career, track]
    );
    const current = rows.map((r) => r.id);
    const sameSet =
      current.length === ids.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.includes(id));
    if (!sameSet) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "阶段列表与当前路线不一致，请刷新后重试" }, { status: 400 });
    }
    await renumberTrack(career, track, client, ids);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
