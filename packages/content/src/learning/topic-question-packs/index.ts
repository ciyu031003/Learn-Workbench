import { aiEngineeringTopicQuestions } from "./ai-engineering";
import { dataAnalysisTopicQuestions } from "./data-analysis";
import { javaTopicQuestions } from "./java";
import { javascriptTopicQuestions } from "./javascript";
import { linuxTopicQuestions } from "./linux";
import { powerBiTopicQuestions } from "./power-bi";
import { pythonTopicQuestions } from "./python";
import type { LearningQuestion } from "../types";

export const topicQuestionPacks: LearningQuestion[] = [
  ...pythonTopicQuestions,
  ...javaTopicQuestions,
  ...javascriptTopicQuestions,
  ...linuxTopicQuestions,
  ...dataAnalysisTopicQuestions,
  ...powerBiTopicQuestions,
  ...aiEngineeringTopicQuestions,
];
