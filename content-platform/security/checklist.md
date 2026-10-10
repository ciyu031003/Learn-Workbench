# 安全评审清单（组三 · H3）

每引入一条**新的写路径 / 新的外部输入**时逐条过一遍；决策背景见 `../adr/ADR-004-安全纵深与权限.md`。

## 1. 鉴权与权限

| 检查项 | 现状 |
|---|---|
| 业务接口是否用 `currentUserId()` 且 SQL 一律带 `user_id` 隔离 | ✅（`anonFilterSql` 处理未登录） |
| 内部接口是否走 `guardInternalRequest`（先限流再验密钥） | ✅ 5/5（`api-inventory.mjs --check` 强制） |
| 权限是否按角色判定，而不是靠"能拿到 id 就行" | ✅ `lib/roles.ts`（learner/editor/reviewer/admin） |
| 新增受限操作是否写审计 | ✅ `lib/audit.ts`（导入/回滚/同步已接） |
| 未知用户 / 脏数据是否**默认拒绝** | ✅ `roleOf` 未知 → `learner`，`hasRole(null)` → false |

## 2. 外部输入

| 检查项 | 现状 |
|---|---|
| 请求体是否限长（`parseBody(req, maxBytes)`） | 新接口 ✅（`conventions.md` §5） |
| 是否用 zod schema 校验而不是 `as` 强转 | ✅ `@learn-workbench/shared` |
| 外部 URL 是否做协议 + 宿主白名单 | ✅ `assertSafeRepoUrl`（https + GitHub 白名单） |
| git ref / 分支名是否做形状校验 | ✅ `assertSafeGitRef`（拒 `-` 开头、`..`、空格） |
| 路径是否拒绝穿越 / 绝对路径 | ✅ `assertSafeRelativePath`、`isSafeEquipmentPath` |
| git 传输是否关掉 file/ext/ssh | ✅ `GIT_ALLOW_PROTOCOL=https`（`runGit`） |
| SQL 是否全部参数化 | ✅（无字符串拼接；`listAuditLog` 亦走 `$n`） |

## 3. 凭据与秘密

| 检查项 | 现状 |
|---|---|
| 秘密只从环境变量读，不进仓库 | ✅（`CRON_SECRET` / `PGPASSWORD` / `AI_API_KEY` / `DEEPSEEK_*`） |
| 密码存储是否加盐哈希 | ✅ `lib/password.ts` |
| 会话令牌是否只存哈希 | ✅ `sessions.token_hash`（sha256），明文列仅过渡期双写 |
| 日志是否泄漏秘密 | ✅ 响应体不回显；AI key 只用于出网请求头 |
| 轮换流程 | ⏳ 见 `../../deploy/RUNBOOK.md`（H5 补） |

## 4. 前端输出

| 检查项 | 现状 |
|---|---|
| Markdown 渲染是否做危险 HTML 处理 | ✅ `lib/md-lite.ts`（自研渲染器，不注入原始 HTML） |
| 是否允许用户内容进 `dangerouslySetInnerHTML` | 需逐处确认（当前仅内部固定文案） |
| 外链是否 `rel="noopener noreferrer"` | 随页面改动确认 |

## 5. 依赖

| 检查项 | 现状 |
|---|---|
| 依赖漏洞扫描入 CI | ✅ `pnpm audit --audit-level=high`（H4，`ci.yml`） |
| 第三方 UI 来源与署名 | ✅ `docs/第三方UI来源与署名.md` + `docs/THIRD_PARTY.md` |
