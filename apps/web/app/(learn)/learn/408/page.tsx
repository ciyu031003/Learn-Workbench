import type { Metadata } from "next";
import { Exam408Hub } from "@/components/exam/exam-408-hub";
import { getExam408Overview } from "@/lib/exam-408";

export const dynamic = "force-dynamic";

/**
 * 来源许可要求「不再分发」（db/migrations/071_exam_408_content.sql:226）：
 * 本专区页面不得被搜索引擎收录 → noindex, nofollow；robots.txt 另有 /learn/408 Disallow 兜底。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Exam408Page() {
  const overview = await getExam408Overview();
  return <Exam408Hub overview={overview} />;
}
