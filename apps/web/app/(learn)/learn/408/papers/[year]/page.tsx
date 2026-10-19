import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperRunner } from "@/components/exam/paper-runner";
import { getExam408Paper } from "@/lib/exam-408";

export const dynamic = "force-dynamic";

/** 来源许可要求「不再分发」（db/migrations/071_exam_408_content.sql:226）：真题原卷不收录 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Exam408PaperPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) notFound();
  const paper = await getExam408Paper(parsedYear);
  if (!paper) notFound();
  return <PaperRunner paper={paper} />;
}
