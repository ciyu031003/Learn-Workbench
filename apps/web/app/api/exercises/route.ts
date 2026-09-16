import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { readIntParam } from "@/lib/query";
import {
  EXERCISE_CATALOG,
  filterExercises,
  type ExerciseCatalogItem,
} from "@learn-workbench/shared";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/**
 * 转义 LIKE 的通配符：否则 `?q=%` 在库路径会匹配全部、而回退路径（字面量 includes）匹配 0 条，
 * 同一个接口两种结果（审查发现）。配合 SQL 里的 `ESCAPE '\'` 使用。
 */
function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

interface ExerciseRow {
  id: string | number;
  key: string;
  name: string;
  muscle_group: ExerciseCatalogItem["muscleGroup"];
  category: ExerciseCatalogItem["category"];
  equipment: ExerciseCatalogItem["equipment"];
}

/**
 * GET /api/exercises —— 健身房动作字典（迁移 046 exercise_items）
 *
 * 与 `/api/sports` 同样的策略：**优先读库，库不可用/为空时回退代码内置目录**
 * （`EXERCISE_CATALOG`，与迁移种子同源）。纯静态目录，无需鉴权 ——
 * 移动端训练记录面板要求它必须能在「未登录 + 弱网」下工作。
 *
 * 参数：`?q=` 关键词（中文名 / key / 器械 / 部位）、`?category=` 分类、`?limit=1..200`（默认 100）
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  // readIntParam 处理「缺失/空串/非法/越界」四种情况（`Number(null)=0` 的老坑见 lib/query.ts）
  const limit = readIntParam(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);

  try {
    const { rows } = await pgPool.query<ExerciseRow>(
      `SELECT id, key, name, muscle_group, category, equipment
         FROM exercise_items
        WHERE ($1::text = ''
               OR name ILIKE '%' || $1::text || '%' ESCAPE '\'
               OR key ILIKE '%' || $1::text || '%' ESCAPE '\'
               OR COALESCE(equipment, '') ILIKE '%' || $1::text || '%' ESCAPE '\'
               OR muscle_group ILIKE '%' || $1::text || '%' ESCAPE '\')
          AND ($2::text = '' OR upper(category) = upper($2::text))
        ORDER BY sort ASC, id ASC
        LIMIT $3::int`,
      [escapeLike(q), category, limit]
    );
    if (rows.length > 0) {
      return NextResponse.json({
        exercises: rows.map((r) => ({
          id: Number(r.id),
          key: r.key,
          name: r.name,
          muscleGroup: r.muscle_group,
          category: r.category,
          equipment: r.equipment ?? null,
        })),
      });
    }
  } catch (e) {
    // 库不可用（未迁移 / 连接失败）→ 代码内置目录兜底，前端面板照常可用；
    // 但必须留一条日志，否则线上会静默长期走回退目录而无人发现（审查发现）
    console.warn("[exercises] 读取动作字典失败，已回退内置目录：", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    // 内置目录没有数据库 id：`id` 置 null，客户端一律用稳定的 `key` 做标识
    exercises: filterExercises(EXERCISE_CATALOG, { q, category, limit }).map((e) => ({
      id: null as number | null,
      key: e.key,
      name: e.name,
      muscleGroup: e.muscleGroup,
      category: e.category,
      equipment: e.equipment,
    })),
  });
}
