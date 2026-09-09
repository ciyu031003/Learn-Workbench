import { pgPool } from "@/lib/db";
import { queryJobs } from "@/lib/domains/jobs/queries";
import {
  aggregateMarketGaps,
  computeJobMatch,
  listUserSkills,
} from "@/lib/skills";
import type { MarketGapItem, UserSkillView } from "@learn-workbench/shared";

export interface MarketPersonalJob {
  id: number;
  title: string;
  company: string;
  city: string;
  salaryText: string;
  url: string;
  source: string;
  isNew: boolean;
  isFav: boolean;
  match: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface MarketPersonalInsights {
  loggedIn: true;
  profile: {
    skills: UserSkillView[];
    profileSkillCount: number;
    marketSkillCount: number;
    skillCoveragePct: number;
  };
  reachableJobs: number;
  gaps: MarketGapItem[];
  recommendations: MarketPersonalJob[];
}

export async function getMarketPersonalInsights(
  userId: string,
  limit = 5
): Promise<MarketPersonalInsights> {
  const [skills, gapResult, marketSkillRes] = await Promise.all([
    listUserSkills(userId),
    aggregateMarketGaps(userId, { limit: Math.min(limit + 4, 12) }),
    pgPool.query<{ n: number }>(
      "SELECT count(DISTINCT skill_id)::int AS n FROM job_skill_links"
    ),
  ]);

  const strongSkills = skills
    .filter((skill) => skill.level >= 2)
    .slice(0, 6);
  const skillNames = strongSkills.map((skill) => skill.name);
  const jobs = skillNames.length
    ? await queryJobs({
        page: 1,
        pageSize: limit,
        skills: skillNames,
        userId,
      })
    : { jobs: [], total: 0 };

  const recommendations = await Promise.all(
    jobs.jobs.slice(0, limit).map(async (job) => {
      const match = await computeJobMatch(userId, job.id);
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        city: job.city,
        salaryText: job.salaryText,
        url: job.url,
        source: job.source,
        isNew: job.isNew,
        isFav: job.isFav,
        match: match.overall,
        matchedSkills: match.matchedSkills
          .filter((item) => item.hit || item.partial)
          .map((item) => item.skill),
        missingSkills: match.missingSkills.map((item) => item.skill).slice(0, 6),
      };
    })
  );

  const profileSkillCount = skills.filter((skill) => skill.level >= 1).length;
  const marketSkillCount = Number(marketSkillRes.rows[0]?.n ?? 0);
  const skillCoveragePct = marketSkillCount
    ? Math.min(100, Math.round((profileSkillCount / marketSkillCount) * 100))
    : 0;

  return {
    loggedIn: true,
    profile: {
      skills,
      profileSkillCount,
      marketSkillCount,
      skillCoveragePct,
    },
    reachableJobs: jobs.total,
    gaps: gapResult.gaps,
    recommendations,
  };
}
