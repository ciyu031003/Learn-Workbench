import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/http", () => ({
  parseBody: vi.fn(async (req: Request) => ({ ok: true, data: await req.json() })),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "hashed") }));
import { pgPool } from "@/lib/db";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
beforeEach(() => {
  vi.resetAllMocks();
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT user_id FROM password_reset_tokens")) {
        return { rows: [{ user_id: "u-1" }], rowCount: 1 } as never;
      }
      if (sql.startsWith("SELECT 1 FROM accounts")) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 } as never;
      }
      return { rows: [], rowCount: 1 } as never;
    }),
    release: vi.fn(),
  };
  connectMock.mockResolvedValue(client as never);
});

function post(newPassword = "newpass123", token = "tok-1") {
  return POST(new Request("https://x.cn/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  }));
}

describe("POST /api/auth/reset", () => {
  it("rejects short passwords", async () => {
    const res = await post("123");
    expect(res.status).toBe(400);
  });

  it("rejects invalid tokens", async () => {
    const client = await connectMock();
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT user_id FROM password_reset_tokens")) {
        return { rows: [], rowCount: 0 } as never;
      }
      return { rows: [], rowCount: 1 } as never;
    });
    const res = await post();
    expect(res.status).toBe(400);
  });

  it("updates password, invalidates token and sessions", async () => {
    const res = await post();
    const body = await res.json();
    expect(body.ok).toBe(true);
    const client = await connectMock();
    const sqls = (client.query as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes("UPDATE accounts SET password_hash"))).toBe(true);
    expect(sqls.some((s) => s.includes("DELETE FROM sessions"))).toBe(true);
  });

  it("refuses accounts without password login", async () => {
    const client = await connectMock();
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT user_id FROM password_reset_tokens")) {
        return { rows: [{ user_id: "u-1" }], rowCount: 1 } as never;
      }
      if (sql.startsWith("SELECT 1 FROM accounts")) return { rows: [], rowCount: 0 } as never;
      return { rows: [], rowCount: 1 } as never;
    });
    const res = await post();
    expect(res.status).toBe(400);
  });
});
