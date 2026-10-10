-- 062：内容导入/来源/版本管线（组二 · 阶段 10 = V3 纵轨 Phase F）
--
-- 三张表，回答三个问题：
--   content_source       —— 内容从哪来、什么许可、允许抓哪个范围、核验过没有（可追溯）；
--   content_import_batch —— 这一次同步看了什么版本、计划新增/更新/跳过/冲突各多少、成功还是回滚（可回滚）；
--   content_import_item  —— 批次里每一条的外部键 → 目标键 → 动作与原因（可审计）。
--
-- 关键取舍：
--   1. 导入进来的内容**一律 status='review'**（草稿区），绝不直接 published —— 内容权威仍是 packages/content；
--      人工确认后再写进内容包（走阶段 9 的质量门禁）。
--   2. 批次表存 `commit_sha`：固定版本可复现，回滚有据可查。
--   3. 回滚 = 把该批次新建的知识点软归档（status='archived'）+ 批次标记 rolled-back，**不物理删**。
-- 幂等：IF NOT EXISTS；db/schema.sql 已同步登记。

CREATE TABLE IF NOT EXISTS content_source (
  key            text PRIMARY KEY,               -- 稳定键，如 github:Snailclimb/JavaGuide
  name           text NOT NULL,
  url            text NOT NULL,                  -- 必须 https（阶段 9 的链接校验同口径）
  repo           text,                           -- owner/name（jsDelivr 用）
  ref            text NOT NULL DEFAULT 'main',   -- 固定版本：分支 / tag / sha
  commit_sha     text,                           -- 实际解析到的版本（批次时回填）
  license        text NOT NULL,
  usage          text NOT NULL DEFAULT 'reference',
                 CONSTRAINT ck_content_source_usage CHECK (usage IN ('import','reference')),
  scope          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 允许的路径前缀数组
  obligation     text,                           -- 署名/义务说明
  note           text,                           -- 用途/覆盖范围说明
  verified_at    timestamptz,                    -- 许可核验日期
  last_synced_at timestamptz,
  status         text NOT NULL DEFAULT 'active',
                 CONSTRAINT ck_content_source_status CHECK (status IN ('active','paused','retired')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_source_status ON content_source(status, usage);

CREATE TABLE IF NOT EXISTS content_import_batch (
  id               bigserial PRIMARY KEY,
  source_key       text NOT NULL REFERENCES content_source(key) ON DELETE RESTRICT,
  mode             text NOT NULL DEFAULT 'dry-run',
                   CONSTRAINT ck_content_import_mode CHECK (mode IN ('dry-run','apply')),
  status           text NOT NULL DEFAULT 'running',
                   CONSTRAINT ck_content_import_status CHECK (status IN ('running','success','partial','failed','rolled-back')),
  commit_sha       text,
  scope            jsonb NOT NULL DEFAULT '[]'::jsonb,
  planned_new      int NOT NULL DEFAULT 0,
  planned_update   int NOT NULL DEFAULT 0,
  planned_skip     int NOT NULL DEFAULT 0,
  planned_conflict int NOT NULL DEFAULT 0,
  planned_failed   int NOT NULL DEFAULT 0,
  applied_new      int NOT NULL DEFAULT 0,
  applied_update   int NOT NULL DEFAULT 0,
  applied_skipped  int NOT NULL DEFAULT 0,
  report           jsonb NOT NULL DEFAULT '{}'::jsonb,
  error            text,
  created_by       text NOT NULL DEFAULT 'cli',
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_import_batch_source ON content_import_batch(source_key, started_at DESC);

CREATE TABLE IF NOT EXISTS content_import_item (
  id           bigserial PRIMARY KEY,
  batch_id     bigint NOT NULL REFERENCES content_import_batch(id) ON DELETE CASCADE,
  kind         text NOT NULL,
               CONSTRAINT ck_content_import_item_kind CHECK (kind IN ('knowledge-point','question')),
  external_key text NOT NULL,                    -- 源内稳定键：<路径>#<标题指纹>
  target_key   text,                             -- 落库后的知识点/题 key
  action       text NOT NULL,
               CONSTRAINT ck_content_import_item_action CHECK (action IN ('new','update','skip','conflict','failed')),
  reason       text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_import_item
  ON content_import_item(batch_id, kind, external_key);
CREATE INDEX IF NOT EXISTS idx_content_import_item_batch ON content_import_item(batch_id, action);

DROP TRIGGER IF EXISTS trg_content_source_updated ON content_source;
CREATE TRIGGER trg_content_source_updated BEFORE UPDATE ON content_source
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 来源登记种子：由 packages/content/src/learning/*.ts 的 LearningSource 抽取（20 条，import 14 / reference 6）
INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note)
VALUES
  ('algorithms-java', 'TheAlgorithms/Java', 'https://github.com/TheAlgorithms/Java', 'TheAlgorithms/Java', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '算法、集合和数据结构练习'),
  ('java-patterns', 'Java Design Patterns', 'https://github.com/iluwatar/java-design-patterns', 'iluwatar/java-design-patterns', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '设计模式、重构与对象协作'),
  ('tech-interview-handbook', 'Tech Interview Handbook', 'https://github.com/yangshun/tech-interview-handbook', 'yangshun/tech-interview-handbook', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '算法与工程面试问题组织方式'),
  ('advanced-java-reference', 'advanced-java', 'https://github.com/doocs/advanced-java', 'doocs/advanced-java', 'main', 'CC BY-SA 4.0', 'reference', '仅外链引用，不复制正文；保留署名（CC BY-SA 4.0）', '后端进阶主题索引，首版仅作为延伸阅读'),
  ('freecodecamp-js', 'freeCodeCamp', 'https://github.com/freeCodeCamp/freeCodeCamp', 'freeCodeCamp/freeCodeCamp', 'main', 'BSD-3-Clause', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（BSD-3-Clause）', 'JavaScript 基础练习组织、测试驱动学习和项目思路'),
  ('algorithms-javascript', 'TheAlgorithms/JavaScript', 'https://github.com/TheAlgorithms/JavaScript', 'TheAlgorithms/JavaScript', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '数组、对象、算法与数据结构练习'),
  ('mdn-reference', 'MDN Web Docs', 'https://github.com/mdn/content', 'mdn/content', 'main', 'CC BY-SA 2.5', 'reference', '仅外链引用，不复制正文；保留署名（CC BY-SA 2.5）', '浏览器 API、JavaScript 语义与 Web 平台参考，仅保留外链'),
  ('exercism-python', 'Exercism Python', 'https://github.com/exercism/python', 'exercism/python', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '练习结构、测试驱动与概念学习方式'),
  ('algorithms-python', 'TheAlgorithms/Python', 'https://github.com/TheAlgorithms/Python', 'TheAlgorithms/Python', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '算法、数据结构与代码示例'),
  ('ms-data-science', 'Microsoft Data Science for Beginners', 'https://github.com/microsoft/Data-Science-For-Beginners', 'microsoft/Data-Science-For-Beginners', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'Pandas、数据清洗、可视化与项目结构'),
  ('data-engineering-reference', 'Data Engineering Zoomcamp', 'https://github.com/DataTalksClub/data-engineering-zoomcamp', 'DataTalksClub/data-engineering-zoomcamp', 'main', 'UNKNOWN', 'reference', '仅外链引用，不复制正文；保留署名（未识别，待核验）', '数据工程学习路径参考，首版不直接复制'),
  ('system-design-primer', 'System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'donnemartin/system-design-primer', 'main', 'CC BY 4.0', 'reference', '仅外链引用，不复制正文；保留署名（CC BY 4.0）', '数据流和系统边界的设计方法'),
  ('pl300', 'Microsoft PL-300 Power BI Data Analyst', 'https://github.com/MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst', 'MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '微软官方 12 个实验室模块与考试知识结构'),
  ('powerbi-samples', 'Power BI Desktop Samples', 'https://github.com/microsoft/powerbi-desktop-samples', 'microsoft/powerbi-desktop-samples', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '月度示例文件和真实业务模型素材'),
  ('algorithms-shell', 'TheAlgorithms/Shell', 'https://github.com/TheAlgorithms/Shell', 'TheAlgorithms/Shell', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'Shell 脚本片段、文本处理与自动化练习'),
  ('command-line-reference', 'The Art of Command Line', 'https://github.com/jlevy/the-art-of-command-line', 'jlevy/the-art-of-command-line', 'main', 'CC BY-NC-SA 4.0', 'reference', '仅外链引用，不复制正文；保留署名（CC BY-NC-SA 4.0）', '命令行工作流与排障方法参考，不直接复制正文'),
  ('linux-system-reference', 'System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'donnemartin/system-design-primer', 'main', 'CC BY 4.0', 'reference', '仅外链引用，不复制正文；保留署名（CC BY 4.0）', '系统边界、可靠性和性能分析方法'),
  ('microsoft-generative-ai', 'Generative AI for Beginners', 'https://github.com/microsoft/generative-ai-for-beginners', 'microsoft/generative-ai-for-beginners', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '生成式 AI 课程结构、RAG 和应用安全主题'),
  ('openai-cookbook', 'OpenAI Cookbook', 'https://github.com/openai/openai-cookbook', 'openai/openai-cookbook', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '结构化输出、检索、评测和工程实践示例'),
  ('langgraph', 'LangGraph', 'https://github.com/langchain-ai/langgraph', 'langchain-ai/langgraph', 'main', 'MIT', 'import', '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '有状态 Agent、工作流和人工确认节点')
ON CONFLICT (key) DO NOTHING;
