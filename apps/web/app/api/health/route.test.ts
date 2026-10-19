import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import pkg from "../../../package.json";
import { pgPool } from "@/lib/db";
import { HEALTH_DB_TIMEOUT_MS } from "@/lib/health";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);

/** 取 SQL 文本（pgPool.query 可能收到 string 或 { text } 配置） */
function sqlOf(q: unknown): string {
  if (typeof q === "string") return q;
  const text = (q as { text?: unknown } | null)?.text;
  return typeof text === "string" ? text : "";
}

/** 按 SQL 分派：SELECT 1 → 成功；schema_migrations → 返回给定迁移名 */
function dbUp(lastMigration: string | null = "079_session_lifecycle.sql") {
  queryMock.mockImplementation(((q: unknown) => {
    const sql = sqlOf(q);
    if (sql.includes("schema_migrations")) {
      return Promise.resolve({ rows: lastMigration ? [{ filename: lastMigration }] : [] });
    }
    return Promise.resolve({ rows: [{ "?column?": 1 }] });
  }) as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  // 隔离宿主环境：默认两个版本变量都为空
  vi.stubEnv("APP_VERSION", "");
  vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("DB 正常 → 200 / status ok，返回最小字段集且 no-store", async () => {
    dbUp();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ["db", "migrations", "status", "timestamp", "uptimeSeconds", "version"].sort()
    );
    expect(body.status).toBe("ok");
    expect(body.db).toBe("up");
    expect(body.migrations).toBe("079_session_lifecycle.sql");
    expect(body.version).toBe(pkg.version);
    expect(Number.isInteger(body.uptimeSeconds)).toBe(true);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);

    // 两次查询：SELECT 1 + schema_migrations
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(sqlOf(queryMock.mock.calls[0][0])).toContain("SELECT 1");
    expect(sqlOf(queryMock.mock.calls[1][0])).toContain("schema_migrations");
  });

  it("DB down → 503 / degraded，migrations=null，且不泄露内部错误", async () => {
    queryMock.mockImplementation((() => {
      return Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret"));
    }) as never);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("down");
    expect(body.migrations).toBeNull();
    const text = JSON.stringify(body);
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("password");
    expect(text).not.toContain("10.0.0.5");
  });

  it("DB down 时不查迁移表（只发一条 SELECT 1）", async () => {
    queryMock.mockImplementation((() => Promise.reject(new Error("db down"))) as never);
    await GET();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("schema_migrations 缺失/查询失败 → 200 ok，migrations=null（不降级）", async () => {
    queryMock.mockImplementation(((q: unknown) => {
      const sql = sqlOf(q);
      if (sql.includes("schema_migrations")) {
        return Promise.reject(new Error('relation "schema_migrations" does not exist'));
      }
      return Promise.resolve({ rows: [{ "?column?": 1 }] });
    }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("up");
    expect(body.migrations).toBeNull();
  });

  it("schema_migrations 为空表 → 200 ok，migrations=null", async () => {
    dbUp(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).migrations).toBeNull();
  });

  it("意外异常 → 503 统一错误 envelope（不裸抛 500），仍 no-store", async () => {
    // getHealth 内部兜底了预期失败；这里模拟真正不可预见的异常，验证 route 的防御分支
    const uptimeSpy = vi.spyOn(process, "uptime").mockImplementation(() => {
      throw new Error("unexpected boom");
    });
    try {
      const res = await GET();
      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = await res.json();
      expect(body.code).toBe("internal_error");
      expect(typeof body.error).toBe("string");
      expect(JSON.stringify(body)).not.toContain("boom");
    } finally {
      uptimeSpy.mockRestore();
    }
  });

  it("DB 探活超过 800ms → 503 degraded（不无限等待）", async () => {
    vi.useFakeTimers();
    queryMock.mockImplementation((() => new Promise(() => undefined)) as never);
    const pending = GET();
    await vi.advanceTimersByTimeAsync(HEALTH_DB_TIMEOUT_MS + 5);
    const res = await pending;
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.db).toBe("down");
    expect(body.migrations).toBeNull();
  });

  it("NEXT_PUBLIC_APP_VERSION 优先于 APP_VERSION / package.json", async () => {
    dbUp();
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "9.9.9");
    vi.stubEnv("APP_VERSION", "1.1.1");
    const body = await (await GET()).json();
    expect(body.version).toBe("9.9.9");
  });

  it("没有 NEXT_PUBLIC_APP_VERSION 时回退镜像注入的 APP_VERSION（Dockerfile ARG）", async () => {
    dbUp();
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "  ");
    vi.stubEnv("APP_VERSION", "v1.49.0");
    const body = await (await GET()).json();
    expect(body.version).toBe("v1.49.0");
  });

  it("两个版本变量都空白时回退 package.json", async () => {
    dbUp();
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "   ");
    vi.stubEnv("APP_VERSION", "");
    const body = await (await GET()).json();
    expect(body.version).toBe(pkg.version);
  });
});
