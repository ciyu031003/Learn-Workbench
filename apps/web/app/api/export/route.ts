import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildExportPayload } from "@/lib/export-data";

/** GET /api/export —— 导出当前作用域（登录用户 / 匿名设备）的全部业务数据 */
export async function GET(req: Request) {
  // P3（评审 2026-10-31）：导出是一次全量读放大——登录/匿名作用域都限 5 次/分钟
  //（键优先 uid/anonId，回退 IP），防被滥刷成 DB 读放大器
  const scopeUid = await currentUserId();
  const scopeAnon = scopeUid ? null : await getAnonId();
  const throttle = await rateLimit(`export:${scopeUid ?? scopeAnon ?? clientIp(req)}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!throttle.ok) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const client = await pgPool.connect();
  try {
    const data = await buildExportPayload(client, { uid: scopeUid, anonId: scopeAnon });
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}
