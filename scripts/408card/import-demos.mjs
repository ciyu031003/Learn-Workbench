#!/usr/bin/env node
/**
 * 408card.top 98 个交互演示（demos.json）→ exam_408_demos（P1/P2）
 *
 * 数据来源：scripts/408card/capture-demos.mjs 产出的 demos.json
 *   - catalog[]：key/sourceId/subjectKey/title/description/sourceUrl/sortOrder/frameCount/steps[{explain,frame}]/fingerprint
 *   - 帧文件：apps/web/public/content-demos/<demo>/<n>.webp（steps[].frame = content-demos/<demo>/<n>.webp）
 *
 * 授权：作者已同意个人学习、非商业用途；保留署名与来源链接。
 *
 * 用法：
 *   node scripts/408card/import-demos.mjs --dry-run   # 只校验 + 报告，不写库
 *   node scripts/408card/import-demos.mjs --apply     # 校验 + 事务写库
 *
 * 可选：
 *   --allow-partial   允许 catalog 少于 98 个演示（调试/补抓时用）
 *   --archive-stale   把库里 source_key='408card-top' 但不在本次 catalog 的演示置 archived
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const DEMOS_JSON = path.join(ROOT, "scripts/408card/demos.json");
const PUBLIC_DIR = path.join(ROOT, "apps/web/public");
const SOURCE_KEY = "408card-top";
const MIN_STEPS = 3;
const MAX_FRAME_BYTES = 80 * 1024;
const EXPECTED_DEMOS = 98;

const args = new Set(process.argv.slice(2));
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : "";
if (!MODE) {
  console.error("用法：node scripts/408card/import-demos.mjs --dry-run|--apply");
  process.exit(2);
}
const ALLOW_PARTIAL = args.has("--allow-partial");
const ARCHIVE_STALE = args.has("--archive-stale");

const log = (...items) => console.log("[demos-import]", ...items);

function fail(message) {
  console.error("[demos-import] 校验失败：" + message);
  process.exit(1);
}

async function loadCatalog() {
  let payload;
  try {
    payload = JSON.parse(await readFile(DEMOS_JSON, "utf8"));
  } catch (error) {
    fail("读取 " + DEMOS_JSON + " 失败：" + error.message);
  }
  if (payload.source !== SOURCE_KEY) fail("demos.json 的 source 应为 " + SOURCE_KEY);
  const catalog = Array.isArray(payload.catalog) ? payload.catalog : [];
  if (catalog.length === 0) fail("demos.json 的 catalog 为空");
  if (catalog.length !== EXPECTED_DEMOS && !ALLOW_PARTIAL) {
    fail(
      "catalog 有 " +
        catalog.length +
        " 个演示，应为 " +
        EXPECTED_DEMOS +
        "；确认只做部分导入请加 --allow-partial",
    );
  }
  const seen = new Set();
  for (const demo of catalog) {
    const label = demo.sourceId || demo.key || "(unknown)";
    if (!demo.key || !/^408card\/[a-z0-9-]+$/.test(demo.key)) fail(label + "：key 形状不对");
    if (seen.has(demo.key)) fail(label + "：key 重复");
    seen.add(demo.key);
    if (demo.key !== "408card/" + demo.sourceId) fail(label + "：key 与 sourceId 不一致");
    if (!demo.subjectKey || !/^beokayy-408\/[a-z-]+$/.test(demo.subjectKey)) {
      fail(label + "：subjectKey 形状不对（应为 beokayy-408/xxx）");
    }
    if (!demo.title || !String(demo.title).trim()) fail(label + "：缺 title");
    if (!demo.description || !String(demo.description).trim()) fail(label + "：缺 description");
    if (!demo.sourceUrl || !/^https?:\/\//.test(demo.sourceUrl)) fail(label + "：缺 sourceUrl");
    if (!demo.fingerprint || !/^[a-f0-9]{64}$/.test(demo.fingerprint)) fail(label + "：fingerprint 不是 sha256");
    const steps = Array.isArray(demo.steps) ? demo.steps : [];
    if (steps.length < MIN_STEPS) fail(label + "：步骤数 " + steps.length + " < " + MIN_STEPS);
    if (demo.frameCount !== steps.length) fail(label + "：frameCount 与 steps 数量不一致");
    for (const [index, step] of steps.entries()) {
      if (!step || !String(step.explain || "").trim()) fail(label + "：第 " + (index + 1) + " 步缺 explain");
      if (!step.frame || !/^content-demos\/[a-z0-9-]+\/\d+\.webp$/.test(step.frame)) {
        fail(label + "：第 " + (index + 1) + " 步 frame 路径不合法：" + step.frame);
      }
      const abs = path.join(PUBLIC_DIR, step.frame);
      let info;
      try {
        info = await stat(abs);
      } catch {
        fail(label + "：帧文件不存在 " + step.frame);
      }
      if (!info.isFile() || info.size === 0) fail(label + "：帧文件为空 " + step.frame);
      if (info.size > MAX_FRAME_BYTES) {
        fail(label + "：帧过大 " + step.frame + "（" + info.size + " 字节 > " + MAX_FRAME_BYTES + "）");
      }
    }
  }
  return { payload, catalog };
}

async function loadPointMapping(client) {
  // 同一 demo 可能被多张速记卡引用，取「出现次数最多」的知识点（并列取字典序最小），保证结果确定。
  const counts = new Map();
  try {
    const { rows } = await client.query(
      "SELECT demo_key, knowledge_point_key, count(*)::int AS n FROM exam_408_cards " +
        "WHERE demo_key IS NOT NULL AND knowledge_point_key IS NOT NULL " +
        "GROUP BY 1, 2",
    );
    for (const row of rows) {
      if (!row.demo_key || !row.knowledge_point_key) continue;
      const list = counts.get(row.demo_key) || [];
      list.push({ pointKey: row.knowledge_point_key, n: Number(row.n) || 1 });
      counts.set(row.demo_key, list);
    }
  } catch (error) {
    log("读取速记卡映射失败（knowledge_point_key 全部置空）：" + error.message);
    return new Map();
  }
  const mapping = new Map();
  for (const [demoKey, list] of counts) {
    list.sort((a, b) => b.n - a.n || a.pointKey.localeCompare(b.pointKey));
    mapping.set(demoKey, list[0].pointKey);
  }
  return mapping;
}

async function main() {
  const { payload, catalog } = await loadCatalog();
  const totalSteps = catalog.reduce((sum, demo) => sum + demo.steps.length, 0);
  log(
    "catalog 校验通过：" +
      catalog.length +
      " 个演示 / " +
      totalSteps +
      " 步 / " +
      (payload.stats && payload.stats.bytes ? (payload.stats.bytes / 1024 / 1024).toFixed(2) + "MB" : "大小未知"),
  );

  const { Pool } = require("pg");
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
    database: process.env.PGDATABASE || "Learn-Workbench",
  });
  const client = await pool.connect();
  try {
    const before = await client.query(
      "SELECT count(*)::int AS n FROM exam_408_demos WHERE source_key = $1",
      [SOURCE_KEY],
    );
    const subjects = await client.query(
      "SELECT subject_key, count(*)::int AS n FROM exam_408_demos WHERE source_key = $1 GROUP BY 1 ORDER BY 1",
      [SOURCE_KEY],
    );
    const pointMapping = await loadPointMapping(client);

    if (MODE === "dry-run") {
      log("dry-run：库中现有 " + before.rows[0].n + " 个 " + SOURCE_KEY + " 演示（将写入 " + catalog.length + " 个）");
      for (const demo of catalog) {
        const pointKey = pointMapping.get(demo.sourceId) || null;
        log(
          "  - " +
            demo.key +
            " [" +
            demo.subjectKey +
            "] " +
            demo.frameCount +
            " 步" +
            (pointKey ? " → " + pointKey : ""),
        );
      }
      if (subjects.rows.length > 0) {
        log("按科目现有行数：" + subjects.rows.map((row) => row.subject_key + "=" + row.n).join(", "));
      }
      return;
    }

    await client.query("BEGIN");
    let updated = 0;
    for (const demo of catalog) {
      const pointKey = pointMapping.get(demo.sourceId) || null;
      const steps = demo.steps.map((step) => ({ explain: String(step.explain), frame: String(step.frame) }));
      const result = await client.query(
        "INSERT INTO exam_408_demos (key, source_key, subject_key, title, description, knowledge_point_key, steps, frame_count, sort_order, fingerprint, status) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'published') " +
          "ON CONFLICT (key) DO UPDATE SET source_key=EXCLUDED.source_key, subject_key=EXCLUDED.subject_key, " +
          "title=EXCLUDED.title, description=EXCLUDED.description, knowledge_point_key=EXCLUDED.knowledge_point_key, " +
          "steps=EXCLUDED.steps, frame_count=EXCLUDED.frame_count, sort_order=EXCLUDED.sort_order, " +
          "fingerprint=EXCLUDED.fingerprint, status=EXCLUDED.status, updated_at=now()",
        [
          demo.key,
          SOURCE_KEY,
          demo.subjectKey,
          String(demo.title).trim(),
          String(demo.description).trim(),
          pointKey,
          JSON.stringify(steps),
          steps.length,
          Number(demo.sortOrder) || 0,
          demo.fingerprint,
        ],
      );
      updated += result.rowCount ?? 0;
    }
    if (ARCHIVE_STALE && catalog.length === EXPECTED_DEMOS) {
      const keys = catalog.map((demo) => demo.key);
      const archived = await client.query(
        "UPDATE exam_408_demos SET status = 'archived', updated_at = now() " +
          "WHERE source_key = $1 AND status <> 'archived' AND NOT (key = ANY($2::text[]))",
        [SOURCE_KEY, keys],
      );
      if ((archived.rowCount ?? 0) > 0) log("已归档 " + archived.rowCount + " 个不在本次 catalog 的旧演示");
    }
    await client.query("COMMIT");

    const after = await client.query(
      "SELECT count(*)::int AS n, coalesce(sum(frame_count),0)::int AS frames FROM exam_408_demos WHERE source_key = $1",
      [SOURCE_KEY],
    );
    const bySubject = await client.query(
      "SELECT subject_key, count(*)::int AS n, coalesce(sum(frame_count),0)::int AS frames FROM exam_408_demos " +
        "WHERE source_key = $1 GROUP BY 1 ORDER BY 1",
      [SOURCE_KEY],
    );
    log(
      "写入完成：更新/插入 " +
        updated +
        " 行；库中 " +
        SOURCE_KEY +
        " 共 " +
        after.rows[0].n +
        " 个演示 / " +
        after.rows[0].frames +
        " 步",
    );
    for (const row of bySubject.rows) log("  " + row.subject_key + "：" + row.n + " 个 / " + row.frames + " 步");
    if (after.rows[0].n !== catalog.length) {
      log("⚠️ 库中行数（" + after.rows[0].n + "）与 catalog（" + catalog.length + "）不一致，请检查是否为增量导入");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[demos-import] 失败：" + (error && error.stack ? error.stack : error));
  process.exit(1);
});
