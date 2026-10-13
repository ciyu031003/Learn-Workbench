/**
 * Pure change planning for the 408 snapshot importer.
 *
 * The importer writes audit rows before materializing content. Keeping the
 * action decision pure lets us test the important safety rule without a
 * database: a changed published row is a conflict unless the operator
 * explicitly chose the publish path.
 */

export const SNAPSHOT_ACTIONS = ["new", "update", "skip", "conflict", "failed"];

function text(value) {
  return String(value ?? "").trim();
}

function emptyCounts() {
  return { new: 0, update: 0, skip: 0, conflict: 0, failed: 0 };
}

function existingMap(rows) {
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [text(row?.key), row])
      .filter(([key]) => key),
  );
}

function planItem({ kind, key, title, fingerprint, existing, publish }) {
  const targetKey = text(key);
  const externalKey = targetKey;
  const incomingFingerprint = text(fingerprint);
  const base = {
    kind,
    externalKey,
    targetKey,
    title: text(title),
    fingerprint: incomingFingerprint,
  };

  if (!targetKey || !incomingFingerprint || !base.title) {
    return { ...base, action: "failed", reason: "invalid-snapshot-row" };
  }
  if (!existing) return { ...base, action: "new", reason: null };
  if (text(existing.fingerprint) === incomingFingerprint) {
    return { ...base, action: "skip", reason: "unchanged" };
  }
  if (text(existing.status) === "published" && !publish) {
    return { ...base, action: "conflict", reason: "published-content-changed" };
  }
  return { ...base, action: "update", reason: "fingerprint-changed" };
}

export function buildSnapshotImportPlan({ existing = {}, model, publish = false } = {}) {
  const pointsByKey = existingMap(existing.points);
  const questionsByKey = existingMap(existing.questions);
  const items = [];

  for (const point of model?.points ?? []) {
    items.push(
      planItem({
        kind: "knowledge-point",
        key: point.key,
        title: point.title,
        fingerprint: point.fingerprint,
        existing: pointsByKey.get(text(point.key)),
        publish,
      }),
    );
  }
  for (const question of model?.questions ?? []) {
    items.push(
      planItem({
        kind: "question",
        key: question.key,
        title: question.question_id || question.key,
        fingerprint: question.fingerprint,
        existing: questionsByKey.get(text(question.key)),
        publish,
      }),
    );
  }

  const counts = emptyCounts();
  for (const item of items) counts[item.action] += 1;

  const incomingPointKeys = new Set((model?.points ?? []).map((point) => text(point.key)));
  const incomingQuestionKeys = new Set((model?.questions ?? []).map((question) => text(question.key)));
  const stalePoints = [...pointsByKey.keys()].filter((key) => !incomingPointKeys.has(key)).sort();
  const staleQuestions = [...questionsByKey.keys()].filter((key) => !incomingQuestionKeys.has(key)).sort();

  return {
    items,
    counts,
    stale: {
      points: stalePoints,
      questions: staleQuestions,
    },
  };
}

export function withSnapshotStatus(model, status) {
  const target = status === "published" ? "published" : "review";
  return {
    ...model,
    points: (model?.points ?? []).map((point) => ({ ...point, status: target })),
    papers: (model?.papers ?? []).map((paper) => ({ ...paper, status: target })),
    questions: (model?.questions ?? []).map((question) => ({ ...question, status: target })),
  };
}

export function batchStatusFromCounts(counts) {
  const bad = Number(counts?.conflict ?? 0) + Number(counts?.failed ?? 0);
  const accepted = Number(counts?.new ?? 0) + Number(counts?.update ?? 0) + Number(counts?.skip ?? 0);
  if (bad === 0) return "success";
  return accepted === 0 ? "failed" : "partial";
}
