import { aiEngineeringTopicLessons } from "./ai-engineering";
import { algorithmsTopicLessons } from "./algorithms";
import { applicationSecurityTopicLessons } from "./application-security";
import { backendEngineeringTopicLessons } from "./backend-engineering";
import { cloudPlatformTopicLessons } from "./cloud-platform";
import { computerNetworkingTopicLessons } from "./computer-networking";
import { computerOrganizationTopicLessons } from "./computer-organization";
import { dataAnalysisTopicLessons } from "./data-analysis";
import { databaseTopicLessons } from "./database";
import { exam408TopicLessons } from "./exam-408";
import { javaTopicLessons } from "./java";
import { javascriptTopicLessons } from "./javascript";
import { linuxTopicLessons } from "./linux";
import { networkEngineeringTopicLessons } from "./network-engineering";
import { operatingSystemsTopicLessons } from "./operating-systems";
import { powerBiTopicLessons } from "./power-bi";
import { pythonTopicLessons } from "./python";
import { stageLessons } from "./stages";
import type { LearningTopicLesson } from "../types";

export const topicLessons: Record<string, LearningTopicLesson> = {
  ...algorithmsTopicLessons,
  ...applicationSecurityTopicLessons,
  ...backendEngineeringTopicLessons,
  ...pythonTopicLessons,
  ...javaTopicLessons,
  ...javascriptTopicLessons,
  ...dataAnalysisTopicLessons,
  ...powerBiTopicLessons,
  ...linuxTopicLessons,
  ...aiEngineeringTopicLessons,
  ...databaseTopicLessons,
  ...cloudPlatformTopicLessons,
  ...networkEngineeringTopicLessons,
  ...computerNetworkingTopicLessons,
  ...operatingSystemsTopicLessons,
  ...computerOrganizationTopicLessons,
  ...exam408TopicLessons,
};

export { stageLessons };
