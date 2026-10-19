import { Suspense } from "react";
import { flattenLearningQuestions } from "@/lib/learning-questions";
import { loadLearningTracks } from "@/lib/content/learning-repo";
import QuestionsBrowser from "./questions-browser";

/**
 * 题库总览（服务端）：题目来自**数据库**；服务端查库并拍平成条目，前端只做筛选与模板渲染。
 * 改题/加题只需改库（或跑一次内容同步），不再需要重新构建前端。
 */
export const dynamic = "force-dynamic";

export default async function LearnQuestionsPage() {
  const tracks = await loadLearningTracks();
  const items = flattenLearningQuestions(tracks);
  return (
    <Suspense fallback={null}>
      <QuestionsBrowser items={items} />
    </Suspense>
  );
}
