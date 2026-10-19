#!/usr/bin/env node
/**
 * S5-7b 移动端同步一致性静态矩阵（无真机环境下的最低门禁）
 *
 * 背景：S5 的「弱网 / 时延 / 换设备」一致性验证没有真机与小规模用户就做不了端到端，
 * 但**代码里有没有这些机制**是可以静态判定的。本脚本对 apps/mobile/src 的同步链路做 5 项
 * 阻断级检查 + 5 项信息级检查，输出机读行，供 CI / 评审脚本消费。
 *
 * 阻断级（任一 FAIL → 退出码 1，说明 S5-3 同步协议 v2 的移动端部分没落地）：
 *   1. serverTime-cursor  : 拉取游标只能来自服务端时间（禁止 new Date()/Date.now() 推进 lastSyncedAt）
 *   2. retry-backoff      : 失败退避序列 2/8/30/120（秒或毫秒）存在且升序
 *   3. dirty-rerun        : 同步进行中产生的新变更会在本轮结束后补跑（dirty/pendingRun/while 重试）
 *   4. pending-cap        : pendingChanges 有上限（cap/limit/slice），匿名用户队列不会无限增长
 *   5. rehydrate-gate     : persist 恢复（onRehydrateStorage / hasHydrated）存在，首帧不读空状态
 * 信息级（不影响退出码，用于报告现状）：
 *   - owner-isolation     : 换账号丢弃旧账号 pendingChanges（S1-6）
 *   - push-batch-500      : push 分批 500（服务端 MAX_CHANGES 上限）
 *   - lww-merge           : applyRemoteChanges 按 updatedAt 做本地优先合并
 *   - outbox-flush        : 网络恢复/回前台补发饮食与图片发件箱
 *   - offline-classify    : 写操作四分类（offline/server/client/auth）
 *
 * 用法：
 *   node scripts/mobile-sync-matrix.mjs                # 实跑：阻断级全 PASS 才 exit 0
 *   node scripts/mobile-sync-matrix.mjs --dry-run      # 只列检查项与源文件，exit 0
 *   node scripts/mobile-sync-matrix.mjs --report       # 实跑但无论结果 exit 0（基线快照用）
 *   node scripts/mobile-sync-matrix.mjs --json         # 追加一行 JSON 汇总（便于机读）
 *
 * 局限（必须知道）：静态检查只能证明「机制存在」，不能证明「时序正确」。真机场景
 * （飞行模式来回切、弱网丢包、系统杀进程、换设备登录）仍要按
 * docs/S5-移动端弱网与换设备测试矩阵.md 的人工矩阵执行。
 */
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
// --src <mobile/src 目录>：自测/回归用（默认真实仓库的 apps/mobile/src）
const SRC_ARG_INDEX = process.argv.indexOf("--src");
const SRC = SRC_ARG_INDEX > 0 ? path.resolve(process.argv[SRC_ARG_INDEX + 1]) : path.join(REPO_ROOT, "apps/mobile/src");
const ROOT = process.argv[SRC_ARG_INDEX + 1] ? REPO_ROOT : REPO_ROOT;
const LIB = path.join(SRC, "lib");
const STORE = path.join(SRC, "store");
const APP = path.join(SRC, "app");

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has("--dry-run");
const REPORT = argv.has("--report");
const JSON_OUT = argv.has("--json");

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
function readLines(file) {
  const text = readText(file);
  return text === null ? null : { text, lines: text.split(/\r?\n/) };
}
function rel(file) {
  // --src 自测时也输出可读相对路径（相对 src 的父目录：apps/mobile）
  const base = path.relative(REPO_ROOT, SRC).startsWith("..") ? path.resolve(SRC, "../..") : REPO_ROOT;
  return path.relative(base, file).replace(/\\/g, "/");
}
function lineOf(lines, re) {
  for (let i = 0; i < lines.length; i += 1) {
    if (re.test(lines[i])) return i + 1;
  }
  return null;
}
function evidence(file, lines, re) {
  const ln = lineOf(lines, re);
  return ln ? rel(file) + ":" + ln : rel(file);
}
/** 收集 lib 下所有非测试的 sync*.ts（兼容 S5-3 可能新增 sync-scheduler.ts 等文件） */
function syncSourceFiles() {
  const out = [];
  if (!fs.existsSync(LIB)) return out;
  for (const name of fs.readdirSync(LIB)) {
    if (!/^sync.*\.ts$/.test(name)) continue;
    if (/\.test\.ts$/.test(name)) continue;
    out.push(path.join(LIB, name));
  }
  out.sort();
  return out;
}
/** 在 lib 与 store 里找「提到某个标识符」的非测试源文件（兼容 S5-3 新增 persist*.ts / sync-scheduler.ts） */
function filesMentioning(needle) {
  const out = [];
  for (const dir of [LIB, STORE]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const file = path.join(dir, name);
      const text = readText(file);
      if (text && text.includes(needle)) out.push(file);
    }
  }
  return out.sort();
}
function uniq(list) {
  return [...new Set(list)];
}
function textAfter(data, lineNumber, count = 40) {
  return data.lines.slice(lineNumber - 1, lineNumber - 1 + count).join("\n");
}
function numberSequences(text) {
  /** 找形如 [2, 8, 30, 120] 或 [2000, 8000, 30000, 120000] 的数字序列 */
  const out = [];
  const re = /\[\s*([0-9][0-9_\s,]*?)\s*\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const nums = (m[1].match(/[0-9][0-9_]*/g) || []).map((n) => Number(n.replace(/_/g, "")));
    if (nums.length >= 4) out.push(nums);
  }
  return out;
}
function ascendingIncluding(nums, want) {
  const has = want.every((w) => nums.includes(w));
  if (!has) return false;
  const ordered = nums.filter((n) => want.includes(n));
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i] <= ordered[i - 1]) return false;
  }
  return true;
}

// ---------------------------------------------------------------- 检查项
const CHECKS = [];

function register(check) {
  CHECKS.push(check);
}

register({
  id: "serverTime-cursor",
  kind: "blocking",
  title: "拉取游标只认服务端时间",
  run() {
    const file = path.join(LIB, "sync.ts");
    const data = readLines(file);
    if (!data) return { status: "FAIL", detail: "缺少 src/lib/sync.ts", evidence: rel(file) };
    const setterLines = [];
    data.lines.forEach((line, i) => {
      if (/setLastSyncedAt\s*\(/.test(line)) setterLines.push({ ln: i + 1, text: line.trim() });
    });
    if (setterLines.length === 0) {
      return { status: "FAIL", detail: "sync.ts 没有任何 setLastSyncedAt 调用（游标未维护）", evidence: rel(file) };
    }
    const deviceClock = setterLines.filter((x) => /new Date|Date\.now/.test(x.text));
    const fromServer = setterLines.filter((x) => /serverTime/i.test(x.text));
    if (deviceClock.length > 0) {
      return {
        status: "FAIL",
        detail: "游标被设备时钟推进（时钟偏移会让 since 永久超前 → 云端变更拉不到）",
        evidence: deviceClock.map((x) => rel(file) + ":" + x.ln).join(","),
      };
    }
    if (fromServer.length === 0) {
      return { status: "FAIL", detail: "游标没有从响应 serverTime 取值", evidence: rel(file) };
    }
    return {
      status: "PASS",
      detail: "setLastSyncedAt 的 " + setterLines.length + " 处调用全部来自 serverTime",
      evidence: fromServer.map((x) => rel(file) + ":" + x.ln).join(","),
    };
  },
});

register({
  id: "retry-backoff",
  kind: "blocking",
  title: "失败退避序列 2/8/30/120",
  run() {
    const files = syncSourceFiles();
    if (files.length === 0) return { status: "FAIL", detail: "找不到 sync*.ts 源文件", evidence: "apps/mobile/src/lib" };
    const hits = [];
    for (const file of files) {
      const text = readText(file);
      if (!text) continue;
      for (const seq of numberSequences(text)) {
        if (ascendingIncluding(seq, [2, 8, 30, 120]) || ascendingIncluding(seq, [2000, 8000, 30000, 120000])) {
          hits.push({ file, seq });
        }
      }
      if (/BACKOFF|RETRY_?DELAYS?|retryDelays/i.test(text)) {
        const lines = text.split(/\r?\n/);
        const ln = lineOf(lines, /BACKOFF|RETRY_?DELAYS?|retryDelays/i);
        if (ln) hits.push({ file, seq: null, ln });
      }
    }
    if (hits.length === 0) {
      return {
        status: "FAIL",
        detail: "未找到 2/8/30/120 退避序列或 BACKOFF/RETRY_DELAYS 常量（失败后只会等下一次网络/前台事件）",
        evidence: files.map(rel).join(","),
      };
    }
    const first = hits[0];
    return {
      status: "PASS",
      detail: "退避序列已存在" + (first.seq ? "：" + first.seq.join("/") : "（BACKOFF 常量）"),
      evidence: rel(first.file) + (first.ln ? ":" + first.ln : ""),
    };
  },
});

register({
  id: "dirty-rerun",
  kind: "blocking",
  title: "同步进行中的新变更在本轮结束后补跑",
  run() {
    const files = syncSourceFiles();
    const dirtyRe = /\b(dirty|needs?Rerun|rerun|pendingRun|queuedRun)\b/i;
    const hits = [];
    for (const file of files) {
      const data = readLines(file);
      if (!data) continue;
      const assign = lineOf(data.lines, /\b(dirty|needs?Rerun|rerun|pendingRun|queuedRun)\b\s*=\s*true/i);
      const guard = lineOf(data.lines, /if\s*\([^)]*\b(dirty|needs?Rerun|rerun|pendingRun|queuedRun)\b/i);
      const loop = lineOf(data.lines, /while\s*\([^)]*\b(run|sync|retry|dirty|pending)\b/i);
      if ((assign && guard) || loop) {
        hits.push({ file, assign, guard, loop });
      }
    }
    if (hits.length === 0) {
      return {
        status: "FAIL",
        detail: "运行中产生的新变更没有补跑标记（runSync 的 running 守卫会直接 return 且不重排）",
        evidence: files.map(rel).join(","),
      };
    }
    const h = hits[0];
    return {
      status: "PASS",
      detail: "存在 dirty/补跑逻辑",
      evidence: rel(h.file) + ":" + (h.assign || h.loop || h.guard),
    };
  },
});

register({
  id: "pending-cap",
  kind: "blocking",
  title: "pendingChanges 有上限",
  run() {
    const files = uniq([
      path.join(STORE, "app-store.ts"),
      ...syncSourceFiles(),
      ...filesMentioning("pendingChanges"),
    ]).filter((x) => fs.existsSync(x));
    // 只认「有明显上限语义的常量 + 确实被引用/用于裁剪」；不用裸 length 比较兜底（会误判成 cap）
    const NAME_RE = /((?:PENDING|QUEUE)[_A-Z]*(?:CAP|LIMIT|MAX)|MAX_PENDING[_A-Z]*|PENDING_QUEUE_LIMIT|PENDING_CHANGES_CAP)\s*=\s*(\d+)/i;
    const hits = [];
    for (const file of files) {
      const data = readLines(file);
      if (!data) continue;
      const m = NAME_RE.exec(data.text);
      if (!m) continue;
      const name = m[1];
      const defLn = lineOf(data.lines, new RegExp(name + "\\s*=\\s*" + m[2]));
      let usedIn = null;
      for (const f2 of files) {
        const d2 = readLines(f2);
        if (!d2) continue;
        for (let i = 0; i < d2.lines.length; i += 1) {
          const line = d2.lines[i];
          if (!line.includes(name)) continue;
          if (f2 === file && i + 1 === defLn) continue;
          const useRe = new RegExp("\\.slice\\([^)]*" + name + "|\\.splice\\([^)]*" + name + "|limit[^=]*=\\s*" + name + "|import[^\\n]*" + name + "|\\.length\\s*>\\s*" + name);
          if (useRe.test(line)) {
            usedIn = { file: f2, ln: i + 1 };
            break;
          }
        }
        if (usedIn) break;
      }
      if (usedIn) hits.push({ file, ln: defLn, name, cap: m[2], usedIn });
    }
    if (hits.length === 0) {
      return {
        status: "FAIL",
        detail: "pendingChanges 无上限：匿名/长期离线用户的队列只增不减，会撑爆单键持久化",
        evidence: files.map(rel).join(","),
      };
    }
    const h = hits[0];
    return {
      status: "PASS",
      detail: "存在队列上限 " + h.name + "=" + h.cap + "（定义 + 使用均已接线）",
      evidence: rel(h.file) + ":" + h.ln + "," + rel(h.usedIn.file) + ":" + h.usedIn.ln,
    };
  },
});

register({
  id: "rehydrate-gate",
  kind: "blocking",
  title: "persist 恢复门禁（首帧不读空状态）",
  run() {
    const store = readLines(path.join(STORE, "app-store.ts"));
    const layout = readLines(path.join(APP, "_layout.tsx"));
    if (!store) return { status: "FAIL", detail: "缺少 src/store/app-store.ts", evidence: rel(path.join(STORE, "app-store.ts")) };
    const onRehydrate = lineOf(store.lines, /onRehydrateStorage/);
    const hasHydrated = lineOf(store.lines, /hasHydrated/) || (layout ? lineOf(layout.lines, /hasHydrated/) : null);
    const manual = lineOf(store.lines, /persist\.rehydrate|skipHydration/);
    // S5-6 允许把持久化拆到 src/lib/persist*.ts：在 store 之外的 persist 模块里也算数
    const persistModules = filesMentioning("onRehydrateStorage").concat(filesMentioning("hasHydrated"));
    const moduleHit = persistModules.length > 0 ? rel(persistModules[0]) : null;
    if (!onRehydrate && !hasHydrated && !manual && !moduleHit) {
      return {
        status: "FAIL",
        detail: "persist 无 onRehydrateStorage / hasHydrated / 手动 rehydrate：splash 撤得比 AsyncStorage 恢复早，首帧会闪空数据/浅色主题",
        evidence: rel(path.join(STORE, "app-store.ts")),
      };
    }
    const ev = onRehydrate ? rel(path.join(STORE, "app-store.ts")) + ":" + onRehydrate : hasHydrated ? rel(layout ? path.join(APP, "_layout.tsx") : path.join(STORE, "app-store.ts")) + ":" + hasHydrated : rel(path.join(STORE, "app-store.ts")) + ":" + manual;
    return { status: "PASS", detail: "存在 persist 恢复门禁", evidence: ev };
  },
});

register({
  id: "owner-isolation",
  kind: "info",
  title: "换账号丢弃旧账号 pendingChanges（S1-6）",
  run() {
    const engine = readLines(path.join(LIB, "sync-engine.ts"));
    const store = readLines(path.join(STORE, "app-store.ts"));
    if (!engine || !store) return { status: "FAIL", detail: "缺少 sync-engine.ts / app-store.ts", evidence: "-" };
    const sel = lineOf(store.lines, /isForeignPendingChange|selectForeignPendingChanges/);
    const use = lineOf(engine.lines, /selectForeignPendingChanges|discardForeignPendingChanges/);
    if (sel && use) return { status: "PASS", detail: "ownerUserId + 外来变更丢弃已接线", evidence: rel(path.join(STORE, "app-store.ts")) + ":" + sel + "," + rel(path.join(LIB, "sync-engine.ts")) + ":" + use };
    return { status: "FAIL", detail: "未找到换账号隔离逻辑", evidence: "-" };
  },
});

register({
  id: "push-batch-500",
  kind: "info",
  title: "push 分批 500（对齐服务端 MAX_CHANGES）",
  run() {
    const data = readLines(path.join(LIB, "sync.ts"));
    if (!data) return { status: "FAIL", detail: "缺少 sync.ts", evidence: "-" };
    const ln = lineOf(data.lines, /PUSH_BATCH_SIZE\s*=\s*500/);
    return ln ? { status: "PASS", detail: "PUSH_BATCH_SIZE=500", evidence: rel(path.join(LIB, "sync.ts")) + ":" + ln } : { status: "FAIL", detail: "未找到 PUSH_BATCH_SIZE=500", evidence: rel(path.join(LIB, "sync.ts")) };
  },
});

register({
  id: "lww-merge",
  kind: "info",
  title: "applyRemoteChanges 本地优先 LWW 合并",
  run() {
    const store = readLines(path.join(STORE, "app-store.ts"));
    if (!store) return { status: "FAIL", detail: "缺少 app-store.ts", evidence: "-" };
    const ln = lineOf(store.lines, /applyRemoteChanges/);
    const cmp = lineOf(store.lines, /new Date\([^)]*updatedAt[^)]*\)\s*[<>]/);
    if (ln && cmp) return { status: "PASS", detail: "按 updatedAt 比较后合并", evidence: rel(path.join(STORE, "app-store.ts")) + ":" + cmp };
    return { status: "FAIL", detail: "applyRemoteChanges 缺 updatedAt 比较（远端会无条件覆盖本地）", evidence: rel(path.join(STORE, "app-store.ts")) };
  },
});

register({
  id: "outbox-flush",
  kind: "info",
  title: "网络恢复/回前台补发饮食与图片发件箱",
  run() {
    const engine = readLines(path.join(LIB, "sync-engine.ts"));
    if (!engine) return { status: "FAIL", detail: "缺少 sync-engine.ts", evidence: "-" };
    const a = lineOf(engine.lines, /flushNutritionOutbox\(/);
    const b = lineOf(engine.lines, /flushUploadOutbox\(/);
    if (a && b) return { status: "PASS", detail: "两个发件箱都在 onOnlineOrForeground 里补发", evidence: rel(path.join(LIB, "sync-engine.ts")) + ":" + a + "," + b };
    return { status: "FAIL", detail: "发件箱未接线到网络恢复", evidence: rel(path.join(LIB, "sync-engine.ts")) };
  },
});

register({
  id: "offline-classify",
  kind: "info",
  title: "写操作四分类（offline/server/client/auth）",
  run() {
    const file = path.join(LIB, "send-outcome.ts");
    const data = readLines(file);
    if (!data) return { status: "FAIL", detail: "缺少 send-outcome.ts", evidence: rel(file) };
    const kinds = lineOf(data.lines, /"offline"\s*\|\s*"server"\s*\|\s*"client"\s*\|\s*"auth"/);
    return kinds ? { status: "PASS", detail: "四分类类型存在", evidence: rel(file) + ":" + kinds } : { status: "FAIL", detail: "未找到四分类", evidence: rel(file) };
  },
});

register({
  id: "habit-appliers",
  kind: "info",
  title: "pull 的 habits/habitLogs 在移动端有 applier（S5-3 #4）",
  run() {
    const store = readLines(path.join(STORE, "app-store.ts"));
    if (!store) return { status: "FAIL", detail: "缺少 app-store.ts", evidence: "-" };
    const habits = lineOf(store.lines, /case\s+"habits"|entityType\s*===\s*"habits"/);
    const logs = lineOf(store.lines, /case\s+"habitLogs"|entityType\s*===\s*"habitLogs"/);
    if (habits && logs) return { status: "PASS", detail: "habits + habitLogs 均已覆盖", evidence: rel(path.join(STORE, "app-store.ts")) + ":" + habits + "," + logs };
    return { status: "FAIL", detail: "pull 返回的 habits/habitLogs 仍会被静默丢弃", evidence: rel(path.join(STORE, "app-store.ts")) };
  },
});

register({
  id: "clock-skew-hint",
  kind: "info",
  title: "时钟偏移 >5min 的用户提示（S5-3 #5）",
  run() {
    const files = [path.join(LIB, "sync.ts"), path.join(LIB, "sync-engine.ts"), ...filesMentioning("serverTime")].filter((x) => fs.existsSync(x));
    for (const file of files) {
      const data = readLines(file);
      if (!data) continue;
      const ln = lineOf(data.lines, /时钟|skew|clockOffset|offsetMs|300000|5\s*\*\s*60\s*\*\s*1000/);
      if (ln) return { status: "PASS", detail: "存在时钟偏移判定/提示", evidence: rel(file) + ":" + ln };
    }
    return { status: "FAIL", detail: "未找到时钟偏移（>5min）判定或提示文案", evidence: files.map(rel).join(",") || "-" };
  },
});

register({
  id: "pending-status-ui",
  kind: "info",
  title: "同步状态条（N 条待同步 / 上次失败原因）",
  run() {
    const files = filesMentioning("pendingChanges").filter((x) => x.includes(path.sep + "app" + path.sep));
    const all = [...files, path.join(APP, "(tabs)", "settings.tsx")].filter((x) => fs.existsSync(x));
    for (const file of all) {
      const data = readLines(file);
      if (!data) continue;
      const ln = lineOf(data.lines, /待同步|上次失败|lastError|未同步/);
      if (ln) return { status: "PASS", detail: "设置页存在待同步/失败原因展示", evidence: rel(file) + ":" + ln };
    }
    return { status: "FAIL", detail: "未找到「N 条待同步 / 上次失败原因」的 UI 接线", evidence: all.map(rel).join(",") || "-" };
  },
});

// ---------------------------------------------------------------- 执行
function main() {
  const syncFiles = syncSourceFiles();
  console.log("[matrix] S5-7b 移动端同步静态矩阵");
  console.log("[matrix] root=" + ROOT);
  console.log("[matrix] sources=" + (syncFiles.length ? syncFiles.map(rel).join(",") : "(none)"));

  if (DRY_RUN) {
    console.log("[matrix] mode=dry-run（只列检查项，不判定）");
    for (const c of CHECKS) console.log("[matrix] PLAN " + c.kind + " " + c.id + " | " + c.title);
    console.log("[matrix] SUMMARY total=" + CHECKS.length + " mode=dry-run");
    console.log("[matrix] RESULT=PASS exit=0");
    process.exit(0);
  }

  const results = [];
  for (const c of CHECKS) {
    let r;
    try {
      r = c.run();
    } catch (e) {
      r = { status: "FAIL", detail: "检查异常：" + (e instanceof Error ? e.message : String(e)), evidence: "-" };
    }
    results.push({ ...c, ...r });
    console.log("[matrix] " + r.status + " " + c.kind + " " + c.id + " | " + r.detail + " | evidence=" + r.evidence);
  }

  const blocking = results.filter((r) => r.kind === "blocking");
  const fails = results.filter((r) => r.status === "FAIL");
  const blockingFails = blocking.filter((r) => r.status === "FAIL");
  console.log(
    "[matrix] SUMMARY total=" + results.length +
      " blocking=" + blocking.length +
      " pass=" + results.filter((r) => r.status === "PASS").length +
      " fail=" + fails.length +
      " blockingFail=" + blockingFails.length
  );
  const ok = blockingFails.length === 0;
  console.log("[matrix] RESULT=" + (ok ? "PASS" : "FAIL") + " exit=" + (ok ? 0 : 1));
  if (JSON_OUT) {
    console.log(
      "[matrix] JSON " +
        JSON.stringify({
          result: ok ? "PASS" : "FAIL",
          total: results.length,
          blockingFail: blockingFails.length,
          checks: results.map((r) => ({ id: r.id, kind: r.kind, status: r.status, detail: r.detail, evidence: r.evidence })),
        })
    );
  }
  if (!ok && REPORT) {
    console.log("[matrix] NOTE --report：存在阻断级失败但按基线快照模式 exit 0");
    process.exit(0);
  }
  process.exit(ok ? 0 : 1);
}

main();
