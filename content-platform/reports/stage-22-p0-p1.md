# 阶段 22 汇报：P0 基线审计与 P1 408 导入加固

- **ADR**：ADR-001（内容模型与稳定 ID）
- **日期**：2026-10-13
- **提交**：执行前基线 `f287197`（`v1.45.1 / code 77`）
- **范围**：只处理采集、解析、校验、内容模型同步和数据库核验，不改 UI、不发布版本

## 发现

1. 当前内容包基线为 21 门课程、101 个阶段、360 个知识点、1935 道题；其中 1747 道题已关联知识点，188 道题仍未分类。
2. 408 快照包含 2009-2026 共 18 套试卷、846 道题（720 道选择题、126 道综合题、145 道含图题）。
3. 408 知识点索引包含 4 个科目、25 章、99 个知识点、1129 条题目关联：
   - 数据结构：7 章 / 31 个知识点 / 296 条关联
   - 计算机组成原理：7 章 / 27 个知识点 / 365 条关联
   - 操作系统：5 章 / 17 个知识点 / 257 条关联
   - 计算机网络：6 章 / 24 个知识点 / 211 条关联
4. 本地测试库最初的迁移记录不完整，只登记了 11 个迁移；`knowledge_points` 等统一内容模型表尚未建立。058、060-063、065-070、071 对应内容链已补齐并同步，但 059 因缺少历史 `uploads` 表、064 因缺少历史 `meal_entries` 表未执行；这是本地旧库的历史迁移欠账，不应在生产库上跳号补丁。
5. 408 来源继续按 `personal-study` 使用范围保存，来源站未声明开源或转载许可，当前实现不把快照作为可再分发内容。
6. 采集脚本此前没有内容量基线，知识和题目数量下降时校验仍可能通过；408 导入也没有独立的“快照、导入模型、数据库”三方审计入口。

## 改动

- 新增 `scripts/beokayy-408/baseline.json`，记录四科章节、知识点、题目关联及试卷/题目的最低可接受数量。
- 扩展 `scripts/beokayy-408/validate.mjs`，对知识点、章节、关联和总体题量做回归检查，并补空标题检查。
- 新增 `scripts/beokayy-408/audit.mjs`，只读核对本地快照、导入模型和 PostgreSQL 计数、来源哈希与使用范围。
- 调整 `scripts/beokayy-408/import-db.mjs`，使数据库计数按 `source_key` 统计，并支持被审计脚本安全复用。
- 新增 `scripts/lib/beokayy-408.test.mjs`，覆盖选项解析、图片网格解析、答案字母提取和知识量回归。
- 将 408 测试加入 `pnpm test:scripts`，新增 `pnpm audit:408`。
- 同步统一内容模型：360 个知识点、1747 条题目关联、615 条知识点关系、80 条前置关系。

## 验证

- `node scripts/beokayy-408/validate.mjs`
  - `years=18 questions=846 errors=0 warnings=0`
- `node scripts/beokayy-408/import-db.mjs --apply` 连续执行两次
  - 两次均为 `subjects=4 chapters=25 points=99 papers=18 questions=846 links=1129 tags=249`
- `node scripts/beokayy-408/audit.mjs --require-db`
  - `snapshot=18p/846q knowledge=25c/99pts database=connected issues=0`
- 数据库核对：
  - `exam_408_questions=846`
  - `exam_408_question_knowledge_points=1129`
  - `exam_408_tags=249`
  - 选择题有效数 `720`，含图题 `145`，无效试卷 `0`
  - `knowledge_points=360`，`question_knowledge_point=1747`
- `node scripts/check-content-quality.mjs --strict --require-db`
  - 通过，0 个警告
- `pnpm test:scripts`
  - 90 个脚本测试通过，迁移、内容质量、发布卫生、索引、API 清单和 worklet 门禁均通过
- `pnpm -F @learn-workbench/content test`
  - 34 个内容测试通过

## 风险

- 本地库不是生产库，迁移记录欠账不会自动代表线上状态；后续部署前必须在目标库执行只读迁移对账，不能直接复制本地修复。
- 旧内容库仍有 188 道题未关联知识点，属于下一阶段的关联质量工作，不影响本次 408 快照落库。
- 408 导入目前是独立摄取链，尚未写入通用 `content_import_batch` 审计批次；如果后续要求跨来源统一回滚，应单独设计适配，不应硬塞进现有知识条目流水线。
- 408 页面和统一知识模型仍是两套读取路径；P2 需要在 UI 重构前完成稳定 ID 映射，不应复制正文到两套表。

## 下一阶段

1. 在目标数据库执行迁移对账，补齐历史欠账并确认 058-071 的真实状态。
2. 用 408 四科章节和知识点建立与 `knowledge_points` 的稳定映射。
3. 进入 P2：重构 408 科目、章节、知识点和历年试卷入口，同时保留当前数据层不改。
