import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { collectChangesSince, upsertSyncDevice } from "@/lib/sync-service";

// 增量同步 Pull（§37-§40）：按设备 since 游标返回变更，客户端本地 LWW 合并
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId") || "unknown";
  const sinceParam = url.searchParams.get("since");
  const since =
    sinceParam && !isNaN(new Date(sinceParam).getTime()) ? new Date(sinceParam) : new Date(0);
  const client = await pgPool.connect();
  try {
    const changes = await collectChangesSince(client, uid, since);
    await upsertSyncDevice(client, uid, deviceId, url.searchParams.get("deviceName") || null);
    const { rows } = await client.query("SELECT now() AS now");
    return NextResponse.json({ changes, serverTime: rows[0].now });
  } finally {
    client.release();
  }
}
