import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EXERCISE_CATALOG,
  exerciseMuscleGroups,
  filterExercises,
  exerciseByKey,
} from "@learn-workbench/shared";

/**
 * 种子同步校验（防漂移）：
 * `packages/shared` 的 EXERCISE_CATALOG 与 `db/migrations/046_exercise_catalog.sql`
 * 是同一份数据的两处表达 —— 迁移负责入库、常量负责「库不可用 / 未迁移」回退与移动端离线。
 * 两边一旦不一致，就会出现"线上一套、离线一套"的诡异问题，所以这里直接解析迁移文件逐条比对。
 */
const SQL_PATH = fileURLToPath(new URL("../../../db/migrations/046_exercise_catalog.sql", import.meta.url));

interface SeedRow {
  key: string;
  name: string;
  muscleGroup: string;
  category: string;
  equipment: string | null;
  met: number | null;
  sort: number;
}

function parseSeedRows(sql: string): SeedRow[] {
  const rows: SeedRow[] = [];
  const re =
    /\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(?:'([^']*)'|(NULL)),\s*(?:([\d.]+)|(NULL)),\s*(\d+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    rows.push({
      key: m[1],
      name: m[2],
      muscleGroup: m[3],
      category: m[4],
      equipment: m[5] ?? null,
      met: m[7] === undefined ? null : Number(m[7]),
      sort: Number(m[9]),
    });
  }
  return rows;
}

describe("EXERCISE_CATALOG ↔ 迁移 046 种子一致性", () => {
  const sql = readFileSync(SQL_PATH, "utf8");
  const seed = parseSeedRows(sql);

  it("迁移里的种子行数与常量条目数一致", () => {
    expect(seed.length).toBeGreaterThanOrEqual(40);
    expect(seed.length).toBe(EXERCISE_CATALOG.length);
  });

  it("逐条比对 key / name / 部位 / 分类 / 器械 / MET / 排序", () => {
    const expected = EXERCISE_CATALOG.map((e) => ({
      key: e.key,
      name: e.name,
      muscleGroup: e.muscleGroup,
      category: e.category,
      equipment: e.equipment,
      met: e.met,
      sort: e.sort,
    }));
    expect(seed).toEqual(expected);
  });

  it("key 全局唯一，且都能用 exerciseByKey 反查", () => {
    const keys = EXERCISE_CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(exerciseByKey(k)?.key).toBe(k);
    expect(exerciseByKey("not-exist")).toBeUndefined();
  });

  it("部位取值都在迁移 CHECK 约束的枚举内", () => {
    for (const e of EXERCISE_CATALOG) expect(exerciseMuscleGroups).toContain(e.muscleGroup);
  });

  it("分类取值都在 exerciseTypeOptions 的枚举内（面板 Tab 与 SQL CHECK 对齐）", () => {
    const allowed = new Set(["BALL", "AEROBIC", "STRENGTH", "STRETCH", "MOVE", "OTHER"]);
    for (const e of EXERCISE_CATALOG) expect(allowed.has(e.category)).toBe(true);
  });

  it("器械取值都在 CHECK 约束的枚举内（或为 NULL）", () => {
    const allowed = new Set(["杠铃", "哑铃", "器械", "自重", "绳索", "壶铃"]);
    for (const e of EXERCISE_CATALOG) {
      if (e.equipment !== null) expect(allowed.has(e.equipment)).toBe(true);
    }
  });
});

describe("filterExercises · 纯过滤逻辑", () => {
  it("空条件返回全量", () => {
    expect(filterExercises(EXERCISE_CATALOG)).toHaveLength(EXERCISE_CATALOG.length);
    expect(filterExercises(EXERCISE_CATALOG, { q: "  ", category: "", limit: undefined })).toHaveLength(
      EXERCISE_CATALOG.length
    );
  });

  it("q 匹配中文名 / key / 部位 / 器械（大小写不敏感）", () => {
    // 注意「腿弯举」也含"弯举"，按 sort 排在手臂动作之前 —— 这正是"搜索要覆盖全部字段"的意义
    expect(filterExercises(EXERCISE_CATALOG, { q: "弯举" }).map((e) => e.name)).toEqual([
      "腿弯举",
      "杠铃弯举",
      "哑铃弯举",
      "锤式弯举",
      "集中弯举",
      "牧师凳弯举",
      "腕弯举",
    ]);
    expect(filterExercises(EXERCISE_CATALOG, { q: "BENCH" }).map((e) => e.key)).toEqual([
      "bench-press",
      "incline-bench-press",
      "dumbbell-bench-press",
      "close-grip-bench-press",
    ]);
    expect(filterExercises(EXERCISE_CATALOG, { q: "壶铃" }).map((e) => e.key)).toEqual(["kettlebell-swing"]);
  });

  it("category 过滤（大小写不敏感，ALL/空不过滤）", () => {
    const aerobic = filterExercises(EXERCISE_CATALOG, { category: "aerobic" });
    expect(aerobic.length).toBeGreaterThan(0);
    expect(aerobic.every((e) => e.category === "AEROBIC")).toBe(true);
    expect(filterExercises(EXERCISE_CATALOG, { category: "ALL" })).toHaveLength(EXERCISE_CATALOG.length);
    expect(filterExercises(EXERCISE_CATALOG, { category: "BALL" })).toEqual([]);
  });

  it("q 与 category 叠加，limit 截断且不越界", () => {
    const out = filterExercises(EXERCISE_CATALOG, { q: "卧推", category: "STRENGTH", limit: 2 });
    expect(out.map((e) => e.name)).toEqual(["卧推", "上斜卧推"]);
    expect(filterExercises(EXERCISE_CATALOG, { limit: 0 })).toEqual([]);
    expect(filterExercises(EXERCISE_CATALOG, { limit: 9999 })).toHaveLength(EXERCISE_CATALOG.length);
  });
});
