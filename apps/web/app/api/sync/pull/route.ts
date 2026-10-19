import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import {
  SYNC_ENTITY_TYPES,
  SYNC_PULL_DEFAULT_LIMIT,
  SYNC_PULL_MAX_LIMIT,
  parseSyncEntityList,
} from "@learn-workbench/shared/sync";
import {
  collectChangesSince,
  serverTimeISO,
  upsertSyncDevice,
  sanitizeDeviceId,
  sanitizeDeviceName,
} from "@/lib/sync-service";

/** 游标编码：base64url(JSON) —— 客户端只当不透明字符串，未来可换成 (updatedAt,id) 精确游标 */
interface PullCursorV1 {
  v: 1;
  offset: number;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset } satisfies PullCursorV1), "utf8").toString("base64url");
}

function decodeCursor(raw: string): { ok: true; offset: number } | { ok: false } {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<PullCursorV1>;
    if (parsed?.v !== 1 || !Number.isInteger(parsed.offset) || (parsed.offset as number) < 0) return { ok: false };
    return { ok: true, offset: parsed.offset as number };
  } catch {
    return { ok: false };
  }
}

/**
 * 增量同步 Pull v2（S5-2）：按设备 since 游标返回变更，客户端本地 LWW 合并。
 *
 * v2 增量（全部**向后兼容**，v1 客户端只读 changes/serverTime 不受影响）：
 *  - `entities=` 白名单：只拉指定实体（逗号分隔，如 entities=tasks,logs）；未知实体返回 400，
 *    不静默忽略（否则客户端会以为"拉完了"却缺实体）；
 *  - `limit=` 分页：默认 500、上限 1000；超过时返回 `hasMore=true` + `cursor`，
 *    客户端需**保持 since 不变**、带 cursor 继续翻页，取完再推进到 serverTime；
 *  - `serverTime`：Asia/Shanghai ISO（唯一可信游标）。
 *
 * 排序稳定性由 collectChangesSince 统一保证（updatedAt → entityType → entityId），
 * cursor 是"已取条数"的偏移量（同一 since 下集合与顺序稳定，偏移可复现）。
 */
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const url = new URL(req.url);

  // 1) entities 白名单
  const parsedEntities = parseSyncEntityList(url.searchParams.get("entities"));
  if (!parsedEntities.ok) {
    return NextResponse.json(
      {
        error: `不支持的同步实体：${parsedEntities.invalid.join(", ")}`,
        code: API_ERROR_CODES.validation_failed,
        allowed: [...SYNC_ENTITY_TYPES],
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const entities = parsedEntities.entities ?? undefined;

  // 2) limit（默认 500；非法 → 400；超过上限按上限截断）
  const rawLimit = url.searchParams.get("limit");
  let limit = SYNC_PULL_DEFAULT_LIMIT;
  if (rawLimit !== null && rawLimit !== "") {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { error: "limit 必须是正整数", code: API_ERROR_CODES.validation_failed },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    limit = Math.min(parsedLimit, SYNC_PULL_MAX_LIMIT);
  }

  // 3) cursor（不透明；非法 → 400，避免静默回到第一页导致重复/漏拉）
  const rawCursor = url.searchParams.get("cursor");
  let offset = 0;
  if (rawCursor) {
    const decoded = decodeCursor(rawCursor);
    if (!decoded.ok) {
      return NextResponse.json(
        { error: "cursor 无效", code: API_ERROR_CODES.validation_failed },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    offset = decoded.offset;
  }

  // 与 push 同一白名单/截断规则，防止伪造超长脏数据写入 sync_devices
  const deviceId = sanitizeDeviceId(url.searchParams.get("deviceId") || "unknown", "unknown");
  const deviceName = sanitizeDeviceName(url.searchParams.get("deviceName"));
  const sinceParam = url.searchParams.get("since");
  const since =
    sinceParam && !isNaN(new Date(sinceParam).getTime()) ? new Date(sinceParam) : new Date(0);

  const client = await pgPool.connect();
  try {
    const all = await collectChangesSince(client, uid, since, { entities });
    const changes = all.slice(offset, offset + limit);
    const hasMore = all.length > offset + limit;
    await upsertSyncDevice(client, uid, deviceId, deviceName);
    const { rows } = await client.query("SELECT now() AS now");
    return NextResponse.json(
      {
        changes,
        serverTime: serverTimeISO(rows[0]?.now),
        hasMore,
        cursor: hasMore ? encodeCursor(offset + limit) : null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } finally {
    client.release();
  }
}
