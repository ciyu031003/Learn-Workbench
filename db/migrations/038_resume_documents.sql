-- 038：Resume Engine v1——简历文档（多模板 / 分节顺序 / 样式 / A4 预览 / 导出）
-- 设计：简历「内容」不复制存储，而是实时从 Profile 信息源（user_settings 教育/经历）
--       + 证书领域（certificates）+ 技能（user_skills）+ 简历资产（resume_assets）组装；
--       本表只存「文档级配置」：标题、模板、分节顺序与可见性、样式、以及少量覆盖文案。
-- 模板注册表放在 shared 代码里（RESUME_TEMPLATES），避免 DB 种子与渲染器配置漂移。

CREATE TABLE IF NOT EXISTS resume_documents (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id       text,
  title         text NOT NULL DEFAULT '我的简历',
  template_key  text NOT NULL DEFAULT 'classic',
  -- 分节顺序与可见性：[{ "key": "basics", "visible": true }, ...]
  section_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 样式：{ "accent": "#2f74c0", "fontScale": 1, "spacing": "normal", "page": "A4" }
  styles        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 覆盖/自由文本：{ "basics": { "headline": "..." }, "summary": "..." }
  overrides     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default    boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  client_id     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_docs_user
  ON resume_documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resume_docs_anon
  ON resume_documents(anon_id) WHERE deleted_at IS NULL AND user_id IS NULL;

-- 同步幂等（与 certificates / exercise_logs 同模式）
CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_documents_client
  ON resume_documents(user_id, client_id)
  WHERE user_id IS NOT NULL AND client_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_resume_documents_updated ON resume_documents;
CREATE TRIGGER trg_resume_documents_updated BEFORE UPDATE ON resume_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();