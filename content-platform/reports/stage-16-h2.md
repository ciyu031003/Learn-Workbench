# 阶段 16 汇报：API 治理（组三 · H2）

- **ADR**：ADR-003
- **日期**：2026-10-11
- **提交**：`4cddcb9`

## 发现

- 全仓 **134** 个 `route.ts`，错误体大多手写 `NextResponse.json({ error })`；
  `apps/web/lib/api-error.ts` 已有 `apiError`/`dbErrorResponse`，但只有 `{ error }` 一个字段；
- 只有 9 个路由接限流，`api/internal/**` 一个都没接；
- 无 `x-request-id`：前端报错与服务端日志无法对齐；
- 学习库与内容同步这两组接口**只有实现、没有契约**。

（核对方式：`rg -ln "rateLimit\(" apps/web/app/api | wc -l`、`Get-ChildItem -Recurse apps/web/app/api -Filter route.ts`。）

## 改动

- `apps/web/lib/api-error.ts`：`{ error, code?, requestId?, retryAfterSeconds? }` + `API_ERROR_CODES` 稳定枚举（不传 options 仍是 `{ error }`）；
- `apps/web/lib/request-id.ts`：采信合法 `x-request-id`，否则 UUID（拒绝超长/非法字符）；
- `apps/web/lib/internal-guard.ts`：内部接口统一前门，**先限流再验密钥**；5 个内部路由全部接入；
- `scripts/api-inventory.mjs` → `content-platform/api/route-inventory.md`：135 条路由台账 + 三条硬门槛；
- `content-platform/api/conventions.md`、`content-platform/openapi/learning.md`、ADR-003。

## 验证

```bash
node scripts/api-inventory.mjs --check    # 台账最新 + 门槛 3/3（同名单测 / 内部限流 / 契约范围有 OpenAPI）
pnpm --filter web exec vitest run app/api/internal lib/internal-guard.test.ts lib/request-id.test.ts
```

单测共 64 例通过（含 `internal-guard` 的"错密钥探测也会被计入桶"）。

## 风险

- 存量 134 个接口**没有强制迁移**到新 envelope（刻意为之：大 diff 风险高），台账里可查未迁移清单；
- 分页/排序只有约定、没有公共实现；等出现第二处重复逻辑再抽 `lib/pagination.ts`；
- 会话兜底通道（角色用户触发内部接口）依赖 `next/headers`，在脚本/单测里被 try/catch 吞掉，行为是"视为未登录"。

## 下阶段

H3：安全纵深（角色、审计、输入闸门）。
