import type { LearningDifficulty, LearningQuestion } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function singleQuestion(input: {
  key: string;
  stageKey: string;
  stem: string;
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
}): LearningQuestion {
  return {
    key: input.key,
    stageKey: input.stageKey,
    type: "single",
    stem: input.stem,
    options: input.options.map((text, index) => ({ key: OPTION_KEYS[index], text })),
    answer: [input.answer],
    explanation: input.explanation,
    difficulty: input.difficulty,
    tags: input.tags,
    sourceKey: input.sourceKey,
  };
}

export function judgeQuestion(input: {
  key: string;
  stageKey: string;
  stem: string;
  answer: boolean;
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
}): LearningQuestion {
  return {
    key: input.key,
    stageKey: input.stageKey,
    type: "judge",
    stem: input.stem,
    options: [
      { key: "A", text: "正确" },
      { key: "B", text: "错误" },
    ],
    answer: [input.answer ? "A" : "B"],
    explanation: input.explanation,
    difficulty: input.difficulty,
    tags: input.tags,
    sourceKey: input.sourceKey,
  };
}
