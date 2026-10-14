import { loadLearningTracks } from "@/lib/content/learning-repo";
import LearnLibrary from "./learn-library";

/**
 * 技术课程列表（服务端）：课程/阶段/知识点/题目全部来自**数据库**，前端只做筛选与模板渲染。
 */
export const dynamic = "force-dynamic";

export default async function LearnLibraryPage() {
  const tracks = await loadLearningTracks();
  return <LearnLibrary tracks={tracks} />;
}
