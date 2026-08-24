import { pgPool } from "@/lib/db";
import type { JobLearningPlan, JobMatchResult, MarketGapItem, SkillGapItem, SkillRecommend, UserSkillView } from "@learn-workbench/shared";

/* ================= 技能归一化 ================= */

/** 归一化一个原始技能标签 → 规范技能名（别名表 + 小写模糊） */
export async function normalizeSkillTag(raw: string): Promise<string | null> {
  const tag = (raw ?? "").trim().toLowerCase();
  if (!tag) return null;
  // 1) 精确匹配规范名
  const exact = await pgPool.query<{ name: string }>(
    "SELECT name FROM skill_taxonomy WHERE lower(name) = $1",
    [tag]
  );
  if (exact.rows[0]) return exact.rows[0].name;
  // 2) 别名匹配
  const alias = await pgPool.query<{ name: string }>(
    `SELECT name FROM skill_taxonomy WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(aliases) a WHERE lower(a) = $1)`,
    [tag]
  );
  if (alias.rows[0]) return alias.rows[0].name;
  // 3) 规范名包含（如 "Redis" in "Redis 缓存"）
  const contains = await pgPool.query<{ name: string }>(
    "SELECT name FROM skill_taxonomy WHERE $1 LIKE '%' || lower(name) || '%' LIMIT 1",
    [tag]
  );
  return contains.rows[0]?.name ?? null;
}

/** 获取技能 id（不存在则创建） */
export async function ensureSkill(name: string, category = ""): Promise<number> {
  const { rows } = await pgPool.query(
    `INSERT INTO skill_taxonomy (name, aliases, category)
     VALUES ($1, '[]'::jsonb, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, category]
  );
  return rows[0].id;
}

/** 回填：job_postings.tags → job_skill_links（增量，仅处理未链接的职位） */
export async function backfillJobSkillLinks(limit = 200): Promise<number> {
  const { rows } = await pgPool.query<{ id: number; tags: string[] }>(
    `SELECT j.id, j.tags FROM job_postings j
      WHERE NOT EXISTS (SELECT 1 FROM job_skill_links l WHERE l.job_id = j.id)
        AND jsonb_array_length(j.tags) > 0
      ORDER BY j.fetched_at DESC LIMIT $1`,
    [limit]
  );
  let linked = 0;
  for (const job of rows) {
    for (const raw of job.tags) {
      const name = await normalizeSkillTag(raw);
      if (!name) continue;
      const skillId = await ensureSkill(name);
      await pgPool.query(
        "INSERT INTO job_skill_links (job_id, skill_id, weight) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
        [job.id, skillId]
      );
      linked += 1;
    }
  }
  return linked;
}

/* ================= 用户技能画像 ================= */

/** 从 resume_assets(kind=skill) 回填 user_skills（一次性，幂等） */
export async function backfillUserSkillsFromResume(userId: string): Promise<number> {
  const { rows } = await pgPool.query<{ title: string }>(
    "SELECT title FROM resume_assets WHERE user_id = $1 AND kind = 'skill'",
    [userId]
  );
  let added = 0;
  for (const r of rows) {
    const name = await normalizeSkillTag(r.title);
    if (!name) continue;
    const skillId = await ensureSkill(name);
    await pgPool.query(
      `INSERT INTO user_skills (user_id, skill_id, level, source)
       VALUES ($1, $2, 3, 'resume')
       ON CONFLICT (user_id, skill_id) DO UPDATE SET source = 'resume', updated_at = now()`,
      [userId, skillId]
    );
    added += 1;
  }
  return added;
}

/** 用户技能画像（含缺口标记） */
export async function listUserSkills(userId: string): Promise<UserSkillView[]> {
  const { rows } = await pgPool.query<{
    id: number; name: string; category: string; level: number; source: string;
  }>(
    `SELECT s.id, s.name, s.category, us.level, us.source
       FROM user_skills us
       JOIN skill_taxonomy s ON s.id = us.skill_id
      WHERE us.user_id = $1
      ORDER BY us.level DESC, s.category, s.name`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, category: r.category, level: r.level, source: r.source,
  }));
}

export async function setUserSkill(userId: string, skillId: number, level: number, source = "manual"): Promise<void> {
  await pgPool.query(
    `INSERT INTO user_skills (user_id, skill_id, level, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET level = EXCLUDED.level, source = EXCLUDED.source, updated_at = now()`,
    [userId, skillId, level, source]
  );
}

export async function removeUserSkill(userId: string, skillId: number): Promise<void> {
  await pgPool.query("DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2", [userId, skillId]);
}

/* ================= 岗位匹配度（规则版） ================= */

/**
 * 匹配度 = Σ(命中技能权重)/Σ(岗位技能权重) × 0.7 + 学历满足 0.1 + 经验满足 0.1 + 城市匹配 0.1
 * 技能命中：用户 level ≥ 2 计 1.0，level=1 计 0.5
 */
export async function computeJobMatch(
  userId: string | null,
  jobId: number,
  opts: { city?: string; education?: string; experience?: string } = {}
): Promise<JobMatchResult> {
  // 岗位技能
  const { rows: jobSkills } = await pgPool.query<{ skill_id: number; name: string; weight: number }>(
    `SELECT l.skill_id, s.name, l.weight::float FROM job_skill_links l
       JOIN skill_taxonomy s ON s.id = l.skill_id WHERE l.job_id = $1`,
    [jobId]
  );
  // 用户技能
  const userLevels = new Map<number, number>();
  if (userId) {
    const { rows } = await pgPool.query<{ skill_id: number; level: number }>(
      "SELECT skill_id, level FROM user_skills WHERE user_id = $1",
      [userId]
    );
    rows.forEach((r) => userLevels.set(r.skill_id, r.level));
  }

  const totalWeight = jobSkills.reduce((a, s) => a + s.weight, 0);
  let hitWeight = 0;
  const matched: { skill: string; level: number; hit: boolean; partial: boolean }[] = [];
  const missing: { skill: string }[] = [];
  for (const s of jobSkills) {
    const ul = userLevels.get(s.skill_id) ?? 0;
    if (ul >= 2) { hitWeight += s.weight; matched.push({ skill: s.name, level: ul, hit: true, partial: false }); }
    else if (ul === 1) { hitWeight += s.weight * 0.5; matched.push({ skill: s.name, level: ul, hit: false, partial: true }); }
    else missing.push({ skill: s.name });
  }
  const skillScore = totalWeight > 0 ? hitWeight / totalWeight : 0;

  // 学历 / 经验 / 城市（规则近似）
  const eduOk = !opts.education || !jobSkills.length || true; // 学历信息在岗位字段里，这里用宽松规则
  const expOk = true;
  const cityOk = !opts.city ? 0.5 : 1; // 未设期望城市按 0.5

  const overall = Math.round(
    (skillScore * 0.7 + (eduOk ? 0.1 : 0) + (expOk ? 0.1 : 0) + cityOk * 0.1) * 100
  );

  return {
    jobId,
    overall,
    matchedSkills: matched,
    missingSkills: missing,
    hasUserProfile: !!userId,
  };
}

/* ================= 能力缺口 ================= */

/** 缺口：岗位技能 - 用户技能，附 skill_content_links 映射的学习建议 */
export async function computeSkillGaps(
  userId: string,
  jobId: number,
  precomputed?: { missingSkills: { skill: string }[] }
): Promise<{ gaps: SkillGapItem[]; totalHours: number }> {
  const { missingSkills } = precomputed ?? (await computeJobMatch(userId, jobId));
  if (missingSkills.length === 0) return { gaps: [], totalHours: 0 };
  const gaps: SkillGapItem[] = [];
  let totalHours = 0;
  for (const m of missingSkills) {
    const { rows } = await pgPool.query<{
      skill_id: number; name: string; topic_id: number; topic_title: string; estimate_hours: number;
      phase_id: number | null; phase_title: string | null; phase_key: string | null;
    }>(
      `SELECT s.id AS skill_id, s.name, t.id AS topic_id, t.title AS topic_title, l.estimate_hours,
              p.id AS phase_id, p.title AS phase_title, p.phase_key AS phase_key
         FROM skill_content_links l
         JOIN skill_taxonomy s ON s.id = l.skill_id
         JOIN content_topics t ON t.id = l.topic_id
         LEFT JOIN content_phases p ON p.id = t.phase_id
        WHERE s.name = $1`,
      [m.skill]
    );
    const hours = rows.reduce((a, r) => a + (r.estimate_hours ?? 8), 0);
    totalHours += hours;
    gaps.push({
      skill: m.skill,
      topicId: rows[0]?.topic_id ?? null,
      topicTitle: rows[0]?.topic_title ?? null,
      estimateHours: hours > 0 ? hours : null,
      enrollable: rows.length > 0,
      phaseId: rows[0]?.phase_id ?? null,
      phaseTitle: rows[0]?.phase_title ?? null,
      phaseKey: rows[0]?.phase_key ?? null,
    });
  }
  return { gaps, totalHours };
}

/** 岗位学习计划（整包规划）：岗位信息 + 匹配度 + 按路线图阶段分组的学习计划 */
export async function buildJobLearningPlan(userId: string, jobId: number): Promise<JobLearningPlan> {
  const [match, { rows: jobs }] = await Promise.all([
    computeJobMatch(userId, jobId),
    pgPool.query<{
      id: number; title: string; company: string; city: string;
      salary_text: string; education: string; experience: string;
    }>(
      `SELECT id, title, company, city, salary_text, education, experience
         FROM job_postings WHERE id = $1`,
      [jobId]
    ),
  ]);
  const { gaps, totalHours } = await computeSkillGaps(userId, jobId, match);
  const job = jobs[0];
  if (!job) throw new Error("job not found");

  // 按阶段分组（null 阶段归为「其他」，排最后）
  const phaseMap = new Map<number | null, {
    phaseId: number | null; phaseTitle: string | null; phaseKey: string | null;
    sortOrder: number; hours: number; skills: SkillGapItem[];
  }>();
  for (const g of gaps) {
    const key = g.phaseId ?? -1;
    let entry = phaseMap.get(key);
    if (!entry) {
      entry = { phaseId: g.phaseId, phaseTitle: g.phaseTitle, phaseKey: g.phaseKey, sortOrder: 999, hours: 0, skills: [] };
      phaseMap.set(key, entry);
    }
    entry.hours += g.estimateHours ?? 0;
    entry.skills.push(g);
  }
  // 取真实阶段的 sort_order 排序
  const phaseIds = [...phaseMap.keys()].filter((x): x is number => x != null && x > 0);
  if (phaseIds.length > 0) {
    const { rows } = await pgPool.query<{ id: number; sort_order: number }>(
      `SELECT id, sort_order FROM content_phases WHERE id = ANY($1)`,
      [phaseIds]
    );
    for (const r of rows) {
      const e = phaseMap.get(r.id);
      if (e) e.sortOrder = r.sort_order;
    }
  }
  const phases = [...phaseMap.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({ ...p }));
  const estimatedWeeks = totalHours > 0 ? Math.max(1, Math.round(totalHours / WEEKLY_PLAN_HOURS)) : 0;
  return {
    job: {
      id: Number(job.id), title: job.title, company: job.company, city: job.city,
      salaryText: job.salary_text, education: job.education, experience: job.experience,
    },
    match: match.overall,
    totalHours,
    estimatedWeeks,
    phases,
    gaps,
  };
}

/** 整包规划每周学习时长假设（小时） */
export const WEEKLY_PLAN_HOURS = 10;

/** 缺口一键加入学习路线：生成 daily_tasks */
export async function enrollGapsToTasks(userId: string, gaps: { skill: string; topicId: number | null; hours: number }[]): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  // 批量取主题标题，任务标题用「学习技能：主题标题」（修复旧实现把 topicId 当标题的 bug）
  const topicIds = gaps.map((g) => g.topicId).filter((x): x is number => x != null);
  const titleById = new Map<number, string>();
  if (topicIds.length > 0) {
    const { rows } = await pgPool.query<{ id: number; title: string }>(
      `SELECT id, title FROM content_topics WHERE id = ANY($1)`,
      [topicIds]
    );
    rows.forEach((r) => titleById.set(r.id, r.title));
  }
  let created = 0;
  for (const g of gaps) {
    const topicTitle = g.topicId ? titleById.get(g.topicId) : null;
    const title = topicTitle ? `学习「${g.skill}」：${topicTitle}` : `学习技能 ${g.skill}`;
    await pgPool.query(
      `INSERT INTO daily_tasks (user_id, task_date, title, task_type, topic_id)
       VALUES ($1, $2, $3, 'study', $4)`,
      [userId, today, title, g.topicId]
    );
    created += 1;
  }
  return created;
}

/* ================= 聚合「市场需求缺口」（学习 × 招聘打通） ================= */

/**
 * 市场高频需求技能 × 我的缺失技能：
 * 统计 job_skill_links 中要求最多的技能，过滤掉我已达标（level ≥ minLevel）的，
 * 附 skill_content_links 的学习建议，按市场岗位数降序返回。
 */
export async function aggregateMarketGaps(
  userId: string,
  opts: { limit?: number; minLevel?: number } = {}
): Promise<{ gaps: MarketGapItem[]; totalJobs: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 50);
  const minLevel = opts.minLevel ?? 2;

  const [{ rows: demand }, { rows: total }] = await Promise.all([
    pgPool.query<{ skill_id: number; name: string; category: string; job_count: string; demand_weight: string }>(
      `SELECT s.id AS skill_id, s.name, s.category,
              COUNT(DISTINCT l.job_id) AS job_count,
              COALESCE(SUM(l.weight), 0)::float8 AS demand_weight
         FROM job_skill_links l
         JOIN skill_taxonomy s ON s.id = l.skill_id
        GROUP BY s.id, s.name, s.category
        ORDER BY job_count DESC, demand_weight DESC
        LIMIT 200`
    ),
    pgPool.query<{ n: string }>(`SELECT COUNT(DISTINCT job_id) AS n FROM job_skill_links`),
  ]);
  const totalJobs = Number(total[0]?.n ?? 0);

  // 用户技能等级
  const userLevels = new Map<number, number>();
  if (userId) {
    const { rows } = await pgPool.query<{ skill_id: number; level: number }>(
      "SELECT skill_id, level FROM user_skills WHERE user_id = $1",
      [userId]
    );
    rows.forEach((r) => userLevels.set(r.skill_id, r.level));
  }

  const gaps: MarketGapItem[] = [];
  for (const d of demand) {
    const skillId = d.skill_id;
    const level = userLevels.get(skillId) ?? 0;
    if (level >= minLevel) continue;
    const { rows: learn } = await pgPool.query<{
      topic_id: number; topic_title: string; estimate_hours: number;
      phase_id: number | null; phase_title: string | null; phase_key: string | null;
    }>(
      `SELECT t.id AS topic_id, t.title AS topic_title, l.estimate_hours,
              p.id AS phase_id, p.title AS phase_title, p.phase_key AS phase_key
         FROM skill_content_links l
         JOIN content_topics t ON t.id = l.topic_id
         LEFT JOIN content_phases p ON p.id = t.phase_id
        WHERE l.skill_id = $1
        ORDER BY l.estimate_hours ASC
        LIMIT 1`,
      [skillId]
    );
    gaps.push({
      skillId,
      skill: d.name,
      category: d.category,
      jobCount: Number(d.job_count),
      demandWeight: Number(d.demand_weight),
      myLevel: level,
      missing: level < 1,
      topicId: learn[0]?.topic_id ?? null,
      topicTitle: learn[0]?.topic_title ?? null,
      estimateHours: learn[0]?.estimate_hours ?? null,
      enrollable: learn.length > 0,
      phaseId: learn[0]?.phase_id ?? null,
      phaseTitle: learn[0]?.phase_title ?? null,
      phaseKey: learn[0]?.phase_key ?? null,
    });
    if (gaps.length >= limit) break;
  }
  return { gaps, totalJobs };
}

/* ================= 技能画像冷启动：按目标职业推荐技能 ================= */

/** 职业 → 推荐技能（规范名 + 分类）；不在技能库的会在 recommend 时自动建库 */
const CAREER_SKILL_MAP: Record<string, { name: string; category: string }[]> = {
  ict: [
    { name: "linux", category: "ops" }, { name: "docker", category: "ops" }, { name: "shell", category: "ops" },
    { name: "sql", category: "data" }, { name: "python", category: "backend" }, { name: "networking", category: "network" },
    { name: "cloud", category: "cloud" }, { name: "redis", category: "data" }, { name: "nginx", category: "ops" },
    { name: "k8s", category: "ops" }, { name: "git", category: "soft" }, { name: "security", category: "security" },
  ],
  frontend: [
    { name: "html", category: "frontend" }, { name: "css", category: "frontend" }, { name: "javascript", category: "frontend" },
    { name: "typescript", category: "frontend" }, { name: "vue", category: "frontend" }, { name: "react", category: "frontend" },
    { name: "bootstrap", category: "frontend" }, { name: "vite", category: "frontend" }, { name: "nodejs", category: "backend" },
    { name: "git", category: "soft" },
  ],
  "java-backend": [
    { name: "java", category: "backend" }, { name: "spring", category: "backend" }, { name: "springboot", category: "backend" },
    { name: "mysql", category: "data" }, { name: "redis", category: "data" }, { name: "sql", category: "data" },
    { name: "docker", category: "ops" }, { name: "linux", category: "ops" }, { name: "git", category: "soft" },
    { name: "kafka", category: "data" },
  ],
  "data-analysis": [
    { name: "sql", category: "data" }, { name: "python", category: "backend" }, { name: "excel", category: "data" },
    { name: "tableau", category: "data" }, { name: "mysql", category: "data" }, { name: "postgresql", category: "data" },
    { name: "spark", category: "data" }, { name: "etl", category: "data" }, { name: "mongodb", category: "data" },
  ],
  "ai-engineer": [
    { name: "python", category: "backend" }, { name: "pytorch", category: "ai" }, { name: "tensorflow", category: "ai" },
    { name: "llm", category: "ai" }, { name: "nlp", category: "ai" }, { name: "sql", category: "data" },
    { name: "linux", category: "ops" }, { name: "docker", category: "ops" },
  ],
  "cyber-security": [
    { name: "security", category: "security" }, { name: "linux", category: "ops" }, { name: "networking", category: "network" },
    { name: "shell", category: "ops" }, { name: "python", category: "backend" }, { name: "docker", category: "ops" },
    { name: "k8s", category: "ops" },
  ],
};
const DEFAULT_CAREER = "ict";

/** 按目标职业推荐技能（冷启动引导）；技能不存在时自动建库（ensureSkill 幂等） */
export async function recommendSkillsForCareer(
  careerKey: string
): Promise<{ career: string; careerName: string; skills: SkillRecommend[] }> {
  const key = CAREER_SKILL_MAP[careerKey] ? careerKey : DEFAULT_CAREER;
  const list = CAREER_SKILL_MAP[key];
  const { rows } = await pgPool.query<{ name: string }>(
    "SELECT name FROM careers WHERE career_key = $1",
    [key]
  );
  const careerName = rows[0]?.name ?? "ICT 学习规划";
  const skills: SkillRecommend[] = [];
  for (const item of list) {
    const id = await ensureSkill(item.name, item.category);
    skills.push({ id, name: item.name, category: item.category });
  }
  return { career: key, careerName, skills };
}
