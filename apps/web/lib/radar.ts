import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface RadarMatchedSkill {
  skill: string;
  level: number;
  hit: boolean;
  partial: boolean;
}

export interface RadarJob {
  jobId: number;
  title: string;
  company: string;
  city: string;
  education: string;
  salaryText: string;
  salaryBand: string;
  url: string;
  source: string;
  publishedAt: string | null;
  /** 规则版匹配度 0-100（技能命中 0.7 + 学历 0.1 + 经验 0.1 + 城市 0.1） */
  overall: number;
  matchedSkills: RadarMatchedSkill[];
  missingSkills: { skill: string }[];
  /** 缺口预估学习时长（小时），来自 skill_content_links */
  gapHours: number;
  deadlineAt: string | null;
  deadlineLabel: string | null;
  fromFavorite: boolean;
  fromApplication: boolean;
}

export interface RadarResult {
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  buckets: {
    highMatch: RadarJob[];
    highValue: RadarJob[];
    urgent: RadarJob[];
  };
  top: RadarJob[];
  counts: {
    candidates: number;
    matched: number;
    favorites: number;
    applications: number;
  };
}

const TOP_LIMIT = 12;
const FILL_LIMIT = 60;
const HIGH_MATCH_MIN = 75;
const HIGH_VALUE_MIN = 55;
const URGENT_DAYS = 7;
const HIGH_SALARY_BANDS = new Set(["20-30K", "30-50K", "50K+", "30K+"]);

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

interface ScoredRow {
  id: string | number;
  title: string;
  company: string;
  city: string;
  education: string;
  salary_text: string;
  salary_band: string;
  url: string;
  source: string;
  published_at: Date | null;
  total_weight: string | number | null;
  hit_weight: string | number | null;
  missing: string[] | null;
  matched: string[] | null;
}

/**
 * 批量岗位匹配（B 为主）：一次查询完成「画像 × 岗位集」的技能命中计算，
 * 避免对每个岗位各调一次 computeJobMatch 造成 N 次往返。
 * 画像缺失（无 skills 与 profile）时由调用方回落逐岗位 A 路径。
 */
export async function computeRadar(
  userId: string,
  opts: { city?: string | null; limit?: number } = {}
): Promise<RadarResult> {
  const limit = Math.max(1, Math.min(TOP_LIMIT, opts.limit ?? TOP_LIMIT));

  // 1) 画像：技能 + 城市 + 目标岗位
  const [skillsRes, profileRes] = await Promise.all([
    pgPool.query<{ skill_id: number; level: number }>(
      `SELECT skill_id, level FROM user_skills WHERE user_id = $1`,
      [userId]
    ),
    pgPool.query<{ city: string | null; targetRole: string | null }>(
      `SELECT current_city AS city, target_role AS "targetRole"
         FROM user_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
  ]);
  const profileCity = opts.city ?? profileRes.rows[0]?.city ?? null;
  const targetRole = profileRes.rows[0]?.targetRole ?? null;
  const hasProfile = skillsRes.rows.length > 0;

  // 2) 候选集：收藏 + 投递（显式意图）∪ 画像城市下的活跃岗位（补充）
  const [favRes, appRes, fillRes] = await Promise.all([
    pgPool.query<{ job_id: string }>(`SELECT job_id FROM job_favorites WHERE user_id = $1`, [userId]),
    pgPool.query<{ job_id: string }>(`SELECT job_id FROM job_applications WHERE user_id = $1`, [userId]),
    profileCity
      ? pgPool.query<{ id: string }>(
          `SELECT id FROM job_postings
            WHERE is_active = true AND city = $1
            ORDER BY published_at DESC NULLS LAST, fetched_at DESC
            LIMIT $2`,
          [profileCity, FILL_LIMIT]
        )
      : pgPool.query<{ id: string }>(
          `SELECT id FROM job_postings
            WHERE is_active = true
            ORDER BY published_at DESC NULLS LAST, fetched_at DESC
            LIMIT $1`,
          [FILL_LIMIT]
        ),
  ]);

  const favIds = new Set(favRes.rows.map((r) => String(r.job_id)));
  const appIds = new Set(appRes.rows.map((r) => String(r.job_id)));
  const idSet = new Set<string>([...favIds, ...appIds, ...fillRes.rows.map((r) => String(r.id))]);
  if (idSet.size === 0) {
    return {
      hasProfile, profileCity, targetRole,
      buckets: { highMatch: [], highValue: [], urgent: [] },
      top: [],
      counts: { candidates: 0, matched: 0, favorites: favIds.size, applications: appIds.size },
    };
  }
  const ids = [...idSet];

  // 3) 批量技能命中（单次查询）
  const { rows } = await pgPool.query<ScoredRow>(
    `WITH my_skills AS (
        SELECT skill_id,
               CASE WHEN level >= 2 THEN 1.0 WHEN level = 1 THEN 0.5 ELSE 0.0 END AS hit
          FROM user_skills WHERE user_id = $1
     ),
     job_skills AS (
        SELECT l.job_id, s.name, l.weight::float AS weight, COALESCE(ms.hit, 0) AS hit
          FROM job_skill_links l
          JOIN skill_taxonomy s ON s.id = l.skill_id
          LEFT JOIN my_skills ms ON ms.skill_id = l.skill_id
         WHERE l.job_id = ANY($2::bigint[])
     ),
     agg AS (
        SELECT job_id,
               SUM(weight) AS total_weight,
               SUM(weight * hit) AS hit_weight,
               array_agg(name ORDER BY weight DESC) FILTER (WHERE hit = 0) AS missing,
               array_agg(name ORDER BY weight DESC) FILTER (WHERE hit > 0) AS matched
          FROM job_skills GROUP BY job_id
     )
     SELECT j.id, j.title, j.company, j.city, j.education, j.salary_text, j.salary_band,
            j.url, j.source, j.published_at,
            COALESCE(a.total_weight, 0) AS total_weight,
            COALESCE(a.hit_weight, 0) AS hit_weight,
            COALESCE(a.missing, '{}') AS missing,
            COALESCE(a.matched, '{}') AS matched
       FROM job_postings j
       LEFT JOIN agg a ON a.job_id = j.id
      WHERE j.id = ANY($2::bigint[]) AND j.is_active = true`,
    [userId, ids]
  );
  if (rows.length === 0) {
    return {
      hasProfile, profileCity, targetRole,
      buckets: { highMatch: [], highValue: [], urgent: [] },
      top: [],
      counts: { candidates: ids.length, matched: 0, favorites: favIds.size, applications: appIds.size },
    };
  }

  // 4) 缺口学习时长：对出现过的缺失技能一次性取映射
  const allMissing = new Set<string>();
  for (const r of rows) for (const m of r.missing ?? []) allMissing.add(m);
  const hoursBySkill = new Map<string, number>();
  if (allMissing.size > 0) {
    const { rows: hourRows } = await pgPool.query<{ name: string; hours: string | number | null }>(
      `SELECT s.name, SUM(l.estimate_hours) AS hours
         FROM skill_content_links l
         JOIN skill_taxonomy s ON s.id = l.skill_id
        WHERE s.name = ANY($1::text[])
        GROUP BY s.name`,
      [[...allMissing]]
    );
    for (const h of hourRows) hoursBySkill.set(h.name, Number(h.hours ?? 0) || 0);
  }

  // 5) 截止事件（报名截止）取每个岗位最近的一个
  const deadlineMap = new Map<string, Date>();
  const { rows: eventRows } = await pgPool.query<{ job_id: string; event_at: Date }>(
    `SELECT DISTINCT ON (job_id) job_id, event_at
       FROM job_exam_events
      WHERE job_id = ANY($1::bigint[]) AND kind = 'apply_end' AND event_at > now()
      ORDER BY job_id, event_at ASC`,
    [ids]
  );
  for (const e of eventRows) deadlineMap.set(String(e.job_id), e.event_at);

  // 6) 逐岗位打分
  const now = Date.now();
  const matched: RadarJob[] = rows.map((r) => {
    const total = Number(r.total_weight ?? 0);
    const hit = Number(r.hit_weight ?? 0);
    const skillScore = total > 0 ? hit / total : 0;
    const cityOk = !profileCity ? 0.5 : r.city === profileCity ? 1 : 0;
    const overall = Math.round((skillScore * 0.7 + 0.1 + 0.1 + cityOk * 0.1) * 100);

    const missing = (r.missing ?? []).map((skill) => ({ skill }));
    const gapHours = missing.reduce((a, m) => a + (hoursBySkill.get(m.skill) ?? 0), 0);

    const deadline = deadlineMap.get(String(r.id)) ?? null;
    const days = deadline ? Math.ceil((deadline.getTime() - now) / 86_400_000) : null;

    const matchedSkills: RadarMatchedSkill[] = (r.matched ?? []).map((skill) => ({
      skill,
      level: 0,
      hit: true,
      partial: false,
    }));

    return {
      jobId: Number(r.id),
      title: r.title,
      company: r.company,
      city: r.city,
      education: r.education,
      salaryText: r.salary_text,
      salaryBand: r.salary_band,
      url: r.url,
      source: r.source,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      overall: clamp(overall, 0, 100),
      matchedSkills,
      missingSkills: missing,
      gapHours,
      deadlineAt: deadline ? deadline.toISOString() : null,
      deadlineLabel: days === null ? null : days <= 0 ? "今日截止" : `${days} 天后截止`,
      fromFavorite: favIds.has(String(r.id)),
      fromApplication: appIds.has(String(r.id)),
    };
  });

  const byScore = [...matched].sort((a, b) => b.overall - a.overall || a.gapHours - b.gapHours);

  const highMatch = byScore.filter((j) => j.overall >= HIGH_MATCH_MIN).slice(0, limit);
  const highValue = byScore
    .filter((j) => j.overall >= HIGH_VALUE_MIN && HIGH_SALARY_BANDS.has(j.salaryBand))
    .slice(0, limit);
  const urgent = matched
    .filter((j) => {
      if (!j.deadlineAt) return false;
      const days = (Date.parse(j.deadlineAt) - now) / 86_400_000;
      return days >= 0 && days <= URGENT_DAYS;
    })
    .sort((a, b) => Date.parse(a.deadlineAt!) - Date.parse(b.deadlineAt!))
    .slice(0, limit);

  return {
    hasProfile,
    profileCity,
    targetRole,
    buckets: { highMatch, highValue, urgent },
    top: byScore.slice(0, limit),
    counts: { candidates: ids.length, matched: matched.length, favorites: favIds.size, applications: appIds.size },
  };
}

/** 画像缺失时的 A 兜底：仅按活跃岗位 + 城市给出基础列表（无技能匹配分） */
export async function radarFallback(
  opts: { city?: string | null; limit?: number } = {}
): Promise<RadarResult> {
  const limit = Math.max(1, Math.min(TOP_LIMIT, opts.limit ?? TOP_LIMIT));
  try {
    const { rows } = await pgPool.query<ScoredRow>(
      opts.city
        ? `SELECT id, title, company, city, education, salary_text, salary_band, url, source, published_at,
                  NULL AS total_weight, NULL AS hit_weight, '{}'::text[] AS missing
             FROM job_postings WHERE is_active = true AND city = $1
            ORDER BY published_at DESC NULLS LAST, fetched_at DESC LIMIT $2`
        : `SELECT id, title, company, city, education, salary_text, salary_band, url, source, published_at,
                  NULL AS total_weight, NULL AS hit_weight, '{}'::text[] AS missing
             FROM job_postings WHERE is_active = true
            ORDER BY published_at DESC NULLS LAST, fetched_at DESC LIMIT $1`,
      opts.city ? [opts.city, limit] : [limit]
    );
    const jobs: RadarJob[] = rows.map((r) => ({
      jobId: Number(r.id),
      title: r.title,
      company: r.company,
      city: r.city,
      education: r.education,
      salaryText: r.salary_text,
      salaryBand: r.salary_band,
      url: r.url,
      source: r.source,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      overall: 0,
      matchedSkills: [],
      missingSkills: [],
      gapHours: 0,
      deadlineAt: null,
      deadlineLabel: null,
      fromFavorite: false,
      fromApplication: false,
    }));
    return {
      hasProfile: false,
      profileCity: opts.city ?? null,
      targetRole: null,
      buckets: { highMatch: [], highValue: [], urgent: [] },
      top: jobs,
      counts: { candidates: jobs.length, matched: 0, favorites: 0, applications: 0 },
    };
  } catch (e) {
    logger.error("radar fallback error", e);
    return {
      hasProfile: false,
      profileCity: opts.city ?? null,
      targetRole: null,
      buckets: { highMatch: [], highValue: [], urgent: [] },
      top: [],
      counts: { candidates: 0, matched: 0, favorites: 0, applications: 0 },
    };
  }
}