# P0 安全加固 + HTTPS 部署指南

> 日期：2026-08-22 · 对应评审报告 P0 清单（H1-H7）

## 一、本次代码改动（P0 落地）

### 1. 安全响应头与 HTTPS 准备
- `apps/web/next.config.ts`：全站安全头（CSP / X-Frame-Options: DENY / X-Content-Type-Options / Referrer-Policy / Permissions-Policy；生产环境追加 HSTS）。
- 登录/注册 cookie 在生产环境自动加 `secure` 标志。

### 2. 受限操作收敛（H2）
- 新增 `apps/web/lib/tasks/runner.ts`：DB 级任务互斥锁（`task_runs` 表）+ detached spawn 封装，替代原先三处重复 spawn 样板。
- `/api/jobs/run`、`/api/jobs/hosts/update` 改为**仅管理员**可调用 + 限流；`/api/background/refresh` 改为登录 + 限流。
- 管理员判定：`users.is_admin`（首个注册用户自动成为管理员；`scripts/create-admin.mjs` 创建/重置的账号也标记为管理员）。

### 3. 登录防爆破（H3）
- `apps/web/lib/password.ts`：scrypt 改**异步**（不再阻塞事件循环），新哈希带成本参数格式 `scrypt:N:r:p:salt:hash`；旧格式自动兼容，登录成功后自动升级。
- 新增 `auth_attempts` 表：失败计数 + 15 分钟窗口锁定（5 次）；登录接口按 IP 限流（20 次/分钟）。

### 4. 输入校验与 body 限制（H4）
- `apps/web/lib/http.ts`：统一 `parseBody`（1MB 默认上限 + JSON 解析收敛），应用于 auth / import / jobs/run / hosts / github / sync-push。
- 新增 `importFileSchema`（packages/shared）：`/api/import` 导入文件全量校验，非法字段直接 400。

### 5. 匿名数据设备化（H5）
- `db/migrations/016_security_hardening.sql`：`anon_id` 列（用户数据 + 健康/知识域）+ 部分唯一索引。
- `apps/web/proxy.ts`：匿名访客自动下发 `lwb_anon` 设备标识 cookie。
- 匿名写入带设备标识；匿名读取按设备隔离（含遗留行）；登录认领只认领**当前设备**的数据，历史遗留行需显式 `claimLegacy`（Web 登录页默认携带）。
- 注意：迁移前已存在的匿名数据（`anon_id IS NULL`）在登录时经 `claimLegacy` 并入；未登录匿名用户仍可见遗留行（兼容旧行为）。

### 6. 测试 / CI（H6、H7）
- 根 `pnpm test` 改为 `pnpm -r test`（各子包用自身 vitest 配置解析 `@` 别名）。
- 新增 `.github/workflows/ci.yml`：typecheck + lint + test + web build。
- 登录/密码测试更新为新逻辑。

## 二、子域名 + HTTPS 部署步骤（腾讯云）

约定子域名：**`learn.yuanabd.cn`** → `106.55.2.197`（如想换其它子域，全局替换 `learn.yuanabd.cn` 即可）。

### 1. DNS
在域名 DNS 控制台（yuanabd.cn）添加 A 记录：
```
主机记录：lwb      记录类型：A      记录值：106.55.2.197
```
等待生效（`ping learn.yuanabd.cn` 或 `nslookup learn.yuanabd.cn` 验证）。

### 2. 部署（任选其一，二选一）
**A. 现有 deploy.sh + Nginx（推荐，管理简单）**
```bash
# 服务器上（已有 deploy.sh 流程）：
bash deploy.sh            # 完成应用部署（HTTP :3001）
```
然后配置 Nginx 反代 + 自动 HTTPS：
```nginx
# /etc/nginx/conf.d/learn.yuanabd.cn.conf
server {
    listen 80;
    server_name learn.yuanabd.cn;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host;
                 proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
}
```
```bash
sudo certbot --nginx -d learn.yuanabd.cn      # 自动签发并续期证书
```

**B. Docker Compose（现有 deploy-docker.sh）**
```bash
bash deploy-docker.sh                       # 应用跑在 :3001（HTTP）
# 同样用 Nginx 反代 + certbot 终结 TLS（同上）
```

### 3. 服务端环境（可选）
- 首个注册用户即管理员，无需额外配置；若已有账号，用 `node scripts/create-admin.mjs --username <你的账号>` 升级为管理员。
- 服务器 `.env.local` 保持 `PGHOST/PGUSER/PGPASSWORD` 等不变（Nginx 反代不需要改应用监听端口）。

### 4. 移动端构建
```bash
# 默认已指向 https://learn.yuanabd.cn（app.config.js 注入）
# 本地联调：
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001 EXPO_PUBLIC_ALLOW_CLEARTEXT=1 npx expo start
# 生产打包（默认 HTTPS、禁止明文）：
npx expo run:android --variant release   # 或 EAS Build
```

### 5. 验证
- 浏览器访问 `https://learn.yuanabd.cn`，控制台 Network 确认所有接口走 HTTPS。
- 登录页连续输错 5 次 → 15 分钟锁定提示。
- 设置页「信息源健康度」触发爬虫：未登录/非管理员返回 403；重复点击返回 409（已在运行）。
- `curl -sI https://learn.yuanabd.cn` 应看到 `Strict-Transport-Security` 与 `Content-Security-Policy`。

## 三、已知遗留（P1 跟进）
- **存量 lint 债**：React 19 编译器新规则（react-hooks v6：set-state-in-effect / render 内 Date.now() / ref 访问）对既有 fetch-in-effect 模式的报错（web 8 处 / mobile 7 处）。CI 中 lint 暂不阻塞（continue 方式），P1 统一按新规则迁移（useMemo / useSyncExternalStore / 显式 disable 并注释原因）。
- wellbeing 各表（break/energy/hydration/reminders）与知识笔记已加 `anon_id` 并作用域化；`settings`（职业选择）仍仅登录用户读写。
- 进程内限流为单实例实现；多实例部署需换 Redis（P2）。
- `market` 聚合物化表、爬虫归一化收敛、领域分包等见评审报告 P1 清单。

---

## 四、P1 落地记录（2026-08-22）

| # | 事项 | 状态 |
|---|---|---|
| ① | **存量 lint 债清理**：React 19 compiler 新规则报错（web 8 处 / mobile 7 处）已按仓库既有约定逐处加 `eslint-disable-next-line` 并注明原因；`pnpm lint` 转绿，**CI lint 恢复为硬性门槛** | ✅ |
| ② | **爬虫归一化收敛**：新增 `scripts/lib/normalize.js`（stripHtml / parseSalary / parsePublished / contentHash 单份实现）+ `scripts/lib/normalize.test.mjs`（node:test，7 用例）；`jobs_official.mjs`、`jobs_browser.mjs` 已移除本地重复函数并改为引用统一模块；`scripts/package.json` 声明 `type: module` 消除警告 | ✅ |
| ③ | **market 物化缓存**：新增 `db/migrations/017_market_stats.sql`（`job_postings.tags` GIN 索引 + `market_stats` 缓存表）；`analyzeMarket` 改为 DB 缓存（60s TTL，多实例共享、重启不丢），替代原进程内缓存；`invalidateMarketCache`（从未被调用）移除 | ✅ |
| ④ | **迁移一致性校验**：新增 `scripts/verify-migrations.mjs`（编号检查 + schema 漂移检查），已接入 `pnpm test:scripts` 与 CI | ✅ |
| ⑤ | **子域名切换**：`lwb.yuanabd.cn` → `learn.yuanabd.cn`（app.config.js / app.json / config.ts / settings.tsx / 文档） | ✅ |

### 校验脚本当前输出（存量漂移，P2 清理）
```
[warn] 迁移编号跳号: 11 → 13（缺 12）
[warn] 迁移中新建但 schema.sql 未登记的表（23）: auth_attempts, break_sessions, ..., market_stats, task_runs, ...
```
- 012 编号为历史缺失（无对应文件，非功能性影响）。
- schema.sql 与迁移的漂移属既有问题（迁移新增表未回写 schema.sql），P2 建议以「schema.sql = 全量基线 + 迁移仅增量」为原则做一次对账。

### 剩余 P1 / P2
- **P1 未完**：`lib/domains/*` 领域分包（jobs.ts 496 行拆分）、`packages/config` 业务规则配置化（market 分类/权重/薪资分桶）、统一日志（pino + request-id）、mobile 同步幂等键；`fetch_jobs.py` 已于 2026-08-23 标记废弃（Node 双引擎取代，见 docs/JOBS_ANTI_CRAWL.md）。
- **P2**：爬虫服务化、多实例部署（缓存 Redis 化）、schema.sql 全量对账、迁移 012 补齐说明、Playwright E2E。

---

## 五、服务器部署与 HTTPS 状态（2026-08-22）

### 已上线（learn-workbench-web 容器，Docker Compose）
- 代码同步 → 镜像重建（含 Dockerfile packages/config 修复）→ 迁移 016/017 应用 → 管理员 is_admin=true → 端到端验证（登录/me/受限操作均 200）
- 内部访问 `http://127.0.0.1:3001`、`http://106.55.2.197:3001` 正常（注：公网 3001 已不在安全组放行，见下）

### HTTPS 证书（已签发，DNS-01 方式）
- 因腾讯云对未备案域名拦截 80 端口（302 → dnspod webblock 备案页），HTTP-01 验证不可用
- 已通过 DNS-01（在 DNSPod 手动添加 `_acme-challenge.learn.yuanabd.cn` TXT 记录）签发证书：
  - 证书路径 `/etc/letsencrypt/live/learn.yuanabd.cn/`，有效期 **2026-08-22 → 2026-11-20**
  - nginx 443 SSL 站点已配置并 reload，服务器内部 `https://learn.yuanabd.cn` 返回 307（应用正常）
  - ⚠️ **手动 DNS-01 证书不会自动续期**：到期前需重新执行本流程（或完成备案后改用 `certbot --nginx` 自动续期）

### 备案通过前的临时入口（已配置）
- **http://106.55.2.197/**：nginx 80 默认站点直达学习工作台（IP 访问不受备案拦截，无证书警告）→ 当前可用入口
- **https://106.55.2.197/**：443 默认站点直达（证书为域名证书，会有安全警告）
- nginx 配置已入仓库：deploy/nginx/learn-workbench.conf；曾因安全组不再放行 3001 导致旧地址 http://IP:3001 超时

### ⛔ 唯一阻塞：ICP 备案
- 外网访问 `https://learn.yuanabd.cn` 被腾讯云 **SNI 重置**（连接即断）；`http://learn.yuanabd.cn` 被 302 到备案提示页
- 根因：`learn.yuanabd.cn` **未完成 ICP 备案**（对照：`travel-notes.yuanabd.cn` 同样被 SNI 重置，疑似整域备案状态问题）
- 处理：请在腾讯云控制台「备案」提交 `learn.yuanabd.cn`（或确认 yuanabd.cn 备案状态）；备案通过后 HTTPS 自动可用（证书/nginx 已就绪）
- 说明：公网 3001 端口当前未放行（安全组仅剩 80/443），移动端请直接使用 `https://learn.yuanabd.cn`（备案通过后生效）

---

## 六、P1-B 阶段落地记录（2026-08-23）

| # | 事项 | 状态 |
|---|---|---|
| B1 | 城市/平台编码单源化：`scripts/lib/cities.js`（SUPPORTED_CITIES + CITY_MAP），`jobs_browser.mjs` 引用，`cities.test.mjs` 守护一致性；shared 注释联动 | ✅ |
| B2 | Python 爬虫 `fetch_jobs.py` 退役评估：确认生产服务器不使用（Node 双引擎取代），标记 DEPRECATED + README/调度脚本/文档更新；删除延后至确认无本地计划任务依赖 | ✅ |
| B3 | 领域分包：`lib/jobs.ts`(496行) → `lib/domains/jobs/{queries,config,sources,subscriptions,calendar}.ts`；`lib/market.ts` → `lib/domains/market/{types,analysis}.ts`；均保留 re-export 兼容，路由零改动 | ✅ |
| B4 | 统一日志：`lib/logger.ts`（pino，生产 JSON / 开发 pino-pretty，console 兼容门面），替换 17 文件 21 处 `console.error` → `logger.error` | ✅ |
| B5 | mobile 同步幂等键：**延后**。LWW + 事务 push 已使重放基本幂等（同 updatedAt 不覆盖），剩余收益有限且需 DB 迁移；设计要点：`sync_changes` 增加 (user_id, device_id, entity_type, entity_id, version, created_at) 唯一约束 + ON CONFLICT DO NOTHING，或客户端 changeId——放入 P2 | ⏳ P2 |

> 验证：typecheck 6 包 / 测试 web 168+mobile 21 / lint 0 错误 / web build 通过。
> 部署：以上为本地提交，服务器仍为 A 阶段状态；如需同步 B 阶段到服务器（Docker 重建 + 迁移无新增），确认后执行。