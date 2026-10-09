export type LearningCategory =
  | "编程语言"
  | "数据分析"
  | "商业智能"
  | "后端开发"
  | "前端开发"
  | "人工智能"
  | "操作系统"
  | "系统设计";

export type LearningLevel = "入门" | "进阶" | "综合";
export type LearningQuestionType = "single" | "judge";
export type LearningDifficulty = "easy" | "medium" | "hard";

export interface LearningSource {
  key: string;
  name: string;
  url: string;
  license: string;
  usage: "import" | "reference";
  note: string;
}

export interface LearningQuestionOption {
  key: string;
  text: string;
}

export interface LearningQuestion {
  key: string;
  stageKey: string;
  type: LearningQuestionType;
  stem: string;
  options: LearningQuestionOption[];
  answer: string[];
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
}

export interface LearningTopic {
  key: string;
  title: string;
  summary: string;
  concepts: string[];
  principles: string[];
  applications: string[];
  pitfalls: string[];
  method: string;
  exercise: string;
  checkpoint: string;
}

export interface LearningStage {
  key: string;
  title: string;
  weeks: string;
  goal: string;
  outcome: string;
  topics: LearningTopic[];
  questionKeys: string[];
}

export interface LearningTrack {
  slug: string;
  title: string;
  category: LearningCategory;
  level: LearningLevel;
  accent: string;
  softAccent: string;
  icon: string;
  summary: string;
  whyLearn: string;
  prerequisites: string[];
  studyMethod: string[];
  estimatedHours: number;
  featured: boolean;
  stages: LearningStage[];
  questions: LearningQuestion[];
  sources: LearningSource[];
}
