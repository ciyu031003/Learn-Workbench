import { pgPool } from "@/lib/db";
import { scopeWhere } from "@/lib/anon";
import {
  DEFAULT_RESUME_SECTION_ORDER,
  normalizeSectionOrder,
  resumeStyleSchema,
  getResumeTemplate,
  type ResumeContent,
  type ResumeSectionConfig,
  type ResumeStyle,
} from "@learn-workbench/shared";

export interface Scope {
  uid: string | null;
  anonId: string | null;
}

/** 由 Profile 信息源（user_settings）组装基本信息 / 教育 / 经历 —— Resume 与就绪度共用的单一来源 */
async function loadProfileParts(scope: Scope): Promise<{
  basics: ResumeContent["basics"];
  education: ResumeContent["education"];
  experience: ResumeContent["experience"];
}> {
  const base: unknown[] = [scope.uid];
  const w = scopeWhere(scope, base);
  const { rows } = await pgPool.query<{
    bio: string | null;
    currentCity: string | null;
    targetRole: string | null;
    education: unknown;
    experiences: unknown;
    displayName: string | null;
    email: string | null;
    weightKg: string | null;
  }>(
    `SELECT s.bio, s.current_city AS "currentCity", s.target_role AS "targetRole",
            s.education, s.experiences,
            u.display_name AS "displayName", u.email
       FROM user_settings s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.user_id IS NOT DISTINCT FROM $1${w.sql} LIMIT 1`,
    w.params
  );
  const row = rows[0] ?? ({} as (typeof rows)[number]);

  const education = Array.isArray(row.education)
    ? (row.education as ResumeContent["education"])
    : [];
  const experience = Array.isArray(row.experiences)
    ? (row.experiences as ResumeContent["experience"])
    : [];

  return {
    basics: {
      name: row.displayName ?? "",
      headline: row.targetRole ?? "",
      city: row.currentCity ?? "",
      targetRole: row.targetRole ?? "",
      summary: row.bio ?? "",
      email: row.email ?? "",
    },
    education,
    experience,
  };
}

/** 技能：user_skills 优先，缺失时回退 resume_assets(kind='skill') 的文字 */
async function loadSkills(scope: Scope): Promise<ResumeContent["skills"]> {
  const base: unknown[] = [scope.uid];
  const w = scopeWhere(scope, base);
  const { rows } = await pgPool.query<{ name: string; level: number; category: string }>(
    `SELECT st.name, us.level, st.category
       FROM user_skills us
       JOIN skill_taxonomy st ON st.id = us.skill_id
      WHERE us.user_id IS NOT DISTINCT FROM $1${w.sql}
      ORDER BY us.level DESC, st.name`,
    w.params
  );
  if (rows.length > 0) return rows.map((r) => ({ name: r.name, level: r.level, category: r.category ?? "" }));

  const w2 = scopeWhere(scope, [scope.uid]);
  const { rows: fallback } = await pgPool.query<{ title: string }>(
    `SELECT title FROM resume_assets
      WHERE user_id IS NOT DISTINCT FROM $1${w2.sql} AND kind = 'skill' AND deleted_at IS NULL
      ORDER BY sort_order, id DESC`,
    w2.params
  );
  return fallback.map((r) => ({ name: r.title, level: 0, category: "" }));
}

/** 项目/GitHub：resume_assets(kind in project,github) */
async function loadProjects(scope: Scope): Promise<ResumeContent["projects"]> {
  const base: unknown[] = [scope.uid];
  const w = scopeWhere(scope, base);
  const { rows } = await pgPool.query<{ title: string; content: string | null; url: string | null; kind: string }>(
    `SELECT title, content, url, kind FROM resume_assets
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND kind IN ('project','github') AND deleted_at IS NULL
      ORDER BY kind, sort_order, id DESC`,
    w.params
  );
  return rows.map((r) => ({ title: r.title, content: r.content, url: r.url, kind: r.kind }));
}

/** 证书：独立证书领域（Phase 3），已取得/备考中均展示 */
async function loadCertificates(scope: Scope): Promise<ResumeContent["certificates"]> {
  const base: unknown[] = [scope.uid];
  const w = scopeWhere(scope, base);
  const { rows } = await pgPool.query<{
    name: string; issuer: string | null; earnedDate: string | null; expiryDate: string | null;
  }>(
    `SELECT name, issuer, earned_date AS "earnedDate", expiry_date AS "expiryDate"
       FROM certificates
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
      ORDER BY sort_order, COALESCE(earned_date, target_date) NULLS LAST, id DESC`,
    w.params
  );
  return rows.map((r) => ({
    name: r.name,
    issuer: r.issuer,
    earnedDate: r.earnedDate ? String(r.earnedDate).slice(0, 10) : null,
    expiryDate: r.expiryDate ? String(r.expiryDate).slice(0, 10) : null,
  }));
}

/** 组装完整简历内容（只读，实时来自各领域来源） */
export async function assembleResumeContent(scope: Scope): Promise<ResumeContent> {
  const [profile, skills, projects, certificates] = await Promise.all([
    loadProfileParts(scope),
    loadSkills(scope),
    loadProjects(scope),
    loadCertificates(scope),
  ]);
  return {
    basics: profile.basics,
    education: profile.education,
    experience: profile.experience,
    skills,
    projects,
    certificates,
  };
}

/** 归一化 section_order 列（jsonb → ResumeSectionConfig[]） */
export function parseSectionOrder(raw: unknown): ResumeSectionConfig[] {
  return normalizeSectionOrder(raw);
}

/** 合并模板默认样式 + 文档样式 */
export function parseStyles(templateKey: string, raw: unknown): Partial<ResumeStyle> {
  const tpl = getResumeTemplate(templateKey);
  const merged = { ...tpl.defaults, ...(typeof raw === "object" && raw !== null ? raw : {}) };
  const parsed = resumeStyleSchema.partial().safeParse(merged);
  return parsed.success ? parsed.data : tpl.defaults;
}

export const DEFAULT_SECTION_ORDER = DEFAULT_RESUME_SECTION_ORDER;
