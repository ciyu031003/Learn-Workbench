import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  diagnosticRelPath,
  redactDiagnosticsText,
  saveDiagnosticReport,
  validateDiagnosticBody,
} from "@/lib/diagnostics-store";

/**
 * POST /api/diagnostics —— 接收客户端诊断包（v1.32.0）。
 *
 * 背景：招花（jobs）滑动仍然闪退，前三次"去掉 item 动画"的修复都没根治。
 * 崩溃是**进程级死亡**，客户端只能"崩溃前持续落盘 + 下次冷启动从系统取回 native 崩溃栈"，
 * 然后由用户在「设置 → 问题诊断 → 崩溃取证」里**手动点上传**（默认不自动上传）。
 *
 * 约定：
 *  - 必须登录（与 /api/resume-files 一致；日志要能对应到人，也少一个公开写入口）；
 *  - 正文 ≤ 512KB（客户端 crash-report.ts 的 REPORT_MAX_BYTES 同口径）；
 *  - 落私密目录 private/diagnostics/<userId>/<uuid>.json —— nginx 不直出；
 *  - **限流**：每用户每小时 20 次（诊断包是 512KB 级写入，没有闸门就是可用磁盘/隐私放大器）；
 *  - **兜底脱敏**：落盘前再过一遍服务端脱敏规则（不能只信客户端，见 stores 注释）；
 *  - **保留策略**：maintenance cron 每日清理 30 天前的包（pruneDiagnosticReports）。
 */
const RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(extraHeaders ?? {}) },
  });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return json({ error: "请先登录" }, 401);

  const limited = await rateLimit("diagnostics:" + userId, RATE_LIMIT);
  if (!limited.ok) {
    return json(
      { error: "上传太频繁了，请 " + limited.retryAfterSeconds + " 秒后再试" },
      429,
      { "Retry-After": String(limited.retryAfterSeconds) }
    );
  }

  const text = await req.text().catch(() => "");
  const check = validateDiagnosticBody(text);
  if (!check.ok) return json({ error: check.error }, check.status);

  // 兜底脱敏（只可能变短；用原始体做体积校验，避免"先脱敏再校验"被绕过体积上限）
  const safe = redactDiagnosticsText(text);
  const id = randomUUID();
  try {
    await saveDiagnosticReport(diagnosticRelPath(userId, id), safe);
  } catch {
    return json({ error: "日志保存失败，请重试" }, 500);
  }
  // 排障时按这个前缀捞日志：docker compose logs web | grep diagnostics
  console.log("[diagnostics] 收到诊断包 user=" + userId + " id=" + id + " bytes=" + check.bytes);
  return json({ id, bytes: check.bytes }, 201);
}
