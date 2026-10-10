import { aiEngineeringTrack } from "./ai-engineering";
import { algorithmsTrack } from "./algorithms";
import { applicationSecurityTrack } from "./application-security";
import { backendEngineeringTrack } from "./backend-engineering";
import { cloudPlatformTrack } from "./cloud-platform";
import { dataAnalysisTrack } from "./data-analysis";
import { databaseTrack } from "./database";
import { javaTrack } from "./java";
import { javascriptTrack } from "./javascript";
import { linuxTrack } from "./linux";
import { networkEngineeringTrack } from "./network-engineering";
import { powerBiTrack } from "./power-bi";
import { pythonTrack } from "./python";
import { expandLearningTrack } from "./question-expansions";
import type { LearningQuestion, LearningTrack } from "./types";

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
];

export const learningTracks: LearningTrack[] = baseLearningTracks.map(expandLearningTrack);

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
