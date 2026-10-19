#!/usr/bin/env node
/**
 * 恢复演练（S4-6）：把一份 pg_dump -Fc 备份真正恢复到临时库并断言，然后 DROP。
 *
 * 为什么不是"能 pg_restore --list 就算过"：真实恢复会暴露归档损坏、扩展缺失、
 * 表/数据缺失、权限/owner 问题。每周日演练一次，才有资格谈 RTO。
 *
 * 用法：
 *   node scripts/restore-drill.mjs --dump /data/learn-workbench/backups/Learn-Workbench-20261019.dump
 *   node scripts/restore-drill.mjs --latest /data/learn-workbench/backups     # 取目录里最新 .dump
 *   node scripts/restore-drill.mjs --dump xxx.dump --dry-run                  # 只校验归档可读，不建库
 *   node scripts/restore-drill.mjs --dump xxx.dump --keep                     # 保留临时库供排查
 *
 * 参数：
 *   --dump <file>       指定备份文件（也可用位置参数）
 *   --latest <dir>      取目录中最新的 *.dump（与 --dump 二选一）
 *   --dry-run           只跑 pg_restore --list（不连库、不建库）
 *   --keep              演练成功/失败后保留临时库（默认 DROP）
 *   --min-tables <n>    断言最少表数（默认 50，可用 PGDRILL_MIN_TABLES 覆盖）
 *   --admin-db <name>   建/删临时库所用管理库（默认 postgres）
 *
 * 连接参数走标准 PG 环境变量：PGHOST / PGPORT / PGUSER / PGPASSWORD。
 * pg_restore 可执行文件：PATH 中的 pg_restore，或用 PG_RESTORE_BIN 指定绝对路径。
 *
 * 输出：
 *   stdout 机器可读一行：RESTORE_DRILL_OK mode=... 或 RESTORE_DRILL_FAIL reason=...
 *   人类日志全部写 stderr。退出码：0 成功 / 1 演练失败 / 2 参数或环境错误。
 */
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));

/** 关键表：恢复后必须存在且能 count；覆盖账号/求职/学习/任务/会话。 */
const KEY_TABLES = [
  "users",
  "accounts",
  "job_postings",
  "learning_questions",
  "daily_tasks",
  "sessions",
  "auth_attempts",
];
const DEFAULT_MIN_TABLES = Number(process.env.PGDRILL_MIN_TABLES || 50);

const log = (...args) => console.error("[drill]", ...args);
const elapsedMs = (start) => Date.now() - start;
const sanitize = (text) => String(text || "unknown").replace(/\s+/g, " ").slice(0, 300);

function parseArgs(argv) {
  const opts = {
    dump: null,
    latestDir: null,
    dryRun: false,
    keep: false,
    minTables: DEFAULT_MIN_TABLES,
    adminDb: process.env.PGDRILL_ADMIN_DB || "postgres",
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--keep") opts.keep = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--dump") opts.dump = argv[++i] ?? null;
    else if (arg === "--latest") opts.latestDir = argv[++i] ?? null;
    else if (arg === "--min-tables") opts.minTables = Number(argv[++i]);
    else if (arg === "--admin-db") opts.adminDb = argv[++i] ?? "postgres";
    else if (arg.startsWith("-")) return { error: "未知参数 " + arg };
    else if (opts.dump) return { error: "重复指定 dump 文件" };
    else opts.dump = arg;
  }
  if (!opts.help) {
    if (opts.dump && opts.latestDir) return { error: "--dump 与 --latest 只能二选一" };
    if (!opts.dump && !opts.latestDir) return { error: "缺少 --dump <file> 或 --latest <dir>" };
    if (!Number.isInteger(opts.minTables) || opts.minTables <= 0) return { error: "--min-tables 必须是正整数" };
  }
  return { opts };
}

/** 取目录里最新的 *.dump */
function newestDump(dir) {
  const abs = resolve(dir);
  if (!existsSync(abs)) throw new Error("目录不存在：" + abs);
  const candidates = readdirSync(abs)
    .filter((name) => name.endsWith(".dump"))
    .map((name) => {
      const file = join(abs, name);
      return { file, mtime: statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) throw new Error("目录里没有 *.dump：" + abs);
  return candidates[0].file;
}

async function sha256File(file) {
  const hash = createHash("sha256");
  await new Promise((ok, no) => {
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", ok)
      .on("error", no);
  });
  return hash.digest("hex");
}

/** 若备份旁有 .sha256，则强校验；没有只告警（历史备份可能没有）。 */
async function verifySha256(dump) {
  const sidecar = dump + ".sha256";
  const actual = await sha256File(dump);
  if (!existsSync(sidecar)) {
    log("未找到 " + basename(sidecar) + "，跳过校验和比对（建议用新版 backup-db.sh 生成）");
    return { hash: actual, verified: false };
  }
  const raw = readFileSync(sidecar, "utf8").trim();
  const expected = (raw.split(/\s+/)[0] || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    throw new Error("sha256 文件格式非法：" + sidecar);
  }
  if (expected !== actual) {
    throw new Error("sha256 不匹配：期望 " + expected + "，实际 " + actual);
  }
  log("sha256 校验通过：" + actual);
  return { hash: actual, verified: true };
}

const PG_RESTORE = process.env.PG_RESTORE_BIN || "pg_restore";

function run(cmd, args, extra = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...extra });
}

function checkReadable(dump) {
  const result = run(PG_RESTORE, ["--list", dump]);
  if (result.error) {
    throw new Error(
      "无法执行 " + PG_RESTORE + "（" + result.error.message + "）：安装 postgresql-client 或设 PG_RESTORE_BIN"
    );
  }
  if (result.status !== 0) {
    throw new Error("归档不可读（pg_restore --list 退出码 " + result.status + "）：" + sanitize(result.stderr));
  }
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim().startsWith(";") === false && line.trim() !== "");
  const toc = lines.filter((line) => /^\d+;/.test(line.trim()));
  const tables = toc.filter((line) => /\sTABLE\s/.test(line) && !/\sTABLE DATA\s/.test(line)).length;
  const tableData = toc.filter((line) => /\sTABLE DATA\s/.test(line)).length;
  if (tables === 0) throw new Error("归档里没有任何 TABLE 段（空库/截断备份），不算有效备份");
  return { toc: toc.length, tables, tableData };
}

function loadPg() {
  try {
    return require("pg");
  } catch (error) {
    throw new Error("无法加载 pg 模块（" + error.message + "）：请在仓库根目录执行，或先 pnpm install");
  }
}

function tempDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return "lwb_restore_drill_" + stamp;
}

async function dropTempDb(admin, name) {
  if (!/^lwb_restore_drill_[0-9]{8,20}$/.test(name)) {
    log("拒绝 DROP 非演练库名：" + name);
    return;
  }
  try {
    await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
    log("已 DROP 临时库 " + name);
  } catch (error) {
    try {
      await admin.query('DROP DATABASE IF EXISTS "' + name + '"');
      log("已 DROP 临时库 " + name + "（无 FORCE）");
    } catch (inner) {
      log("DROP 临时库失败，请手工清理 " + name + "：" + sanitize(inner.message));
    }
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error("[drill] " + parsed.error);
    console.error("RESTORE_DRILL_FAIL reason=" + sanitize(parsed.error));
    process.exit(2);
  }
  const opts = parsed.opts;
  if (opts.help) {
    console.log("用法：node scripts/restore-drill.mjs --dump <file> | --latest <dir> [--dry-run] [--keep] [--min-tables N]");
    process.exit(0);
  }

  const started = Date.now();
  const dump = opts.dump ? resolve(opts.dump) : newestDump(opts.latestDir);
  if (!existsSync(dump)) throw new Error("备份文件不存在：" + dump);
  const bytes = statSync(dump).size;
  if (bytes === 0) throw new Error("备份文件为空：" + dump);
  log("备份：" + dump + "（" + bytes + " 字节）");

  const { hash, verified } = await verifySha256(dump);
  const archive = checkReadable(dump);
  log("归档可读：TOC " + archive.toc + " 条，表 " + archive.tables + " 张，表数据段 " + archive.tableData + " 段");

  if (opts.dryRun) {
    console.log(
      "RESTORE_DRILL_OK mode=dry-run dump=" + dump + " bytes=" + bytes +
        " sha256=" + hash + " sha256_verified=" + verified +
        " toc=" + archive.toc + " tables=" + archive.tables +
        " table_data=" + archive.tableData + " elapsed_ms=" + elapsedMs(started)
    );
    return;
  }

  const { Client } = loadPg();
  const admin = new Client({ database: opts.adminDb, application_name: "lwb-restore-drill" });
  const tempDb = tempDbName();
  let created = false;
  let tempClient = null;
  let failure = null;

  try {
    await admin.connect();
    log("已连接管理库 " + opts.adminDb);
    await admin.query('CREATE DATABASE "' + tempDb + '"');
    created = true;
    log("已创建临时库 " + tempDb + "，开始 pg_restore（--no-owner --no-privileges --exit-on-error）");

    const restore = run(PG_RESTORE, [
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--dbname",
      tempDb,
      dump,
    ]);
    if (restore.error) {
      throw new Error("无法执行 " + PG_RESTORE + "（" + restore.error.message + "）");
    }
    if (restore.status !== 0) {
      throw new Error("pg_restore 失败（退出码 " + restore.status + "）：" + sanitize(restore.stderr));
    }
    log("pg_restore 完成，开始断言");

    tempClient = new Client({ database: tempDb, application_name: "lwb-restore-drill" });
    await tempClient.connect();

    const tableRow = await tempClient.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
    );
    const tableCount = tableRow.rows[0].n;
    if (tableCount < opts.minTables) {
      throw new Error("恢复后表数 " + tableCount + " < 阈值 " + opts.minTables + "（备份可能不完整）");
    }

    const rowCounts = {};
    const missing = [];
    for (const table of KEY_TABLES) {
      const exists = await tempClient.query(
        "select 1 from information_schema.tables where table_schema = 'public' and table_name = $1",
        [table]
      );
      if (exists.rowCount === 0) {
        missing.push(table);
        continue;
      }
      const counted = await tempClient.query('select count(*)::int as n from "' + table + '"');
      rowCounts[table] = counted.rows[0].n;
    }
    if (missing.length > 0) {
      throw new Error("关键表缺失：" + missing.join(", "));
    }
    const rowsSummary = Object.entries(rowCounts)
      .map(([table, count]) => table + "=" + count)
      .join(" ");

    console.log(
      "RESTORE_DRILL_OK mode=full dump=" + dump + " temp_db=" + tempDb +
        " bytes=" + bytes + " tables=" + tableCount + " " + rowsSummary +
        " elapsed_ms=" + elapsedMs(started)
    );
  } catch (error) {
    failure = sanitize(error.message);
  } finally {
    try { if (tempClient) await tempClient.end(); } catch { /* ignore */ }
    if (created) {
      if (opts.keep) log("--keep：保留临时库 " + tempDb + "（排查后手工 DROP）");
      else await dropTempDb(admin, tempDb).catch(() => {});
    }
    try { await admin.end(); } catch { /* ignore */ }
  }

  if (failure) {
    console.error("[drill] 演练失败：" + failure);
    console.log("RESTORE_DRILL_FAIL reason=" + failure);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[drill] 演练异常：" + sanitize(error.message));
  console.log("RESTORE_DRILL_FAIL reason=" + sanitize(error.message));
  process.exit(1);
});
