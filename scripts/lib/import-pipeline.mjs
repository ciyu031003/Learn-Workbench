/**
 * 内容导入管线的纯逻辑（组二 · 阶段 10 = V3 纵线 Phase F）。
 *
 * 抽出的原因：导入本身是「外部仓库 → 我们的内容包」的破坏性动作——
 * 一定会有重复条目、同名不同源、以及「题面没变但答案变了」这类不能自动上线的改动。
 * 把判定收敛成纯函数，才能：dry-run 先看报告、单测覆盖冲突口径、CLI 与 Web 端共用同一套结论。
 *
 * 三域不合并、只建桥：这里只在**学习库**内容域内做导入，不触碰职业/健康域。
 */
import { createHash } from "node:crypto";

/** 导入动作：与 `content_import_item.action` 的取值一一对应。 */
export const IMPORT_ACTIONS = ["new", "update", "skip", "conflict", "failed"];

/** 条目类型：与 `content_import_item.kind` 的取值一一对应。 */
export const IMPORT_KINDS = ["knowledge-point", "question"];

/** 跳过/冲突原因码：固定字符串，便于统计与告警（不要把自由文本当原因码）。 */
export const IMPORT_REASONS = {
  outOfScope: "out-of-scope",
  duplicateExternalKey: "duplicate-external-key",
  targetCollision: "target-collision",
  answerChangeRequiresReview: "answer-change-requires-review",
  unchanged: "unchanged",
  missingExternalKey: "missing-external-key",
  missingTargetKey: "missing-target-key",
  missingTitle: "missing-title",
  invalidKind: "invalid-kind",
};

/** 短哈希（16 位十六进制），用于外部键指纹与内容指纹；确定性、不依赖运行时。 */
export function shortHash(input) {
  return createHash("sha1").update(String(input)).digest("hex").slice(0, 16);
}

/** 标题规范化：NFKC 统一全/半角、折叠空白、去首尾、大小写归一（决定标题指纹）。 */
export function normalizeTitle(title) {
  return String(title ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 路径规范化：统一分隔符、去 `./` 前缀、折叠重复斜杠、去空白（不做大小写折叠）。 */
export function normalizePath(path) {
  return String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

/**
 * 源内稳定键：`<路径>#<标题指纹>`。
 * 用标题指纹而不是行号/index，源仓库重排顺序时键不变 —— 这是「可复现导入」的基础。
 */
export function normalizeExternalKey(path, title) {
  const p = normalizePath(path);
  const t = normalizeTitle(title);
  if (!t) return p;
  return `${p}#${shortHash(t)}`;
}

/** 内容指纹：canonical JSON（键排序）的短哈希，用于判断"这条到底变没变"。 */
export function fingerprintOf(value) {
  return shortHash(canonicalJson(value));
}

/** 稳定序列化：对象键排序，数组保序；保证同一内容永远得到同一指纹。 */
export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value === undefined ? null : value;
}

/** 路径是否落在允许的前缀范围内（scope 为空表示不限）。 */
export function inScope(path, scope) {
  const list = Array.isArray(scope) ? scope.map(normalizePath).filter(Boolean) : [];
  if (list.length === 0) return true;
  const p = normalizePath(path);
  return list.some((prefix) => p === prefix || p.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function validateItem(item) {
  const kind = String(item?.kind ?? "").trim();
  if (!IMPORT_KINDS.includes(kind)) return IMPORT_REASONS.invalidKind;
  if (!String(item?.externalKey ?? "").trim()) return IMPORT_REASONS.missingExternalKey;
  if (!String(item?.targetKey ?? "").trim()) return IMPORT_REASONS.missingTargetKey;
  if (!String(item?.title ?? "").trim()) return IMPORT_REASONS.missingTitle;
  return null;
}

/**
 * 冲突检测：同一批次的 incoming 里
 *   1. 同一外部键出现两次但内容不同 —— 源里就有重复且不一致，必须人工看；
 *   2. 两个不同外部键指向同一个目标键（targetKey）—— 会互相覆盖，绝不能自动写；
 *   3. 题面未变但答案变了（answerChanged）—— 答案不允许自动上线，走人工审核。
 * 返回 `externalKey -> reason` 的 Map；同一键以第一条命中的原因为准（确定性）。
 */
export function detectConflicts(existing, incoming, options = {}) {
  const answerChangedRequiresReview = options.answerChangedRequiresReview !== false;
  const conflicts = new Map();

  const seenByExternal = new Map();
  for (const item of incoming) {
    const key = String(item?.externalKey ?? "");
    if (!key) continue;
    const fp = item.fingerprint ?? fingerprintOf(item.payload ?? item);
    const prev = seenByExternal.get(key);
    if (prev && prev.fingerprint !== fp && !conflicts.has(key)) {
      conflicts.set(key, IMPORT_REASONS.duplicateExternalKey);
    } else if (!prev) {
      seenByExternal.set(key, { fingerprint: fp });
    }
  }

  const byTarget = new Map();
  for (const item of incoming) {
    const key = String(item?.externalKey ?? "");
    const target = String(item?.targetKey ?? "");
    if (!key || !target) continue;
    const prev = byTarget.get(target);
    if (prev && prev !== key && !conflicts.has(key)) {
      conflicts.set(key, IMPORT_REASONS.targetCollision);
      if (!conflicts.has(prev)) conflicts.set(prev, IMPORT_REASONS.targetCollision);
    } else if (!prev) {
      byTarget.set(target, key);
    }
  }

  if (answerChangedRequiresReview) {
    const existingByExternal = new Map(existing.map((row) => [String(row.externalKey), row]));
    for (const item of incoming) {
      const key = String(item?.externalKey ?? "");
      if (!key || conflicts.has(key)) continue;
      const before = existingByExternal.get(key);
      if (!before || !before.hasAnswer) continue;
      const fp = item.fingerprint ?? fingerprintOf(item.payload ?? item);
      if (before.fingerprint !== fp && item.answerChanged !== false) {
        conflicts.set(key, IMPORT_REASONS.answerChangeRequiresReview);
      }
    }
  }

  return conflicts;
}

/**
 * 主规划函数：把「已导入的 existing」与「本次解析出的 incoming」对成五个桶。
 * 纯函数：不读库、不写盘、不联网；`now` 也不需要，便于断言。
 */
export function planImport({ existing = [], incoming = [], scope = [], options = {} } = {}) {
  const conflicts = detectConflicts(existing, incoming, options);
  const existingByExternal = new Map(existing.map((row) => [String(row.externalKey), row]));

  const plan = { new: [], update: [], skip: [], conflict: [], failed: [] };

  for (const item of incoming) {
    const invalid = validateItem(item);
    if (invalid) {
      plan.failed.push({ ...item, reason: invalid });
      continue;
    }
    if (item.path !== undefined && !inScope(item.path, scope)) {
      plan.skip.push({ ...item, reason: IMPORT_REASONS.outOfScope });
      continue;
    }
    const key = String(item.externalKey);
    const conflictReason = conflicts.get(key);
    if (conflictReason) {
      plan.conflict.push({ ...item, reason: conflictReason });
      continue;
    }
    const before = existingByExternal.get(key);
    const fp = item.fingerprint ?? fingerprintOf(item.payload ?? item);
    if (!before) {
      plan.new.push({ ...item, fingerprint: fp });
      continue;
    }
    if (before.fingerprint === fp) {
      plan.skip.push({ ...item, reason: IMPORT_REASONS.unchanged });
      continue;
    }
    plan.update.push({ ...item, fingerprint: fp, previousFingerprint: before.fingerprint });
  }

  return plan;
}

/** dry-run 报告：先给数量，再给每个非空桶的明细（截断到 limit，避免刷屏但数量真实）。 */
export function buildDryRunReport(plan, options = {}) {
  const limit = Math.max(1, Number(options.limit ?? 20));
  const buckets = ["new", "update", "skip", "conflict", "failed"];
  const counts = {};
  for (const bucket of buckets) counts[bucket] = plan[bucket]?.length ?? 0;

  const details = {};
  for (const bucket of buckets) {
    details[bucket] = (plan[bucket] ?? []).slice(0, limit).map((item) => ({
      kind: item.kind,
      externalKey: item.externalKey,
      targetKey: item.targetKey,
      title: item.title,
      reason: item.reason,
    }));
  }

  const lines = [
    `新增 ${counts.new} / 更新 ${counts.update} / 跳过 ${counts.skip} / 冲突 ${counts.conflict} / 失败 ${counts.failed}`,
  ];
  if (counts.conflict > 0) {
    const reasons = new Map();
    for (const item of plan.conflict) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
    lines.push(
      "冲突原因：" +
        [...reasons.entries()].map(([reason, n]) => `${reason}×${n}`).join("、")
    );
  }
  if (counts.failed > 0) {
    const reasons = new Map();
    for (const item of plan.failed) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
    lines.push(
      "失败原因：" +
        [...reasons.entries()].map(([reason, n]) => `${reason}×${n}`).join("、")
    );
  }
  return { counts, details, lines };
}

/** `content_import_item` 行形状：把五个桶拍平成可批量插入的行（batchId 由调用方给）。 */
export function toImportItemRows(plan, batchId) {
  const rows = [];
  for (const bucket of ["new", "update", "skip", "conflict", "failed"]) {
    for (const item of plan[bucket] ?? []) {
      rows.push({
        batchId,
        kind: String(item.kind),
        externalKey: String(item.externalKey),
        targetKey: item.targetKey ? String(item.targetKey) : null,
        action: bucket,
        reason: item.reason ?? null,
        payload: item.payload ?? null,
      });
    }
  }
  return rows;
}

/** 汇总一批 item 行的动作计数：用于回填 batch 的 planned_* / applied_* 字段。 */
export function countActions(rows) {
  const counts = { new: 0, update: 0, skip: 0, conflict: 0, failed: 0 };
  for (const row of rows ?? []) {
    if (row.action in counts) counts[row.action] += 1;
  }
  return counts;
}
