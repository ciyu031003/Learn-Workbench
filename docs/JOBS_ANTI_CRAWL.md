# 招花 · 反爬/登录态/代理 配置说明

> 适用：服务器（106.55.2.197）部署的「招聘信息」爬虫返回空 / 城市选项缺失等问题排查与修复。
> 背景结论（2026-08-23 实测）：
> - 前程无忧(51job)：真实浏览器 + 住宅 IP 下**未登录**也能抓到职位（成都·前端工程师 157 条）；服务器返回空主要是**云服务器 IP 被 WAF/风控标记**。
> - 猎聘：自动化/无头浏览器会被其安全脚本清成 about:blank；需要登录态 + 更接近真实浏览器的运行方式。
> - Chrome 151 起 cookie 使用 v20 App-Bound 加密，**无法**从本地文件/复制 Profile 直接导出；只能通过「真实浏览器手动登录一次」采集（本目录方案 A）。

## 方案 A：登录态 Cookie（storageState）

1. 在本机（有显示器）执行采集器，会弹出真实 Chrome 窗口，逐个站点登录：
   ```bash
   cd F:\CodeFiles\Learn-Workbench
   node scripts/harvest_cookies.mjs --out config/job-hosts/storageState.json
   # 依次在窗口里登录：猎聘 → 前程无忧 → 国聘网（可跳过），每登录完一个回到终端按回车
   ```
2. 把生成的 `config/job-hosts/storageState.json` 上传到服务器仓库根目录（Docker 部署即宿主机 `<repo>/config/job-hosts/storageState.json`；compose 已把该目录只读挂载进容器）。
3. 爬虫会自动加载它（默认路径 `config/job-hosts/storageState.json`，可用 `--storage-state` 或环境变量 `JOBS_STORAGE_STATE` 覆盖）。
   - 命令行：`node scripts/jobs_browser.mjs --storage-state /path/storageState.json`
   - 提示：storageState 含登录会话，已加入 `.gitignore`，**不要提交到 Git**。

## 方案 B：住宅/干净代理（根治 IP 风控）

爬虫支持 `--proxy` 参数 / 环境变量 `JOBS_PROXY`，格式 `http://user:pass@host:port` 或 `http://host:port`。

- Docker 部署：在服务器 `<repo>/.env` 追加（compose 已透传）：
  ```bash
  JOBS_PROXY=http://user:pass@host:port
  ```
  然后 `bash deploy-docker.sh --restart`（或 `docker compose up -d`）。
- PM2 / 非 Docker 部署：写入 `apps/web/.env.local`（Next.js 服务端会加载）：
  ```bash
  JOBS_PROXY=http://user:pass@host:port
  ```
  重启 web 服务即可。

代理建议：住宅 IP（或至少干净数据中心 IP），否则 51job/智联的 WAF 仍可能拦截。

## 验证

- 直接跑一次互联网爬虫（dry-run 不写库，但需要能连数据库）：
  ```bash
  cd /path/to/repo
  node scripts/jobs_browser.mjs --dry-run --limit 10
  ```
- 或登录后台 → 招聘页 → 立即抓取，然后看 `/api/jobs/health` 与 `/api/jobs/runs` 的平台计数。

## 常见问题

- 猎聘仍返回空：优先确认 storageState 里有 `lt_auth` 且代理是干净 IP；猎聘对无头浏览器识别最严，必要时在服务器用 Xvfb 跑 headed 或接受其部分缺失。

## 猎聘登录态采集受阻（2026-08-23 实测）

猎聘风控会把「被自动化控制的浏览器」清空成 about:blank（包括采集器窗口、以及本助手驱动真实 Chrome 的标签页），因此采集器经常抓不到 `lt_auth`。
手动导出备用方案（在**你日常的 Chrome** 里操作，不要由助手驱动）：

1. 正常打开 `https://www.liepin.com` 并确认右上角已登录；
2. 按 F12 → Application → Storage → Cookies → `https://www.liepin.com`；
3. 复制 `lt_auth`（以及 `acw_tc` 等）的 name=value 发给助手，由助手合并进 `config/job-hosts/storageState.json`。

也可接受猎聘不登录：8/17 本地与服务器均有「未登录 headless 抓到猎聘职位」的记录，配合干净代理后建议先跑一次看是否已恢复。
- 城市选项只剩「成都」：城市筛选来自数据库已有数据；多城市数据抓回来后会自动出现（前端另有规范城市列表可加固，见代码 TODO）。
- 国聘网/成都事业单位：需在 `config/job-hosts/sources.json` 补充源（cdhrss 尚未配置），再 `node scripts/update_job_hosts.mjs` 落库。
