# 契约：学习库与内容同步接口（组三 · H2 补登）

补登两组此前只有实现、没有契约的接口；错误体统一见
`content-platform/api/conventions.md`（`{ error, code?, requestId? }`）。

| 接口 | 鉴权 | 幂等 |
|---|---|---|
| `GET  /api/learning/catalog` | 无 | 读 |
| `GET  /api/learning/progress?track=` | 登录（`user_id` 隔离） | 读 |
| `GET  /api/learning/library-state?track=` | 登录 | 读 |
| `GET  /api/learning/review?scope=due\|all` | 登录 | 读（`due` 为到期队列；`all` 用于计划管理，SM-2） |
| `PATCH /api/learning/review` | 登录 | **幂等**：`clientId` 标识一次延后/暂停/恢复/完成操作 |
| `POST /api/learning/read` | 登录 | **幂等**：进度只增不减，重复上报同 `clientId` 不重复计数 |
| `POST /api/learning/favorite` | 登录 | **幂等**：`favorite=false` 即取消（软删除），可再次收藏 |
| `POST /api/learning/attempt` | 登录 | 追加型（每次作答都是新事实） |
| `GET  /api/learning/point-states?track=` | 登录 | 读（知识点五状态：阅读/练习/掌握/复习/实践） |
| `GET  /api/learning/question-status` | 无 | 读（题目生命周期状态，库不可用降级为空） |
| `GET  /api/learning/content-freshness?track=` | 无 | 读（`stale_after` 过期知识点，库不可用降级为空） |
| `POST /api/internal/content/question-status` | `x-cron-secret` 或内容角色 | **幂等**：设置目标状态，重复调用结果相同 |
| `POST /api/internal/content/sync` | `x-cron-secret` | **幂等**：按稳定 key upsert + 指纹判等，只重写 derived 关联 |
| `GET  /api/internal/content/knowledge-point?key=` | `x-cron-secret` 或内容角色 | 读（当前快照 + 乐观锁 `version`） |
| `POST /api/internal/content/knowledge-point` | `x-cron-secret` 或内容角色 | **乐观锁**：`version` 不匹配即 409，绝不静默覆盖 |

## POST /api/learning/attempt

```jsonc
// 请求
{
  "questionKey": "java-async-01",        // 1..120
  "trackSlug": "java",
  "stageKey": "java-async-browser",
  "chosenAnswer": ["A"],                  // 1..8 项
  "clientId": "mobile-attempt-abc123"      // 可选；离线重试去重
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

**幂等口径**：同一用户携带相同 `clientId` 重放作答只写一条 `learning_attempts`，
并且只推进一次复习卡。无 `clientId` 的旧客户端仍按追加型处理。

## PATCH /api/learning/review

```jsonc
// 延后：snoozeDays 与 snoozeUntil 可同时给；后者保留客户端本地时间语义。
{
  "action": "snooze",                    // snooze | pause | resume | complete
  "questionKeys": ["java-async-01"],
  "clientId": "mobile-review-abc123",
  "snoozeDays": 1,
  "snoozeUntil": "2026-10-14T12:00:00.000Z"
}

// 暂停 / 恢复 / 完成只需 action + questionKeys + clientId。
```

响应在 `learningReviewResponseSchema` 基础上追加：

```jsonc
{ "applied": 1, "duplicate": false, "cards": [], "weakTopics": [] }
```

服务端在事务内锁定卡片后再动作，重复 `clientId` 返回 `duplicate=true` 且不二次延长间隔。

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

## POST /api/internal/content/knowledge-point

组三 · H1 收口的**应用层乐观锁写入路径**（迁移 `064` 的 `version` 列至此才真正被应用层使用）。

```jsonc
// GET 预读：/api/internal/content/knowledge-point?key=algorithms/ds-sort/ds-insertion-sort
{ "key": "...", "title": "插入排序", "summary": "...", "status": "published",
  "tags": ["排序", "408"], "version": 3, "updatedAt": "...", "updatedBy": "editor-1" }

// POST 请求（title/summary/status/tags 至少给一个）
{ "key": "algorithms/ds-sort/ds-insertion-sort", "expectedVersion": 3, "status": "review" }
// 响应 200
{ "ok": true, "key": "...", "version": 4, "requestId": "..." }
```

| 状态 | code | 场景 |
|---|---|---|
| 400 | `validation_failed` | 缺 key / `expectedVersion` 非正整数 / 补丁非法（空标题、超长、非法状态、tags 非数组） |
| 403 | `forbidden` | 缺少 / 不匹配 `x-cron-secret`，且会话不具备内容角色 |
| 404 | `not_found` | 知识点不存在或已软删除（先跑内容同步登记） |
| 409 | `conflict` | `expectedVersion` 与库中 `version` 不一致（别人先改了），响应带 `currentVersion` |
| 429 | `rate_limited` | 同一 IP 每分钟超过 30 次 |
| 500 | `internal_error` | 落库失败（不泄漏内部细节） |

**并发口径**：`UPDATE ... WHERE key = $1 AND version = $2`，命中 0 行时分清「不存在」与「版本冲突」；
成功写入 `version = version + 1` 并记录 `updated_by`。**永不**用后写覆盖先写。
