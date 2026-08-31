import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { renumberTrack, type RoadmapTrack } from "@/lib/roadmap-admin";

const TRACKS: RoadmapTrack[] = ["main", "agent"];

function trackOf(v: unknown): RoadmapTrack | null {
  return TRACKS.includes(v as RoadmapTrack) ? (v as RoadmapTrack) : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** 新增大阶段（用户自建，is_custom=true） */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const career = str(body?.career) ?? "ict";
  const track = trackOf(body?.track) ?? "main";
  const title = str(body?.title);
  if (!title) return NextResponse.json({ error: "阶段标题不能为空" }, { status: 400 });
  const summary = str(body?.summary);
  const weeks = str(body?.weeks);

  const { rows } = await pgPool.query<{ id: number }>(
    `INSERT INTO content_phases (phase_key, career_key, title, weeks, track, summary, sort_order, is_custom, owner_id)
     VALUES ('custom-' || gen_random_uuid(), $1, $2, $3, $4, $5,
             (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM content_phases WHERE career_key = $1 AND track = $4),
             TRUE, $6)
     RETURNING id`,
    [career, title, weeks, track, summary, uid]
  );
  const phaseId = rows[0].id;
  await renumberTrack(career, track);

  const created = await pgPool.query(
    `SELECT id, phase_key, title, weeks, track, summary, sort_order, is_custom
     FROM content_phases WHERE id = $1`,
    [phaseId]
  );
  return NextResponse.json({ ok: true, phase: created.rows[0] }, { status: 201 });
}

/** 编辑大阶段（标题/简介/周期/轨道） */
export async function PATCH(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const cur = await pgPool.query<{ career_key: string; track: RoadmapTrack }>(
    `SELECT career_key, track FROM content_phases WHERE id = $1`,
    [id]
  );
  if (!cur.rows[0]) return NextResponse.json({ error: "阶段不存在" }, { status: 400 });
  const career = cur.rows[0].career_key;
  const oldTrack = cur.rows[0].track;

  const title = str(body?.title);
  const summary = str(body?.summary);
  const weeks = str(body?.weeks);
  const newTrack = body?.track === undefined ? null : trackOf(body.track);
  if (body?.title !== undefined && !title) {
    return NextResponse.json({ error: "阶段标题不能为空" }, { status: 400 });
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (title !== null) { params.push(title); sets.push(`title = $${params.length}`); }
  if (summary !== null) { params.push(summary); sets.push(`summary = $${params.length}`); }
  if (weeks !== null) { params.push(weeks); sets.push(`weeks = $${params.length}`); }
  if (newTrack) { params.push(newTrack); sets.push(`track = $${params.length}`); }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  params.push(id);
  await pgPool.query(
    `UPDATE content_phases SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params
  );

  if (newTrack && newTrack !== oldTrack) {
    await renumberTrack(career, oldTrack);
    await renumberTrack(career, newTrack);
  } else {
    await renumberTrack(career, oldTrack);
  }
  return NextResponse.json({ ok: true });
}

/** 删除大阶段（其下主题/资源/实操/项目/检查点级联删除），随后同轨重新编号 */
export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const cur = await pgPool.query<{ career_key: string; track: RoadmapTrack }>(
    `SELECT career_key, track FROM content_phases WHERE id = $1`,
    [id]
  );
  if (!cur.rows[0]) return NextResponse.json({ error: "阶段不存在" }, { status: 400 });
  const { career_key: career, track } = cur.rows[0];

  await pgPool.query(`DELETE FROM content_phases WHERE id = $1`, [id]);
  await renumberTrack(career, track);
  return NextResponse.json({ ok: true });
}