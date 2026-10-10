/**
 * 题目生命周期的**纯词汇表**（组二 · 阶段 12 剩余）。
 *
 * 单独成文件的原因：客户端组件要引这些常量做角标，但 `content/question-lifecycle.ts`
 * 会 `import pgPool`；把常量和 DB 访问分开，客户端就不会把数据库连接打进 bundle。
 */

export const QUESTION_STATUSES = ["draft", "review", "published", "archived"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "草稿",
  review: "待审",
  published: "已发布",
  archived: "已下线",
};

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return typeof value === "string" && (QUESTION_STATUSES as readonly string[]).includes(value);
}
