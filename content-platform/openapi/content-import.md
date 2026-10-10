# 契约：内容导入管线（组二 · 阶段 10 = V3 纵线 Phase F）

两个内部接口，都走 `x-cron-secret`（与 cron / 内容同步 / 面试导入同款）。
它们**不对外**，只给 CLI（`scripts/crawl_content_source.mjs`）与 cron 用。

## POST /api/internal/content/import

### 请求

```jsonc
{
  "sourceKey": "algorithms-java",     // 必填，content_source.key
  "mode": "dry-run",                  // "dry-run" | "apply"，缺省 dry-run
  "commitSha": "abc1234",             // 固定版本（可复现）
  "scope": ["src"],                   // 允许的路径前缀（空数组 = 不限）
  "createdBy": "cli",
  "items": [
    {
      "kind": "knowledge-point",      // "knowledge-point" | "question"
      "externalKey": "src/a.md#0f3a...",  // <路径>#<标题指纹>
      "targetKey": "java/java-foundation/java-types-control",
      "title": "类型与控制流",
      "path": "src/a.md",
      "unmapped": false,              // true = 还没有归属映射，记成 skip(unmapped)
      "payload": {
        "trackSlug": "java", "stageKey": "java-foundation", "topicKey": "java-types-control",
        "title": "类型与控制流", "summary": "...", "difficulty": "medium",
        "tags": ["算法"], "estimatedMinutes": 12, "qualityLevel": "L2",
        "fingerprint": "0f3a..."      // 内容指纹；缺省由服务端按 payload 计算
      }
    }
  ]
}
```

### 响应 200

```jsonc
{
  "ok": true,
  "batchId": 12,
  "sourceKey": "algorithms-java",
  "mode": "dry-run",
  "status": "success",              // success | partial | failed
  "counts": { "new": 8, "update": 1, "skip": 5, "conflict": 2, "failed": 0 },
  "applied": { "new": 0, "update": 0, "skipped": 5 },
  "staged": { "questions": 0 },
  "commitSha": "abc1234"
}
```

### 错误

| 状态 | code | 场景 |
|---|---|---|
| 400 | `no-items` | `items` 为空 |
| 400 | `source-not-importable` | 来源已停用；或 `usage='reference'` 却请求 `mode='apply'` |
| 403 | — | 缺少 / 不匹配 `x-cron-secret` |
| 404 | `source-not-found` | `content_source` 里没有这个 key |
| 500 | — | 其他（不泄漏内部细节） |

### 语义保证

- **不自动上线**：`apply` 只写 `knowledge_points.status='review'`；
  upsert 带 `WHERE status='review'` 守卫，目标键已是 `published` 时写 0 行并
  把该条目改判 `conflict(target-published)`。
- **冲突不静默**：`duplicate-external-key` / `target-collision` /
  `answer-change-requires-review` / `target-published` 全部落进 `content_import_item.reason`。
- **冲突不回滚整批**：状态记 `partial`，明细留给人看（这正是导入要产出的东西）。
- **题目不物化**：学习库题目来自内容包，库里没有题目表；`kind='question'` 的条目
  登记为工作项，数量由 `staged.questions` 回报。

## POST /api/internal/content/import（回滚形态）

```jsonc
{ "rollback": 12 }
```

响应 `{ "ok": true, "rollback": true, "archived": 8, "batchId": 12 }`。

- 只把**该批次新建的 review 草稿**软归档（`status='archived'`），绝不物理删；
- 批次状态改为 `rolled-back`；
- `dry-run` 批次回滚会返回 400 `source-not-importable`（没有可回滚的物化行）。

## 表

| 表 | 作用 |
|---|---|
| `content_source` | 来源登记：从哪来、什么许可、允许抓哪个范围、核验过没有 |
| `content_import_batch` | 一次同步看了什么版本、计划新增/更新/跳过/冲突各多少、成功还是回滚 |
| `content_import_item` | 批次里每条的外部键 → 目标键 → 动作与原因 |
