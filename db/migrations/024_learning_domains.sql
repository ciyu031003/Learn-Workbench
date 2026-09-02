-- ============================================================================
-- 024_learning_domains.sql —— P0 学习领域（Domain）底座 + 阶段隔离修复
-- 需求：把「职业路线 careers」语义泛化为「学习领域」，支持用户完全自主创建
--       英语/羽毛球/球类等自定义领域；并修复自定义大阶段跨账号串扰/越权。
--
-- 设计说明（不重命名 careers，最小侵入）：
--  - careers 增加 kind/icon/color/phase_prefix/owner_id/is_archived。
--    kind 语义：career 职业类（保留技能树/简历/面试/求职等专属能力）、
--    language 语言、sports 运动、hobby 兴趣、life 生活、custom 自定义。
--  - 系统内置域 owner_id IS NULL 且全员共享；用户自建域 owner_id = 用户 id，
--    读取/写入都按 owner 过滤（system OR owner = 当前用户），杜绝跨账号串扰。
--  - content_phases：自定义阶段已有 is_custom/owner_id 列（migration 022），
--    本迁移补齐索引并修正读取范围（见 lib/api.ts）与 CRUD 鉴权（见 route）。
--  - 幂等：本文件可重复执行。
-- ============================================================================

-- ---------- 1. careers 领域化列 ----------
ALTER TABLE careers ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE careers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'career';
ALTER TABLE careers ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'compass';
ALTER TABLE careers ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1';
ALTER TABLE careers ADD COLUMN IF NOT EXISTS phase_prefix text NOT NULL DEFAULT 'P';
ALTER TABLE careers ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE careers ADD CONSTRAINT IF NOT EXISTS careers_kind_check
  CHECK (kind IN ('career','language','sports','hobby','life','custom'));
ALTER TABLE careers ADD CONSTRAINT IF NOT EXISTS careers_owner_scope_check
  CHECK (kind <> 'custom' OR owner_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_careers_owner ON careers(owner_id);
CREATE INDEX IF NOT EXISTS idx_careers_kind   ON careers(kind);

-- ---------- 2. 既有种子职业元信息（幂等补齐；名字/描述保留不变） ----------
UPDATE careers SET
  icon = CASE career_key
    WHEN 'ict' THEN 'cpu'
    WHEN 'frontend' THEN 'layout'
    WHEN 'java-backend' THEN 'coffee'
    WHEN 'data-analysis' THEN 'chart-line'
    WHEN 'ai-engineer' THEN 'brain'
    WHEN 'cyber-security' THEN 'shield'
    ELSE icon END,
  color = CASE career_key
    WHEN 'ict' THEN '#4f46e5'
    WHEN 'frontend' THEN '#0ea5e9'
    WHEN 'java-backend' THEN '#dc2626'
    WHEN 'data-analysis' THEN '#16a34a'
    WHEN 'ai-engineer' THEN '#9333ea'
    WHEN 'cyber-security' THEN '#e11d48'
    ELSE color END
WHERE owner_id IS NULL;

-- ---------- 3. 内容阶段 owner 读取索引（自定义阶段按用户隔离） ----------
CREATE INDEX IF NOT EXISTS idx_phases_career_owner ON content_phases(career_key, owner_id);

-- 说明：schema.sql 不修改，增量迁移按项目规范「append not modify」执行。