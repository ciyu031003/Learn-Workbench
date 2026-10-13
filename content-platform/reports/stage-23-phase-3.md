# 阶段 23 汇报：内容生产流水线与开源适配（V3 Phase 3）

- **ADR**：ADR-001（内容模型与稳定 ID）、ADR-004（安全纵深与权限；导入来源校验复用）
- **日期**：2026-10-13
- **前置提交**：`1b3174c`（P2 408 入口与章节浏览）
- **范围**：仅新增采集/解析/校验、导入审计、格式和文档；不改 Web / 移动端 UI，不新增发布版本

## 发现

1. 现有通用导入管线已经支持 `new/update/skip/conflict/failed`、`status='review'`
   和批次明细，但缺少面向课程/题库的统一包格式；408 独立链路也没有接入
   `content_import_batch`。
2. 408 快照导入此前直接写 `status='published'`，没有批次审计；来源变化时也没有
   明确的“已发布内容冲突”状态。按照 Phase 3 的审核口径，这需要收紧。
3. 实施方案列出的 6 个候选项目需要重新核验。实测许可证分别为 MIT、Apache-2.0、
   NOASSERTION、MIT、GPL-3.0、MIT；不能把“可查看”直接等同于“可复制”。
4. 本地 408 快照仍为 4 科 / 25 章 / 99 知识点 / 18 套 / 846 题，和 P2 数据库计数一致。

## 改动

### 统一课程包 / 题库格式

- 新增 `content-platform/schemas/content-package-v1.schema.json`：
  `review-only` 包结构、来源许可、章节/知识点/题目/关联字段。
- 新增 `scripts/lib/content-package.mjs`：
  - 跨字段校验：唯一 key、题目回链知识点、choice 四选项、答案字母；
  - 安全检查：拒绝 `<script>`、iframe、事件处理器、`javascript:`；
  - `content_import_item` 转换：`exam-408` 包固定输出 `unmapped` 审计项，
    避免通用学习库导入器复制出第二套 `knowledge_points`；
  - 稳定 package fingerprint。
- 新增 `scripts/validate-content-package.mjs`：
  本地校验和 `--emit-import-items`，不碰数据库。
- 新增文档 `content-platform/content-package-v1.md`。

### 408 内容试点

- 新增 `scripts/beokayy-408/export-package.mjs`：
  从本地 `.local/beokayy-408/parsed/` 导出指定章节为统一包，仍固定输出 `review`。
- 实跑章节 `data-structure / ds-02`：
  - 1 章、3 知识点、5 道题、5 条关联；
  - `strict` 校验通过；
  - 生成物：`.local/beokayy-408/pilots/data-structure-ds-02.package.json`（不提交正文）。

### 408 导入审计与审核门

- 新增 `scripts/beokayy-408/plan.mjs`：
  - `new/update/skip/conflict/failed` 纯函数规划；
  - 已发布内容指纹变化默认判 `conflict(published-content-changed)`；
  - 报告 stale key，但不物理删除。
- 扩展 `scripts/beokayy-408/import-db.mjs`：
  - 默认物化状态改为 `review`；
  - `content_import_batch` + `content_import_item` 记录 99 知识点和 846 题目；
  - 有冲突/失败时整次内容物化停止，只保留审计批次；
  - 已发布行写入带 `WHERE status <> 'published'` 守卫；
  - 只有显式 `--apply --publish` 才能走发布物化路径；
  - 报告 bundle/manifest hash、stale 数量和 materialized 状态。
- 扩展 `scripts/beokayy-408/audit.mjs`：
  核对最新批次状态、bundle hash、数据库计数和来源快照。
- 新增迁移 `db/migrations/072_exam_408_import_audit.sql`：
  把 `beokayy-408` 登记进通用 `content_source`，不新建表，不改 408 内容权威表。

### 开源准入审计

- 新增 `content-platform/open-source-audit.json` 和 `open-source-audit.md`，
  逐一记录 6 个候选项目的 LICENSE、最近提交、技术栈、依赖、可复用模块、安全边界和决策。
- 新增 `scripts/audit-open-sources.mjs`：离线结构校验 + `--online` GitHub metadata /
  license 复核。
- 结论：
  - `learn-from-materials`、`Exameow`、`Examination-System`：适配小模块；
  - `Aether`、`learning-platform`、`Moodle`：只借鉴，不复制源码；
  - 没有“直接整库复用”的候选。

## 数据库与契约

- 数据库迁移：`072` 只增加 `content_source('beokayy-408')`。
- 无公开 API 变更。
- 无 Web / 移动端组件变更。
- 新增内容包 JSON Schema 与 CLI 契约。

## 验证

| 门禁 | 命令 | 结果 |
|---|---|---|
| 脚本测试 | `pnpm test:scripts` | 106 通过；迁移 72 文件；内容质量 0 警告；索引/API/worklet 通过 |
| 类型 | `pnpm typecheck` | 7/7 通过 |
| 内容包 | `pnpm -F @learn-workbench/content test` | 4 文件 / 34 通过 |
| Web | `pnpm -F web test` | 209 文件通过 / 3 skipped；1401 通过 / 15 skipped |
| 移动端 | `pnpm -F mobile test` | 65 文件 / 614 通过 |
| Web lint | `pnpm -F web lint` | 0 error / 56 历史 warning |
| 移动端 lint | `pnpm -F mobile lint` | 0 error / 66 历史 warning |
| 开源在线复核 | `node scripts/audit-open-sources.mjs --online` | 6/6 仓库、分支、SPDX 一致 |
| 章节试点 | `export-package.mjs --chapter=ds-02` + strict validate | 1 章 / 3 点 / 5 题 / 5 关联 |
| 408 dry-run | `node scripts/beokayy-408/import-db.mjs` 连续两次 | 每次 `0 new / 0 update / 945 skip / 0 conflict` |
| 408 apply 守卫 | `node scripts/beokayy-408/import-db.mjs --apply` | 945 skip；99 点 / 846 题仍全部 published |
| 408 审计 | `node scripts/beokayy-408/audit.mjs --require-db` | `issues=0`，最新批次 hash 对账通过 |

## 风险与边界

- 统一包通过校验后仍不会自动进入 `packages/content`；这是刻意保留的人工审核边界。
- 408 import 的默认路径是 `review`。现有线上数据已经 published，所以默认 apply
  不会降级；新内容必须先经过批次审计，再由人工决定是否 `--publish`。
- stale key 只报告，不自动归档；删除/下线仍由后续审核动作处理。
- `beokayy-408` 与 `csgraduates-408` 的内容许可仍是个人学习、非商业、不再分发；
  代码许可证核验不会扩大内容许可。
- 本轮没有跑 Android 真机/OTA，因为没有 UI 或版本变更。

## 回滚

1. `git revert` 本轮提交即可回滚所有脚本、Schema、文档和来源登记。
2. 数据库回滚顺序：
   - 先删除本轮产生的 `content_import_batch` 明细；
   - 再删除 `content_source` 中 `beokayy-408` 行；
   - `exam_408_*` 内容表未被这套审计迁移改写，不需要回滚。

## 下阶段

Phase 4 进入掌握度与间隔复习：

1. 盘点 `learning_attempts` / `learning_review_cards` 的现有事件和时区字段；
2. 定义可解释的初始掌握度规则，先不接黑盒参数；
3. 单独核验 FSRS 实现的许可证、参数迁移和离线/跨设备冲突；
4. 用统一包里的 `knowledgePointKeys` 把薄弱知识点接入下一轮复习任务。
