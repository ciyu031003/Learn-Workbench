# 环境矩阵（组三 · H4 交付补强）

三套环境的行为差异集中在这里；**同一个 commit 应当能在三套环境里跑起来**，差异只来自环境变量。

## 1. 环境对照

| 维度 | 本地开发 | Staging（预发） | 生产 |
|---|---|---|---|
| Web | `pnpm web`（Next dev，:3001） | 同一镜像，独立域名/端口 | `pm2`/容器，nginx 反代 `learn.yuanabd.cn` |
| DB | 本机 `.pgdata`（`Learn-Workbench`） | 独立库 | 服务器 Postgres（`PG_DB`） |
| 迁移 | 手动 `node scripts/check-schema-fresh.mjs` | 部署前自动跑全部迁移 | 部署前自动跑全部迁移 + 备份 |
| 外部源 | `LWB_API_URL=http://127.0.0.1:3001` | staging 域名 | 生产域名 |
| Redis | 通常不配（进程内限流/缓存） | 建议配（验证多实例路径） | 配 `REDIS_URL`（限流跨实例共享） |
| 特性开关 | 按需 | **灰度先在这里开** | 只在 staging 验证后开 |
| 内容导入 | `--mode=dry-run` 为主 | `apply` 到 staging 库看效果 | 只由 cron / CLI 触发，且默认 dry-run |

## 2. 环境变量清单

### 必填（缺失即不可用）

| 变量 | 用途 | 备注 |
|---|---|---|
| `CRON_SECRET` | 内部接口鉴权（`x-cron-secret`） | 部署脚本自动生成写入 crontab |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | 数据库 | 生产由 `deploy.sh` 的 `ENV_FILE` 注入 |
| `WEB_BASE_URL` | 拼邮件/回跳链接的站点 origin | **不读 `Origin` 头**（防 token 外泄到攻击者域） |

### 可选（缺省回落到安全默认）

| 变量 | 默认行为 |
|---|---|
| `APP_PORT` | 3001 |
| `REDIS_URL` | 不配 → 限流/缓存走进程内（单实例语义） |
| `LOG_LEVEL` | 生产 `info`，开发 `debug` |
| `PGPOOL_MAX` / `PG_STATEMENT_TIMEOUT_MS` | 20 / 15000ms（慢查询超时即中断） |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | 无 key → `/api/ai/tip` 返回 503，前端回落规则版 |
| `EMAIL_API_KEY` / `EMAIL_FROM` | 无 → 邮件相关功能返回未启用 |
| `WECHAT_WEB_APPID` / `WECHAT_WEB_SECRET` / `WECHAT_STATE_SECRET` | 无 → 微信登录/绑定未启用 |
| `UPLOAD_DIR` / `RESUME_DIR` / `DIAGNOSTICS_DIR` | 部署脚本创建的默认目录 |
| `FEATURE_*` / `FEATURE_FLAGS` | 见 `apps/web/lib/flags.ts`（缺省用代码里的 defaultEnabled） |

## 3. 特性开关与灰度流程（H4）

1. 代码里声明开关（`FLAGS`）并给出 `defaultEnabled`；
2. staging 用环境变量开启，跑 E2E + 人工验证；
3. 生产先小范围开（例如只对管理员可见的入口），观察日志与指标；
4. 出问题**先关开关**（`FEATURE_X=off` 重启），不要急着回滚代码。

开关读取规则：`FEATURE_FLAGS`（JSON）优先于单变量 `FEATURE_<NAME>`；无法识别的取值回落默认（不静默关功能）。

## 4. 部署前必跑

```bash
pnpm typecheck && pnpm test && pnpm test:scripts
node scripts/check-schema-fresh.mjs     # 空库收敛
node scripts/migration-drill.mjs        # 回滚演练
node scripts/check-deps-audit.mjs       # 依赖漏洞棘轮
```

（同样这五条已在 `.github/workflows/ci.yml` 的 quality job 里，配 Postgres service。）
