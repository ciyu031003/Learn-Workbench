import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { pgPool } from "@/lib/db";
import type { WechatProfile } from "@/lib/wechat";

/**
 * 第三方身份（identities 表）读写助手。
 * password 身份仍由 accounts 承载；这里只管 wechat 等外部身份。
 */

export interface IdentityRow {
  provider: string;
  provider_uid: string;
  unionid: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export async function findUserIdByWechat(openid: string, unionid: string | null): Promise<string | null> {
  // 优先 openid 精确匹配，其次 unionid 关联（同一开放平台主体下多端打通）
  const { rows } = await pgPool.query<{ user_id: string }>(
    `SELECT user_id FROM identities
     WHERE provider = 'wechat' AND (provider_uid = $1 OR ($2::text IS NOT NULL AND unionid = $2))
     ORDER BY (provider_uid = $1) DESC, created_at ASC
     LIMIT 1`,
    [openid, unionid]
  );
  return rows[0]?.user_id ?? null;
}

export async function createWechatUser(profile: WechatProfile): Promise<{ userId: string; username: string }> {
  // 生成不冲突的 wx_xxx 账号名（昵称不可作账号：字符集不受控）
  for (let i = 0; i < 5; i++) {
    const username = `wx_${randomBytes(4).toString("hex")}`;
    const dup = await pgPool.query("SELECT 1 FROM accounts WHERE username = $1", [username]);
    if (dup.rows.length > 0) continue;
    const userId = randomUUID();
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO users (id, display_name) VALUES ($1, $2)", [
        userId,
        profile.nickname ?? "微信用户",
      ]);
      await client.query(
        "INSERT INTO accounts (username, password_hash, user_id) VALUES ($1, $2, $3)",
        [username, "wx:no-password", userId]
      );
      await client.query(
        `INSERT INTO identities (user_id, provider, provider_uid, unionid, nickname, avatar_url)
         VALUES ($1, 'wechat', $2, $3, $4, $5)`,
        [userId, profile.openid, profile.unionid, profile.nickname, profile.avatarUrl]
      );
      await client.query("COMMIT");
      return { userId, username };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  throw new Error("无法生成可用账号名，请稍后重试");
}

export async function bindWechatIdentity(userId: string, profile: WechatProfile): Promise<"bound" | "conflict"> {
  const existing = await findUserIdByWechat(profile.openid, profile.unionid);
  if (existing && existing !== userId) return "conflict";
  if (existing === userId) return "bound";
  await pgPool.query(
    `INSERT INTO identities (user_id, provider, provider_uid, unionid, nickname, avatar_url)
     VALUES ($1, 'wechat', $2, $3, $4, $5)
     ON CONFLICT (provider, provider_uid) DO NOTHING`,
    [userId, profile.openid, profile.unionid, profile.nickname, profile.avatarUrl]
  );
  return "bound";
}

/** 解绑微信：需保留至少一种其他登录方式（password 账号或其他 identity） */
export async function canUnbindWechat(userId: string): Promise<boolean> {
  const { rows: acc } = await pgPool.query("SELECT 1 FROM accounts WHERE user_id = $1 AND password_hash <> 'wx:no-password' LIMIT 1", [userId]);
  if (acc.length > 0) return true;
  const { rows: others } = await pgPool.query(
    "SELECT 1 FROM identities WHERE user_id = $1 AND provider <> 'wechat' LIMIT 1",
    [userId]
  );
  return others.length > 0;
}

export async function unbindWechat(userId: string): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    "DELETE FROM identities WHERE user_id = $1 AND provider = 'wechat'",
    [userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function listIdentities(userId: string): Promise<IdentityRow[]> {
  const { rows } = await pgPool.query<IdentityRow>(
    `SELECT provider, provider_uid, unionid, nickname, avatar_url
     FROM identities WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return rows;
}
