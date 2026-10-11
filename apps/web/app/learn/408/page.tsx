import { Exam408Hub } from "@/components/exam/exam-408-hub";
import { getExam408Overview } from "@/lib/exam-408";

export const dynamic = "force-dynamic";

export default async function Exam408Page() {
  const overview = await getExam408Overview();
  return <Exam408Hub overview={overview} />;
}
