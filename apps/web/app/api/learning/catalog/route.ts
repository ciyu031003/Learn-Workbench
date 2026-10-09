import { NextResponse } from "next/server";
import { learningCatalog } from "@/lib/learning";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    return NextResponse.json({ tracks: learningCatalog() });
  } catch (error) {
    logger.error("learning catalog error", error);
    return NextResponse.json({ error: "技术题库加载失败" }, { status: 500 });
  }
}

