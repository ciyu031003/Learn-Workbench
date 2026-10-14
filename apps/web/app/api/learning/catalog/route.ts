import { NextResponse } from "next/server";
import { loadLearningTracks } from "@/lib/content/learning-repo";
import { learningCatalog } from "@/lib/learning";
import { logger } from "@/lib/logger";

/**
 * GET /api/learning/catalog —— 课程目录（**数据库**来源）。
 * 返回结构与改造前一致：课程 + 阶段 + 知识点，题目只给题干、隐藏答案与解析。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tracks = await loadLearningTracks();
    return NextResponse.json({ tracks: learningCatalog(tracks) });
  } catch (error) {
    logger.error("learning catalog error", error);
    return NextResponse.json({ error: "技术题库加载失败" }, { status: 500 });
  }
}
