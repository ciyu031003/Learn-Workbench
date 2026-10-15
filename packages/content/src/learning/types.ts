export type LearningCategory =
  | "408"
  | "计算机基础"
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
  | "网络工程"
  | "网络安全";

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
  /** 题目分级：入门级 / 进阶级 / 综合级。缺省时由 difficulty 推导（easy→入门、medium→进阶、hard→综合）。 */
  level?: LearningLevel;
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

/**
 * 专业术语的「小白解释」。
 *
 * 知识点正文里难免出现行话（幂等、索引覆盖、N+1、CORS…）。对刚入门的人，术语本身就是门槛：
 * 这里给每条术语一句**人话**，再补一段**更细的说明**（可选，讲清"为什么"和"什么时候会踩坑"）。
 */
export interface LearningTerm {
  /** 术语本身（保留英文原词，便于搜索） */
  term: string;
  /** 一句话人话解释（≤60 字，先让人"看懂"） */
  plain: string;
  /** 展开说明：为什么、怎么用、常见误解（可选） */
  detail?: string;
}

export interface LearningTopicLesson {
  overview: string[];
  mechanism: string[];
  example: LearningCodeExample;
  practiceSteps: string[];
  masteryChecklist: string[];
  /**
   * 本章小结（3-6 条）：把这一节"该记住什么"收口成可复述的短句。
   * 与 overview（展开讲）和 masteryChecklist（自检项）分工不同 —— 小结是"合上书能背出来"的那几句。
   */
  summary?: string[];
  /** 术语小白解释（本章出现的行话） */
  terms?: LearningTerm[];
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
  /**
   * 算法演示动图的 key（见 `algorithm-animations.ts` 的 `algorithmAnimations` 注册表）。
   * 每个 key 对应一组按帧播放的 SVG：渲染层按帧切换到下一帧，浏览器/移动端都可播放。
   */
  animations?: string[];
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
