import { notFound } from "next/navigation";
import { loadAlgorithmAnimations, loadLearningTrack } from "@/lib/content/learning-repo";
import { AnimationFramesProvider } from "@/components/learning/algorithm-animation";
import CourseDetail from "./course-detail";

/**
 * 课程详情（服务端）：课程/阶段/知识点/讲义/配套题/算法动图全部来自**数据库**。
 * 库里没有 → 404；内容改动只需改库并跑一次内容同步，无需重新构建前端。
 */
export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [track, animations] = await Promise.all([loadLearningTrack(slug), loadAlgorithmAnimations()]);
  if (!track) notFound();
  return (
    <AnimationFramesProvider frames={animations}>
      <CourseDetail track={track} />
    </AnimationFramesProvider>
  );
}
