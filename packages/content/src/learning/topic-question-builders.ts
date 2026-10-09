import { judgeQuestion, singleQuestion } from "./question-builders";
import type { LearningDifficulty, LearningQuestion } from "./types";

type SingleInput = {
  stem: string;
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
};

type JudgeInput = {
  stem: string;
  answer: boolean;
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
};

export function topicQuestionPair(
  topicKey: string,
  stageKey: string,
  single: SingleInput,
  judge: JudgeInput
): LearningQuestion[] {
  return [
    singleQuestion({
      ...single,
      key: `${topicKey}-single`,
      topicKey,
      stageKey,
    }),
    judgeQuestion({
      ...judge,
      key: `${topicKey}-judge`,
      topicKey,
      stageKey,
    }),
  ];
}
