# 契约：学习库与内容同步接口（组三 · H2 补登）

补登两组此前只有实现、没有契约的接口；错误体统一见
`content-platform/api/conventions.md`（`{ error, code?, requestId? }`）。

| 接口 | 鉴权 | 幂等 |
|---|---|---|
| `GET  /api/learning/catalog` | 无 | 读 |
| `GET  /api/learning/progress?track=` | 登录（`user_id` 隔离） | 读 |
| `GET  /api/learning/library-state?track=` | 登录 | 读 |
| `GET  /api/learning/review` | 登录 | 读（到期队列，SM-2） |
| `POST /api/learning/read` | 登录 | **幂等**：进度只增不减，重复上报同 `clientId` 不重复计数 |
| `POST /api/learning/favorite` | 登录 | **幂等**：`favorite=false` 即取消（软删除），可再次收藏 |
| `POST /api/learning/attempt` | 登录 | 追加型（每次作答都是新事实） |
| `POST /api/internal/content/sync` | `x-cron-secret` | **幂等**：按稳定 key upsert + 指纹判等，只重写 derived 关联 |

## POST /api/learning/attempt

```jsonc
// 请求
{
  "questionKey": "java-async-01",        // 1..120
  "trackSlug": "java",
  "stageKey": "java-async-browser",
  "chosenAnswer": ["A"]                   // 1..8 项
}
// 响应 201（learningAttemptResultSchema）
{
  "questionKey": "...", "trackSlug": "...", "stageKey": "...",
  "isCorrect": true, "answer": ["A"], "explanation": "...", "createdAt": "..."
}
```

| 状态 | code | 场景 |
|---|---|---|
| 400 | `validation_failed` | body 不满足 `learningAttemptInputSchema` |
| 401 | `unauthorized` | 未登录 |
| 500 | `internal_error` | 落库失败（不泄漏内部细节） |

## POST /api/learning/read

```jsonc
// 请求（learningReadStateInputSchema = knowledgePointRef + progress? + clientId?）
{ "trackSlug": "java", "stageKey": "java-foundation", "topicKey": "java-types-control",
  "progress": 60, "clientId": "mobile-abc" }
// 响应 201：learningReadStateSchema（pointKey / firstReadAt / lastReadAt / progress / readCount）
```

**幂等口径**：`progress` 只增不减（回退上报不生效）；`clientId` 相同视为同一次阅读，`readCount` 不重复累加。

## POST /api/learning/favorite

```jsonc
// 请求（learningFavoriteInputSchema = knowledgePointRef + favorite + note?）
{ "trackSlug": "java", "stageKey": "java-foundation", "topicKey": "java-types-control",
  "favorite": true, "note": "面试常考" }
```

**幂等口径**：`favorite` 是目标状态而非增量，重复调用结果相同；取消为软删除，历史可审计。

## POST /api/internal/content/sync

```jsonc
// 请求（字段全可选）
{ "dryRun": true, "contentVersion": "abc1234", "contentUpdatedAt": "2026-10-11T00:00:00.000Z", "reviewTtlDays": 30 }
// 响应 200
{ "ok": true, "dryRun": true, "contentUpdatedAt": "...", "requestId": "...",
  "contentVersion": "...", "inserted": 0, "updated": 0, "unchanged": 120, "links": 400, "archived": 0 }
```

| 状态 | code | 场景 |
|---|---|---|
| 403 | `forbidden` | 缺少 / 不匹配 `x-cron-secret` |
| 429 | `rate_limited` | 同一 IP 每分钟超过 30 次 |
| 500 | `internal_error` | 同步失败（不泄漏内部细节） |

**幂等口径**：知识点按稳定 key（`<trackSlug>/<stageKey>/<topicKey>`）upsert，`fingerprint` 相同即 `unchanged`；
模型里消失的知识点只软归档（`status='archived'`），历史作答仍可追溯；人工审定的 `curated` 关联边不被覆盖。
