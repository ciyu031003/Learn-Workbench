import { describe, it, expect, vi, afterEach } from "vitest";
import { Writable } from "node:stream";
import {
  createLogger,
  LOGGER_REDACT_CENSOR,
  LOGGER_REDACT_PATHS,
} from "./logger";
import { logRequest, requestLogEntry, formatRequestLogLine } from "./api/log-request";

/** 收集 pino 输出的内存流（避免测试里创建 pino-pretty worker） */
function collect(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  const lines = () =>
    chunks
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines };
}

describe("LOGGER_REDACT_PATHS", () => {
  it("覆盖凭据/身份类字段（顶层 + 一层通配 + PG 错误 detail）", () => {
    for (const path of [
      "password",
      "token",
      "authorization",
      "cookie",
      "set-cookie",
      "x-cron-secret",
      "*.password",
      "*.token",
      "*.email",
      "*.phone",
      "err.detail",
      "err.parameters",
    ]) {
      expect(LOGGER_REDACT_PATHS).toContain(path);
    }
  });
});

describe("createLogger", () => {
  it("redact：password/token/authorization/cookie/email/phone 都替换成 [REDACTED]", () => {
    const { stream, lines } = collect();
    const log = createLogger({ level: "info", destination: stream });
    log.info(
      {
        password: "p@ss",
        authorization: "Bearer secret-token",
        cookie: "lwb_session=abc",
        "x-cron-secret": "cron-secret",
        user: { token: "tok", email: "a@b.com", phone: "13800000000" },
        err: { detail: "Key (username)=(alice) already exists", parameters: ["alice"] },
      },
      "login attempt"
    );
    const [line] = lines();
    expect(line.password).toBe(LOGGER_REDACT_CENSOR);
    expect(line.authorization).toBe(LOGGER_REDACT_CENSOR);
    expect(line.cookie).toBe(LOGGER_REDACT_CENSOR);
    expect(line["x-cron-secret"]).toBe(LOGGER_REDACT_CENSOR);
    const user = line.user as Record<string, unknown>;
    expect(user.token).toBe(LOGGER_REDACT_CENSOR);
    expect(user.email).toBe(LOGGER_REDACT_CENSOR);
    expect(user.phone).toBe(LOGGER_REDACT_CENSOR);
    const err = line.err as Record<string, unknown>;
    expect(err.detail).toBe(LOGGER_REDACT_CENSOR);
    expect(err.parameters).toBe(LOGGER_REDACT_CENSOR);
    // 非敏感字段与消息保留
    expect(line.msg).toBe("login attempt");
  });

  it("child(bindings) 返回真实子 logger：bindings 合并父级且输出带上 requestId", () => {
    const { stream, lines } = collect();
    const root = createLogger({ level: "info", destination: stream });
    const child = root.child({ requestId: "req-12345678" });
    expect(child.bindings()).toMatchObject({ requestId: "req-12345678" });
    child.info({ route: "/api/logs" }, "[api] GET /api/logs 200 12ms");
    const [line] = lines();
    expect(line.requestId).toBe("req-12345678");
    expect(line.route).toBe("/api/logs");
    // 子 logger 仍继承 redact
    child.info({ token: "leak" }, "x");
    expect(lines()[1].token).toBe(LOGGER_REDACT_CENSOR);
    // 父级 bindings 不受子级污染
    expect(root.bindings()).not.toMatchObject({ requestId: "req-12345678" });
  });

  it("兼容 console 风格调用：logger.info('msg', err) 归一化为 { err }", () => {
    const { stream, lines } = collect();
    const log = createLogger({ level: "info", destination: stream });
    log.info("保存失败", new Error("boom"));
    const [line] = lines();
    expect(line.msg).toBe("保存失败");
    expect((line.err as Record<string, unknown>).message).toBe("boom");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dev/test 下 error 级别镜像到 console.error（production 不镜像）", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stream } = collect();
    const log = createLogger({ level: "info", destination: stream });
    log.error({ code: "23505" }, "[api] database error");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("logRequest", () => {
  const req = (url: string, method = "GET") => new Request(url, { method });

  it("只记 pathname，不把 query（可能含 token）写进日志", () => {
    const entry = requestLogEntry(req("http://127.0.0.1:3001/api/resume-files/1?token=secret-token&x=1"), 200, 12, "req-1");
    expect(entry.path).toBe("/api/resume-files/1");
    expect(JSON.stringify(entry)).not.toContain("secret-token");
    expect(formatRequestLogLine(entry)).toBe("[api] GET /api/resume-files/1 200 12ms");
  });

  it("不抛错：正常 URL / 5xx / 非法 URL 都能安全记录", () => {
    // logRequest 用模块级 logger（已初始化）；这里只验证入口函数不抛错（日志是旁路）
    expect(() => logRequest(req("http://x/api/a?token=t", "POST"), 200, 5, "r1")).not.toThrow();
    expect(() => logRequest(req("http://x/api/b", "PUT"), 503, 900, "r2")).not.toThrow();
    const fakeReq = { url: "not a url", method: "GET" } as unknown as Request;
    expect(() => logRequest(fakeReq, 500, 1, "r3")).not.toThrow();

    const entry = requestLogEntry(req("http://x/api/c", "DELETE"), 500, 3, "r4");
    expect(entry).toMatchObject({ method: "DELETE", path: "/api/c", status: 500, ms: 3 });
  });

  it("非法 URL 回退到 /（绝不把原始串写进日志）", () => {
    const fakeReq = { url: "not a url?token=abc", method: "GET" } as unknown as Request;
    const entry = requestLogEntry(fakeReq, 200, 1, "r");
    expect(entry.path).toBe("/");
    expect(JSON.stringify(entry)).not.toContain("abc");
  });
});
