import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const SELECT_COLS = `id, name, icon, is_boolean AS "isBoolean", target_value AS "targetValue",
  unit, schedule, color, sort_order AS "sortOrder"`;

function pickSchedule(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const set = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  const out = [...set].sort((a, b) => a - b);
  return out.length > 0 ? out : [0, 1, 2, 3, 4, 5, 6];
}

/** PATCH /api/habits/[id] —— 更新习惯（名称/目标/排期/颜色/排序/归档） */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const sets: string[] = [];
  const params: unknown[] = [...w.params];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: "习惯名称不能为空" }, { status: 400 });
    push("name", name);
  }
  if (body.icon !== undefined) push("icon", typeof body.icon === "string" ? body.icon.trim().slice(0, 20) || null : null);
  if (body.isBoolean !== undefined) push("is_boolean", Boolean(body.isBoolean));
  if (body.targetValue !== undefined) {
    const n = Number(body.targetValue);
    push("target_value", Number.isFinite(n) && n > 0 ? Math.min(1_000_000, Math.round(n * 100) / 100) : null);
  }
  if (body.unit !== undefined) push("unit", typeof body.unit === "string" ? body.unit.trim().slice(0, 20) || null : null);
  if (body.schedule !== undefined) {
    const s = pickSchedule(body.schedule);
    if (!s) return NextResponse.json({ error: "schedule 无效" }, { status: 400 });
    push("schedule", s);
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json({ error: "color 无效" }, { status: 400 });
    }
    push("color", body.color);
  }
  if (body.sortOrder !== undefined) push("sort_order", Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0))));
  if (body.archived !== undefined) push("archived_at", body.archived ? new Date() : null);

  if (sets.length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });

  const { rows } = await pgPool.query(
    `UPDATE habits SET ${sets.join(", ")}, updated_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL
      RETURNING ${SELECT_COLS}`,
    params
  );
  if (!rows[0]) return NextResponse.json({ error: "未找到习惯" }, { status: 404 });
  return NextResponse.json({ habit: rows[0] });
}

/** DELETE /api/habits/[id] —— 软删除（级联保留历史打卡） */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE habits SET deleted_at = now() WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}