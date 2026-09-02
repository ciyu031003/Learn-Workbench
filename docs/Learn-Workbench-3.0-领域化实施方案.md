# Learn-Workbench 3.0 · 学习领域（Domain）自定义实施方案

> 版本：3.0 / 领域化（Domain-ize）
> 状态：已评审（按推荐执行）· 实施中
> 范围：Web + Android（移动端同步对齐）双端
> 原则：最小侵入式演进 —— 不推翻现有 Liquid Glass UI，不重命名现有表，先把「职业路线」泛化为「学习领域」，再把既有能力按领域接上。

## 一、为什么做

现状：`careers` 表只有 6 条种子职业，任务/日志/专注/仪表盘/顶栏全部围绕「职业 / ICT」硬编码。
目标：用户可以完全自主地创建与管理任何成长主题 —— 职业路线之外，还能建立 英语学习、羽毛球、球类训练 等领域，并复用路线图、任务、日志、专注、打卡、统计等全部既有能力。

## 二、目标模型

```
学习领域 Domain（原 careers 表语义泛化）
├── 职业类（kind=career）：ICT / 前端 / Java …  → 关联 技能树 / 简历 / 面试 / 求职 / 招花
├── 语言类（kind=language）：英语学习 …          → 路线图 + 记录维度
├── 运动类（kind=sports）：羽毛球 / 篮球 / 球类   → 路线图 + 训练记录
├── 其他（kind=custom / hobby / life）：任意自建
└── 每个域 = 名称 + 图标 + 主题色 + 描述 + 阶段前缀 + 模板或空白
```

- 系统内置域与今天一样共享内容；**用户自建域 = 该用户私有的 careers 行 + 私有阶段/主题副本**。
- 领域数据一律按 `user_id`（或 `anon_id`）隔离。
- 职业类专属能力（技能树/简历/面试/求职/市场/职业准备度）只在 `kind=career` 域渲染。

## 三、现状盘点（决策输入）

### 已具备
- 6 条系统路线 + `is_locked`；路线图支持大阶段增删/编辑/拖拽排序、自动更名（migration `022`）。
- 自定义阶段/主题已带 `is_custom` + `owner_id` 雏形（`content_phases` / `content_topics`）。

### 阻止「完全自主自定义」的硬编码点
1. `careers` 表无 `owner_id / kind / icon / color / 归档`，用户无法新建域；
2. `api/settings/career` PUT 白名单硬编码 6 个职业 key；
3. `getRoadmapWithProgress` 阶段查询 `WHERE career_key=$1` 不过滤 owner —— 用户自建阶段可跨账号串扰（存量缺陷，须随 P0 修复）；
4. `api/roadmap/phases` POST/PATCH/DELETE 未校验阶段归属，存在越权改删风险；
5. `daily_tasks.task_type` 枚举僵化（study/agent/output/review/exam），无域维度、无用户自定义分类、无计量字段；
6. `log_entries / focus_sessions / /api/summary / 顶导` 文案与统计默认「职业/ICT」；
7. 移动端 roadmap 读 `packages/content` 内置 ICT 副本，不走 careers 全量；
8. `packages/content` 只有 ICT 一份内置内容。

## 四、分阶段实施

### P0 领域模型底座 + 权限隔离修复
- migration `024_learning_domains.sql`：`careers` 增加 `owner_id / kind / icon / color / phase_prefix / is_archived`（CHECK kind），不重命名表。
- `/api/careers` 返回新字段；新增 `/api/domains`：POST（空白 / 从模板创建）、PATCH（改名/图标/颜色/归档）、DELETE（仅 owner 的自定义域）、POST `/api/domains/:id/duplicate`（克隆模板）。
- `/api/settings/career`：白名单改为查 careers 表；响应带 kind/icon/color。
- `lib/api.ts` 阶段查询改为 `WHERE career_key=$1 AND (is_custom = FALSE OR owner_id = $2)`；`lib/roadmap-admin.ts` 与 phases CRUD 加 owner 鉴权。
- 每 API 路由配 `route.test.ts`。
- 验收：老数据零变化；账号 A 自建域对账号 B 完全不可见；老 6 职业照旧；test/typecheck/lint 全绿。

### P1 内容模板库：英语 / 羽毛球 / 球类
- `packages/content/src/domain-templates.ts`：用户「从模板创建」时服务端复制成私有域，不预灌所有人的 careers。
- 内置模板：羽毛球·从零到实战（sports）；英语学习（language）；球类运动通用框架（sports，可套篮球/乒乓球等）；空白领域（custom）。

### P2 跨模块「域」维度打通
- `daily_tasks` 增加 `domain_key`（可空）+ `category text`（用户自定义分类，绕开 task_type 枚举僵化；旧枚举保留兼容）；
- `log_entries` 增加 `domain_key`；专注统计与打卡按域聚合；
- 仪表盘领域切换 chips + 「各领域投入分布」；当前域为 career 时保留职业准备度，非 career 显示本月投入/连续打卡/目标进度；顶栏领域胶囊换成域图标+色；
- 职业专有能力入口对非 career 域隐藏。

### P3 领域记录维度（Tracker）
- 新表 `domain_trackers` + `tracker_logs`：通用计量模型（名称/单位/日周目标/频率；日期/数值/备注），一套覆盖英语单词量、羽毛球训练量、跑量等，替代逐个写死子模块。

### P4 移动端对齐 + 收尾
- 移动端 roadmap：ICT 走本地，其余域走 Web API（或 sync 扩展 domain/roadmap 实体）；
- 领域管理在移动端「我的」提供只读/轻量管理；JSON 导入导出包含自定义域与记录项；
- 双端 UI 过 impeccable detector、Playwright e2e、Docker 部署回归。

## 五、不改什么（边界）
- 不做内容社区 / 多人协作 / 模板市场；
- 不做大规模表/字段重命名（`careers` 物理名保留）；
- 招花爬虫、技能树/简历/面试/求职、健康提醒、Bing 背景、导出同步逻辑不动（仅职业专属入口条件化）；
- 移动端 APK 打包（M6）不在本次范围。

## 六、验收与验证方式
每阶段收口：新 migration 干净库 + 现有 `.pgdata` 幂等各跑一遍 → `pnpm -F web test` / typecheck / lint → Web 手工冒烟（老职业不受影响 → 模板建英语域 → 打勾/任务/记录 → 换域统计 → 职业域保留专属入口）→ impeccable detector → 可选 Playwright e2e。

## 七、工作量估算
P0 ≈ 0.5–1 天 · P1 ≈ 1–1.5 天 · P2 ≈ 1 天 · P3 ≈ 1.5–2 天 · P4 ≈ 1–2 天。