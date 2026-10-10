export type LearningCategory =
  | "编程语言"
  | "数据分析"
  | "商业智能"
  | "后端开发"
  | "前端开发"
  | "人工智能"
  | "操作系统"
  | "系统设计"
  | "数据库"
  | "云平台"
  | "网络工程";

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
  topicKey?: string;
  type: LearningQuestionType;
  stem: string;
  options: LearningQuestionOption[];
  answer: string[];
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
}

export interface LearningCodeExample {
  title: string;
  language: string;
  code: string;
  explanation: string;
}

export interface LearningTopicLesson {
  overview: string[];
  mechanism: string[];
  example: LearningCodeExample;
  practiceSteps: string[];
  masteryChecklist: string[];
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
  lesson?: LearningTopicLesson;
}

export interface LearningStageMilestone {
  title: string;
  evidence: string;
}

export interface LearningStageLesson {
  overview: string[];
  studyLoop: string[];
  milestones: LearningStageMilestone[];
  completionCriteria: string[];
}

export interface LearningStage {
  key: string;
  title: string;
  weeks: string;
  goal: string;
  outcome: string;
  topics: LearningTopic[];
  questionKeys: string[];
  lesson?: LearningStageLesson;
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
