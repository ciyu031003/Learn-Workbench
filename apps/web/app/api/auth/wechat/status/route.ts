import { NextResponse } from "next/server";
import { isWechatEnabled } from "@/lib/wechat";

/** 微信扫码能力开关（只暴露是否可用，不泄露 appid/secret） */
export async function GET() {
  return NextResponse.json({ enabled: isWechatEnabled() });
}
