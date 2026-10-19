/**
 * 三类演练的共享工具（S7-2）。
 *
 * 设计目标：**一条命令、机器可读、CI 可跑**。
 *  - 不依赖 docker / 真实网络：rollback 用 PATH shim 模拟 docker/curl/sleep；
 *  - 不依赖 bash 的机器上：静态校验 + 明确 SKIP（不伪装成 PASS）；
 *  - Windows 下自动发现 Git Bash（D:\Program Files\Git\usr\bin\bash.exe 等），
 *    并把 PATH 转成 POSIX 形式（Git Bash 的 bin/bash.exe wrapper 会重排 PATH，必须用 usr/bin/bash.exe）。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const IS_WINDOWS = process.platform === "win32";

export function banner(name, message) {
  console.error("[drill:" + name + "] " + message);
}

export function tail(text, maxChars = 800) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length <= maxChars ? s : "…" + s.slice(-maxChars);
}

/** Windows 路径 → Git Bash 的 POSIX 路径（C:\a\b → /c/a/b；非 Windows 原样返回） */
export function toPosixPath(p) {
  const s = String(p || "").replace(/\\/g, "/");
  if (!IS_WINDOWS) return s;
  const m = /^([A-Za-z]):\/(.*)$/.exec(s);
  return m ? "/" + m[1].toLowerCase() + "/" + m[2] : s;
}

export function systemBashPathEntries() {
  return ["/usr/local/bin", "/usr/bin", "/bin", "/mingw64/bin"];
}

/** 把 Windows/绝对路径列表拼成 bash 可用的 PATH 值 */
export function buildBashPath(entries) {
  if (!IS_WINDOWS) {
    const existing = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    return [...entries, ...systemBashPathEntries(), ...existing].join(":");
  }
  return [...entries.map(toPosixPath), ...systemBashPathEntries()].join(":");
}

function runCapture(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15000, windowsHide: true });
    return r.status === 0 ? String(r.stdout || "").trim() : "";
  } catch {
    return "";
  }
}

function bashWorks(bashPath) {
  try {
    const r = spawnSync(bashPath, ["--version"], { encoding: "utf8", timeout: 15000, windowsHide: true });
    return r.status === 0 && /bash/i.test(String(r.stdout || ""));
  } catch {
    return false;
  }
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

/**
 * 发现可用的 bash。
 * 优先级：DRILL_BASH > PATH 中的 bash > Git for Windows 的 usr/bin/bash.exe（真实 bash，不重排 PATH）> bin/bash.exe。
 */
export function detectBash() {
  const fromEnv = (process.env.DRILL_BASH || "").trim();
  if (fromEnv && existsSync(fromEnv) && bashWorks(fromEnv)) return fromEnv;
  if (!IS_WINDOWS) {
    for (const candidate of ["bash", "/bin/bash", "/usr/bin/bash"]) {
      if (candidate === "bash" || existsSync(candidate)) {
        if (bashWorks(candidate)) return candidate;
      }
    }
    return null;
  }
  const candidates = [];
  const gitExec = runCapture("git", ["--exec-path"]);
  if (gitExec) {
    const gitRoot = path.resolve(gitExec, "../../..");
    candidates.push(path.join(gitRoot, "usr", "bin", "bash.exe"), path.join(gitRoot, "bin", "bash.exe"));
  }
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.ProgramW6432];
  for (const root of roots) {
    if (!root) continue;
    candidates.push(path.join(root, "Git", "usr", "bin", "bash.exe"), path.join(root, "Git", "bin", "bash.exe"));
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(process.env.LOCALAPPDATA, "Programs", "Git", "usr", "bin", "bash.exe"),
      path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe")
    );
  }
  candidates.push("C:\\Program Files\\Git\\usr\\bin\\bash.exe", "D:\\Program Files\\Git\\usr\\bin\\bash.exe");
  for (const candidate of unique(candidates)) {
    if (existsSync(candidate) && bashWorks(candidate)) return candidate;
  }
  return null;
}

/** 运行 bash（cwd=仓库根；env 需由调用方给全） */
export function runBash(bash, args, options = {}) {
  const r = spawnSync(bash, args, {
    cwd: ROOT,
    env: options.env || process.env,
    encoding: "utf8",
    timeout: options.timeoutMs || 180000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: r.status,
    timedOut: r.error && r.error.code === "ETIMEDOUT" ? true : false,
    stdout: String(r.stdout || ""),
    stderr: String(r.stderr || ""),
    error: r.error ? String(r.error.message) : null,
  };
}

/**
 * 异步运行 node 脚本（不阻塞父进程）
 *
 * 为什么需要：alert 演练要在**父进程内**起临时 webhook 服务；spawnSync 会阻塞事件循环，
 * 子进程的 HTTP 请求永远等不到父进程 accept（5s 后 abort）。webhook 分支必须用本函数。
 */
export function runNodeAsync(scriptRelPath, args = [], env = {}, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, scriptRelPath), ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, options.timeoutMs || 180000);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish({ status: null, stdout, stderr, error: String(error.message) }));
    child.on("close", (status, signal) => finish({ status, signal, stdout, stderr, error: null }));
  });
}

/** 运行 node 脚本（跨平台，用当前 node 可执行文件） */
export function runNode(scriptRelPath, args = [], env = {}, options = {}) {
  const r = spawnSync(process.execPath, [path.join(ROOT, scriptRelPath), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: options.timeoutMs || 180000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: r.status,
    timedOut: r.error && r.error.code === "ETIMEDOUT" ? true : false,
    stdout: String(r.stdout || ""),
    stderr: String(r.stderr || ""),
    error: r.error ? String(r.error.message) : null,
  };
}

export function findOnPath(name) {
  if (IS_WINDOWS) {
    const out = runCapture("where", [name]);
    return out ? out.split(/\r?\n/)[0].trim() : null;
  }
  const out = runCapture("sh", ["-c", "command -v " + name]);
  return out ? out.split(/\r?\n/)[0].trim() : null;
}

/** 找 pg 工具：显式 env > 仓库 .tools/pg（本机 conda 环境）> PATH */
export function findPgTool(name) {
  const envSpecific = (name === "pg_dump" ? process.env.PG_DUMP_BIN || process.env.DRILL_PG_DUMP : process.env.PG_RESTORE_BIN || process.env.DRILL_PG_RESTORE) || "";
  const explicit = (process.env.DRILL_PG_BIN || "").trim();
  const candidates = [];
  if (envSpecific) candidates.push(envSpecific);
  if (explicit) candidates.push(path.join(explicit, name + (IS_WINDOWS ? ".exe" : "")));
  candidates.push(path.join(ROOT, ".tools", "pg", "Library", "bin", name + (IS_WINDOWS ? ".exe" : "")));
  const onPath = findOnPath(name);
  if (onPath) candidates.push(onPath);
  for (const c of unique(candidates)) if (existsSync(c)) return c;
  return null;
}

export function pgConn() {
  return {
    host: process.env.DRILL_PGHOST || process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.DRILL_PGPORT || process.env.PGPORT || 5432),
    user: process.env.DRILL_PGUSER || process.env.PGUSER || "postgres",
    password: process.env.DRILL_PGPASSWORD || process.env.PGPASSWORD || "",
    database: process.env.DRILL_PGDATABASE || process.env.PGDATABASE || "Learn-Workbench",
    adminDatabase: process.env.DRILL_PG_ADMIN_DB || "postgres",
  };
}

export function pgReachable(conn, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: conn.host, port: conn.port });
    const done = (ok) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export function makeTempDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function cleanupDir(dir) {
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // 清理失败不影响演练结论
  }
}

export function writeFile(dir, name, content) {
  const file = path.join(dir, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** 静态断言收集器 */
export function createChecks() {
  const checks = [];
  return {
    checks,
    add(name, ok, detail) {
      checks.push({ name, ok: !!ok, detail: detail ? String(detail) : "" });
      return !!ok;
    },
    allOk() {
      return checks.every((c) => c.ok);
    },
    failed() {
      return checks.filter((c) => !c.ok);
    },
    passed() {
      return checks.filter((c) => c.ok);
    },
  };
}

/** 从多行 stdout 里取最后一条匹配机读行（返回匹配组或 null） */
export function lastMachineLine(stdout, regex) {
  const lines = String(stdout || "").split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = regex.exec(lines[i].trim());
    if (m) return m;
  }
  return null;
}

export function result(name, status, data = {}) {
  return { name, status, ...data };
}
