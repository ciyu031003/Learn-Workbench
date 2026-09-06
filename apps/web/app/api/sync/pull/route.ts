import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { collectChangesSince, upsertSyncDevice, sanitizeDeviceId, sanitizeDeviceName } from "@/lib/sync-service";

// 增量同步 Pull（§37-§40）：按设备 since 游标返回变更，客户端本地 LWW 合并
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  // 与 push 同一白名单/截断规则，防止伪造超长脏数据写入 sync_devices
  const deviceId = sanitizeDeviceId(url.searchParams.get("deviceId") || "unknown", "unknown");
  const deviceName = sanitizeDeviceName(url.searchParams.get("deviceName"));
  const sinceParam = url.searchParams.get("since");
  const since =
    sinceParam && !isNaN(new Date(sinceParam).getTime()) ? new Date(sinceParam) : new Date(0);
  const client = await pgPool.connect();
  try {
    const changes = await collectChangesSince(client, uid, since);
    await upsertSyncDevice(client, uid, deviceId, deviceName);
    const { rows } = await client.query("SELECT now() AS now");
    return NextResponse.json({ changes, serverTime: rows[0].now });
  } finally {
    client.release();
  }
}
