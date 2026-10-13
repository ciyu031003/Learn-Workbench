# 统一课程包 / 题库格式 v1（Phase 3）

## 目标

外部项目、408 快照和后续 AI 辅助生产都先转换成同一份 JSON 包，再经过
校验、去重、关联检查和人工审核，最后才允许进入正式内容包或发布状态。

格式的硬边界：

- 包本身只能是 `status: "review"`；导入器不接受 `published`。
- 每个章节必须有稳定 `key`，每个知识点和题目必须有稳定 `key`。
- 每道题必须通过 `knowledgePointKeys` 回链到包内知识点。
- 题目答案、选项、来源 URL 和来源许可都随包保存。
- 危险 HTML / `javascript:` / 内联事件处理器直接判错。

`content-platform/schemas/content-package-v1.schema.json` 是结构契约，
`scripts/lib/content-package.mjs` 是运行时校验与去重实现。两者同时存在：
schema 方便外部工具预校验，脚本负责跨字段、关联和危险内容检查。

## 最小结构

```jsonc
{
  "formatVersion": 1,
  "packageKey": "beokayy-408-data-structure-ds-02-pilot",
  "title": "408 数据结构 · 线性表（内容试点）",
  "domain": "exam-408",
  "status": "review",
  "source": {
    "key": "beokayy-408",
    "name": "四〇八档案室",
    "url": "https://zhenti.beokayy.club/",
    "license": "站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发。",
    "usage": "personal-study",
    "ref": "bundle-2026-10-11"
  },
  "course": { "key": "ex-408-grad", "title": "408 考研专项", "category": "408" },
  "chapters": [
    {
      "key": "beokayy-408/ds-02",
      "title": "线性表",
      "subjectKey": "beokayy-408/data-structure",
      "subjectTitle": "数据结构",
      "points": [
        {
          "key": "beokayy-408/ds-02-02",
          "title": "线性表的顺序表示",
          "summary": "顺序表的随机访问、插入和删除代价。",
          "tags": ["数据结构", "线性表", "顺序表"]
        }
      ]
    }
  ],
  "questions": [
    {
      "key": "beokayy-408/2023-01",
      "externalId": "2023-01",
      "type": "choice",
      "prompt": "下列操作的算法中，平均时间复杂度为 O(1) 的是？",
      "options": [
        { "key": "A", "text": "按位获取元素" },
        { "key": "B", "text": "按值查找" },
        { "key": "C", "text": "在表头插入" },
        { "key": "D", "text": "删除中间元素" }
      ],
      "answer": { "choice": "A", "text": "答案：A" },
      "knowledgePointKeys": ["beokayy-408/ds-02-02"],
      "tags": ["顺序表", "复杂度"],
      "sourceUrl": "https://zhenti.beokayy.club/question/2023-01"
    }
  ],
  "review": {
    "status": "pending",
    "reviewer": "",
    "reviewedAt": "",
    "note": "人工复核后才允许发布"
  }
}
```

## 校验命令

```bash
# 结构 / 关联 / 安全 / 质量检查；不写数据库
pnpm validate:package -- --file .local/beokayy-408/pilots/data-structure-ds-02.package.json --strict

# 导出通用 content_import_item 形状，交给现有导入管线做 dry-run/批次审计
pnpm validate:package -- --file <package.json> --emit-import-items .local/package-items.json
```

`domain: "exam-408"` 的包只会输出 **skip(unmapped) 审计工作项**，不会通过通用
学习库导入器写 `knowledge_points`；408 的正文物化仍由
`scripts/beokayy-408/import-db.mjs` 写入 `exam_408_*`。

## 408 单章试点生成

```bash
node scripts/beokayy-408/export-package.mjs --subject=data-structure --chapter=ds-02
node scripts/validate-content-package.mjs --file .local/beokayy-408/pilots/data-structure-ds-02.package.json --strict
```

生成命令只读 `.local/beokayy-408/parsed/`，不写 PostgreSQL，也不会修改 UI。
生成结果固定落在 `.local`，避免把站点正文误当成可再分发内容提交。
