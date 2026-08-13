# Travel-Notes × Learn-Workbench · 第 10-11 步执行报告

> 执行日期：2026-08-13 ｜ 依据：《Travel-Notes × Learn-Workbench 完整优化与迁移实施方案》§77
> 对应步骤：10. Travel-Notes 开始 Space/Memory 重构；11. Learn-Workbench 重构增量同步

---

## 步骤 10：Travel-Notes 开始 Space / Memory 重构 ✅

### 现状（并发会话已完成并提交）
- Prisma 数据模型：Space / SpaceMember / SpaceInvite / Travel / TravelDay / Location / Memory / Media / MediaVariant / Album / AlbumMedia / AuditLog / Anniversary / ItineraryItem / Expense（commit 1f4d449）
- MySQL 已建表；Space RBAC（permissions）+ audit-log 服务 + /api/spaces 系列路由
- 并发会话另在开发 album / anniversary / timeline / 旅行规划（P2 行程/花费）模块

### 本会话新增（基于既有 Space 模式，统一 RBAC + 审计）
| 模块 | 文件 |
|---|---|
| Memory | `lib/modules/memory/memory.repository.ts` + `memory.service.ts`（§31 核心实体） |
| Travel（空间级 CRUD） | `lib/modules/travel/space-travel.repository.ts` + `space-travel.service.ts` |
| Memory API | `app/api/spaces/[id]/memories/route.ts`（GET/POST）、`app/api/memories/[id]/route.ts`（GET/PATCH/DELETE） |
| Travel API | `app/api/spaces/[id]/travels/route.ts`（GET/POST）、`app/api/travels/[id]/route.ts`（GET/PATCH/DELETE） |

> ⚠️ 与并发会话的文件冲突处理：对方在 `lib/modules/travel/travel.service.ts` 写入了不同的「P2 行程/花费规划」实现（无 spaceId/RBAC，且其 createTravel 存在类型错误）。为避免互相覆盖，本会话的 Space 级 Travel CRUD 使用独立文件名 `space-travel.*`，两套并存、互不影响。

### 运行时验证（Next.js 15.5 起于 3100 端口）
- 登录 → 创建 Space → 创建 Travel（状态 ONGOING、日期正确）→ 创建 Memory（含 travelId/happenedAt/mood）→ 列表/详情 → 更新 → 删除，全部通过
- AuditLog 完整记录：LOGIN / CREATE Space / CREATE Travel / CREATE Memory / UPDATE Memory / DELETE Memory
- UTF-8 中文（标题/内容/心情）经文件体请求验证存入 MySQL 正确
- 我的文件 `tsc --noEmit` 无错误（剩余错误均为并发会话 WIP 文件 album.service.ts / travel.service.ts，非本会话产物）

---

## 步骤 11：Learn-Workbench 重构增量同步 ✅

### 设计（§37-§40）
- 实体统一带 `updated_at` / `deleted_at`（软删除）；代理键实体带 `client_id`（跨设备稳定 ID）
- 新增 `sync_devices`（§37 deviceId）、`sync_changes`（§38 变更日志，CREATE/UPDATE/DELETE + version + payload）
- 冲突策略：**Last-Write-Wins**（§40，按 updated_at；DELETE 也受 updated_at 守卫，防止旧删除误删新更新的行）
- 客户端：pending changes 追踪 + deviceId + since 游标拉取

### DB 迁移
- `db/migrations/005_incremental_sync.sql`（已应用 + 同步进 `db/schema.sql`）：
  - 8 张可同步表加 `deleted_at`；`focus_sessions`/`checkins` 补 `updated_at`+触发器；`content_topics` 补 `updated_at`
  - `daily_tasks`/`focus_sessions`/`log_entries`/`resume_assets`/`content_topics` 加 `client_id` + 部分唯一索引
  - 存量数据回填 `client_id = 'srv-' || id`
  - `sync_devices`、`sync_changes` 两张新表

### 服务端
- `apps/web/lib/sync-service.ts`：7 类实体（progress/tasks/sessions/checkins/logs/github/customTopics）的 LWW 应用 + 增量收集 + sync_changes 记录 + sync_devices upsert
- `/api/sync/push`：接收 `{deviceId, changes:[{entityType,entityId,operation,version,payload,updatedAt}]}`，事务内 LWW 合并，记录变更日志
- `/api/sync/pull`：`?deviceId=&since=` 返回游标之后增量变更（含 DELETE 软删除）
- `next build` 通过，`tsc --noEmit` 通过

### 移动端
- `store/app-store.ts`：deviceId（持久化）、pendingChanges（持久化）、lastSyncedAt；所有写操作（打勾/任务/日志/打卡/专注/GitHub/自定义主题）自动记录变更；`applyRemoteChanges` 本地 LWW 合并
- `lib/sync.ts`：`syncPush` 只发 pending changes（成功后清空）；`syncPull` 按 since 增量拉取并应用
- `app/settings.tsx`：「一键同步到云端」→ 增量 push；「从云端恢复」→ 增量 pull
- `tsc --noEmit` 通过

### 端到端验证（生产构建 `next start`）
| 场景 | 结果 |
|---|---|
| Push 7 类变更（device-1） | ✅ applied=7，行 + client_id + updated_at 正确 |
| 幂等重放 | ✅ 不产生重复（client_id 匹配 upsert） |
| LWW：旧 UPDATE（1 小时前） | ✅ 被忽略（行未变化） |
| LWW：旧 DELETE（早于行更新） | ✅ 被忽略（deleted_at 未设置） |
| LWW：新 DELETE | ✅ 生效（deleted_at 设置，软删除） |
| Pull（device-2，since 游标） | ✅ 返回增量变更（含 DELETE 操作） |
| sync_devices / sync_changes | ✅ 设备与变更日志均正确记录 |
| 测试数据清理 | ✅ 全部删除，topic 101 进度已恢复 |

---

## 遗留与建议
1. Travel-Notes 管理员在线密码仍为旧默认 `Abd123456.`（`.env` 中），建议轮换（与 Learn-Workbench 一致）。
2. 并发会话的 `travel.service.ts`（P2 行程/花费）与 `album.service.ts` 存在类型错误，需其会话修复。
3. KnowledgeNote 的同步（notes 实体）暂未纳入移动端增量同步（Phase 8 移动端学习闭环再做）。
4. LWW 第一阶段使用客户端时间戳；后续可考虑服务端单调版本号（§40 提到的 version 演进）。