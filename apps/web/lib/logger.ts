import pino from "pino";

/**
 * 统一日志（B4）：生产输出 JSON，开发环境 pino-pretty 可读。
 * 薄门面：兼容 console.error("msg", err, ...) 的调用习惯，
 * 归一化为 pino 的 (obj, msg) 形式（pino 不接受 (string, unknown) 直传）。
 *
 * 2026-10-18 S2-9：
 *  - 增加 redact（authorization/cookie/password/token/email/phone 等，含 * 通配与 err.detail/parameters），
 *    DB 错误里的 detail/parameters 不再以明文进日志；
 *  - child(bindings) 真实实现（请求级关联：withApi 里用 child({ requestId })）；
 *  - 新增 bindings()，供测试/诊断确认继承链；
 *  - pino-pretty 只在 development 启用（test/CI 不创建 transport worker）。
 *
 * 兼容取舍：非 production（dev/test）下 error 级别额外镜像到 console.error ——
 * 既有调用习惯与既有单测（api-error.test.ts 等 spy console.error）不回归；
 * production 只输出结构化 JSON，不会出现 console 明文。
 */

/** 统一的脱敏替换值（测试与文档共用） */
export const LOGGER_REDACT_CENSOR = "[REDACTED]";

/**
 * pino redact 路径（fast-redact 语法）：
 *  - 顶层键 + 一层通配（*.password）覆盖 { user: { password } } 这类对象；
 *  - headers.authorization / headers.cookie / headers["set-cookie"] 变体单独列出；
 *  - err.detail / err.parameters / err.query：Postgres 错误对象上的敏感字段
 *    （detail 可能含 "Key (username)=(xxx) already exists"）。
 */
export const LOGGER_REDACT_PATHS: readonly string[] = [
  "password",
  "*.password",
  "passwd",
  "*.passwd",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "set-cookie",
  "*.set-cookie",
  "x-cron-secret",
  "*.x-cron-secret",
  "email",
  "*.email",
  "phone",
  "*.phone",
  "err.detail",
  "err.parameters",
  "err.query",
];

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
  /** 当前 logger 继承的 bindings（child 会合并父级） */
  bindings(): Record<string, unknown>;
}

export interface CreateLoggerOptions {
  /** 日志级别；缺省 LOG_LEVEL 或 production=info / 其它=debug */
  level?: string;
  /** 是否启用 pino-pretty；缺省仅 development 启用 */
  pretty?: boolean;
  /** 自定义输出流（单测/嵌入场景用；传入时不启用 pretty） */
  destination?: NodeJS.WritableStream;
}

/** console 风格 (msg, err?, extra?) → pino 风格 ([obj, msg] | [msg]) */
function normalize(args: unknown[]): unknown[] {
  if (typeof args[0] !== "string") return args;
  const [msg, ...rest] = args;
  if (rest.length === 0) return [msg];
  const obj: Record<string, unknown> = { err: rest[0] };
  if (rest.length > 1) obj.extra = rest.slice(1);
  return [obj, msg];
}

function wrap(instance: pino.Logger): Logger {
  const call = (fn: (...a: unknown[]) => void) => (...args: unknown[]) => fn(...normalize(args));
  const base: Logger = {
    error: call(instance.error.bind(instance)),
    warn: call(instance.warn.bind(instance)),
    info: call(instance.info.bind(instance)),
    debug: call(instance.debug.bind(instance)),
    child: (bindings: Record<string, unknown>) => wrap(instance.child(bindings)),
    bindings: () => instance.bindings(),
  };
  if (process.env.NODE_ENV !== "production") {
    // dev/test：错误镜像到 stderr，保留 console.error 的可见性与既有测试兼容
    const pinoError = base.error;
    base.error = (...args: unknown[]) => {
      const normalized = normalize(args);
      pinoError(...args);
      console.error(...normalized);
    };
  }
  return base;
}

/** 创建 logger（可注入输出流/级别，便于单测断言 redact 与 child bindings） */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const isProd = process.env.NODE_ENV === "production";
  // test 环境默认 silent：单测不需要 pino 输出（需要断言的用例显式传 level/destination）
  const defaultLevel = isProd ? "info" : process.env.NODE_ENV === "test" ? "silent" : "debug";
  const level = options.level ?? process.env.LOG_LEVEL ?? defaultLevel;
  const pinoOptions: pino.LoggerOptions = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: [...LOGGER_REDACT_PATHS], censor: LOGGER_REDACT_CENSOR, remove: false },
  };
  if (options.destination) {
    return wrap(pino(pinoOptions, options.destination as pino.DestinationStream));
  }
  const pretty = options.pretty ?? process.env.NODE_ENV === "development";
  if (pretty) {
    pinoOptions.transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    };
  }
  return wrap(pino(pinoOptions));
}

/** 全局 logger（进程单例；模块级初始化，与之前行为一致） */
export const logger: Logger = createLogger();
