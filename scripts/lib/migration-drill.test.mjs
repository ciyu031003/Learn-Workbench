import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDownContract } from "../migration-drill.mjs";

test("parseDownContract：索引 / 约束 / 列 都被解析出来", () => {
  const sql = `
DROP INDEX IF EXISTS idx_accounts_user;
DROP INDEX IF EXISTS idx_daily_tasks_phase;
ALTER TABLE content_topics DROP CONSTRAINT IF EXISTS ck_content_topics_version;
ALTER TABLE content_phases DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS version;
`;
  const contract = parseDownContract(sql);
  assert.deepEqual(contract.indexes, ["idx_accounts_user", "idx_daily_tasks_phase"]);
  assert.deepEqual(contract.constraints, [{ table: "content_topics", name: "ck_content_topics_version" }]);
  assert.deepEqual(contract.columns, [
    { table: "content_phases", name: "created_by" },
    { table: "content_phases", name: "updated_by" },
    { table: "content_phases", name: "version" },
  ]);
});

test("parseDownContract：单个 DROP COLUMN 也要能被抓出来（不漏对象）", () => {
  const contract = parseDownContract("ALTER TABLE knowledge_points DROP COLUMN IF EXISTS version;\n");
  assert.deepEqual(contract.columns, [{ table: "knowledge_points", name: "version" }]);
});

test("parseDownContract：空的 down 文件解析为空契约（会被演练判为形同空文）", () => {
  const contract = parseDownContract("-- 什么都没回滚\n");
  assert.equal(contract.indexes.length + contract.constraints.length + contract.columns.length, 0);
});
