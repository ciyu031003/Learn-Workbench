import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("POST /api/progress", () => {
  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/progress", { method: "POST", body: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid topicId", async () => {
    const res = await post({ topicId: "abc", done: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "topicId 无效" });
  });

  it("upserts progress with coerced values", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await post({ topicId: "12", done: 1, note: "学完" });
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (user_id, topic_id)"),
      ["u-1", 12, true, "学完"]
    );
  });
});
