import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import {
  SYNC_ENTITY_TYPES,
  SYNC_PULL_DEFAULT_LIMIT,
  SYNC_PULL_MAX_LIMIT,
  isValidSyncPullCursorV2,
  parseSyncEntityList,
} from "@learn-workbench/shared/sync";
import {
  collectChangesFromLedger,
  collectChangesSince,
  getLedgerMinSeq,
  serverTimeISO,
  upsertSyncDevice,
  sanitizeDeviceId,
  sanitizeDeviceName,
} from "@/lib/sync-service";

/**
 * pull 游标两代并存（客户端只当不透明字符串）：
 *  - v1（legacy）：base64url({ v:1, offset })——实体表时间窗 + 内存偏移分页，服务端
 *    v1.50.0 及更早的移动端仍在使用，语义保持不变；
 *  - v2.1：base64url({ v:2, seq })——sync_changes ledger 单调序号回放（083 触发器
 *    保证全部写路径进 ledger）。写入顺序即到达顺序，与业务 updatedAt 解耦：
 *    修复离线补传对其他设备不可见（P1）与 offset 跳条（P2）；配合移动端循环
 *    跟随 hasMore/cursor 修复 >500 条丢数据（P0）。
 *    seq 数值同时经响应 `lastSeq` 明文返回，客户端无需自行解码 cursor。
 */
interface PullCursorV1 {
  v: 1;
  offset: number;
}

type PullCursor = PullCursorV1 | { v: 2; seq: number };

function encodeCursorV1(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset } satisfies PullCursorV1), "utf8").toString("base64url");
}

function encodeCursorV2(seq: number): string {
  return Buffer.from(JSON.stringify({ v: 2, seq } satisfies { v: 2; seq: number }), "utf8").toString("base64url");
}

function decodeCursor(raw: string): { ok: true; cursor: PullCursor } | { ok: false } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (isValidSyncPullCursorV2(parsed)) return { ok: true, cursor: { v: 2, seq: parsed.seq } };
    const legacy = parsed as Partial<PullCursorV1>;
    if (legacy?.v === 1 && Number.isInteger(legacy.offset) && (legacy.offset as number) >= 0) {
      return { ok: true, cursor: { v: 1, offset: legacy.offset as number } };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * 增量同步 Pull：
 *
 * v2.1 路径（cursor v2 或 sinceSeq 参数）：ledger 单源顺序回放。
 *  - `sinceSeq=` 首次拉取起点（cursor={v:2,seq:sinceSeq} 等价）；响应 `lastSeq` 为
 *    本页末行 seq，客户端持久化为下一轮起点；
 *  - 响应 `ledgerMinSeq` = 该用户 ledger 现存最小 seq（维护任务按 90 天修剪）；
 *    客户端 lastSeq>0 且 `ledgerMinSeq > lastSeq+1` 时须重置全量重拉，否则会静默
 *    漏掉被修剪的变更；
 *  - 新写入的 seq 更大，天然落在后续页/后续轮——无需"保持 since 不变"的翻页纪律。
 *
 * legacy 路径（v1 cursor 或仅 since 参数，v1.50.0 及更早客户端）：行为与历史版本
 * 完全一致——collectChangesSince 实体表时间窗 + offset 分页，`hasMore=true` 时
 * 客户端须保持 since 不变、带 cursor 继续翻页。
 *
 * 两者共用：entities 白名单（未知 → 400）、limit（默认 500 上限 1000）、
 * serverTime（Asia/Shanghai ISO，legacy 客户端唯一可信游标）。
 */
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE });

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
      { status: 400, headers: NO_STORE }
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
        { status: 400, headers: NO_STORE }
      );
    }
    limit = Math.min(parsedLimit, SYNC_PULL_MAX_LIMIT);
  }

  // 3) 路径判定：cursor v2 / sinceSeq → ledger；其余 → legacy（保持老客户端语义）
  const rawCursor = url.searchParams.get("cursor");
  let cursor: PullCursor | null = null;
  if (rawCursor) {
    const decoded = decodeCursor(rawCursor);
    if (!decoded.ok) {
      return NextResponse.json(
        { error: "cursor 无效", code: API_ERROR_CODES.validation_failed },
        { status: 400, headers: NO_STORE }
      );
    }
    cursor = decoded.cursor;
  }
  const rawSinceSeq = url.searchParams.get("sinceSeq");
  if (rawSinceSeq !== null && cursor?.v !== 2) {
    const parsedSeq = Number(rawSinceSeq);
    if (!Number.isInteger(parsedSeq) || parsedSeq < 0) {
      return NextResponse.json(
        { error: "sinceSeq 必须是非负整数", code: API_ERROR_CODES.validation_failed },
        { status: 400, headers: NO_STORE }
      );
    }
    cursor = { v: 2, seq: parsedSeq };
  }

  // 与 push 同一白名单/截断规则，防止伪造超长脏数据写入 sync_devices
  const deviceId = sanitizeDeviceId(url.searchParams.get("deviceId") || "unknown", "unknown");
  const deviceName = sanitizeDeviceName(url.searchParams.get("deviceName"));

  const client = await pgPool.connect();
  try {
    if (cursor && cursor.v === 2) {
      // ---- v2.1：ledger 单源 ----
      const result = await collectChangesFromLedger(client, uid, cursor.seq, limit, { entities });
      const ledgerMinSeq = await getLedgerMinSeq(client, uid);
      await upsertSyncDevice(client, uid, deviceId, deviceName);
      const { rows } = await client.query("SELECT now() AS now");
      return NextResponse.json(
        {
          changes: result.changes,
          serverTime: serverTimeISO(rows[0]?.now),
          hasMore: result.hasMore,
          cursor: result.hasMore ? encodeCursorV2(result.lastSeq) : null,
          lastSeq: result.lastSeq,
          ledgerMinSeq,
        },
        { headers: NO_STORE }
      );
    }

    // ---- legacy：实体表时间窗 + offset 分页（v1 客户端语义不变）----
    const offset = cursor && cursor.v === 1 ? cursor.offset : 0;
    const sinceParam = url.searchParams.get("since");
    const since =
      sinceParam && !isNaN(new Date(sinceParam).getTime()) ? new Date(sinceParam) : new Date(0);
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
        cursor: hasMore ? encodeCursorV1(offset + limit) : null,
      },
      { headers: NO_STORE }
    );
  } finally {
    client.release();
  }
}
