import { logger } from "@/lib/logger";

/**
 * 请求级访问日志（S2-9 薄工具，供 withApi / 路由包装层调用）。
 *
 * 设计取舍：
 *  - 只记录 pathname（**不记 query**）：session token / reset token 曾经走过 URL query
 *    （resume 预览 ?token=），日志里出现 query 就等于凭据落盘；
 *  - 结构化字段固定为 { requestId, method, path, status, ms }，便于采集端按 status 分桶、
 *    按 requestId 关联响应体里的 requestId；
 *  - 5xx 走 warn（便于告警规则按 level 抓），4xx/2xx 走 info；
 *  - 本函数**不抛错**：日志失败不应影响请求本身。
 */

export interface RequestLogEntry {
  requestId: string;
  method: string;
  path: string;
  status: number;
  ms: number;
}

/** 从 Request 提取可安全落日志的字段（去掉 query/hash，限制长度） */
export function requestLogEntry(
  req: Request,
  status: number,
  ms: number,
  requestId: string
): RequestLogEntry {
  let path = "/";
  try {
    path = new URL(req.url).pathname;
  } catch {
    // 非法 URL：保留占位符，绝不把原始 url 写进日志
  }
  return {
    requestId,
    method: (req.method || "GET").toUpperCase().slice(0, 12),
    path: path.slice(0, 200),
    status: Number.isFinite(status) ? status : 0,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
  };
}

/** 记录一条访问日志（成功/失败都不抛错） */
export function logRequest(req: Request, status: number, ms: number, requestId: string): void {
  try {
    const entry = requestLogEntry(req, status, ms, requestId);
    const line = formatRequestLogLine(entry);
    if (entry.status >= 500) logger.warn(entry, line);
    else logger.info(entry, line);
  } catch {
    // 日志是旁路：任何异常都不影响请求
  }
}

/** 测试/诊断用：把 entry 渲染成一行（与 logRequest 的消息格式一致） */
export function formatRequestLogLine(entry: RequestLogEntry): string {
  return "[api] " + entry.method + " " + entry.path + " " + entry.status + " " + entry.ms + "ms";
}
