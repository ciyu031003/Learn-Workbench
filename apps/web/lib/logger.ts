import pino from "pino";

/**
 * 统一日志（B4）：生产输出 JSON，开发环境 pino-pretty 可读。
 * 薄门面：兼容 console.error("msg", err, ...) 的调用习惯，
 * 归一化为 pino 的 (obj, msg) 形式（pino 不接受 (string, unknown) 直传）。
 * 请求级关联：后续接入统一 API 包装层后用 child({ requestId })（P2）。
 */
const p = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" } } }
    : {}),
});

/** console 风格 (msg, err?, extra?) → pino 风格 ([obj, msg] | [msg]) */
function normalize(args: unknown[]): unknown[] {
  if (typeof args[0] !== "string") return args;
  const [msg, ...rest] = args;
  if (rest.length === 0) return [msg];
  const obj: Record<string, unknown> = { err: rest[0] };
  if (rest.length > 1) obj.extra = rest.slice(1);
  return [obj, msg];
}

const passthrough = (fn: (...a: unknown[]) => void) =>
  (...args: unknown[]) => fn(...normalize(args));

interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}

export const logger: Logger = {
  error: passthrough(p.error.bind(p)),
  warn: passthrough(p.warn.bind(p)),
  info: passthrough(p.info.bind(p)),
  debug: passthrough(p.debug.bind(p)),
  child: () => logger,
};