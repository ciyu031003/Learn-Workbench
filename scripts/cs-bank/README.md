# cs-bank · 本地备考资料 → 题库流水线

把本机的考研 / 计算机等级考试 / 面试 / 教材资料抽取成结构化题目，再分两路落地：

1. **学习题库（App 内容包）**：带答案的 4 选 1 选择题 → `packages/content/src/learning/exam-bank.ts`
   （由 `gen_ts.py` 生成，经 `question-expansions.ts` 并入对应课程）。
2. **面试 / 技术题库（服务端 DB）**：全部题目（选择题 + 问答 + 知识点卡）→ `interview_questions`
   （由 `gen_csv.py` + `import_bank.sql` 批量导入，`external_key` 以 `local-material#` 前缀去重）。

## 依赖

- Python 3（本机用 `py`），需 `PyMuPDF`（`fitz`）、`python-docx`、`python-pptx`：
  `py -m pip install pymupdf python-docx python-pptx`
- 导入到数据库需要目标 Postgres 可达；生产导入走服务器 `learn-workbench-db-1` 容器。

## 使用

在本仓库根目录依次执行（中间产物都落 `.local/csimport/`）：

```powershell
py scripts/cs-bank/extract.py  .local/csimport/raw.jsonl        # 1. 抽取文本
py scripts/cs-bank/parse.py    .local/csimport/raw.jsonl .local/csimport/items.jsonl   # 2. 解析成题目
py scripts/cs-bank/finalize.py                                  # 3. 过滤去重 分类 → bank.jsonl + bundled.json
py scripts/cs-bank/gen_ts.py                                    # 4. 生成 exam-bank.ts
py scripts/cs-bank/gen_csv.py                                   # 5. 生成 bank.csv（导入用）
```

导入（服务器）：

```bash
scp .local/csimport/bank.csv .local/csimport/import_bank.sql ubuntu@<host>:/tmp/
ssh ubuntu@<host> "docker cp /tmp/bank.csv learn-workbench-db-1:/tmp/bank.csv && \
  docker cp /tmp/import_bank.sql learn-workbench-db-1:/tmp/import_bank.sql && \
  docker exec learn-workbench-db-1 psql -U lwb -d Learn-Workbench -f /tmp/import_bank.sql"
```

导入是幂等的（`ON CONFLICT (external_key) DO NOTHING`）；重跑只补齐新增题目。

## 抽取范围

`extract.py` 里的 `ROOTS` 是本机的资料目录（考研真题、等级考试资料、面试 PDF、教材书库、
模拟题），换机器时改这一段即可。抽取只做「PDF/DOCX/PPTX/TXT」纯文本，扫描件（图片型 PDF）会得到空文本，
属预期。

## 口径

个人自用、不商用。题目来源如实记录在 `source`（文件名）与 DB 的 `source_site/license` 字段；
许可字段只作登记，不作为可用性门槛。
