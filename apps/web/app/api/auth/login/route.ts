import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, sessionCookieName } from "@/lib/session";

async function claimAnonData(uid: string) {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const tables = [
      "topic_progress", "daily_tasks", "focus_sessions", "checkins",
      "log_entries", "certificates", "xp_events", "resume_assets",
    ];
    for (const table of tables) {
      await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [uid]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
  }

  const { rows } = await pgPool.query(
    `SELECT a.password_hash, u.id AS user_id, u.display_name AS "displayName"
     FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.username = $1`,
    [username]
  );
  const account = rows[0];
  if (!account || !verifyPassword(password, account.password_hash)) {
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }

  const uid = account.user_id as string;
  await claimAnonData(uid);

  const { token, expiresAt } = await createSession(uid);
  const res = NextResponse.json({
    ok: true,
    token,
    user: { id: uid, username, displayName: account.displayName },
  });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return res;
}
