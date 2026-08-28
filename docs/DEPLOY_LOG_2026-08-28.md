# 招花 · 新疆/兵团/重庆重点爬取 交付记录

- 交付日期：2026-08-28（Asia/Shanghai）
- 服务器：106.55.2.197（SSH: ubuntu@106.55.2.197）
- 部署路径：/home/ubuntu/learn-workbench
- 部署方式：Docker Compose，`docker compose build web` + `docker compose up -d web`

## 一、目标
在既有 11 城（成都等）招聘爬取基础上，新增**新疆全疆 + 兵团 + 重庆**重点覆盖；同时不丢弃其他一二线城市。互联网平台（51job/智联）除乌鲁木齐外，补齐克拉玛依等主要地州。

## 二、代码改动
1. `config/job-hosts/sources.json`：信息源从 10 → **14 个**，新增
   - `xjrst-sydw` 新疆人社厅·事业单位招聘（http）
   - `xjrsks-notice` 新疆人事考试中心·最新动态（http，官网 https://www.xjrsks.com.cn/ncms/index.shtml）
   - `btpta-recruit` 兵团考试信息网·通知公告（http）
   - `cqrsj-sydw` 重庆人社局·事业单位公开招聘（http）
   - `iguopin` 改为多区域 districts（成都/北京/上海/广州/深圳/杭州/西安/南京/武汉/苏州/乌鲁木齐/新疆/重庆）
2. `scripts/jobs_official.mjs`：`crawlIguopinApi` 由单城市成都注入改为 `districts` 多区域循环，按 `job_id` 去重。
3. `scripts/lib/cities.js`：城市从 11 → **20 个**，修正全部 zhilian/job51 编码（详见下文）。
4. `packages/shared/src/index.ts`：`SUPPORTED_CITIES` 同步 20 城，前端城市 chip 常驻显示。
5. `scripts/jobs_browser.mjs`：城市解析正则补齐新疆主要地州；保留 `JOBS_PROXY` 住宅代理支持。

## 三、平台城市编码实测（2026-08-28）
### 智联招聘（jl）
- 北京 530、上海 538、广州 763、深圳 765、杭州 653、成都 801、西安 854、重庆 551、南京 635、武汉 736、苏州 639
- 乌鲁木齐 890、克拉玛依 891、吐鲁番 892、哈密 893、昌吉 894、喀什 899、和田 900、伊犁 901、阿克苏 897

### 前程无忧（jobArea，来自 51job dictionary 接口）
- 北京 010000、上海 020000、广州 030200、深圳 040000、杭州 080200、成都 090200、西安 200200、重庆 060000、南京 070200、武汉 180200、苏州 070300
- 乌鲁木齐 310200、克拉玛依 310300、喀什地区 310400、伊犁 310500、阿克苏 310600、哈密 310700、石河子 310800、昌吉 311200、吐鲁番 311400、和田 311600

> 修正历史错误：广州 653→763、杭州 619→653、西安 715→854、南京 631→635、武汉 679→736、苏州 653/050200→639/070300、乌鲁木齐 749/330100→890/310200。

## 四、部署步骤（服务器已完成）
1. scp 变更文件：`config/job-hosts/sources.json`、`scripts/jobs_official.mjs`、`scripts/jobs_browser.mjs`、`scripts/lib/cities.js`、`packages/shared/src/index.ts`
2. `docker compose build web`（构建成功，Next 16.3.0 + Turbopack）
3. `docker compose up -d web`（容器 recreate，db healthy）
4. 容器内 `node scripts/update_job_hosts.mjs` 落库：**14 源，version=3**
5. 更新 `job_crawler_configs`：cities=20 城、platforms=zhilian/job51、provinces=四川/重庆/新疆、categories=全量

## 五、验证结果（服务器实测）
- `update_job_hosts --dry-run`：14 源，version=3 ✅
- `node scripts/jobs_official.mjs --sources xjrst-sydw --limit 10`：**25 行，新增 25** ✅
- `node scripts/jobs_official.mjs --sources xjrst-sydw,btpta-recruit,cqrsj-sydw,xjrsks-notice --limit 10`：**55 行，新增 30** ✅
- `node scripts/jobs_browser.mjs --dry-run --timeout-min 1 --limit 3`：智联北京/上海/广州/深圳各 3 条，共 12 行（代理生效，标题/链接解析已修复，未写库）✅
- `node scripts/jobs_browser.mjs --limit 10 --timeout-min 2`（临时配置：前程无忧/乌鲁木齐/前端）：**7 条，新增 7**，标题与详情链接正确 ✅
- 前端构建产物已包含“克拉玛依”等新城市 chip ✅

## 六、备注 / 待办
1. `JOBS_PROXY` 已在服务器 `.env` 配置为住宅代理，`docker compose up -d` 后已生效。
2. 猎聘仍按前次结论放弃（F12/自动化触发空白页，App-Bound 加密 cookie 无法导出）。
3. `cdhrss-sydw` 保持默认关闭（成都人社局 WAF 403），后续服务器可达再启用。
4. 全量互联网平台爬取组合 880 个（20 城 × 22 关键词 × 2 平台），建议通过 `job_crawler_configs.schedule_time` 定时分批运行，避免单次超时。
---

# 追加记录（2026-08-29）：新疆/兵团 央国企（yangqi）信息源补齐

## 背景
2026-08-28 交付后，新疆地区**考公/考编/岗位类**信息源（xjrst-sydw / xjrsks-notice / btpta-recruit / cqrsj-sydw）均正常，但 **央国企（yangqi）** 在新疆几乎为空。排查发现两点根因：
1. hosts/sources.json 中缺少新疆、兵团的**国资委官方招聘/公示**信息源；
2. `crawlIguopinApi` 用 `slice(0, limit)` 按先后截断，成都/北上广等前置 district 占满额度，导致后置的 乌鲁木齐/新疆/重庆 被裁掉。

## 代码改动（相对 v3）
- `config/job-hosts/sources.json`：信息源 **14 → 16 个**，`meta.version` **3 → 4**，新增两个央国企官方源：
  - `xjgzw-gsgg` 新疆国资委·公示公告（http，`http://gzw.xinjiang.gov.cn/gzw/gsgg/list_tj.shtml`，title_filter `招聘|拟聘|录用|遴选|引进|选聘|引才`）
  - `btgzw-tzgg` 兵团国资委·通知公告（http，`http://gyzc.xjbt.gov.cn/xxgk/tzgg/`，title_filter `招聘|拟聘|录用|遴选|选聘`）
  - 均为 `category=yangqi`、`channel=announcement`、`city=乌鲁木齐`、`engine=http`
- `iguopin` 的 `api.districts` 由 **13 → 21** 个，新增：克拉玛依、吐鲁番、哈密、昌吉、伊犁、喀什、阿克苏、和田。
- `scripts/jobs_official.mjs`：`crawlIguopinApi` 修复
  - 按 `job_id` 全局去重；
  - 遍历全部 `districts` 注入接口（`recom-job`），去掉"只注入单一默认城市"逻辑；
  - 结果上限由 `slice(0, limit)` 改为 `slice(0, Math.max(limit, districts.length * 25))`，防止前置城市占满导致地区失衡。

## 部署步骤（服务器已完成）
1. scp `config/job-hosts/sources.json`、`scripts/jobs_official.mjs` → 服务器 `/home/ubuntu/learn-workbench`
2. `docker compose cp` 进 `web:/app/...`
3. 容器内 `node scripts/update_job_hosts.mjs` 落库：**16 源，version=4**（app_meta 已确认 `{"version":4}`）
4. `node scripts/jobs_official.mjs --sources xjgzw-gsgg,btgzw-tzgg --limit 10`：**13 行，新增 13**（3 xjgzw + 10 btgzw，city=乌鲁木齐）
5. `node scripts/jobs_official.mjs --sources iguopin --limit 30 --timeout-min 5`：**336 行，新增 182**（21 district 全量循环）

## 验证结果（数据库实测 postgres：Learn-Workbench）
- `job_crawler_sources`：16 源；yangqi 源 = `sasac-recruit, xjgzw-gsgg, btgzw-tzgg, iguopin`，均 enabled=true ✅
- `iguopin.list_config.api.districts`：`jsonb` object，长度 **21** ✅
- 新疆/兵团央国企（yangqi）job_postings 分布：
  | source | city | 数量 |
  |---|---:|---:|
  | iguopin | 乌鲁木齐 | 33 |
  | iguopin | 昌吉 | 20 |
  | iguopin | 伊犁 | 17 |
  | iguopin | 喀什 | 15 |
  | iguopin | 哈密 | 13 |
  | iguopin | 克拉玛依 | 8 |
  | iguopin | 阿克苏 | 7 |
  | iguopin | 和田 | 6 |
  | iguopin | 吐鲁番 | 4 |
  | iguopin | 新疆 | 1 |
  | btgzw-tzgg | 乌鲁木齐 | 10 |
  | xjgzw-gsgg | 乌鲁木齐 | 3 |
  合计新疆/兵团央国企 **137** 条；全库 `job_postings` **2832** 条，其中 `category=yangqi` **628** 条 ✅

## 前端
- 构建产物 `/app/apps/web/.next/server/chunks/ssr/packages_shared_src_index_ts_*.js` 已包含 `克拉玛依/和田/乌鲁木齐`，前端城市 chip 可常驻显示新疆城市，`yangqi` 分类数据已落库可查询。

## 备注
- `config/job-hosts` 为容器只读挂载，sources.json 改动即时生效，无需重建镜像；但 `packages/shared` 的 `SUPPORTED_CITIES` 需随镜像构建。
- 后续如需刷新全量官方源，可 `docker compose exec -T web node /app/scripts/jobs_official.mjs --limit 30 --timeout-min 5` 全分类跑一次。
