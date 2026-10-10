# 导入映射（import-maps）

每个登记在 `content_source` 里的来源，可以有一个同名映射文件：

```
content-platform/import-maps/<content_source.key>.json
```

映射的作用只有一个：**告诉导入管线"这个外部文件对应我们哪个知识点"**。
管线不猜归属 —— 没有映射的候选文件照样进批次，但记成 `skip(unmapped)`，
形成"还有哪些外部章节没归类"的工作清单。

## 格式

```json
{
  "sourceKey": "algorithms-java",
  "ref": "main",
  "entries": {
    "<仓库相对路径>": {
      "trackSlug": "java",
      "stageKey": "java-foundation",
      "topicKey": "java-types-control",
      "title": "可选：覆盖源文件标题",
      "summary": "可选：覆盖摘要",
      "difficulty": "easy | medium | hard",
      "tags": ["算法", "数组"],
      "estimatedMinutes": 12,
      "qualityLevel": "L2"
    }
  }
}
```

- `entries` 的键是**仓库相对路径**（正斜杠），与 `walkDocs` 输出一致。
- `targetKey` 缺省时按 `<trackSlug>/<stageKey>/<topicKey>` 计算（即知识点稳定键）。
  需要指向"另一个已存在知识点"时显式写 `targetKey`。
- 一个来源的多个文件映射到同一个 `targetKey` 会被判成 `target-collision` 冲突 ——
  这正是"多个来源争同一个知识点"该被人工决策的场景，不自动挑一个。

## 命名

- 真实来源：`<sourceKey>.json`
- 模板/示例：以 `_` 开头（如 `_template.json`），不会被任何 `--source` 命中。

## 校验

```bash
# dry-run：只出报告，不写库（先看 unmapped / conflict 有多少）
pnpm import:content -- --source=algorithms-java

# 小批量试导入：只取前 20 个候选，物化成 review 草稿
pnpm import:content -- --source=algorithms-java --mode=apply --limit=20
```
