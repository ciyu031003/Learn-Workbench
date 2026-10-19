/**
 * backup 演练（S7-2）：真实调用 scripts/backup-db.sh → 校验 BACKUP_OK/文件/sha256 →
 * 调 scripts/restore-drill.mjs（默认 --dry-run；--full 时做真实恢复）。
 *
 * 环境策略（SKIP 而不是 FAIL 的情形）：
 *  - 没有 bash（Windows 无 Git Bash/WSL，可用 DRILL_BASH 指定）；
 *  - 没有 pg_dump/pg_restore（可用 DRILL_PG_BIN / PG_DUMP_BIN / PG_RESTORE_BIN）；
 *  - PG 不可达（可用 DRILL_PGHOST/DRILL_PGPORT/DRILL_PGUSER/DRILL_PGDATABASE 覆盖）。
 * 只要 PG 可达且脚本跑起来，任何失败都按 FAIL 报（可行动）。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as L from "./lib.mjs";

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export async function run(ctx) {
  const checks = L.createChecks();
  const backupScript = path.join(L.ROOT, "scripts", "backup-db.sh");
  checks.add("scripts/backup-db.sh 存在", existsSync(backupScript), "scripts/backup-db.sh");

  const bash = ctx.bash || L.detectBash();
  if (!bash) {
    return L.result("backup", "SKIP", {
      reason: "未找到 bash（Windows 可安装 Git Bash，或设 DRILL_BASH=<bash.exe>）",
      checks: checks.checks,
    });
  }
  checks.add("bash 可用", true, L.IS_WINDOWS ? L.toPosixPath(bash) : bash);

  const pgDump = L.findPgTool("pg_dump");
  const pgRestore = L.findPgTool("pg_restore");
  if (!pgDump || !pgRestore) {
    return L.result("backup", "SKIP", {
      reason: "未找到 pg_dump/pg_restore（设 DRILL_PG_BIN 或 PG_DUMP_BIN/PG_RESTORE_BIN；本地可用 .tools/pg）",
      checks: checks.checks,
    });
  }
  checks.add("pg_dump/pg_restore 可用", true, path.basename(pgDump) + " / " + path.basename(pgRestore));

  const conn = L.pgConn();
  if (!(await L.pgReachable(conn))) {
    return L.result("backup", "SKIP", {
      reason: "PG " + conn.host + ":" + conn.port + " 不可达（先 scripts/start_pg.ps1，或设 DRILL_PGHOST/DRILL_PGPORT）",
      checks: checks.checks,
    });
  }
  checks.add("PG 可达", true, conn.host + ":" + conn.port + "/" + conn.database);

  const workDir = L.makeTempDir("lwb-drill-backup-");
  try {
    const env = {
      PATH: L.buildBashPath([path.dirname(pgDump)]),
      PGHOST: conn.host,
      PGPORT: String(conn.port),
      PGUSER: conn.user,
      PGDATABASE: conn.database,
      BACKUP_TARGET: "local",
      BACKUP_DIR: L.toPosixPath(workDir),
      KEEP_DAYS: "1",
    };
    if (conn.password) env.PGPASSWORD = conn.password;

    L.banner("backup", "运行 scripts/backup-db.sh（target=local dir=临时目录）");
    const backupRun = L.runBash(bash, ["scripts/backup-db.sh"], { env, timeoutMs: 180000 });
    const machine = L.lastMachineLine(backupRun.stdout, /^BACKUP_OK (\S+) (\d+) ([0-9a-fA-F]{64})$/);
    checks.add(
      "backup-db.sh 输出 BACKUP_OK 机读行",
      !!machine,
      machine ? "bytes=" + machine[2] + " sha=" + machine[3].slice(0, 12) + "…" : "exit=" + backupRun.status + " " + L.tail(backupRun.stderr, 260)
    );
    if (!machine) {
      return L.result("backup", "FAIL", {
        reason: "backup-db.sh 失败（exit " + backupRun.status + "）：" + L.tail(backupRun.stderr, 300),
        checks: checks.checks,
      });
    }

    const dumps = readdirSync(workDir).filter((name) => name.endsWith(".dump"));
    checks.add("备份文件落盘", dumps.length === 1, dumps.join(", "));
    if (dumps.length !== 1) {
      return L.result("backup", "FAIL", { reason: "备份目录里 .dump 数量异常：" + dumps.length, checks: checks.checks });
    }
    const dump = path.join(workDir, dumps[0]);
    const bytes = statSync(dump).size;
    const sha = sha256File(dump);
    checks.add("字节数与 BACKUP_OK 一致", bytes === Number(machine[2]), "actual=" + bytes + " expected=" + machine[2]);
    checks.add("sha256 与 BACKUP_OK 一致", sha.toLowerCase() === machine[3].toLowerCase(), sha);
    const sidecarPath = dump + ".sha256";
    const sidecar = existsSync(sidecarPath) ? readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0].toLowerCase() : "";
    checks.add(".sha256 sidecar 一致（可离线校验）", sidecar === sha, sidecar || "缺失");

    L.banner("backup", ctx.full ? "运行 restore-drill.mjs（真实恢复，--full）" : "运行 restore-drill.mjs --dry-run");
    const restoreArgs = ctx.full ? ["--latest", workDir, "--keep"] : ["--latest", workDir, "--dry-run"];
    const restore = L.runNode("scripts/restore-drill.mjs", restoreArgs, {
      PG_RESTORE_BIN: pgRestore,
      PGHOST: conn.host,
      PGPORT: String(conn.port),
      PGUSER: conn.user,
      PGDATABASE: conn.database,
      ...(conn.password ? { PGPASSWORD: conn.password } : {}),
    });
    const restoreLine = L.lastMachineLine(restore.stdout, /^RESTORE_DRILL_OK\s+mode=(\S+).*tables=(\d+)/);
    checks.add(
      "restore-drill.mjs 通过",
      !!restoreLine,
      restoreLine ? "mode=" + restoreLine[1] + " tables=" + restoreLine[2] : "exit=" + restore.status + " " + L.tail(restore.stderr, 300)
    );
    if (!restoreLine) {
      return L.result("backup", "FAIL", {
        reason: "restore-drill 失败（exit " + restore.status + "）：" + L.tail(restore.stderr, 300),
        checks: checks.checks,
      });
    }

    return L.result("backup", "PASS", {
      reason: "备份 + sha256 + 归档可读性/恢复演练通过",
      checks: checks.checks,
      evidence: { dump: dumps[0], bytes, sha256: sha, restoreMode: restoreLine[1], tables: Number(restoreLine[2]) },
    });
  } finally {
    L.cleanupDir(workDir);
  }
}
