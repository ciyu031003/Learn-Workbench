-- ============================================================================
-- 022：学习路线图自定义——大阶段（phase）可增删、可拖动排序、自动更名
-- 需求：路线图尽可能可自定义：阶段卡可拖动排序（P3 拖到 P1 上自动更名），
--       大阶段可增加/删除/编辑；自定义主题能力沿用 content_topics.is_custom。
-- ============================================================================

-- 1) content_phases 增加自定义标记与归属（与 content_topics 模式一致）
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_phases_owner ON content_phases(owner_id);
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_content_phases_updated ON content_phases;
CREATE TRIGGER trg_content_phases_updated BEFORE UPDATE ON content_phases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) 主线阶段键位从 phase-0.. 归一为 phase-1..（与 P1/P2/P3 命名一致，避免拖拽重排后键位错乱）
--    两步更新避免 phase_key / sort_order 唯一约束冲突：先打临时标记，再按序编号。
UPDATE content_phases SET phase_key = 'ren-' || id, sort_order = id WHERE track = 'main';

DO $$
DECLARE
  r record;
  p record;
  i int;
BEGIN
  FOR r IN SELECT DISTINCT career_key FROM content_phases WHERE track = 'main' ORDER BY career_key LOOP
    i := 1;
    FOR p IN SELECT id FROM content_phases
             WHERE career_key = r.career_key AND track = 'main'
             ORDER BY sort_order, id LOOP
      UPDATE content_phases SET phase_key = 'phase-' || i, sort_order = i - 1 WHERE id = p.id;
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;