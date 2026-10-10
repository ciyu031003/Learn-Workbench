# ADR-003：API 版本策略与统一错误契约

- **状态**：已采纳
- **日期**：2026-10-11
- **阶段**：组三 · 阶段 16（V3 横轨 H2）
- **相关文件**：`apps/web/lib/api-error.ts`、`apps/web/lib/request-id.ts`、
  `content-platform/api/conventions.md`、`content-platform/api/route-inventory.md`、
  `content-platform/openapi/learning.md`、`scripts/api-inventory.mjs`

## 1. 背景（实测依据）

- 全仓 134 个 `route.ts`，错误体**大多手写** `NextResponse.json({ error })`；
  只有 9 个接了限流；`api/internal/**` 新接口没有限流。
- `interview_questions` 与学习题库两套作答接口的 `code` 语义各不相同
  （`ContentImportError.reason` 是一套，PG 错误码映射是另一套），客户端无法按类型分流。
- 无 `x-request-id`：前端报错与服务端日志无法对齐。
- 无版本策略：一旦要改响应结构，只能全量同改或临时加 `/v2`。

## 2. 决策

1. **不引入 URI 版本号**（`/api/v2/...`）。理由：本仓库是单租户自用工作台，前后端同仓同发布，
   URI 版本只会带来双份路由与双份测试。需要破坏性变更时按 §3 的规则走。
2. **破坏性变更 = 新增字段 / 新参数 / 新接口**；真正破坏性的（删字段、改语义）走
   `Sunset` 头 + 至少一个发版周期的并行期，并在本 ADR 追加变更记录。
3. **统一错误契约**：`{ error, code?, requestId? }`。`error` 是人类文案（不稳定），`code` 是机器契约（稳定）。
   非破坏性：不传 options 时仍输出 `{ error }`，存量接口零改动。
4. **`requestId` 贯穿**：入口 `requestIdFrom(req)` 采信合法的上游 `x-request-id`，否则生成 UUID；
   新接口的响应体与日志都带上它。
5. **新接口三条硬门槛**（由 `scripts/api-inventory.mjs --check` 强制）：
   ① 必须有同名 `route.test.ts`；② `api/internal/**` 必须限流；③ 必须在 `openapi/` 里有条目。
   存量欠账用 `content-platform/api/test-exceptions.json` 显式登记，只许减少不许新增。

## 3. 备选方案与为什么不选

| 备选 | 说明 | 否决理由 |
|---|---|---|
| A. URI 版本 `/api/v2/**` | 最直观 | 单仓同发布的自用系统，收益为零成本翻倍；路由、测试、契约全要双份 |
| B. 用 `Accept: application/vnd.lwb.v2+json` 做协商 | 干净 | 前端与移动端都要改，实际只会建两套分支判断，不如直接加字段 |
| C. 保留中文文案当契约（现状） | 零改动 | 文案一改客户端就断；且无法按类型分流（去登录 vs 重试 vs 提示校验） |
| D. 一次性把 134 个路由全改成新 envelope | 彻底 | 高风险大 diff，且大量接口是内部自用；新接口强制 + 存量随改随迁更稳 |

## 4. 影响与验收

- 契约工件：`content-platform/api/conventions.md`（约定）、`openapi/learning.md`（学习库与内容同步接口补登）、
  `api/route-inventory.md`（134 个路由的台账：方法 / 鉴权 / 限流 / 测试 / 文档）。
- 门禁：`node scripts/api-inventory.mjs --check` 已进 `test:scripts`（CI）。
- 已改造接口：`/api/internal/content/import`、`/api/internal/content/sync`（限流 + `code` + `requestId`）。
- 单测：`apps/web/lib/api-error-envelope.test.ts`（7 例）、`apps/web/lib/request-id.test.ts`（4 例）。

## 5. 后续（未在本阶段闭合）

- 存量接口按「随改随迁」补 `code`（不动行为，只在既有响应上加字段），台账里可查未迁移清单。
- 分页/排序约定（`conventions.md` §2）目前只有约定、没有跨接口的公共实现；
  等列表接口出现第二处重复分页逻辑时再抽 `lib/pagination.ts`，避免过早抽象。
