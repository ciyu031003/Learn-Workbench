import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listSubscriptions, saveSubscription } from "@/lib/jobs";
import { jobSubscriptionSchema } from "@learn-workbench/shared";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const subscriptions = await listSubscriptions(userId);
  return NextResponse.json({ subscriptions });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const input = body?.subscription ?? body;
  const parsed = jobSubscriptionSchema.omit({ id: true, createdAt: true }).safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "订阅格式不正确", detail: parsed.error.flatten() }, { status: 400 });
  }
  const rawId = input?.id;
  const id = typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const subscription = await saveSubscription(userId, { ...parsed.data, id });
  return NextResponse.json({ ok: true, subscription });
}
