#!/usr/bin/env node
/**
 * migrate.mjs — Travel-Notes → Learn-Workbench 学习内容迁移（方案 §19-§24）
 *
 * 用法（在仓库根目录执行）：
 *   node migration/migrate.mjs --dry-run     # 试运行：只统计与校验，不写入
 *   node migration/migrate.mjs --execute     # 执行迁移（幂等，可重复运行）
 *   node migration/migrate.mjs --verify      # 校验迁移结果（§24）
 *   node migration/migrate.mjs --all         # dry-run → execute → verify 全流程
 *   node migration/migrate.mjs --user <uuid> # 指定目标用户（默认取第一个账号）
 *   MYSQL_URL=mysql://root:xxx@localhost:3306/Travel_And_Study node migration/migrate.mjs --all
 */
import fs from "node:fs";
import path from "node:path";
import { collectSource } from "./lib/extract.mjs";
import { pgPool } from "./lib/drivers.mjs";
import { loadAll, resolveTargetUser } from "./lib/load.mjs";
import { verifyMigration } from "./lib/verify.mjs";

const REPORT_DIR = path.join(process.cwd(), "migration/reports");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const execute = args.includes("--execute");
const verify = args.includes("--verify");
const all = args.includes("--all");
const userIdx = args.indexOf("--user");
const userArg = userIdx !== -1 ? args[userIdx + 1] : undefined;

function writeReport(name, data) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, name + ".json");
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  return jsonPath;
}

function summaryOf(dtos) {
  const byType = {};
  for (const d of dtos) byType[d.type] = (byType[d.type] || 0) + 1;
  return {
    total: dtos.length,
    NOTE: byType.NOTE || 0,
    MINDMAP: byType.MINDMAP || 0,
    PROJECT_NOTE: byType.PROJECT_NOTE || 0,
    other: Object.entries(byType).filter(([k]) => !["NOTE", "MINDMAP", "PROJECT_NOTE"].includes(k)).reduce((s, [, v]) => s + v, 0),
    tags: [...new Set(dtos.flatMap((d) => d.tags))].length,
  };
}

async function main() {
  const pool = pgPool();
  try {
    const { dtos, warnings, mysqlAvailable } = await collectSource({
      mysqlUrl: process.env.MYSQL_URL,
    });
    const summary = summaryOf(dtos);

    if (dryRun || all) {
      console.log("===== Dry-Run 迁移预览（不写入） =====");
      console.log("总内容（学习）:", summary.total);
      console.log("  学习知识 NOTE:", summary.NOTE);
      console.log("  思维导图 MINDMAP:", summary.MINDMAP);
      console.log("  项目 PROJECT_NOTE:", summary.PROJECT_NOTE);
      console.log("  标签（去重）:", summary.tags);
      console.log("MySQL 提取:", mysqlAvailable ? "可用" : "不可用（以 Markdown 为准）");
      if (warnings.length) {
        console.log("警告:");
        for (const w of warnings) console.log("  - " + w);
      }
      console.log("明细:");
      for (const d of dtos) {
        console.log(
          `  [${d.type}] ${d.slug} | ${d.title} | tags=${d.tags.length} | ${d.content.length} 字符 | ${d.sourcePath}`
        );
      }
      const report = {
        generatedAt: new Date().toISOString(),
        mode: "dry-run",
        mysqlAvailable,
        warnings,
        summary,
        items: dtos.map((d) => ({
          sourceId: d.sourceId,
          title: d.title,
          slug: d.slug,
          type: d.type,
          date: d.date,
          tags: d.tags,
          sourcePath: d.sourcePath,
          contentChars: d.content.length,
        })),
      };
      const p = writeReport("dry-run", report);
      console.log("报告已写入:", p);
    }

    if (execute || all) {
      console.log("\n===== 执行迁移 =====");
      const userId = userArg || (await resolveTargetUser(pool));
      const result = await loadAll(pool, dtos, { userId });
      console.log("目标用户:", result.userId || "(匿名)");
      for (const n of result.notes) {
        console.log(`  ✔ ${n.slug} (id=${n.id}, ${n.type})` + (n.assets.length ? " assets=" + n.assets.join(",") : ""));
      }
      console.log("标签新增/复用:", result.tags);
      if (result.errors.length) {
        console.error("错误:", result.errors);
      }
      const report = {
        generatedAt: new Date().toISOString(),
        mode: "execute",
        userId: result.userId,
        notes: result.notes,
        tags: result.tags,
        errors: result.errors,
      };
      const p = writeReport("migration", report);
      console.log("报告已写入:", p);
    }

    if (verify || all) {
      console.log("\n===== 校验迁移结果（§24） =====");
      const v = await verifyMigration(pool, dtos);
      for (const c of v.checks) {
        console.log(`  ${c.ok ? "✔" : "✘"} ${c.name}: ${c.detail}`);
      }
      console.log("源内容数:", v.sourceCount, " / 目标笔记数:", v.notesCount);
      console.log(v.allOk ? "全部校验通过 ✅" : "存在未通过项 ❌");
      const report = {
        generatedAt: new Date().toISOString(),
        mode: "verify",
        allOk: v.allOk,
        sourceCount: v.sourceCount,
        notesCount: v.notesCount,
        checks: v.checks,
      };
      const p = writeReport("verification", report);
      console.log("报告已写入:", p);
    }

    if (!dryRun && !execute && !verify && !all) {
      console.log("请指定模式：--dry-run / --execute / --verify / --all");
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("迁移失败:", e);
  process.exit(1);
});
