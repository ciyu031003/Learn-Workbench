// extract.mjs — 提取层：Markdown（主）+ MySQL（可选）
import { loadMysql } from "./drivers.mjs";
import { buildDtos, TYPE } from "./dto.mjs";

/**
 * 从 MySQL Post 表提取学习类内容（type in blog/mindmap/repo）。
 * 当前 Travel-Notes 学习内容全部在 Markdown，MySQL 仅 3 条 travel；
 * 保留该提取路径以支持后续/其他环境存在 DB 学习帖的情况。
 */
export async function extractFromMysql(cfg) {
  const mysql = loadMysql();
  if (!mysql) return { available: false, dtos: [], warnings: ["mysql2 不可用，跳过 MySQL 提取（学习内容以 Markdown 为准）"] };
  const url = new URL((cfg.mysqlUrl || "mysql://root:CHANGE_ME@localhost:3306/Travel_And_Study").replace("mysql://", "http://"));
  const dbName = decodeURIComponent(url.pathname.slice(1));
  let conn;
  try {
    conn = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port || "3306", 10),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: dbName,
      connectTimeout: 4000,
    });
  } catch (e) {
    return { available: false, dtos: [], warnings: ["MySQL 连接失败: " + e.message] };
  }
  try {
    const [rows] = await conn.query(
      "SELECT id, slug, title, content, date, tags, type, summary FROM Post WHERE type IN ('blog','mindmap','repo') ORDER BY id"
    );
    const dtos = [];
    for (const r of rows) {
      let tags = [];
      try {
        tags = JSON.parse(r.tags || "[]");
      } catch {}
      const typeMap = { blog: TYPE.NOTE, mindmap: TYPE.MINDMAP, repo: TYPE.PROJECT_NOTE };
      dtos.push({
        sourceId: "travel-notes:db:" + r.type + ":" + r.id,
        title: r.title,
        slug: String(r.slug || "").trim() || String(r.id),
        content: r.content || "",
        type: typeMap[r.type] || TYPE.NOTE,
        date: r.date ? new Date(r.date).toISOString() : null,
        tags,
        sourcePath: "mysql:Post#" + r.id,
        metadata: { sourceProject: "Travel-Notes", sourceType: "db:" + r.type, sourceId: r.id, summary: r.summary },
      });
    }
    return { available: true, dtos, warnings: [] };
  } catch (e) {
    return { available: false, dtos: [], warnings: ["MySQL 提取失败: " + e.message] };
  } finally {
    await conn.end().catch(() => {});
  }
}

/** 汇总源数据（Markdown DTO + MySQL DTO），按 sourceId 去重 */
export async function collectSource(cfg) {
  const { dtos: mdDtos, warnings: mdWarnings } = buildDtos();
  const mysql = await extractFromMysql(cfg);
  const warnings = [...mdWarnings, ...mysql.warnings];
  const seen = new Set();
  const all = [];
  for (const d of [...mdDtos, ...mysql.dtos]) {
    if (seen.has(d.sourceId)) continue;
    seen.add(d.sourceId);
    all.push(d);
  }
  return { dtos: all, warnings, mysqlAvailable: mysql.available };
}
