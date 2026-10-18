import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { buildExportPayload } from "@/lib/export-data";

/** GET /api/export —— 导出当前作用域（登录用户 / 匿名设备）的全部业务数据 */
export async function GET() {
  const client = await pgPool.connect();
  try {
    const uid = await currentUserId();
    const anonId = uid ? null : await getAnonId();
    const data = await buildExportPayload(client, { uid, anonId });
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}
