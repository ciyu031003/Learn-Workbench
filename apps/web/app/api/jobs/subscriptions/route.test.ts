import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ listSubscriptions: vi.fn(), saveSubscription: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { listSubscriptions, saveSubscription } from "@/lib/jobs";
import { GET, POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listSubscriptions);
const saveMock = vi.mocked(saveSubscription);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/subscriptions", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns subscriptions", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith("u-1");
  });
});

describe("POST /api/jobs/subscriptions", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ subscription: { name: 123 } }));
    expect(res.status).toBe(400);
  });

  it("creates a subscription and passes id through", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    saveMock.mockResolvedValue({ id: 9, name: "AI", categories: [], keywords: [], cities: [], enabled: true, createdAt: "2026-08-01T00:00:00Z" });
    const res = await POST(jsonReq({ subscription: { name: "AI", categories: [], keywords: [], cities: [], enabled: true, id: 9 } }));
    expect(res.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith("u-1", expect.objectContaining({ id: 9, name: "AI" }));
    expect((await res.json()).ok).toBe(true);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
