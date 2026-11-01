import { aiEngineeringTrack } from "./ai-engineering";
import { algorithmsTrack } from "./algorithms";
import { applicationSecurityTrack } from "./application-security";
import { backendEngineeringTrack } from "./backend-engineering";
import { cloudPlatformTrack } from "./cloud-platform";
import { computerNetworkingTrack } from "./computer-networking";
import { computerOrganizationTrack } from "./computer-organization";
import { dataAnalysisTrack } from "./data-analysis";
import { databaseTrack } from "./database";
import { exam408Track } from "./exam-408";
import { exam408GradTrack } from "./exam-408-grad";
import { applyExam408DeepLessons } from "./exam-408-grad-deep";
import { javaTrack } from "./java";
import { javascriptTrack } from "./javascript";
import { linuxTrack } from "./linux";
import { networkEngineeringTrack } from "./network-engineering";
import { operatingSystemsTrack } from "./operating-systems";
import { powerBiTrack } from "./power-bi";
import { pythonTrack } from "./python";
import { runoobCsToolsTrack } from "./runoob-cs-tools";
import { runoobFrontendTrack } from "./runoob-frontend";
import { runoobLangTrack } from "./runoob-lang";
import { expandLearningTrack } from "./question-expansions";
import { applyContentOverrides } from "./overrides";
import type { LearningQuestion, LearningTrack } from "./types";

/** ex-408-grad 在生成骨架之上叠加「加深层」正文（见 exam-408-grad-deep/）。 */
const exam408GradTrackWithDeep: LearningTrack = applyExam408DeepLessons(exam408GradTrack);

const baseLearningTracks: LearningTrack[] = [
  algorithmsTrack,
  backendEngineeringTrack,
  applicationSecurityTrack,
  pythonTrack,
  javaTrack,
  javascriptTrack,
  dataAnalysisTrack,
  powerBiTrack,
  linuxTrack,
  aiEngineeringTrack,
  databaseTrack,
  cloudPlatformTrack,
  networkEngineeringTrack,
  computerNetworkingTrack,
  operatingSystemsTrack,
  computerOrganizationTrack,
  exam408Track,
  exam408GradTrackWithDeep,
  runoobFrontendTrack,
  runoobLangTrack,
  runoobCsToolsTrack,
];

export const learningTracks: LearningTrack[] = baseLearningTracks
  .map(expandLearningTrack)
  // 数据库 → 内容包 的回写覆盖（scripts/export-content-from-db.mjs 生成）
  .map((track) => applyContentOverrides(track));

export const learningCategories = [...new Set(learningTracks.map((track) => track.category))];

export function getLearningTrack(slug: string | null | undefined): LearningTrack | null {
  if (!slug) return null;
  return learningTracks.find((track) => track.slug === slug) ?? null;
}

export function getLearningQuestion(trackSlug: string, questionKey: string): LearningQuestion | null {
  const track = getLearningTrack(trackSlug);
  if (!track) return null;
  return track.questions.find((question) => question.key === questionKey) ?? null;
}

export function getStageQuestions(track: LearningTrack, stageKey?: string | null): LearningQuestion[] {
  if (!stageKey) return track.questions;
  return track.questions.filter((question) => question.stageKey === stageKey);
}

export * from "./types";
export * from "./model";
export * from "./overrides";
export * from "./algorithm-animations";
