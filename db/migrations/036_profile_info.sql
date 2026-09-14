-- 036：Profile 信息源收敛——user_settings 增列（教育/经历/城市/目标角色/简介）
-- 目的：让 Resume / 就绪度 / 职业雷达读同一份来源，消除「Resume 一份、Career 一份、Certificate 一份」。
-- 全部 nullable 默认空，纯增量无破坏性；登录用户/匿名设备各最多一行（沿用 031 唯一约束）。

-- education：教育经历，JSON 数组 [{ school, major, degree, start, end, note }]
-- experiences：工作/项目经历，JSON 数组 [{ title, org, start, end, description, skills }]
-- current_city：期望工作城市（供岗位匹配，替代过去 opts.city 兜底 0.5）
-- target_role：目标岗位（文字，供雷达/简历头）
-- bio：一句话简介

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS education    jsonb,
  ADD COLUMN IF NOT EXISTS experiences  jsonb,
  ADD COLUMN IF NOT EXISTS current_city text,
  ADD COLUMN IF NOT EXISTS target_role  text,
  ADD COLUMN IF NOT EXISTS bio          text;