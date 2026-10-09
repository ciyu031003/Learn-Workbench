import { z } from "zod";

export const learningAttemptInputSchema = z.object({
  questionKey: z.string().min(1).max(120),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  chosenAnswer: z.array(z.string().min(1).max(120)).min(1).max(8),
});
export type LearningAttemptInput = z.infer<typeof learningAttemptInputSchema>;

export const learningAttemptResultSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  isCorrect: z.boolean(),
  answer: z.array(z.string()),
  explanation: z.string(),
  createdAt: z.string(),
});
export type LearningAttemptResult = z.infer<typeof learningAttemptResultSchema>;

export interface LearningProgress {
  attempted: number;
  correct: number;
  wrong: number;
  mastery: number;
  today: number;
  recent: LearningAttemptResult[];
}

