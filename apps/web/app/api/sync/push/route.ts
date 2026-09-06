import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import {
  applyChanges,
  recordSyncChanges,
  upsertSyncDevice,
  sanitizeDeviceId,
  sanitizeDeviceName,
  type SyncChange,
} from "@/lib/sync-service";
import { parseBody } from "@/lib/http";
import { logger } from "@/lib/logger";

// 单批变更条数上限：超限让客户端分批推送，避免单事务过长持锁
const MAX_CHANGES = 500;

// 增量同步 Push（§37-§40）：客户端只发送自上次同步以来的本地变更（LWW）
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = await parseBody(req, 2_000_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const data = (parsed.data ?? {}) as Record<string, unknown>;

  const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
  if (changes.length > MAX_CHANGES) {
    return NextResponse.json(
      { error: `单批变更过多（>${MAX_CHANGES}），请分批推送` },
      { status: 413 }
    );
  }
  const rawDeviceId = String(data.deviceId || "unknown");
  // P0：deviceId 白名单校验，防止伪造标识刷 sync_devices
  const deviceId = sanitizeDeviceId(rawDeviceId, `anon-${uid.slice(0, 8)}`);
  const deviceName = sanitizeDeviceName(typeof data.deviceName === "string" ? data.deviceName : null);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { applied, okChanges } = await applyChanges(client, uid, changes);
    // P1：只把成功应用的变更写入幂等表——失败变更若也记 changeId，客户端重试会被
    // 当作"已应用"跳过，造成静默丢数据
    await recordSyncChanges(client, uid, deviceId, okChanges);
    await upsertSyncDevice(client, uid, deviceId, deviceName);
    await client.query("COMMIT");
    const { rows } = await client.query("SELECT now() AS now");
    return NextResponse.json({ ok: true, applied, serverTime: rows[0].now });
  } catch (e) {
    await client.query("ROLLBACK");
    logger.error("sync push error", e);
    return NextResponse.json({ error: "同步失败" }, { status: 500 });
  } finally {
    client.release();
  }
}
