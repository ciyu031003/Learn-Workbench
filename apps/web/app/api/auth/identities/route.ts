import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listIdentities } from "@/lib/identities";
import { isWechatEnabled } from "@/lib/wechat";

/** 当前账号的第三方身份列表（账号与安全页用） */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const identities = await listIdentities(userId);
  return NextResponse.json({
    identities: identities.map((i) => ({
      provider: i.provider,
      nickname: i.nickname,
      avatarUrl: i.avatar_url,
      boundUid: i.provider_uid.slice(0, 6) + "***",
    })),
    wechatEnabled: isWechatEnabled(),
  });
}
