import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";

export const DEFAULT_WEIGHT_KG = 60;

/** 当前用户/匿名设备的健康设置（体重，用于 MET 卡路里估算） */
export async function GET() {
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query(
    `SELECT weight_kg AS "weightKg" FROM user_settings
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} LIMIT 1`,
    w.params
  );
  const weightKg = rows[0] ? Number(rows[0].weightKg) : DEFAULT_WEIGHT_KG;
  return NextResponse.json({ weightKg, defaultWeightKg: DEFAULT_WEIGHT_KG });
}

/** 保存体重（20-300kg，越界/非法回退默认 60），每作用域一行 upsert */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = Number(body?.weightKg);
  const weightKg = Number.isFinite(raw) && raw > 0
    ? Math.min(300, Math.max(20, Math.round(raw * 10) / 10))
    : DEFAULT_WEIGHT_KG;

  const scope = await userScope();
  const { rows } = scope.uid
    ? await pgPool.query(
        `INSERT INTO user_settings (user_id, weight_kg) VALUES ($1, $2)
         ON CONFLICT (user_id) WHERE user_id IS NOT NULL
         DO UPDATE SET weight_kg = EXCLUDED.weight_kg
         RETURNING weight_kg AS "weightKg"`,
        [scope.uid, weightKg]
      )
    : await pgPool.query(
        `INSERT INTO user_settings (anon_id, weight_kg) VALUES ($1, $2)
         ON CONFLICT (anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL
         DO UPDATE SET weight_kg = EXCLUDED.weight_kg
         RETURNING weight_kg AS "weightKg"`,
        [scope.anonId, weightKg]
      );
  return NextResponse.json({ weightKg: rows[0] ? Number(rows[0].weightKg) : weightKg });
}
