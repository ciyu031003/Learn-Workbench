/**
 * 阅读状态落库的真库演练（**默认跳过**，显式开启）：
 *   $env:LWB_DB_DRILL=1; $env:PGDATABASE="lwb_drill"
 *   pnpm -F web exec vitest run lib/learning-read.integration.test.ts
 *
 * 验证单测覆盖不到的东西：`ON CONFLICT … WHERE deleted_at IS NULL`（部分唯一索引冲突目标）、
 * `GREATEST(progress)` 只增不减、重复收藏幂等、取消后可再次收藏。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgPool } from "@/lib/db";
import { learningLibraryState, recordReadState, setFavorite } from "./learning-read";

const RUN = process.env.LWB_DB_DRILL === "1";
const DRILL_EMAIL = "drill-reading-state@lwb.local";

let userId = "";
const point = {
  pointKey: "python/python-foundation/python-values-control",
  trackSlug: "python",
  stageKey: "python-foundation",
  topicKey: "python-values-control",
};
const otherPoint = {
  pointKey: "java/java-foundation/java-types-control",
  trackSlug: "java",
  stageKey: "java-foundation",
  topicKey: "java-types-control",
};

describe.skipIf(!RUN)("阅读状态落库（真实 Postgres 演练）", () => {
  beforeAll(async () => {
    const { rows } = await pgPool.query<{ id: string }>(
      `INSERT INTO users (email, display_name) VALUES ($1, '演练用户')
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [DRILL_EMAIL]
    );
    userId = String(rows[0].id);
    await pgPool.query("DELETE FROM knowledge_read_state WHERE user_id = $1", [userId]);
    await pgPool.query("DELETE FROM knowledge_favorites WHERE user_id = $1", [userId]);
  });

  afterAll(async () => {
    await pgPool.query("DELETE FROM knowledge_read_state WHERE user_id = $1", [userId]);
    await pgPool.query("DELETE FROM knowledge_favorites WHERE user_id = $1", [userId]);
    await pgPool.query("DELETE FROM users WHERE email = $1", [DRILL_EMAIL]);
    await pgPool.end().catch(() => {});
  });

  it("首次阅读写入，重复上报不降进度、不改 first_read_at、read_count 递增", async () => {
    const first = await recordReadState(userId, { ...point, progress: 90, clientId: "c1" });
    expect(first.progress).toBe(90);
    expect(first.readCount).toBe(1);

    const second = await recordReadState(userId, { ...point, progress: 30 });
    expect(second.progress, "回看前文不应把进度打回去").toBe(90);
    expect(second.readCount).toBe(2);
    expect(second.firstReadAt).toBe(first.firstReadAt);

    const third = await recordReadState(userId, { ...point });
    expect(third.progress).toBe(90);
    expect(third.readCount).toBe(3);
  });

  it("收藏幂等、取消后可再次收藏（部分唯一索引冲突目标正确）", async () => {
    expect((await setFavorite(userId, { ...point, favorite: true })).favorite).toBe(true);
    expect((await setFavorite(userId, { ...point, favorite: true })).favorite).toBe(true);
    const active = await pgPool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM knowledge_favorites WHERE user_id = $1 AND point_key = $2 AND deleted_at IS NULL",
      [userId, point.pointKey]
    );
    expect(active.rows[0].n, "重复收藏不应产生第二条生效记录").toBe(1);

    expect((await setFavorite(userId, { ...point, favorite: false })).favorite).toBe(false);
    expect((await setFavorite(userId, { ...point, favorite: false })).changed).toBe(false);
    expect((await setFavorite(userId, { ...point, favorite: true })).favorite).toBe(true);
    const rows = await pgPool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM knowledge_favorites WHERE user_id = $1 AND point_key = $2",
      [userId, point.pointKey]
    );
    expect(rows.rows[0].n, "取消后历史行保留（可审计）").toBeGreaterThanOrEqual(2);
  });

  it("跨设备拉取：按课程过滤，计数只算生效中的收藏", async () => {
    await recordReadState(userId, { ...otherPoint, progress: 40 });
    const all = await learningLibraryState(userId);
    expect(all.read.map((item) => item.pointKey)).toEqual(
      expect.arrayContaining([point.pointKey, otherPoint.pointKey])
    );
    expect(all.favorites).toHaveLength(1);
    expect(all.counts.readThisWeek).toBe(2);

    const onlyPython = await learningLibraryState(userId, "python");
    expect(onlyPython.read.map((item) => item.pointKey)).toEqual([point.pointKey]);
    expect(onlyPython.favorites.map((item) => item.pointKey)).toEqual([point.pointKey]);
  });
});
