/**
 * 知识模型落库的真实数据库演练（**默认跳过**，需要显式开启）。
 *
 * 为什么单独放一个 opt-in 测试：上面所有单测都把 pgPool 打桩了，能证明分支逻辑，但证明不了
 * upsert SQL / unnest 批量插入 / 软归档这些**只有真库才暴露**的问题。所以留一个可复跑的真库演练：
 *
 *   # 1) 建演练库副本（带真实数据）并应用迁移 058/060
 *   createdb -T "Learn-Workbench" lwb_drill
 *   psql -d lwb_drill -f .local/drill-060-apply.sql
 *   # 2) 跑演练
 *   $env:LWB_DB_DRILL=1; $env:PGDATABASE="lwb_drill"; pnpm -F web exec vitest run lib/content/knowledge-model.integration.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import { buildKnowledgeModel, learningTracks } from "@learn-workbench/content";
import { pgPool } from "@/lib/db";
import { buildContentSyncPlan, syncKnowledgeModel } from "./knowledge-model";

const RUN = process.env.LWB_DB_DRILL === "1";
const model = buildKnowledgeModel(learningTracks);

describe.skipIf(!RUN)("知识模型落库（真实 Postgres 演练）", () => {
  afterAll(async () => {
    await pgPool.end().catch(() => {});
  });

  it("首次全量写入 → 重复同步 unchanged 且关联行不重复堆叠", async () => {
    const plan = buildContentSyncPlan({
      contentVersion: "drill0001",
      contentUpdatedAt: "2026-10-01T00:00:00.000Z",
    });

    const first = await syncKnowledgeModel(plan);
    expect(first.inserted + first.updated).toBe(plan.points.length);
    expect(first.links).toBe(plan.links.length);
    expect(first.relations).toBe(plan.relations.length);
    expect(first.prerequisites).toBe(plan.prerequisites.length);

    const second = await syncKnowledgeModel(plan);
    expect(second.unchanged).toBe(plan.points.length);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.archived).toBe(0);

    const counts = await pgPool.query<{ points: number; links: number; relations: number; prereq: number }>(
      `SELECT (SELECT count(*)::int FROM knowledge_points WHERE status = 'published') AS points,
              (SELECT count(*)::int FROM question_knowledge_point) AS links,
              (SELECT count(*)::int FROM knowledge_relation) AS relations,
              (SELECT count(*)::int FROM knowledge_prerequisite) AS prereq`
    );
    expect(counts.rows[0]).toEqual({
      points: model.stats.points,
      links: model.stats.links,
      relations: model.stats.relations,
      prereq: model.stats.prerequisites,
    });
  });

  it("内容变化会被识别为 updated（指纹驱动），并刷新内容版本", async () => {
    const before = buildContentSyncPlan({ contentVersion: "drill0001", contentUpdatedAt: "2026-10-01T00:00:00.000Z" });
    const mutated = {
      ...before,
      points: before.points.map((point, index) =>
        index === 0
          ? { ...point, fingerprint: "deadbeef", contentVersion: "drill0002", title: `${point.title}（演练改动）` }
          : point
      ),
    };
    const result = await syncKnowledgeModel(mutated);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(before.points.length - 1);

    const row = await pgPool.query<{ title: string; content_version: string }>(
      "SELECT title, content_version FROM knowledge_points WHERE key = $1",
      [before.points[0].key]
    );
    expect(row.rows[0].content_version).toBe("drill0002");
    expect(row.rows[0].title).toContain("演练改动");

    // 复原
    await syncKnowledgeModel(before);
  });

  it("模型里消失的知识点只软归档（历史作答可追溯），curated 边不被自动同步冲掉", async () => {
    await pgPool.query(
      `INSERT INTO knowledge_points (key, track_slug, stage_key, topic_key, title)
       VALUES ('drill/legacy/topic', 'drill', 'legacy', 'topic', '演练遗留知识点')
       ON CONFLICT (key) DO NOTHING`
    );
    const plan = buildContentSyncPlan({ contentVersion: "drill0001", contentUpdatedAt: "2026-10-01T00:00:00.000Z" });
    const target = plan.points[0];
    const prerequisite = plan.points[1];
    await pgPool.query(
      `INSERT INTO knowledge_prerequisite (knowledge_point_key, prerequisite_key, relation_source, note)
       VALUES ($1, $2, 'curated', '人工审定的前置边（演练）')
       ON CONFLICT DO NOTHING`,
      [target.key, prerequisite.key]
    );

    const result = await syncKnowledgeModel(plan);
    expect(result.archived).toBeGreaterThanOrEqual(1);

    const legacy = await pgPool.query<{ status: string }>(
      "SELECT status FROM knowledge_points WHERE key = 'drill/legacy/topic'"
    );
    expect(legacy.rows[0].status).toBe("archived");

    const curated = await pgPool.query<{ note: string }>(
      `SELECT note FROM knowledge_prerequisite
        WHERE knowledge_point_key = $1 AND prerequisite_key = $2 AND relation_source = 'curated'`,
      [target.key, prerequisite.key]
    );
    expect(curated.rows[0]?.note).toContain("人工审定");

    await pgPool.query("DELETE FROM knowledge_points WHERE key = 'drill/legacy/topic'");
    await pgPool.query(
      "DELETE FROM knowledge_prerequisite WHERE knowledge_point_key = $1 AND prerequisite_key = $2 AND relation_source = 'curated'",
      [target.key, prerequisite.key]
    );
  });

  it("dryRun 只给预览、不写任何行", async () => {
    const before = await pgPool.query<{ n: number }>("SELECT count(*)::int AS n FROM knowledge_points");
    const plan = buildContentSyncPlan({ contentVersion: "dryrun001", contentUpdatedAt: "2026-10-01T00:00:00.000Z" });
    const result = await syncKnowledgeModel(plan, { dryRun: true });
    expect(result.unchanged + result.updated + result.inserted).toBe(plan.points.length);
    expect(result.links).toBe(0);
    const after = await pgPool.query<{ n: number }>("SELECT count(*)::int AS n FROM knowledge_points");
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const version = await pgPool.query<{ content_version: string }>(
      "SELECT content_version FROM knowledge_points ORDER BY key LIMIT 1"
    );
    expect(version.rows[0].content_version).not.toBe("dryrun001");
  });
});
