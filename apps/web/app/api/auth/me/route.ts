import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { withPrivateNoStore } from "@/lib/api/cache";

export async function GET() {
  const user = await currentUser();
  // S5-5：会话态响应一律 private, no-store（任何层都不缓存）
  return withPrivateNoStore(NextResponse.json({ user }));
}
