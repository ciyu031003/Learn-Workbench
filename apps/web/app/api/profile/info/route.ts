import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { profileInfoSchema } from "@learn-workbench/shared";

/** 读取 Profile 基本信息（教育/经历/城市/目标/简介）+ 体重。载体：user_settings 扩展列。 */
export async function GET() {
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query(
    `SELECT weight_kg AS "weightKg",
            education, experiences, current_city AS "currentCity",
            target_role AS "targetRole", bio
       FROM user_settings
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} LIMIT 1`,
    w.params
  );
  const row = rows[0] ?? {};
  const normalize = <T,>(v: unknown, fallback: T): T =>
    v == null ? fallback : (v as T);
  return NextResponse.json({
    weightKg: Number(row.weightKg ?? 60),
    education: normalize((row.education as unknown) ?? null, null),
    experiences: normalize((row.experiences as unknown) ?? null, null),
    currentCity: normalize(row.currentCity, ""),
    targetRole: normalize(row.targetRole, ""),
    bio: normalize(row.bio, ""),
  });
}

/** 保存 Profile 基本信息（upsert，只更新 body 实际出现的字段——避免 zod default 误判为已提交）。保留体重由 wellbeing/profile 负责。 */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  const parsed = profileInfoSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  const d = parsed.data;
  const scope = await userScope();

  // 组装列与参数：仅当 body 显式带该字段才更新（hasOwnProperty）
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  if (Object.prototype.hasOwnProperty.call(body, "education")) push("education", JSON.stringify(d.education));
  if (Object.prototype.hasOwnProperty.call(body, "experiences")) push("experiences", JSON.stringify(d.experiences));
  if (Object.prototype.hasOwnProperty.call(body, "currentCity")) push("current_city", d.currentCity);
  if (Object.prototype.hasOwnProperty.call(body, "targetRole")) push("target_role", d.targetRole);
  if (Object.prototype.hasOwnProperty.call(body, "bio")) push("bio", d.bio);

  // 保底：至少只更新 updated_at（触发 upsert 行）
  if (sets.length === 0) sets.push(`updated_at = now()`);

  const scopeCol = scope.uid ? "user_id" : "anon_id";
  const scopeVal = scope.uid ?? scope.anonId;
  params.push(scopeVal);

  const onConflict = scope.uid
    ? `ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE SET ${sets.join(", ")}`
    : `ON CONFLICT (anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL DO UPDATE SET ${sets.join(", ")}`;

  const { rows } = await pgPool.query(
    `INSERT INTO user_settings (${scopeCol}, updated_at)
     VALUES ($${params.length}, now())
     ${onConflict}
     RETURNING education, experiences, current_city AS "currentCity",
               target_role AS "targetRole", bio`,
    params
  );
  const r = rows[0] ?? {};
  return NextResponse.json({
    education: (r.education as unknown) ?? null,
    experiences: (r.experiences as unknown) ?? null,
    currentCity: r.currentCity ?? d.currentCity ?? "",
    targetRole: r.targetRole ?? d.targetRole ?? "",
    bio: r.bio ?? d.bio ?? "",
  });
}