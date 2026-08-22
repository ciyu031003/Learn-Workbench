import { pgPool } from "@/lib/db";
import { readinessWeights } from "@learn-workbench/config";
import { anonFilterSql } from "@/lib/anon";
import type { CareerReadiness, ReadinessDimension } from "@learn-workbench/shared";

/** 目标岗位：settings.career → careers.name；未设置时回退 ICT 学习规划 */
export async function loadTargetRole(userId: string | null): Promise<{ career: string; careerName: string }> {
  let career = "ict";
  if (userId) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
      [userId]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  const { rows } = await pgPool.query<{ name: string }>(
    `SELECT name FROM careers WHERE career_key = $1`,
    [career]
  );
  return { career, careerName: rows[0]?.name ?? "ICT 学习规划" };
}

/** 匿名作用域：未登录时追加 anon_id 过滤（含遗留行） */
function anonScope(uid: string | null, anonId: string | null, base: unknown[]): { params: unknown[]; sql: string } {
  const params = [...base];
  if (uid) return { params, sql: "" };
  params.push(anonId);
  return { params, sql: ` AND ${anonFilterSql(params.length)}` };
}

/** 四维打分（0-100）：技能 / 项目 / 简历 / 面试 —— 数据全部来自现有表，规则版，P5 再上模型 */
export async function computeReadiness(
  userId: string | null,
  anonId: string | null = null
): Promise<CareerReadiness> {
  const { careerName } = await loadTargetRole(userId);

  // 技能：resume_assets(kind=skill) 数量 + topic_progress 完成度
  const skillScope = anonScope(userId, anonId, [userId]);
  const { rows: skillRows } = await pgPool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resume_assets WHERE user_id IS NOT DISTINCT FROM $1${skillScope.sql} AND kind = 'skill'`,
    skillScope.params
  );
  const skillCount = skillRows[0]?.n ?? 0;
  const progScope = anonScope(userId, anonId, [userId]);
  const { rows: progRows } = await pgPool.query<{ done: number; total: number }>(
    `SELECT count(*) FILTER (WHERE done)::int AS done, count(*)::int AS total
       FROM topic_progress WHERE user_id IS NOT DISTINCT FROM $1${progScope.sql}`,
    progScope.params
  );
  const topicTotal = progRows[0]?.total ?? 0;
  const topicDone = progRows[0]?.done ?? 0;
  const topicRatio = topicTotal > 0 ? topicDone / topicTotal : 0;
  const skillScore = clamp(Math.round(skillCount * 8 + topicRatio * 60), 0, 100);

  // 项目：resume_assets(kind=project) + content_projects 完成数（完成主题数近似）
  const projScope = anonScope(userId, anonId, [userId]);
  const { rows: projRows } = await pgPool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resume_assets WHERE user_id IS NOT DISTINCT FROM $1${projScope.sql} AND kind = 'project'`,
    projScope.params
  );
  const projectCount = projRows[0]?.n ?? 0;
  const projectScore = clamp(Math.round(projectCount * 20 + topicDone * 4), 0, 100);

  // 简历：resume_assets 四类资产完整度（skill/project/github/certificate）
  const resumeScope = anonScope(userId, anonId, [userId]);
  const { rows: resumeRows } = await pgPool.query<{ kind: string }>(
    `SELECT DISTINCT kind FROM resume_assets WHERE user_id IS NOT DISTINCT FROM $1${resumeScope.sql}`,
    resumeScope.params
  );
  const kinds = new Set(resumeRows.map((r) => r.kind));
  const resumeScore = clamp(Math.round(
    (kinds.has("skill") ? 25 : 0) +
    (kinds.has("project") ? 25 : 0) +
    (kinds.has("github") ? 25 : 0) +
    (kinds.has("certificate") ? 25 : 0)
  ), 0, 100);

  // 面试：log_entries(kind=interview) 数量近似（题库答题记录 P3 落地）
  const ivScope = anonScope(userId, anonId, [userId]);
  const { rows: ivRows } = await pgPool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${ivScope.sql} AND kind = 'interview'`,
    ivScope.params
  );
  const interviewCount = ivRows[0]?.n ?? 0;
  const interviewScore = clamp(Math.round(interviewCount * 20), 0, 100);

  // 匹配职位数：「发现 N 个适合你的职位」——P0 用活跃职位总数近似，P2 换真实匹配
  const { rows: jobRows } = await pgPool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM job_postings WHERE is_active = true`,
    []
  );
  const matchedJobs = jobRows[0]?.n ?? 0;

  const dimensions: ReadinessDimension[] = [
    { key: "skill", label: "技能", score: skillScore, weight: readinessWeights.skill, detail: `${skillCount} 项技能资产 · 主题完成 ${topicDone}/${topicTotal}` },
    { key: "project", label: "项目", score: projectScore, weight: readinessWeights.project, detail: `${projectCount} 个项目资产 · 完成 ${topicDone} 个主题` },
    { key: "resume", label: "简历", score: resumeScore, weight: readinessWeights.resume, detail: `资产完整度 ${kinds.size}/4 类` },
    { key: "interview", label: "面试", score: interviewScore, weight: readinessWeights.interview, detail: `${interviewCount} 篇面试日志` },
  ];
  const overall = Math.round(dimensions.reduce((a, d) => a + d.score * d.weight, 0));

  return { targetRole: careerName, overall, dimensions, matchedJobs };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}