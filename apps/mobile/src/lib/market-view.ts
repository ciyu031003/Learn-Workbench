import type { MarketAnalysis, MarketGapItem, UserSkillView } from "@learn-workbench/shared";

export interface MarketKpis {
  total: number;
  cityCount: number;
  skillCount: number;
  avgSalary: number | null;
}

export interface MarketSkillRow {
  skill: string;
  count: number;
  avgSalary: number;
  myLevel: number | null;
  topicId: number | null;
  topicTitle: string | null;
  estimateHours: number | null;
  enrollable: boolean;
  phaseId: number | null;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function marketKpis(data: MarketAnalysis): MarketKpis {
  return {
    total: data.total,
    cityCount: data.overview?.cityCount ?? data.byCity.length,
    skillCount: data.overview?.skillCount ?? data.bySkill.length,
    avgSalary: data.overview?.avgSalary ?? null,
  };
}

export function marketSkillRows(
  data: MarketAnalysis,
  skills: UserSkillView[] = [],
  gaps: MarketGapItem[] = []
): MarketSkillRow[] {
  const levelMap = new Map(skills.map((s) => [normalize(s.name), s.level]));
  const gapMap = new Map(gaps.map((g) => [normalize(g.skill), g]));

  return (data.skillSalary ?? [])
    .filter((item) => item.avgSalary != null && item.count > 0)
    .map((item) => {
      const key = normalize(item.skill);
      const gap = gapMap.get(key);
      return {
        skill: item.skill,
        count: item.count,
        avgSalary: item.avgSalary as number,
        myLevel: levelMap.get(key) ?? null,
        topicId: gap?.topicId ?? null,
        topicTitle: gap?.topicTitle ?? null,
        estimateHours: gap?.estimateHours ?? null,
        enrollable: gap?.enrollable ?? false,
        phaseId: gap?.phaseId ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);
}
