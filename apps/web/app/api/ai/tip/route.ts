import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { todayISO } from "@learn-workbench/shared";
import { logger } from "@/lib/logger";

/**
 * AI 每日建议（P2）：把今日学习/运动/精力上下文交给 LLM，生成一句可执行的小建议。
 * env 门控（与微信/邮箱同约定）：未配置 AI_API_KEY 时返回 503 { enabled:false }，前端回落规则版。
 * 可选：AI_BASE_URL（OpenAI 兼容端点，默认 https://api.openai.com/v1）、AI_MODEL（默认 gpt-4o-mini）。
 */

const UPSTREAM_TIMEOUT_MS = 12_000;

function aiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export async function GET() {
  const cfg = aiConfig();
  if (!cfg) {
    return NextResponse.json({ enabled: false, tip: null, error: "未配置 AI_API_KEY" }, { status: 503 });
  }

  const scope = await userScope();
  if (!scope.uid) {
    return NextResponse.json({ enabled: true, tip: null, error: "请先登录" }, { status: 401 });
  }
  const date = todayISO();

  // 今日上下文：任务完成度 / 专注分钟 / 运动分钟
  const w1 = scopeWhere(scope, [scope.uid, date]);
  const tasks = await pgPool.query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0)::int AS done
     FROM daily_tasks
     WHERE user_id IS NOT DISTINCT FROM $1${w1.sql} AND deleted_at IS NULL AND task_date = $2::date`,
    w1.params
  );
  const w2 = scopeWhere(scope, [scope.uid, date]);
  const focus = await pgPool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0)::int AS seconds FROM focus_sessions
     WHERE user_id IS NOT DISTINCT FROM $1${w2.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)`,
    w2.params
  );
  const w3 = scopeWhere(scope, [scope.uid, date]);
  const exercise = await pgPool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0)::int AS seconds FROM exercise_logs
     WHERE user_id IS NOT DISTINCT FROM $1${w3.sql} AND deleted_at IS NULL
       AND started_at >= $2::date AND started_at < ($2::date + 1)`,
    w3.params
  );

  const ctx = {
    tasksTotal: tasks.rows[0]?.total ?? 0,
    tasksDone: tasks.rows[0]?.done ?? 0,
    focusMinutes: Math.round(Number(focus.rows[0]?.seconds ?? 0) / 60),
    exerciseMinutes: Math.round(Number(exercise.rows[0]?.seconds ?? 0) / 60),
  };

  const prompt = [
    "你是一个学习工作台的日更教练。根据用户今日数据，给一句简短、具体、可执行的中文建议。",
    "要求：不超过 40 个字，一句话，不要寒暄和标点堆砌，不要用 markdown。",
    `今日数据：任务 ${ctx.tasksDone}/${ctx.tasksTotal} 完成，专注 ${ctx.focusMinutes} 分钟，运动 ${ctx.exerciseMinutes} 分钟。`,
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });
    if (!r.ok) {
      logger.warn("ai tip upstream error", r.status);
      return NextResponse.json({ enabled: true, tip: null, error: "上游服务暂不可用" }, { status: 502 });
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const tip = data.choices?.[0]?.message?.content?.trim().slice(0, 80) || null;
    if (!tip) {
      return NextResponse.json({ enabled: true, tip: null, error: "未能生成建议" }, { status: 502 });
    }
    return NextResponse.json({ enabled: true, tip, source: "ai" });
  } catch (e) {
    logger.warn("ai tip request failed", e);
    return NextResponse.json({ enabled: true, tip: null, error: "生成超时" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
