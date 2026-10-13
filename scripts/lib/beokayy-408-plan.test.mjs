import { test } from "node:test";
import assert from "node:assert/strict";

import {
  batchStatusFromCounts,
  buildSnapshotImportPlan,
  withSnapshotStatus,
} from "../beokayy-408/plan.mjs";

const model = {
  points: [
    { key: "beokayy-408/ds-01-01", title: "算法和算法评价", fingerprint: "point-fp-1" },
    { key: "beokayy-408/ds-02-01", title: "线性表", fingerprint: "point-fp-2" },
  ],
  questions: [
    { key: "beokayy-408/2023-01", question_id: "2023-01", fingerprint: "question-fp-1" },
  ],
};

test("snapshot plan marks new, unchanged and review updates", () => {
  const plan = buildSnapshotImportPlan({
    model,
    existing: {
      points: [
        { key: "beokayy-408/ds-01-01", status: "review", fingerprint: "point-fp-1" },
        { key: "beokayy-408/ds-02-01", status: "review", fingerprint: "old" },
      ],
      questions: [],
    },
  });
  assert.deepEqual(plan.counts, { new: 1, update: 1, skip: 1, conflict: 0, failed: 0 });
  assert.equal(plan.items.find((item) => item.externalKey.endsWith("2023-01")).action, "new");
  assert.equal(plan.items.find((item) => item.externalKey.endsWith("ds-01-01")).reason, "unchanged");
});

test("changed published content is a conflict unless publish is explicit", () => {
  const existing = {
    points: [{ key: "beokayy-408/ds-01-01", status: "published", fingerprint: "old" }],
    questions: [],
  };
  const guarded = buildSnapshotImportPlan({ model, existing });
  assert.equal(guarded.items.find((item) => item.externalKey.endsWith("ds-01-01")).action, "conflict");
  assert.equal(
    guarded.items.find((item) => item.externalKey.endsWith("ds-01-01")).reason,
    "published-content-changed",
  );

  const published = buildSnapshotImportPlan({ model, existing, publish: true });
  assert.equal(published.items.find((item) => item.externalKey.endsWith("ds-01-01")).action, "update");
});

test("snapshot plan reports stale keys without deleting them", () => {
  const plan = buildSnapshotImportPlan({
    model,
    existing: {
      points: [],
      questions: [{ key: "beokayy-408/old-question", status: "review", fingerprint: "old" }],
    },
  });
  assert.deepEqual(plan.stale.questions, ["beokayy-408/old-question"]);
});

test("status override never emits published unless requested", () => {
  const review = withSnapshotStatus(model, "review");
  assert.ok(review.points.every((point) => point.status === "review"));
  assert.ok(review.questions.every((question) => question.status === "review"));
  const published = withSnapshotStatus(model, "published");
  assert.ok(published.points.every((point) => point.status === "published"));
});

test("batch status separates clean imports from conflicts", () => {
  assert.equal(batchStatusFromCounts({ new: 1, update: 0, skip: 2, conflict: 0, failed: 0 }), "success");
  assert.equal(batchStatusFromCounts({ new: 1, update: 0, skip: 0, conflict: 1, failed: 0 }), "partial");
  assert.equal(batchStatusFromCounts({ new: 0, update: 0, skip: 0, conflict: 1, failed: 1 }), "failed");
});
