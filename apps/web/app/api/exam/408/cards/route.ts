import { NextResponse } from "next/server";

import { apiError, API_ERROR_CODES } from "@/lib/api-error";
import {
  CardNotFoundError,
  gradeCard,
  loadCardDetail,
  loadCardQueue,
  loadCardStats,
  parseCardRating,
  type CardQueueScope,
} from "@/lib/exam-408-cards";
import { logger } from "@/lib/logger";
import { currentUserId } from "@/lib/session";

/**
 * 408 刷卡 API（Web + App 共用）。
 *
 * GET  /api/exam/408/cards?mode=queue|stats&subject=&limit=&scope=queue|mistake
 * GET  /api/exam/408/cards?mode=card&cardKey=  —— 单张卡详情（公开内容，登录附带调度状态）
 * POST /api/exam/408/cards  { cardKey, rating: again|hard|good|easy, clientId? }
 *
 * 错误体统一 { error, code? }（见 lib/api-error.ts）：401 未登录 / 400 参数不合法 /
 * 404 卡不存在 / 500 服务端异常。评级写库带 clientId 幂等（离线重放不会白刷）。
 */

const MAX_CARD_KEY_LENGTH = 120;
const MAX_CLIENT_ID_LENGTH = 120;
/** mode=card 详情：内容只读，但带个人调度状态，只能私有缓存 */
const CARD_DETAIL_CACHE = "private, max-age=60";

function readSubject(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawMode = url.searchParams.get("mode");
  const mode = rawMode === "stats" ? "stats" : rawMode === "card" ? "card" : "queue";

  // mode=card：单张卡详情（P3-1）。内容本身公开，未登录也能读；登录才返回个人调度状态。
  if (mode === "card") {
    const cardKey = (url.searchParams.get("cardKey") ?? "").trim();
    if (!cardKey || cardKey.length > MAX_CARD_KEY_LENGTH) {
      return apiError(400, "cardKey 不合法", { code: API_ERROR_CODES.validation_failed });
    }
    try {
      const detail = await loadCardDetail(cardKey, await currentUserId());
      if (!detail) return apiError(404, "速记卡不存在", { code: API_ERROR_CODES.not_found });
      return NextResponse.json(
        { mode: "card", ...detail },
        { headers: { "cache-control": CARD_DETAIL_CACHE } },
      );
    } catch (error) {
      logger.error("exam 408 card detail error", error);
      return apiError(500, "速记卡加载失败", { code: API_ERROR_CODES.internal_error });
    }
  }

  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized });

  const subject = readSubject(url.searchParams.get("subject"));
  const scope: CardQueueScope = url.searchParams.get("scope") === "mistake" ? "mistake" : "queue";
  const rawLimit = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

  try {
    if (mode === "stats") {
      return NextResponse.json(await loadCardStats(userId, { subject }));
    }
    return NextResponse.json(await loadCardQueue(userId, { subject, limit, scope }));
  } catch (error) {
    logger.error("exam 408 cards query error", error);
    return apiError(500, "刷卡队列加载失败", { code: API_ERROR_CODES.internal_error });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return apiError(401, "请先登录", { code: API_ERROR_CODES.unauthorized });

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError(400, "刷卡数据无效", { code: API_ERROR_CODES.validation_failed });
  }
  const payload = body as { cardKey?: unknown; rating?: unknown; clientId?: unknown };
  const cardKey = typeof payload.cardKey === "string" ? payload.cardKey.trim() : "";
  const rating = parseCardRating(payload.rating);
  const clientId = typeof payload.clientId === "string" ? payload.clientId.trim() : "";
  if (
    cardKey.length === 0 ||
    cardKey.length > MAX_CARD_KEY_LENGTH ||
    rating === null ||
    clientId.length > MAX_CLIENT_ID_LENGTH
  ) {
    return apiError(400, "刷卡数据无效", { code: API_ERROR_CODES.validation_failed });
  }

  try {
    return NextResponse.json(
      await gradeCard(userId, { cardKey, rating, clientId: clientId.length > 0 ? clientId : null }),
    );
  } catch (error) {
    if (error instanceof CardNotFoundError) {
      return apiError(404, "卡片不存在", { code: API_ERROR_CODES.not_found });
    }
    logger.error("exam 408 card grade error", error);
    return apiError(500, "刷卡记录保存失败", { code: API_ERROR_CODES.internal_error });
  }
}
