/**
 * rollback 演练（S7-2）：静态合同校验 + PATH shim 动态双路径（成功/失败）。
 *
 * 为什么用 shim 而不是真 docker：演练要能在 CI/开发机（无 docker）跑；
 * shim 只实现 docker/curl/sleep 的最小行为，用来验证**脚本自己的控制流**：
 * 本地镜像优先 → GHCR 兜底 → --no-build 切换 → 健康检查循环 → 失败 exit 1。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as L from "./lib.mjs";

const ROLLBACK = "deploy/host/rollback-web.sh";
const PULL_UP = "deploy/host/pull-and-up.sh";

const DOCKER_SHIM = [
  "#!/usr/bin/env bash",
  'echo "docker $*" >> "$DRILL_SHIM_LOG"',
  'case "$1 $2" in',
  '  "image inspect") if [ "$DRILL_SHIM_IMAGE" = "local" ]; then exit 0; fi; exit 1 ;;',
  '  "pull "*) exit 0 ;;',
  '  "compose "*) exit 0 ;;',
  "  *) exit 0 ;;",
  "esac",
  "",
].join("\n");

const CURL_SHIM = [
  "#!/usr/bin/env bash",
  'echo "curl $*" >> "$DRILL_SHIM_LOG"',
  'printf "%s" "${DRILL_SHIM_CURL_CODE:-200}"',
  "",
].join("\n");

const SLEEP_SHIM = ["#!/usr/bin/env bash", "exit 0", ""].join("\n");

function readScript(rel) {
  const abs = path.join(L.ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

function staticChecks(checks, bash) {
  const rollback = readScript(ROLLBACK);
  const pullUp = readScript(PULL_UP);
  checks.add(ROLLBACK + " 存在", rollback.length > 0, ROLLBACK);
  checks.add(PULL_UP + " 存在", pullUp.length > 0, PULL_UP);
  if (bash) {
    for (const rel of [ROLLBACK, PULL_UP]) {
      const r = L.runBash(bash, ["-n", rel], { env: { PATH: L.buildBashPath([]) } });
      checks.add("bash -n " + path.basename(rel), r.status === 0, r.status === 0 ? "syntax ok" : L.tail(r.stderr, 200));
    }
  } else {
    checks.add("bash -n 语法检查", true, "SKIP：本机无 bash（静态文本断言仍然执行）");
  }
  checks.add("rollback 本地镜像优先于 GHCR", rollback.indexOf('docker image inspect "$LOCAL_REF"') >= 0 && rollback.indexOf("GHCR_REF") > rollback.indexOf("LOCAL_REF"), "先 inspect LOCAL_REF，再 GHCR");
  checks.add("rollback 使用 --no-build 切换", /up -d --no-build web/.test(rollback), "docker compose ... up -d --no-build web");
  checks.add("rollback 有健康检查循环", /\/api\/health/.test(rollback) && /for i in \$\(seq 1 30\)/.test(rollback), "30 × 2s");
  checks.add("rollback 健康检查失败 exit 1", /exit 1/.test(rollback), "失败路径明确非 0");
  checks.add("pull-and-up 先拉镜像", /pull web/.test(pullUp), "compose pull web");
  checks.add("pull-and-up 容器内跑迁移", /run --rm -T web node \/app\/scripts\/migrate\.mjs/.test(pullUp), "scripts/migrate.mjs");
  checks.add("pull-and-up --no-build 切换", /up -d --no-build web/.test(pullUp), "docker compose ... up -d --no-build web");
  checks.add("pull-and-up 有健康检查循环", /\/api\/health/.test(pullUp) && /for i in \$\(seq 1 30\)/.test(pullUp), "30 × 2s");
  checks.add("pull-and-up 健康检查失败 exit 1", /exit 1/.test(pullUp), "失败路径明确非 0");
}

function makeShims(bash, dir) {
  L.writeFile(dir, "docker", DOCKER_SHIM);
  L.writeFile(dir, "curl", CURL_SHIM);
  L.writeFile(dir, "sleep", SLEEP_SHIM);
  const posixDir = L.toPosixPath(dir);
  const chmod = L.runBash(bash, ["-c", "chmod +x '" + posixDir + "'/*"], { env: { PATH: L.buildBashPath([]) } });
  if (chmod.status !== 0) throw new Error("chmod shim 失败：" + L.tail(chmod.stderr, 200));
}

function runWithShims(bash, shimDir, scriptRel, args, opts) {
  const logFile = path.join(shimDir, "calls.log");
  writeFileSync(logFile, "");
  const env = {
    PATH: L.buildBashPath([shimDir]),
    DRILL_SHIM_LOG: L.toPosixPath(logFile),
    DRILL_SHIM_IMAGE: opts.image || "local",
    DRILL_SHIM_CURL_CODE: opts.curlCode || "200",
    ...(opts.env || {}),
  };
  const r = L.runBash(bash, [scriptRel, ...args], { env, timeoutMs: 60000 });
  const calls = readFileSync(logFile, "utf8").split(/\r?\n/).filter(Boolean);
  return { ...r, calls, output: r.stdout + r.stderr };
}

export async function run(ctx) {
  const checks = L.createChecks();
  const bash = ctx.bash || L.detectBash();
  staticChecks(checks, bash);

  if (!bash) {
    const ok = checks.allOk();
    return L.result("rollback", ok ? "SKIP" : "FAIL", {
      reason: ok ? "静态校验通过，但本机无 bash，无法执行 shim 动态演练（设 DRILL_BASH 或装 Git Bash/WSL）" : "静态校验未通过",
      checks: checks.checks,
    });
  }

  const shimDir = L.makeTempDir("lwb-drill-rollback-");
  try {
    makeShims(bash, shimDir);

    const okLocal = runWithShims(bash, shimDir, ROLLBACK, ["drill-tag"], { image: "local", curlCode: "200" });
    checks.add("成功路径：本地镜像 + 健康检查 200 → exit 0", okLocal.status === 0, "exit=" + okLocal.status + " " + L.tail(okLocal.stderr, 160));
    checks.add("成功路径：选择本地镜像", okLocal.output.includes("learn-workbench-web:drill-tag"), "");
    checks.add("成功路径：--no-build 出现在 compose 调用里", okLocal.calls.some((line) => line.includes("up -d --no-build web")), "");
    checks.add("成功路径：健康检查通过日志", /健康检查通过/.test(okLocal.output), "");
    checks.add("成功路径：不触发 GHCR pull", !okLocal.calls.some((line) => line.startsWith("docker pull ")), "");

    const healthFail = runWithShims(bash, shimDir, ROLLBACK, ["drill-tag"], { image: "local", curlCode: "503" });
    checks.add("失败路径：健康检查 503 → exit 1", healthFail.status === 1, "exit=" + healthFail.status);
    checks.add("失败路径：明确报 30 次未通过", /30 次健康检查未通过/.test(healthFail.output), "");
    const curlCalls = healthFail.calls.filter((line) => line.startsWith("curl ")).length;
    checks.add("失败路径：健康检查确实循环 30 次", curlCalls === 30, "curl_calls=" + curlCalls);

    const pullPath = runWithShims(bash, shimDir, ROLLBACK, ["drill-tag"], { image: "none", curlCode: "200" });
    checks.add("兜底路径：本地无镜像 → GHCR pull → exit 0", pullPath.status === 0, "exit=" + pullPath.status + " " + L.tail(pullPath.stderr, 160));
    checks.add("兜底路径：确实执行了 docker pull", pullPath.calls.some((line) => line.startsWith("docker pull ghcr.io/")), "");
    checks.add("兜底路径：最终使用 GHCR 镜像", /使用镜像:\s*ghcr\.io\//.test(pullPath.output), "");

    const skipPull = runWithShims(bash, shimDir, ROLLBACK, ["drill-tag", "--skip-pull"], { image: "none", curlCode: "200" });
    checks.add("--skip-pull 无本地镜像 → exit 1", skipPull.status === 1, "exit=" + skipPull.status);
    checks.add("--skip-pull 报错文案明确", /且指定了 --skip-pull/.test(skipPull.output), "");

    const pullUpOk = runWithShims(bash, shimDir, PULL_UP, [], {
      image: "none",
      curlCode: "200",
      env: { WEB_IMAGE: "ghcr.io/ciyu031003/learn-workbench-web:drill-tag" },
    });
    checks.add("pull-and-up 成功路径 exit 0", pullUpOk.status === 0, "exit=" + pullUpOk.status + " " + L.tail(pullUpOk.stderr, 160));
    checks.add("pull-and-up 执行 pull web", pullUpOk.calls.some((line) => /compose .*pull web/.test(line)), "");
    checks.add("pull-and-up 执行容器内迁移", pullUpOk.calls.some((line) => /run --rm -T web node \/app\/scripts\/migrate\.mjs/.test(line)), "");
    checks.add("pull-and-up 执行 --no-build 切换", pullUpOk.calls.some((line) => line.includes("up -d --no-build web")), "");

    const pullUpFail = runWithShims(bash, shimDir, PULL_UP, [], {
      image: "none",
      curlCode: "503",
      env: { WEB_IMAGE: "ghcr.io/ciyu031003/learn-workbench-web:drill-tag" },
    });
    checks.add("pull-and-up 健康检查失败 exit 1", pullUpFail.status === 1, "exit=" + pullUpFail.status);
    checks.add("pull-and-up 失败文案", /健康检查未通过/.test(pullUpFail.output), "");

    return L.result("rollback", checks.allOk() ? "PASS" : "FAIL", {
      reason: checks.allOk() ? "静态合同 + shim 双路径（成功/失败/兜底/--skip-pull/pull-and-up）全部通过" : "存在未通过检查项：" + checks.failed().map((c) => c.name).join("；"),
      checks: checks.checks,
    });
  } finally {
    L.cleanupDir(shimDir);
  }
}
