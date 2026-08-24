#!/usr/bin/env node
/**
 * 技能 ↔ 学习主题映射回填（skill_content_links）
 * 需求：学习 × 招聘打通 —— 能力缺口要能给出「去学哪个主题」的学习建议。
 * 读取市场高频需求技能（job_skill_links 聚合），按关键词匹配 content_topics 标题，
 * 写入 skill_content_links（幂等，ON CONFLICT DO NOTHING）。
 * 用法：node scripts/backfill_skill_content_links.mjs [--limit 60]
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// 技能规范名（小写）→ 主题标题关键词（按优先级，取标题最短的命中）
const KEYWORDS = {
  html: ["html5", "html"],
  css: ["css"],
  javascript: ["javascript"],
  typescript: ["typescript"],
  vue: ["vue 3 或 react"],
  react: ["vue 3 或 react", "react native"],
  git: ["git 与团队协作"],
  node: ["node.js 与接口联调"],
  "node.js": ["node.js 与接口联调"],
  nodejs: ["node.js 与接口联调"],
  k8s: ["容器与部署"],
  cicd: ["工程规范与测试"],
  java: ["java 语法与面向对象"],
  spring: ["spring boot", "spring"],
  springboot: ["spring boot"],
  "spring boot": ["spring boot"],
  mysql: ["mysql 与 sql 优化"],
  sql: ["sql 高阶", "sql"],
  redis: ["redis"],
  docker: ["容器与部署"],
  kubernetes: ["k8s"],
  k8s: ["k8s"],
  nginx: ["nginx"],
  linux: ["linux 运维基础", "linux"],
  shell: ["shell 调度与 kettle"],
  python: ["python 编程", "python 基础", "python"],
  go: ["go"],
  php: ["php"],
  network: ["网络协议", "网络自动化巡检"],
  网络: ["网络协议", "网络自动化巡检"],
  security: ["web 安全漏洞", "安全监控"],
  安全: ["web 安全漏洞", "安全监控"],
  渗透: ["渗透测试报告"],
  cloud: ["云与虚拟化基础"],
  云: ["云与虚拟化基础"],
  test: ["工程规范与测试"],
  测试: ["工程规范与测试"],
};

async function findTopic(pool, patterns) {
  for (const kw of patterns) {
    const r = await pool.query(
      `SELECT id, title FROM content_topics WHERE title ILIKE '%' || $1 || '%' ORDER BY length(title) ASC LIMIT 1`,
      [kw]
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 60);
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "Learn-Workbench",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: 3,
  });
  try {
    const { rows: skills } = await pool.query(
      `SELECT s.id, s.name, s.category, COUNT(DISTINCT l.job_id)::int AS jobs
         FROM job_skill_links l
         JOIN skill_taxonomy s ON s.id = l.skill_id
        GROUP BY s.id, s.name, s.category
        ORDER BY jobs DESC, s.name
        LIMIT $1`,
      [limit]
    );
    let linked = 0;
    const unmatched = [];
    for (const sk of skills) {
      const patterns = KEYWORDS[sk.name.toLowerCase()] || [sk.name];
      const topic = await findTopic(pool, patterns);
      if (!topic) { unmatched.push(`${sk.name}(${sk.jobs})`); continue; }
      const r = await pool.query(
        `INSERT INTO skill_content_links (skill_id, topic_id, estimate_hours)
         VALUES ($1, $2, 8) ON CONFLICT DO NOTHING`,
        [sk.id, topic.id]
      );
      if (r.rowCount > 0) {
        linked += 1;
        console.log(`  [ok] ${sk.name} → ${topic.title}`);
      }
    }
    console.log(`[done] 回填 ${linked} 条映射（共 ${skills.length} 个市场高频技能）`);
    if (unmatched.length) console.log(`[warn] 未找到主题：${unmatched.join(", ")}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[fatal]", e && e.message ? e.message : e);
  process.exit(1);
});
