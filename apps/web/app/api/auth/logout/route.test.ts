import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ destroySession: vi.fn(), sessionCookieName: "lwb_session" }));
import { destroySession } from "@/lib/session";
import { POST } from "./route";

const destroyMock = vi.mocked(destroySession);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/logout", () => {
  it("destroys the session from the cookie and clears it", async () => {
    destroyMock.mockResolvedValue();
    const res = await POST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: "lwb_session=tok-1; other=1" },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(destroyMock).toHaveBeenCalledWith("tok-1");
    expect(res.cookies.get("lwb_session")?.maxAge).toBe(0);
  });

  it("does nothing when the cookie is absent", async () => {
    destroyMock.mockResolvedValue();
    const res = await POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(destroyMock).not.toHaveBeenCalled();
  });
});
