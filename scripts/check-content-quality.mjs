#!/usr/bin/env node
/**
 * 内容质量门禁（库侧）（组二 · 阶段 9 = V3 纵轨 Phase C）。
 *
 * 与 `packages/content/src/learning/quality.test.ts` 的分工：
 *   - TS 侧（进 CI，`pnpm test`）：模板必填、代码块语言、链接/许可、重复、危险 HTML、题量、时效；
 *   - 本脚本（库侧）：**已经同步进库、准备给用户看的内容**是否真的合格 ——
 *     有没有把 L0/L1 占位内容发出去、有没有少于 2 题的孤儿知识点、有没有悬空关联、有没有过期没复查的章节。
 *
 * 为什么无库时跳过而不是失败：CI 的质量作业没有数据库（只有 e2e 作业有），
 * 这里按"拿不到库就跳过"处理，本地/发布机上再真正把关（退出码 0 表示没有发现违规）。
 *
 * 用法：node scripts/check-content-quality.mjs [--strict]
 *   --strict 时**警告也当失败**（发布前用）
 * 退出码：0 = 通过（或跳过）；1 = 有违规
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];

const CONN = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
  database: process.env.PGDATABASE || "Learn-Workbench",
};

function shortSha() {
  try {
    return execFileSync("git", ["log", "-1", "--format=%h", "--", "packages/content/src/learning"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function main() {
  const pool = new Pool({ ...CONN, connectionTimeoutMillis: 3000, statement_timeout: 10_000 });
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.log(`[content-quality] 跳过：连不上数据库（${error.code ?? error.message}）—— TS 侧契约检查仍由 pnpm test 覆盖`);
    await pool.end().catch(() => {});
    return;
  }

  try {
    const table = await client.query("SELECT to_regclass('public.knowledge_points') AS t");
    if (!table.rows[0]?.t) {
      console.log("[content-quality] 跳过：本库还没有 knowledge_points（迁移 060 尚未应用）");
      return;
    }

    // 1) 占位内容不得发布（L0/L1 只能留在草稿/审核）
    const placeholder = await client.query(
      `SELECT key, quality_level FROM knowledge_points
        WHERE status = 'published' AND quality_level IN ('L0','L1') ORDER BY key LIMIT 20`
    );
    for (const row of placeholder.rows) {
      errors.push(`占位内容已发布（${row.quality_level}）：${row.key}`);
    }

    // 2) 模板必填：标题/摘要不能为空
    const blank = await client.query(
      `SELECT key FROM knowledge_points
        WHERE status = 'published' AND (btrim(title) = '' OR btrim(summary) = '') ORDER BY key LIMIT 20`
    );
    for (const row of blank.rows) errors.push(`已发布但标题/摘要为空：${row.key}`);

    // 3) 题量：每个已发布知识点至少 2 题
    const thin = await client.query(
      `SELECT kp.key, count(q.question_key)::int AS n
         FROM knowledge_points kp
         LEFT JOIN question_knowledge_point q ON q.knowledge_point_key = kp.key
        WHERE kp.status = 'published'
        GROUP BY kp.key HAVING count(q.question_key) < 2
        ORDER BY kp.key LIMIT 20`
    );
    for (const row of thin.rows) errors.push(`配套题不足 2 道：${row.key}（${row.n} 道）`);

    // 4) 关联完整性（防御式：外键已保证，但归档/手工改动可能绕过）
    const dangling = await client.query(
      `SELECT count(*)::int AS n FROM question_knowledge_point q
         LEFT JOIN knowledge_points kp ON kp.key = q.knowledge_point_key WHERE kp.key IS NULL`
    );
    if (Number(dangling.rows[0]?.n ?? 0) > 0) errors.push(`题↔知识点关联悬空：${dangling.rows[0].n} 条`);

    const selfRef = await client.query(
      `SELECT count(*)::int AS n FROM knowledge_relation WHERE from_key = to_key`
    );
    if (Number(selfRef.rows[0]?.n ?? 0) > 0) errors.push(`知识点关系自指：${selfRef.rows[0].n} 条`);

    const selfPrereq = await client.query(
      `SELECT count(*)::int AS n FROM knowledge_prerequisite WHERE knowledge_point_key = prerequisite_key`
    );
    if (Number(selfPrereq.rows[0]?.n ?? 0) > 0) errors.push(`前置关系自指：${selfPrereq.rows[0].n} 条`);

    // 5) 时效：过期未复查
    const stale = await client.query(
      `SELECT key, stale_after::date AS due FROM knowledge_points
        WHERE status = 'published' AND stale_after IS NOT NULL AND stale_after < now()
        ORDER BY stale_after LIMIT 10`
    );
    for (const row of stale.rows) warnings.push(`过期未复查（${row.due}）：${row.key}`);

    // 6) 来源与标签：已发布内容应当能追溯到来源
    const noSource = await client.query(
      `SELECT count(*)::int AS n FROM knowledge_points
        WHERE status = 'published' AND (source_key IS NULL OR source_key = '')`
    );
    if (Number(noSource.rows[0]?.n ?? 0) > 0) warnings.push(`已发布但无来源键：${noSource.rows[0].n} 个知识点`);

    const noTags = await client.query(
      `SELECT count(*)::int AS n FROM knowledge_points
        WHERE status = 'published' AND jsonb_array_length(tags) = 0`
    );
    if (Number(noTags.rows[0]?.n ?? 0) > 0) warnings.push(`已发布但无标签：${noTags.rows[0].n} 个知识点`);

    // 7) 内容版本：与当前内容包不一致 → 提醒同步
    const sha = shortSha();
    if (sha) {
      const versions = await client.query(
        `SELECT DISTINCT content_version FROM knowledge_points WHERE status = 'published' LIMIT 5`
      );
      const list = versions.rows.map((row) => String(row.content_version));
      if (list.length > 0 && !list.includes(sha)) {
        warnings.push(`库内内容版本 ${list.join("/")} 与当前内容包 ${sha} 不一致 → 建议跑 pnpm sync:content`);
      }
    }

    const summary = await client.query(
      `SELECT (SELECT count(*)::int FROM knowledge_points WHERE status = 'published') AS points,
              (SELECT count(*)::int FROM question_knowledge_point) AS links,
              (SELECT count(*)::int FROM knowledge_relation) AS relations,
              (SELECT count(*)::int FROM knowledge_prerequisite) AS prerequisites`
    );
    console.log(`[content-quality] 规模：${JSON.stringify(summary.rows[0])}`);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }

  for (const warning of warnings) console.warn(`[content-quality][WARN] ${warning}`);
  for (const error of errors) console.error(`[content-quality][FAIL] ${error}`);

  if (errors.length > 0 || (strict && warnings.length > 0)) {
    console.error(`\n[content-quality] 未通过：${errors.length} 个错误 / ${warnings.length} 个警告`);
    process.exitCode = 1;
    return;
  }
  console.log(`[content-quality] 通过 ✅（${warnings.length} 个警告）`);
}

main().catch((error) => {
  console.error("[content-quality] 失败：" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
