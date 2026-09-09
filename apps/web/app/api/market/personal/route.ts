import { currentSessionToken, currentUserId } from "@/lib/session";
import { getMarketPersonalInsights } from "@/lib/domains/market/personal";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const token = await currentSessionToken();
  if (!token) {
    return Response.json({ loggedIn: false });
  }
  const userId = await currentUserId();
  if (!userId) {
    return Response.json({ loggedIn: false });
  }

  try {
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 5;
    const data = await getMarketPersonalInsights(userId, Math.min(10, Math.max(1, limit)));
    return Response.json(data);
  } catch (error) {
    logger.error("market personal api error", error);
    return Response.json({ error: "个人市场位置加载失败" }, { status: 500 });
  }
}
