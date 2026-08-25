export interface MarketCityRow { city: string; count: number; avgMin: number | null; avgMax: number | null; }

export interface MarketSkillRow { skill: string; count: number; }

export interface MarketSalaryRow { label: string; min: number; count: number; }

export interface MarketEduRow { label: string; count: number; }

export interface MarketExpRow { label: string; count: number; }

export interface MarketPlatformRow { label: string; count: number; }

export interface MarketJobTypeRow { label: string; count: number; }

export interface MarketSkillSalaryRow { skill: string; avgSalary: number | null; count: number; }

export interface MarketOverview {
  total: number;                  // 职位样本
  cityCount: number;              // 去重城市数
  skillCount: number;             // 热门技能数（去重标签）
  avgSalary: number | null;       // 整体平均薪资（K/月）
  medianSalary: number | null;    // 整体中位薪资（K/月）
}

export interface MarketAnalysis {
  total: number;
  overview: MarketOverview;
  byCity: MarketCityRow[];       // 城市需求
  bySkill: MarketSkillRow[];     // 技能热度
  salaryDist: MarketSalaryRow[]; // 薪资分布
  byEducation: MarketEduRow[];   // 学历需求
  byExperience: MarketExpRow[];  // 经验需求
  byFunction: MarketExpRow[];    // 岗位职能方向 TOP（清洗公司名脏 title 后按关键词分类）
  byPlatform: MarketPlatformRow[]; // 数据来源平台分布
  byJobType: MarketJobTypeRow[];   // 岗位类型占比（全职/实习/外包/兼职）
  skillSalary: MarketSkillSalaryRow[]; // 技能-薪资相关性（job_skill_links JOIN）
  generatedAt: string;
}
