import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
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

interface PhaseOwnerRow {
  career_key: string;
  track: RoadmapTrack;
  is_custom: boolean;
  owner_id: string | null;
}

/**
 * 读取阶段归属并做写权限校验（2026-10-18 S1-3 加固）：
 *  - 系统内置阶段（is_custom=false）：只有管理员可改/删，否则 403；
 *  - 用户自建阶段：只有 owner 可改/删，否则 403。
 * 之前只校验了「自建阶段 owner」，系统阶段对所有登录用户放行，属于越权（可级联删全局内容）。
 */
async function loadPhaseForWrite(id: number, uid: string): Promise<PhaseOwnerRow | NextResponse> {
  const cur = await pgPool.query<PhaseOwnerRow>(
    `SELECT career_key, track, is_custom, owner_id FROM content_phases WHERE id = $1`,
    [id]
  );
  if (!cur.rows[0]) return NextResponse.json({ error: "阶段不存在" }, { status: 400 });
  const phase = cur.rows[0];
  if (!phase.is_custom) {
    if (!(await hasRole(uid, ADMIN_ROLES))) {
      return NextResponse.json({ error: "系统阶段仅管理员可修改" }, { status: 403 });
    }
    return phase;
  }
  if (phase.owner_id !== uid) {
    return NextResponse.json({ error: "无权操作他人自定义阶段" }, { status: 403 });
  }
  return phase;
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

  // 仅允许在「系统内置域或本人自定义域」下新增阶段
  const domain = await pgPool.query<{ owner_id: string | null }>(
    `SELECT owner_id FROM careers WHERE career_key = $1 AND is_archived = FALSE`,
    [career]
  );
  if (!domain.rows[0]) return NextResponse.json({ error: "学习领域不存在" }, { status: 400 });
  if (domain.rows[0].owner_id !== null && domain.rows[0].owner_id !== uid) {
    return NextResponse.json({ error: "无权操作他人自定义领域" }, { status: 403 });
  }

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

  const phaseOrErr = await loadPhaseForWrite(id, uid);
  if (phaseOrErr instanceof NextResponse) return phaseOrErr;
  const career = phaseOrErr.career_key;
  const oldTrack = phaseOrErr.track;

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
  // 双保险：SQL 层再做一次归属校验（系统阶段仅管理员 / 自建阶段仅 owner）
  const allowSystem = !phaseOrErr.is_custom;
  params.push(uid, allowSystem);
  await pgPool.query(
    `UPDATE content_phases SET ${sets.join(", ")}
      WHERE id = $${params.length - 2}
        AND ((is_custom = TRUE AND owner_id = $${params.length - 1}) OR ($${params.length}::boolean AND is_custom = FALSE))`,
    params
  );

  if (newTrack && newTrack !== oldTrack) {
    await renumberTrack(career, oldTrack);
    await renumberTrack(career, newTrack);
  } else {
    await renumberTrack(career, oldTrack);
  }
  void writeAuditLog({
    action: "roadmap.phase.update",
    actorId: uid,
    actorType: "user",
    targetType: "content_phase",
    targetId: String(id),
    meta: { career, track: newTrack ?? oldTrack, isCustom: phaseOrErr.is_custom },
  });
  return NextResponse.json({ ok: true });
}

/** 删除大阶段（其下主题/资源/实操/项目/检查点级联删除），随后同轨重新编号 */
export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const phaseOrErr = await loadPhaseForWrite(id, uid);
  if (phaseOrErr instanceof NextResponse) return phaseOrErr;
  const { career_key: career, track } = phaseOrErr;

  // 双保险：系统阶段仅管理员可删（防级联删光全局主题/资源/检查点）
  const allowSystem = !phaseOrErr.is_custom;
  await pgPool.query(
    `DELETE FROM content_phases
      WHERE id = $1
        AND ((is_custom = TRUE AND owner_id = $2) OR ($3::boolean AND is_custom = FALSE))`,
    [id, uid, allowSystem]
  );
  await renumberTrack(career, track);
  void writeAuditLog({
    action: "roadmap.phase.delete",
    actorId: uid,
    actorType: "user",
    targetType: "content_phase",
    targetId: String(id),
    meta: { career, track, isCustom: phaseOrErr.is_custom },
  });
  return NextResponse.json({ ok: true });
}