import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getCrawlerConfig, saveCrawlerConfig } from "@/lib/jobs";
import { jobCrawlerConfigSchema } from "@learn-workbench/shared";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const config = await getCrawlerConfig(userId);
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = jobCrawlerConfigSchema.safeParse(body?.config ?? body);
  if (!parsed.success) {
    return NextResponse.json({ error: "配置格式不正确", detail: parsed.error.flatten() }, { status: 400 });
  }
  await saveCrawlerConfig(userId, parsed.data);
  return NextResponse.json({ ok: true, config: parsed.data });
}
