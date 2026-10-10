import { aiEngineeringTopicLessons } from "./ai-engineering";
import { dataAnalysisTopicLessons } from "./data-analysis";
import { databaseTopicLessons } from "./database";
import { javaTopicLessons } from "./java";
import { javascriptTopicLessons } from "./javascript";
import { linuxTopicLessons } from "./linux";
import { powerBiTopicLessons } from "./power-bi";
import { pythonTopicLessons } from "./python";
import { stageLessons } from "./stages";
import type { LearningTopicLesson } from "../types";

export const topicLessons: Record<string, LearningTopicLesson> = {
  ...pythonTopicLessons,
  ...javaTopicLessons,
  ...javascriptTopicLessons,
  ...dataAnalysisTopicLessons,
  ...powerBiTopicLessons,
  ...linuxTopicLessons,
  ...aiEngineeringTopicLessons,
  ...databaseTopicLessons,
};

export { stageLessons };
