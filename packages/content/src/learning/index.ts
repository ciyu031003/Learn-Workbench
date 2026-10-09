import { dataAnalysisTrack } from "./data-analysis";
import { javaTrack } from "./java";
import { powerBiTrack } from "./power-bi";
import { pythonTrack } from "./python";
import type { LearningQuestion, LearningTrack } from "./types";

export const learningTracks: LearningTrack[] = [
  pythonTrack,
  javaTrack,
  dataAnalysisTrack,
  powerBiTrack,
];

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

