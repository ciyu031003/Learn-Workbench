import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { withPrivateNoStore } from "@/lib/api/cache";
import { pgPool } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  // S5-5：会话态响应一律 private, no-store（任何层都不缓存）
  return withPrivateNoStore(NextResponse.json({ user }));
}

const NAME_MAX = 20;

function hasOwn(body: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

/**
 * 保存个人资料（昵称 / 头像）。只接受两份数据：
 * - displayName：1–20 个字符（按 Unicode code point 计），null 表示恢复登录名兜底；
 * - avatarUrl：本站 /uploads/<当前用户 id>/ 下的单个文件名，null 表示移除头像。
 *
 * 头像不走外部 URL，避免把用户资料变成任意外链加载入口；
 * 同时只接受本人目录，防止把别人的上传文件挂成自己的头像。
 */
export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return withPrivateNoStore(NextResponse.json({ error: "请先登录" }, { status: 401 }));

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return withPrivateNoStore(NextResponse.json({ error: "参数不合法" }, { status: 400 }));
  }

  const hasName = hasOwn(body, "displayName");
  const hasAvatar = hasOwn(body, "avatarUrl");
  if (!hasName && !hasAvatar) {
    return withPrivateNoStore(NextResponse.json({ error: "没有可保存的字段" }, { status: 400 }));
  }

  let displayName: string | null | undefined;
  if (hasName) {
    const raw = (body as { displayName?: unknown }).displayName;
    if (raw === null) {
      displayName = null;
    } else if (typeof raw === "string") {
      const value = raw.trim();
      const length = Array.from(value).length;
      if (length < 1 || length > NAME_MAX) {
        return withPrivateNoStore(NextResponse.json({ error: "昵称需为 1–20 个字符" }, { status: 400 }));
      }
      displayName = value;
    } else {
      return withPrivateNoStore(NextResponse.json({ error: "昵称需为 1–20 个字符" }, { status: 400 }));
    }
  }

  let avatarUrl: string | null | undefined;
  if (hasAvatar) {
    const raw = (body as { avatarUrl?: unknown }).avatarUrl;
    if (raw === null) {
      avatarUrl = null;
    } else if (typeof raw === "string") {
      const value = raw.trim();
      const ownPrefix = `/uploads/${user.id}/`;
      const fileName = value.startsWith(ownPrefix) ? value.slice(ownPrefix.length) : "";
      if (!value) avatarUrl = null;
      else if (
        value.length > 500 ||
        !fileName ||
        fileName.includes("/") ||
        value.includes("..") ||
        /[\\?#]/.test(value)
      ) {
        return withPrivateNoStore(NextResponse.json({ error: "头像地址不合法" }, { status: 400 }));
      } else avatarUrl = value;
    } else {
      return withPrivateNoStore(NextResponse.json({ error: "头像地址不合法" }, { status: 400 }));
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (displayName !== undefined) {
    params.push(displayName);
    sets.push(`display_name = $${params.length}`);
  }
  if (avatarUrl !== undefined) {
    params.push(avatarUrl);
    sets.push(`avatar_url = $${params.length}`);
  }
  params.push(user.id);

  const { rows } = await pgPool.query(
    `UPDATE users
        SET ${sets.join(", ")}, updated_at = now()
      WHERE id = $${params.length}
      RETURNING display_name AS "displayName", avatar_url AS "avatarUrl"`,
    params
  );
  const row = rows[0] ?? {};

  return withPrivateNoStore(
    NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: (row.displayName as string | null | undefined) ?? null,
        avatarUrl: (row.avatarUrl as string | null | undefined) ?? null,
      },
    })
  );
}
