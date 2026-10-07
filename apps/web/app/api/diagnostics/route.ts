import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUserId } from "@/lib/session";
import { diagnosticRelPath, saveDiagnosticReport, validateDiagnosticBody } from "@/lib/diagnostics-store";

/**
 * POST /api/diagnostics —— 接收客户端诊断包（v1.32.0）。
 *
 * 背景：招花（jobs）滑动仍然闪退，前三次"去掉 item 动画"的修复都没根治。
 * 崩溃是**进程级死亡**，客户端只能"崩溃前持续落盘 + 下次冷启动从系统取回 native 崩溃栈"，
 * 然后由用户在「设置 → 问题诊断 → 崩溃取证」里**手动点上传**（默认不自动上传）。
 *
 * 约定：
 *  - 必须登录（与 /api/resume-files 一致；日志要能对应到人，也少一个公开写入口）；
 *  - 正文 ≤ 512KB（客户端 crash-report.ts 的 REPORT_MAX_BYTES 同口径，避免"客户端能传、服务端 413"）；
 *  - 落私密目录 private/diagnostics/<userId>/<uuid>.json —— nginx 不直出，只有 ssh/管理员能读。
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const text = await req.text().catch(() => "");
  const check = validateDiagnosticBody(text);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const id = randomUUID();
  try {
    await saveDiagnosticReport(diagnosticRelPath(userId, id), text);
  } catch {
    return NextResponse.json({ error: "日志保存失败，请重试" }, { status: 500 });
  }
  // 排障时按这个前缀捞日志：docker compose logs web | grep diagnostics
  console.log("[diagnostics] 收到诊断包 user=" + userId + " id=" + id + " bytes=" + check.bytes);
  return NextResponse.json({ id, bytes: check.bytes }, { status: 201 });
}
