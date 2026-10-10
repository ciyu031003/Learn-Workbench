/**
 * 内容导入落库的真实数据库演练（**默认跳过**，需要显式开启）。
 *
 * 单测把 pgPool 全打桩了，证明不了 upsert 守卫 / unnest 批量插入 / 软归档回滚这些
 * **只有真库才暴露**的行为。所以留一个可复跑的真库演练：
 *
 *   # 1) 演练库副本 + 迁移 058/060/061/062
 *   createdb -T "Learn-Workbench" lwb_drill
 *   psql -d lwb_drill -f .local/drill-060-apply.sql
 *   psql -d lwb_drill -f .local/drill-061.sql
 *   psql -d lwb_drill -f db/migrations/062_content_import_pipeline.sql
 *   # 2) 跑演练
 *   $env:LWB_DB_DRILL=1; $env:PGDATABASE="lwb_drill"; pnpm -F web exec vitest run lib/content/import-pipeline.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgPool } from "@/lib/db";
import { fingerprintOf } from "./import-plan.mjs";
import { ContentImportError, rollbackContentImport, runContentImport } from "./import-pipeline";

const RUN = process.env.LWB_DB_DRILL === "1";
const SOURCE_KEY = "drill-import-source";
const REF_SOURCE_KEY = "drill-import-reference";
const POINT_KEY = "drillimport/java/imported-topic";
const PUBLISHED_KEY = "drillimport/java/published-topic";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    trackSlug: "drillimport",
    stageKey: "java",
    topicKey: "imported-topic",
    trackTitle: "演练课程",
    stageTitle: "演练阶段",
    title: "导入草稿点",
    summary: "来自外部来源的草稿",
    difficulty: "medium",
    tags: ["演练"],
    estimatedMinutes: 9,
    qualityLevel: "L2",
    ...overrides,
  };
}

const item = (body = payload(), targetKey = POINT_KEY) => ({
  kind: "knowledge-point" as const,
  externalKey: `docs/topic.md#${fingerprintOf(body)}`,
  targetKey,
  title: "导入草稿点",
  path: "docs/topic.md",
  payload: body,
});

async function cleanup() {
  await pgPool.query(
    "DELETE FROM content_import_batch WHERE source_key = ANY($1::text[])",
    [[SOURCE_KEY, REF_SOURCE_KEY]]
  );
  await pgPool.query("DELETE FROM knowledge_points WHERE key = ANY($1::text[])", [
    [POINT_KEY, PUBLISHED_KEY],
  ]);
  await pgPool.query("DELETE FROM content_source WHERE key = ANY($1::text[])", [
    [SOURCE_KEY, REF_SOURCE_KEY],
  ]);
}

describe.skipIf(!RUN)("内容导入落库（真实 Postgres 演练）", () => {
  beforeAll(async () => {
    await cleanup();
    await pgPool.query(
      `INSERT INTO content_source (key, name, url, repo, license, usage, verified_at, note)
       VALUES ($1, '演练来源', 'https://github.com/drill/drill', 'drill/drill', 'MIT', 'import', now(), '演练')
       ON CONFLICT (key) DO NOTHING`,
      [SOURCE_KEY]
    );
    await pgPool.query(
      `INSERT INTO content_source (key, name, url, repo, license, usage, verified_at, note)
       VALUES ($1, '演练参考来源', 'https://github.com/drill/ref', 'drill/ref', 'CC BY 4.0', 'reference', now(), '演练')
       ON CONFLICT (key) DO NOTHING`,
      [REF_SOURCE_KEY]
    );
  });

  afterAll(async () => {
    await cleanup();
    await pgPool.end().catch(() => {});
  });

  it("dry-run 只落批次与明细，不物化；重复 dry-run 结论不变（不会假判 unchanged）", async () => {
    const first = await runContentImport({
      sourceKey: SOURCE_KEY,
      mode: "dry-run",
      items: [item()],
      commitSha: "drill062",
    });
    expect(first.counts.new).toBe(1);
    expect(first.applied.new).toBe(0);

    const rows = await pgPool.query("SELECT 1 FROM knowledge_points WHERE key = $1", [POINT_KEY]);
    expect(rows.rowCount).toBe(0);

    const second = await runContentImport({
      sourceKey: SOURCE_KEY,
      mode: "dry-run",
      items: [item()],
    });
    expect(second.counts.new).toBe(1);
    expect(second.counts.skip).toBe(0);
  });

  it("apply 物化成 review 草稿（绝不 published），并回填来源 last_synced_at", async () => {
    const result = await runContentImport({
      sourceKey: SOURCE_KEY,
      mode: "apply",
      items: [item()],
      commitSha: "drill062",
    });
    expect(result.status).toBe("success");
    expect(result.applied.new).toBe(1);

    const row = await pgPool.query<{ status: string; content_version: string; source_key: string }>(
      "SELECT status, content_version, source_key FROM knowledge_points WHERE key = $1",
      [POINT_KEY]
    );
    expect(row.rows[0].status).toBe("review");
    expect(row.rows[0].content_version).toBe("import");
    expect(row.rows[0].source_key).toBe(SOURCE_KEY);

    const src = await pgPool.query<{ last_synced_at: string | null; commit_sha: string | null }>(
      "SELECT last_synced_at, commit_sha FROM content_source WHERE key = $1",
      [SOURCE_KEY]
    );
    expect(src.rows[0].last_synced_at).not.toBeNull();
    expect(src.rows[0].commit_sha).toBe("drill062");

    // 再跑一次：上一次 apply 批次成了"已导入"的证据 → 指纹相同判 unchanged
    const again = await runContentImport({ sourceKey: SOURCE_KEY, mode: "apply", items: [item()] });
    expect(again.counts.skip).toBe(1);
    expect(again.applied.new).toBe(0);
  });

  it("内容包同步不会归档 review 草稿（草稿区不被顺手清空）", async () => {
    const { syncKnowledgeModel, buildContentSyncPlan } = await import("./knowledge-model");
    await syncKnowledgeModel(
      buildContentSyncPlan({ contentVersion: "drill062", contentUpdatedAt: "2026-10-01T00:00:00.000Z" })
    );
    const row = await pgPool.query<{ status: string }>(
      "SELECT status FROM knowledge_points WHERE key = $1",
      [POINT_KEY]
    );
    expect(row.rows[0]?.status).toBe("review");
  });

  it("目标键已是 published → 改判 conflict(target-published)，且不覆盖上线内容", async () => {
    await pgPool.query(
      `INSERT INTO knowledge_points (key, track_slug, stage_key, topic_key, title, status, fingerprint)
       VALUES ($1, 'drillimport', 'java', 'published-topic', '上线内容', 'published', 'published-fp')
       ON CONFLICT (key) DO UPDATE SET status = 'published', title = '上线内容'`,
      [PUBLISHED_KEY]
    );
    const result = await runContentImport({
      sourceKey: SOURCE_KEY,
      mode: "apply",
      items: [item(payload({ topicKey: "published-topic", title: "导入想覆盖的标题" }), PUBLISHED_KEY)],
    });
    expect(result.counts.conflict).toBe(1);
    expect(result.applied.new).toBe(0);

    const itemRow = await pgPool.query<{ action: string; reason: string }>(
      `SELECT action, reason FROM content_import_item
        WHERE batch_id = $1 ORDER BY id DESC LIMIT 1`,
      [result.batchId]
    );
    expect(itemRow.rows[0]).toMatchObject({ action: "conflict", reason: "target-published" });

    const published = await pgPool.query<{ title: string; fingerprint: string }>(
      "SELECT title, fingerprint FROM knowledge_points WHERE key = $1",
      [PUBLISHED_KEY]
    );
    expect(published.rows[0].title).toBe("上线内容");
    expect(published.rows[0].fingerprint).toBe("published-fp");
  });

  it("usage=reference 的来源拒绝 apply，只允许 dry-run", async () => {
    const ok = await runContentImport({ sourceKey: REF_SOURCE_KEY, mode: "dry-run", items: [item()] });
    expect(ok.counts.new).toBe(1);
    await expect(
      runContentImport({ sourceKey: REF_SOURCE_KEY, mode: "apply", items: [item()] })
    ).rejects.toBeInstanceOf(ContentImportError);
  });

  it("回滚只软归档该批次新建的 review 草稿，published 行不受影响", async () => {
    const fresh = item(
      payload({ topicKey: "rolled-back-topic", title: "待回滚草稿" }),
      "drillimport/java/rolled-back-topic"
    );
    const result = await runContentImport({ sourceKey: SOURCE_KEY, mode: "apply", items: [fresh] });
    expect(result.applied.new).toBe(1);

    const rolled = await rollbackContentImport(result.batchId);
    expect(rolled.archived).toBe(1);

    const draft = await pgPool.query<{ status: string }>(
      "SELECT status FROM knowledge_points WHERE key = $1",
      ["drillimport/java/rolled-back-topic"]
    );
    expect(draft.rows[0].status).toBe("archived");

    const batch = await pgPool.query<{ status: string }>(
      "SELECT status FROM content_import_batch WHERE id = $1",
      [result.batchId]
    );
    expect(batch.rows[0].status).toBe("rolled-back");

    const published = await pgPool.query<{ status: string }>(
      "SELECT status FROM knowledge_points WHERE key = $1",
      [PUBLISHED_KEY]
    );
    expect(published.rows[0].status).toBe("published");

    await pgPool.query("DELETE FROM knowledge_points WHERE key = $1", ["drillimport/java/rolled-back-topic"]);
  });

  it("来源未登记 → source-not-found（不静默建表）", async () => {
    await expect(
      runContentImport({ sourceKey: "drill-import-missing", mode: "dry-run", items: [item()] })
    ).rejects.toMatchObject({ code: "source-not-found" });
  });

  it("unmapped 条目记成 skip(unmapped) 工作项（不被误判失败），scope 外的不进批次", async () => {
    const result = await runContentImport({
      sourceKey: SOURCE_KEY,
      mode: "dry-run",
      scope: ["docs"],
      items: [
        { kind: "knowledge-point", externalKey: "docs/x.md#aaa", targetKey: "", title: "待归类章节", path: "docs/x.md", unmapped: true },
        { kind: "knowledge-point", externalKey: "README.md#bbb", targetKey: "", title: "范围外", path: "README.md", unmapped: true },
      ],
    });
    expect(result.status).toBe("success");
    expect(result.counts.skip).toBe(2);
    expect(result.counts.failed).toBe(0);

    const rows = await pgPool.query<{ reason: string; target_key: string | null }>(
      "SELECT reason, target_key FROM content_import_item WHERE batch_id = $1 ORDER BY external_key",
      [result.batchId]
    );
    expect(rows.rows.map((r) => r.reason)).toEqual(["out-of-scope", "unmapped"]);
    expect(rows.rows.every((r) => !r.target_key)).toBe(true);
  });
});
