import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listQuestions, listQuestionModules } from "@/lib/interview";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const moduleFilter = url.searchParams.get("module") ?? undefined;
  const difficulty = url.searchParams.get("difficulty") ?? undefined;
  try {
    const [questions, modules] = await Promise.all([
      listQuestions({ module: moduleFilter, difficulty }),
      listQuestionModules(),
    ]);
    return NextResponse.json({ questions, modules });
  } catch (e) {
    logger.error("questions list error", e);
    return NextResponse.json({ error: "题库加载失败" }, { status: 500 });
  }
}
