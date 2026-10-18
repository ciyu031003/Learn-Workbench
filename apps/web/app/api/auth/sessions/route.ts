import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentSessionToken, currentUserId, sessionCookieName, sessionTokenHash } from "@/lib/session";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

/** 对外只暴露会话 id 的前 12 位（48 bit，用户内唯一；不暴露 token/token_hash 全量） */
const ID_PREFIX_LEN = 12;
const ID_RE = /^[0-9a-f]{12}$/;

/** 生成会话 id 前缀的 SQL 片段（列固定为 id，不拼接外部输入） */
const ID_PREFIX_SQL = `left(replace(id::text, '-', ''), ${ID_PREFIX_LEN})`;

interface SessionRow {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  tokenHash: string | null;
}

/**
 * GET /api/auth/sessions —— 当前用户的登录设备/会话列表（S2-4）。
 *
 * 只列未过期会话；**不返回 token / token_hash**，只给 id 前缀供吊销用。
 * current 标记由「当前请求令牌的哈希」与行内 token_hash 比对得出（不额外查库）。
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const token = await currentSessionToken();
  const currentHash = token ? sessionTokenHash(token) : null;

  const { rows } = await pgPool.query<SessionRow>(
    `SELECT ${ID_PREFIX_SQL} AS "id",
            device_label AS "deviceLabel",
            user_agent AS "userAgent",
            created_at AS "createdAt",
            last_used_at AS "lastUsedAt",
            expires_at AS "expiresAt",
            token_hash AS "tokenHash"
       FROM sessions
      WHERE user_id = $1 AND expires_at > now()
      ORDER BY COALESCE(last_used_at, created_at) DESC, created_at DESC`,
    [userId]
  );

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      deviceLabel: r.deviceLabel,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
      expiresAt: r.expiresAt,
      current: currentHash !== null && r.tokenHash === currentHash,
    })),
  });
}

/**
 * DELETE /api/auth/sessions?id=<id 前缀> —— 吊销指定会话（S2-4）。
 *
 * 必须属于本人：先按 id 前缀找到行，不是本人的一律 403（前缀不可枚举，不泄露存在性）；
 * 不存在的返回 404。吊销的是当前会话时同时清 cookie（下一次请求即未登录）。
 */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const id = (new URL(req.url).searchParams.get("id") ?? "").trim().toLowerCase();
  if (!ID_RE.test(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const { rows } = await pgPool.query<{ id: string; user_id: string; token_hash: string | null }>(
    `SELECT id, user_id, token_hash FROM sessions
      WHERE ${ID_PREFIX_SQL} = $1 AND expires_at > now()`,
    [id]
  );
  const target = rows[0];
  if (!target) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  if (target.user_id !== userId) return NextResponse.json({ error: "无权操作该会话" }, { status: 403 });

  await pgPool.query("DELETE FROM sessions WHERE id = $1", [target.id]);

  const token = await currentSessionToken();
  const isCurrent = !!token && target.token_hash === sessionTokenHash(token);
  const res = NextResponse.json({ ok: true, current: isCurrent });
  if (isCurrent) {
    res.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: COOKIE_SECURE });
  }
  return res;
}
