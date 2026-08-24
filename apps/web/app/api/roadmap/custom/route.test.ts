import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/roadmap/custom", {
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

describe("POST /api/roadmap/custom", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await post({ phaseId: 1, title: "t" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
  });

  it("returns 400 for invalid params", async () => {
    const res = await post({ phaseId: "x", title: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "参数无效" });
  });

  it("creates a custom topic in the ICT track (no longer fixed)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8, phase_id: 1, title: "t", summary: null, is_custom: true }] } as never);
    const res = await post({ phaseId: 1, title: " 自定义 " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ topic: { id: 8, phase_id: 1, title: "t", summary: null, is_custom: true } });
    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining("SELECT id FROM content_phases"), [1]);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO content_topics"),
      [1, "自定义", null, "u-1"]
    );
  });

  it("creates a custom topic for non-ICT careers", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 2 }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8, phase_id: 2, title: "t", summary: null, is_custom: true }] } as never);
    const res = await post({ phaseId: 2, title: " 自定义 " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ topic: { id: 8, phase_id: 2, title: "t", summary: null, is_custom: true } });
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO content_topics"),
      [2, "自定义", null, "u-1"]
    );
  });

  it("returns 400 when the phase does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await post({ phaseId: 999, title: "t" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "阶段不存在" });
  });
});

describe("DELETE /api/roadmap/custom", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/roadmap/custom?topicId=1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid topicId", async () => {
    const res = await DELETE(new Request("http://localhost/api/roadmap/custom?topicId=abc"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "topicId 无效" });
  });

  it("deletes only the user's own custom topic", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/roadmap/custom?topicId=5"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM content_topics WHERE id = $1 AND is_custom = TRUE AND owner_id = $2"),
      [5, "u-1"]
    );
  });
});
