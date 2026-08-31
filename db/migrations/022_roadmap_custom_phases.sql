-- ============================================================================
-- 022：学习路线图自定义——大阶段（phase）可增删、可拖动排序、自动更名
-- 需求：路线图尽可能可自定义：阶段卡可拖动排序（P3 拖到 P1 上自动更名），
--       大阶段可增加/删除/编辑；自定义主题能力沿用 content_topics.is_custom。
--
-- 设计说明：
--  - phase_key 是全局唯一键（各职业前缀不同，如 ict=phase-N / frontend=fe-phase-N），
--    不做全局重排；前端 P 编号由 sort_order（位置）计算。
--  - 本迁移把每个 (career_key, track) 的 sort_order 归一为 0..N-1（按 id 顺序）；
--    非自定义阶段只重写「脏键」（ren-* 临时键或 ict 的裸 phase-0..N-1），
--    健康的职业前缀键（fe-phase-N 等）保留不动。
-- ============================================================================

-- 1) content_phases 增加自定义标记与归属（与 content_topics 模式一致，幂等）
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_phases_owner ON content_phases(owner_id);
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_content_phases_updated ON content_phases;
CREATE TRIGGER trg_content_phases_updated BEFORE UPDATE ON content_phases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) 预清理：ict 主线裸键（phase-0..N-1）与脏键（ren-*）先统一改为临时唯一键 'ren-'||id，
--    避免原地改号时同轨道键位冲突；健康的前缀键（fe-phase-N 等）不动。
UPDATE content_phases SET phase_key = 'ren-' || id
WHERE is_custom = FALSE AND (
  phase_key LIKE 'ren-%'
  OR (track = 'main' AND career_key = 'ict' AND phase_key ~ '^phase-[0-9]+$')
);

-- 3) 修复/归一 sort_order 与 phase_key（按 id 顺序，避免唯一约束中间态冲突）
DO $$
DECLARE
  r record;
  p record;
  i int;
  new_key text;
  agent_count int;
BEGIN
  FOR r IN SELECT DISTINCT career_key, track FROM content_phases ORDER BY career_key, track LOOP
    i := 0;
    SELECT count(*) INTO agent_count FROM content_phases
      WHERE career_key = r.career_key AND track = 'agent';
    FOR p IN SELECT id, phase_key, is_custom FROM content_phases
             WHERE career_key = r.career_key AND track = r.track
             ORDER BY id LOOP
      new_key := NULL;
      IF NOT p.is_custom THEN
        IF r.track = 'main' AND r.career_key = 'ict' THEN
          new_key := 'phase-' || (i + 1);
        ELSIF r.track = 'agent' THEN
          IF agent_count = 1 AND p.phase_key = 'agent-track' THEN
            new_key := NULL; -- 健康键保留
          ELSIF agent_count = 1 THEN
            new_key := 'agent-track';
          ELSE
            new_key := r.career_key || '-agent-' || (i + 1);
          END IF;
        ELSE -- main 非 ict
          IF p.phase_key IS NULL OR p.phase_key = '' OR p.phase_key LIKE 'ren-%' THEN
            new_key := r.career_key || '-phase-' || (i + 1);
          END IF; -- 否则保留 fe-phase-N 等健康键
        END IF;
      END IF;

      IF new_key IS NOT NULL THEN
        UPDATE content_phases SET phase_key = new_key, sort_order = i WHERE id = p.id;
      ELSE
        UPDATE content_phases SET sort_order = i WHERE id = p.id;
      END IF;
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;