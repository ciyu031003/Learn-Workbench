import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import {
  deleteMarketSavedView,
  renameMarketSavedView,
  updateMarketSavedViewFilters,
} from "@/lib/domains/market/saved-views";
import { logger } from "@/lib/logger";

type Context = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: Context) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (typeof body?.name === "string") {
      const view = await renameMarketSavedView(userId, id, body.name);
      if (!view) return NextResponse.json({ error: "市场视图不存在" }, { status: 404 });
      return NextResponse.json({ view });
    }
    const view = await updateMarketSavedViewFilters(userId, id, body?.filters ?? {});
    if (!view) return NextResponse.json({ error: "市场视图不存在" }, { status: 404 });
    return NextResponse.json({ view });
  } catch (error) {
    logger.error("market view update error", error);
    return NextResponse.json({ error: "市场视图更新失败" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Context) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const ok = await deleteMarketSavedView(userId, id);
    if (!ok) return NextResponse.json({ error: "市场视图不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("market view delete error", error);
    return NextResponse.json({ error: "市场视图删除失败" }, { status: 500 });
  }
}
