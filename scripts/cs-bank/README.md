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
py scripts/cs-bank/test_dirty_filter.py                         # 6. 目录页过滤回归验证（可选）
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

## 目录页（TOC）噪声过滤

PDF 的**目录页**会被当成正文抽取，产生「题目是一堆省略号、答案没有对比性」的脏数据。
典型形态（生产库曾出现，id=1480-1483）：

    question = '算法的复杂度.......................................'
    answer   = '1.2 数据结构...............................................'

根因：`parse.py::parse_headings` 对目录行 `1.1 算法的复杂度.......` 匹配 `HEAD_RE` 后
剥掉行首编号，得到长度 <= 50 的标题，被当成知识点卡收下；紧随其后的目录行又并进它的
body 变成 answer。

过滤口径集中在 `dirty_filter.py`（`parse.py` 与 `gen_csv.py` 共用，保证流水线与生产库同口径）：

| 规则 | 说明 |
| --- | --- |
| `has_toc_leader` | 行尾 >=4 个连续点号/省略号（`.` `。` `…` `．`），即 PDF 目录引导点 |
| `is_dot_filler` | 整行去掉点号/空白后为空（纯点号填充行） |
| `is_toc_page` | 整页过半且至少 3 行是目录行 -> 整页丢弃 |

**口径刻意收窄**（经生产库全量核对，宁可漏杀不可误杀）。以下写法已评估并**排除**：

- `answer ~ '^[0-9]+\.[0-9]'`：上架 31 条里约 27 条是正常习题卡（answer 以 `5.3 `、
  `2.4.1.1.` 等小节号开头），会误杀面试·Java / 书库习题。
- `question ~ '^[.。…．]'`：上架 852 条，其中 709 条是等级考试一级 Photoshop 真题
  （题干被抽成 `. Photoshop中...`），只是行首多一个点，题干完整。
- `'\.{4,}'`（不限行尾）：会误杀数学区间写法 `A[0...m-1]`、`L1, L2, ... , L8` 等真题。
- 「answer 含 >=3 行小节号即判目录页」：上架 114 条误杀。

回归验证：`py scripts/cs-bank/test_dirty_filter.py`（构造含目录页的样本跑 `parse.py`，
断言目录行不再产出、正常知识点卡与 MCQ 不受影响）。

## 口径

408 / 考研真题类题源只进**学习题库**（`ex-408` 的「408」分类），
不进面试题库：`import_bank.sql` 已按 `module LIKE '408%' / '考研真题%'` 过滤，
服务端导入接口也走 `isExamBankModule()` 同口径拦截。个人自用、不商用。题目来源如实记录在 `source`（文件名）与 DB 的 `source_site/license` 字段；
许可字段只作登记，不作为可用性门槛。
