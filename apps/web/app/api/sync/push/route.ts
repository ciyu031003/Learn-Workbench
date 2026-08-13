import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { applyChanges, recordSyncChanges, upsertSyncDevice, type SyncChange } from "@/lib/sync-service";

// 增量同步 Push（§37-§40）：客户端只发送自上次同步以来的本地变更（LWW）
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const data = await req.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });

  const changes: SyncChange[] = Array.isArray(data.changes) ? data.changes : [];
  const deviceId = String(data.deviceId || "unknown");
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const applied = await applyChanges(client, uid, changes);
    await recordSyncChanges(client, uid, deviceId, changes);
    await upsertSyncDevice(client, uid, deviceId, data.deviceName || null);
    await client.query("COMMIT");
    const { rows } = await client.query("SELECT now() AS now");
    return NextResponse.json({ ok: true, applied, serverTime: rows[0].now });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("sync push error", e);
    return NextResponse.json({ error: "同步失败" }, { status: 500 });
  } finally {
    client.release();
  }
}
