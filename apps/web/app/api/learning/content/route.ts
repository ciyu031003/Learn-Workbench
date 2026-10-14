import { NextResponse } from "next/server";
import { loadAlgorithmAnimations, loadLearningTracks } from "@/lib/content/learning-repo";
import { logger } from "@/lib/logger";

/**
 * GET /api/learning/content —— 学习内容全量（**数据库**来源），供 App / 第三方只读。
 *
 * 返回 `{ contentVersion?, tracks }`，结构与内容包的 `LearningTrack[]` 一致：
 * 课程 / 阶段 / 知识点（含讲义与代码示例）/ 题目（含答案解析）/ 来源。
 * App 端拉一次落本地缓存即可离线浏览；改内容只需改库并跑一次内容同步。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [tracks, animations] = await Promise.all([loadLearningTracks(), loadAlgorithmAnimations()]);
    const questionCount = tracks.reduce((total, track) => total + track.questions.length, 0);
    return NextResponse.json(
      { tracks, animations, questionCount, trackCount: tracks.length },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    logger.error("learning content error", error);
    return NextResponse.json({ error: "学习内容加载失败" }, { status: 500 });
  }
}
