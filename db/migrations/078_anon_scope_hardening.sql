-- ============================================================================
-- 078_anon_scope_hardening.sql —— 匿名作用域加固（S1-7，幂等）
--
-- 修掉两个缺陷（评审 P-02 / L1 相关）：
--  1) 「遗留 NULL 池」：旧 anonFilterSql = (anon_id IS NULL OR anon_id = $n)，
--     任何没有 lwb_anon cookie 的客户端都能读写 anon_id IS NULL 的匿名行（跨设备泄漏）。
--     → 给每一条历史 NULL 池行分配随机 anon_id（孤儿化：不再被任何客户端读到，
--       数据仍保留供管理员排查/恢复）。
--  2) 新行仍可能以 user_id=NULL + anon_id=NULL 落库（首次直连 API 未带 cookie）。
--     → 结构级 fail-closed：加 CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)，
--       约束名统一以 _scope_required 结尾，lib/api-error.ts 会映射成 400「缺少设备标识」。
--
-- 回滚：db/migrations/down/078_anon_scope_hardening.down.sql 只删约束；
--       孤儿化的 anon_id 不回滚（回滚不应让数据重新跨设备可见）。
-- ============================================================================

DO $$
DECLARE
  t text;
  cname text;
  targets text[] := ARRAY[
    'break_sessions', 'certificates', 'checkins', 'daily_tasks',
    'energy_logs', 'exercise_goals', 'exercise_logs', 'focus_sessions',
    'habits', 'hydration_goals', 'hydration_logs', 'knowledge_notes',
    'log_entries', 'meal_entries', 'resume_assets', 'resume_documents',
    'topic_progress', 'user_settings', 'weight_logs', 'wellbeing_reminders',
    'workouts', 'xp_events'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    -- 1) 孤儿化历史 NULL 池（幂等：第二次执行无匹配行）
    EXECUTE format(
      'UPDATE %I SET anon_id = gen_random_uuid()::text WHERE user_id IS NULL AND anon_id IS NULL',
      t
    );

    -- 2) 结构级 fail-closed（幂等：已存在则跳过）
    cname := t || '_scope_required';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)',
        t, cname
      );
    END IF;
  END LOOP;
END $$;
