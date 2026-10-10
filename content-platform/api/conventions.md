# API 约定（组三 · H2 API 治理）

适用 `apps/web/app/api/**`。决策背景见 `adr/ADR-003-API版本与错误契约.md`；
台账见 `route-inventory.md`（由 `node scripts/api-inventory.mjs` 再生）。

## 1. 错误响应

```jsonc
{ "error": "未授权", "code": "forbidden", "requestId": "b1f2…" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `error` | ✅ | 面向用户的中文文案；**不承诺稳定**，可以随时改 |
| `code` | 新接口 ✅ | 机器可读类型，见下表；**发布后稳定** |
| `requestId` | 新接口 ✅ | 与日志、响应头对齐，报障时提供它即可定位 |
| `retryAfterSeconds` | 429 时 ✅ | 多久后可重试 |

`code` 取值（`apps/web/lib/api-error.ts` 的 `API_ERROR_CODES`）：
`unauthorized` / `forbidden` / `not_found` / `validation_failed` / `conflict` / `rate_limited` / `internal_error`。

> 已有接口不强制改造（保留 `{ error }`），但**新增接口必须带 `code`**，避免再把中文文案当契约用。
> 用 `apiError(status, message, { code, requestId })`；数据库异常走 `dbErrorResponse(e, fallback, { requestId })`。

## 2. 分页与排序

- 列表接口统一 `?limit=<1..100>&offset=<int>`；默认 `limit=50`。
- 排序用 `?sort=<field>&order=asc|desc`，`field` 必须是白名单枚举（不接受任意列名拼 SQL）。
- 响应体给出 `{ items, total, limit, offset }`，`total` 允许是估算（大表不必精确）。

## 3. 幂等

- **写接口凡由移动端离线队列驱动，必须支持 `clientId` 幂等**（服务端唯一约束去重，不是应用层判重）。
  参考：`uploads`（迁移 059 的 `client_id`）、`learning/read`、`learning/favorite`。
- 导入/同步接口用「稳定业务键 + 内容指纹」判等，重复执行为 no-op（迁移 060/062 已落地）。
- 状态类写接口（收藏、阅读进度）语义是**目标状态**而非增量；`progress` 只增不减。

## 4. 鉴权

| 类型 | 判定 | 用于 |
|---|---|---|
| 登录用户 | `currentUserId()` + `user_id` 隔离 | `/api/*` 业务接口 |
| 内部任务 | `x-cron-secret == CRON_SECRET` | `/api/internal/**` |

内部接口**一律走统一前门** `guardInternalRequest(req, "<name>")`（`apps/web/lib/internal-guard.ts`）：
**先限流再验密钥** —— 反过来的话，错密钥探测可以无限次做字符串比较。
`scripts/api-inventory.mjs --check` 会拦截未限流的 `api/internal/**` 新接口。

## 5. 请求体

- 一律走 `parseBody(req, maxBytes)`（限长，防内存 DoS），不用裸 `req.json()`。
- 校验用 `@learn-workbench/shared` 里的 zod schema，校验失败 → 400 + `validation_failed`。
