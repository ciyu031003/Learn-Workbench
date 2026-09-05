import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/http", () => ({
  parseBody: vi.fn(async (req: Request) => ({ ok: true, data: await req.json() })),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/wechat", () => ({
  isEmailSendingConfigured: vi.fn(),
  sendResetEmail: vi.fn(),
}));
import { pgPool } from "@/lib/db";
import { isEmailSendingConfigured, sendResetEmail } from "@/lib/wechat";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const emailConfiguredMock = vi.mocked(isEmailSendingConfigured);
const sendMock = vi.mocked(sendResetEmail);
beforeEach(() => vi.resetAllMocks());

function post(email = "user@example.com") {
  return POST(new Request("https://x.cn/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }));
}

describe("POST /api/auth/forgot", () => {
  it("reports unconfigured email service", async () => {
    emailConfiguredMock.mockReturnValue(false);
    const res = await post();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("EMAIL_UNCONFIGURED");
  });

  it("always ok:true for unknown email (anti-enumeration)", async () => {
    emailConfiguredMock.mockReturnValue(true);
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await post();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("creates token and sends email for known user", async () => {
    emailConfiguredMock.mockReturnValue(true);
    queryMock.mockResolvedValue({ rows: [{ id: "u-1" }] } as never);
    sendMock.mockResolvedValue(true);
    const res = await post();
    const body = await res.json();
    expect(body.ok).toBe(true);
    const insertCall = queryMock.mock.calls.find((c) => String(c[0]).includes("INSERT INTO password_reset_tokens"));
    expect(insertCall).toBeDefined();
    expect((insertCall![1] as unknown[])[1]).toBe("u-1");
    expect(sendMock).toHaveBeenCalled();
  });

  it("rejects invalid email format", async () => {
    emailConfiguredMock.mockReturnValue(true);
    const res = await post("not-an-email");
    expect(res.status).toBe(400);
  });
});
