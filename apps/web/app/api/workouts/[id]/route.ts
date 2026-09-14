import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { normalizeItems } from "../route";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** PATCH /api/workouts/[id] —— 更新训练；提供 items 时整组替换动作明细 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const sets: string[] = [];
  const params: unknown[] = [...w.params];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: "训练名称不能为空" }, { status: 400 });
    push("name", name);
  }
  if (body.exercisedOn !== undefined) {
    const d = typeof body.exercisedOn === "string" ? body.exercisedOn.slice(0, 10) : "";
    if (!DATE_RE.test(d)) return NextResponse.json({ error: "exercisedOn 无效" }, { status: 400 });
    push("exercised_on", d);
  }
  if (body.durationSeconds !== undefined) {
    push("duration_seconds", Math.max(0, Math.min(86400, Math.round(Number(body.durationSeconds) || 0))));
  }
  if (body.note !== undefined) {
    push("note", typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null);
  }

  const hasItems = body.items !== undefined;
  if (sets.length === 0 && !hasItems) {
    return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    // 归属校验
    const { rows: own } = await client.query(
      `SELECT id FROM workouts WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
      w.params
    );
    if (!own[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "未找到训练记录" }, { status: 404 });
    }
    if (sets.length > 0) {
      await client.query(
        `UPDATE workouts SET ${sets.join(", ")}, updated_at = now()
          WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
        params
      );
    }
    if (hasItems) {
      const items = normalizeItems(body.items);
      await client.query(`DELETE FROM workout_items WHERE user_id IS NOT DISTINCT FROM $1 AND workout_id = $2`, [scope.uid, id]);
      for (const it of items) {
        await client.query(
          `INSERT INTO workout_items
             (user_id, workout_id, exercise_key, exercise_label, sets, reps, weight_kg, duration_seconds, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [scope.uid, id, it.exerciseKey, it.exerciseLabel, it.sets, it.reps, it.weightKg, it.durationSeconds, it.sortOrder]
        );
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** DELETE /api/workouts/[id] —— 软删除训练（动作明细随外键保留） */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE workouts SET deleted_at = now() WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}