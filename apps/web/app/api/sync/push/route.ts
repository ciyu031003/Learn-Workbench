import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { applyChanges, recordSyncChanges, upsertSyncDevice, type SyncChange } from "@/lib/sync-service";
import { parseBody } from "@/lib/http";
import { logger } from "@/lib/logger";

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// 增量同步 Push（§37-§40）：客户端只发送自上次同步以来的本地变更（LWW）
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = await parseBody(req, 2_000_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const data = (parsed.data ?? {}) as Record<string, unknown>;

  const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
  const rawDeviceId = String(data.deviceId || "unknown");
  // P0：deviceId 白名单校验，防止伪造标识刷 sync_devices
  const deviceId = DEVICE_ID_RE.test(rawDeviceId) ? rawDeviceId : `anon-${uid.slice(0, 8)}`;
  const deviceName = typeof data.deviceName === "string" ? data.deviceName.slice(0, 50) : null;

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const applied = await applyChanges(client, uid, changes);
    await recordSyncChanges(client, uid, deviceId, changes);
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
