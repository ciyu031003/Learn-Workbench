#!/usr/bin/env node
/**
 * 统一迁移执行器（S4-1）。
 *
 * 为什么需要：此前 docker 路径用 docker-init-db.sh 逐条 psql -f（无事务/无 checksum），
 * PM2 路径用 deploy_init 标记直接跳过（新迁移永远不执行）；两条路径语义不一致，
 * 且"历史迁移被就地修改"无法被发现。
 *
 * 语义（与 docker-init-db.sh 保持一致）：
 *  - 按文件名排序，逐个应用未登记在 schema_migrations 的迁移；
 *  - 每个文件在**单个事务**内执行（文件自带的 BEGIN/COMMIT 由它自己管理，历史少数文件如此）；
 *  - 台账与迁移在同一事务写：要么都成功，要么都不生效；
 *  - 已登记的文件校验 sha256：不一致 → 直接失败（禁止偷改历史迁移）；
 *  - 有待应用迁移时，先 pg_dump -Fc 备份并用 pg_restore --list 自检（--no-backup 可跳过）。
 *
 * 用法（在 web 容器内或装了 node+pg 的机器上）：
 *   node scripts/migrate.mjs            # 应用未执行的迁移
 *   node scripts/migrate.mjs --dry-run  # 只打印将执行/会失败的内容，不落库
 *   node scripts/migrate.mjs --status   # 打印台账与磁盘文件的对齐情况
 *   node scripts/migrate.mjs --no-backup
 *
 * 退出码：0 = 已是最新/全部成功；1 = 校验失败/迁移失败/备份失败。
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(ROOT, "db", "migrations");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const STATUS_ONLY = args.has("--status");
const NO_BACKUP = args.has("--no-backup");

const PG = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "lwb",
  password: process.env.PGPASSWORD || "",
  database: process.env.PGDATABASE || "Learn-Workbench",
};

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) throw new Error("迁移目录不存在: " + MIGRATIONS_DIR);
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const abs = path.join(MIGRATIONS_DIR, f);
      const buf = readFileSync(abs);
      return { file: f, abs, bytes: buf, checksum: sha256(buf), size: statSync(abs).size };
    });
}

function sqlLiteral(v) {
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function backup(label) {
  const dir = process.env.BACKUP_DIR || path.join(ROOT, "public", "private", "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(dir, `pre-migrate-${stamp}-${label}.dump`);
  console.log("[migrate] 备份数据库 → " + out);
  const env = { ...process.env, PGPASSWORD: PG.password };
  try {
    execFileSync("pg_dump", ["-h", PG.host, "-p", String(PG.port), "-U", PG.user, "-d", PG.database, "-Fc", "-f", out], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/server version mismatch/i.test(msg)) {
      throw new Error(
        "容器内 pg_dump 版本低于数据库（PostgreSQL 主版本不匹配）。" +
          "替代方案：1) 在宿主机用 db 容器备份：BACKUP_MODE=docker bash scripts/backup-db.sh；" +
          "2) 再以 --no-backup 运行本脚本；3) 或把 web 镜像的 postgresql-client 升到与数据库同主版本。"
      );
    }
    throw e;
  }
  // 退出码 0 不代表可恢复：必须能读目录
  const toc = execFileSync("pg_restore", ["--list", out], { env, encoding: "utf8" });
  const entries = toc.split("\n").filter(Boolean).length;
  if (entries < 10) throw new Error("备份自检失败：归档条目过少（" + entries + "）");
  console.log("[migrate] 备份自检通过（" + entries + " 条 TOC）: " + out);
  return out;
}

async function main() {
  const files = listMigrations();
  const client = new Client(PG);
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text");

    const { rows } = await client.query("SELECT filename, checksum FROM schema_migrations");
    const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

    const pending = files.filter((f) => !applied.has(f.file));
    const changed = files.filter((f) => applied.has(f.file) && applied.get(f.file) && applied.get(f.file) !== f.checksum);
    const unverified = files.filter((f) => applied.has(f.file) && !applied.get(f.file));

    console.log(
      `[migrate] 磁盘 ${files.length} 个迁移；已应用 ${applied.size}；待应用 ${pending.length}；未校验 ${unverified.length}`
    );

    if (STATUS_ONLY) {
      for (const f of files) console.log(`  ${applied.has(f.file) ? "applied" : "PENDING"}  ${f.file}`);
      return;
    }
    if (changed.length) {
      console.error("[migrate] 失败：以下已应用的迁移文件内容被修改（checksum 不一致）：");
      for (const f of changed) console.error(`  ${f.file}`);
      process.exitCode = 1;
      return;
    }
    // 历史行回填 checksum（只对已应用且未校验的行）
    for (const f of unverified) {
      await client.query("UPDATE schema_migrations SET checksum=$1 WHERE filename=$2", [f.checksum, f.file]);
    }
    if (unverified.length) console.log(`[migrate] 已回填 ${unverified.length} 条历史 checksum`);

    if (pending.length === 0) {
      console.log("[migrate] 数据库已是最新，无需迁移");
      return;
    }
    if (DRY_RUN) {
      console.log("[migrate] --dry-run：将执行以下迁移（不落库）：");
      for (const f of pending) console.log(`  ${f.file}  ${f.size}B  ${f.checksum.slice(0, 12)}`);
      return;
    }

    if (!NO_BACKUP) backup(pending[pending.length - 1].file.replace(/\.sql$/, ""));

    for (const f of pending) {
      const sql = f.bytes.toString("utf8");
      // 台账与迁移放在同一个 simple query 里：PG 对不含显式事务控制的多语句查询按单事务执行
      const ledger =
        `\n; INSERT INTO schema_migrations (filename, checksum, applied_at) VALUES (` +
        `${sqlLiteral(f.file)}, ${sqlLiteral(f.checksum)}, now()) ` +
        `ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`;
      console.log("[migrate] 执行 " + f.file + " ...");
      try {
        await client.query(sql + ledger);
      } catch (e) {
        console.error("[migrate] 失败于 " + f.file + "：" + (e instanceof Error ? e.message : String(e)));
        process.exitCode = 1;
        return;
      }
    }
    console.log("[migrate] 完成：应用 " + pending.length + " 个迁移");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[migrate] 失败：" + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
