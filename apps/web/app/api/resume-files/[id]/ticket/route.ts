import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { FILE_TICKET_TTL_SECONDS, FileTicketConfigError, issueFileTicket } from "@/lib/file-ticket";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/resume-files/[id]/ticket —— 换一张 5 分钟预览票据（S2-3）。
 *
 * 为什么：移动端用系统浏览器预览 PDF 时带不了 Authorization 头，旧方案只能把 30 天
 * 会话 token 拼进 URL（进 access log / 浏览器历史 / Referer）。现在改成：
 *   1) App 用 Bearer 调本接口换 sig；
 *   2) 浏览器只拿到这份文件专属、5 分钟有效的 sig。
 *
 * 鉴权：必须登录，且该 id 属于本人（不能替别人的文件签票）。
 * 返回：{ sig, expiresIn: 300 }；生产未配密钥 → 503（fail-closed）。
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { rows } = await pgPool.query(
    "SELECT 1 FROM resume_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [id, userId]
  );
  if (!rows[0]) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  try {
    const sig = issueFileTicket(id, userId);
    return NextResponse.json({ sig, expiresIn: FILE_TICKET_TTL_SECONDS });
  } catch (e) {
    if (e instanceof FileTicketConfigError) {
      return NextResponse.json({ error: "预览票据服务未配置" }, { status: 503 });
    }
    return NextResponse.json({ error: "票据签发失败" }, { status: 500 });
  }
}
