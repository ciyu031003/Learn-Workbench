import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/roadmap/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function fakeClient() {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockResolvedValue({ rows: [] });
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("POST /api/roadmap/reorder", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await post({ track: "main", order: [1, 2] });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid order", async () => {
    queryMock.mockResolvedValue({ rows: [{ owner_id: null }] } as never);
    const res = await post({ track: "main", order: "x" });
    expect(res.status).toBe(400);
    const res2 = await post({ track: "main", order: [] });
    expect(res2.status).toBe(400);
  });

  it("returns 400 when the career domain does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await post({ career: "nope", track: "main", order: [1] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "学习领域不存在" });
  });

  it("returns 403 when reordering another user's custom domain", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: "u-2" }] } as never);
    const res = await post({ career: "badminton", track: "main", order: [1] });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "无权操作他人自定义领域" });
  });

  it("returns 400 when the order does not match the current phase list", async () => {
    const client = fakeClient();
    client.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } as never); // SELECT current
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never); // domain scope
    connectMock.mockResolvedValue(client as never);

    const res = await post({ career: "ict", track: "main", order: [1, 2] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "阶段列表与当前路线不一致，请刷新后重试" });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("applies the new order and renumbers keys in one transaction", async () => {
    const client = fakeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 3 }, { id: 1 }, { id: 2 }] } as never) // SELECT current (P3, P1, P2)
      .mockResolvedValueOnce({ rowCount: 1 } as never) // renumberTrack: 全部置临时（负 sort + ren- key）
      .mockResolvedValueOnce({ rowCount: 1 } as never) // final phase-1/sort0 -> id=3
      .mockResolvedValueOnce({ rowCount: 1 } as never) // final phase-2/sort1 -> id=1
      .mockResolvedValueOnce({ rowCount: 1 } as never); // final phase-3/sort2 -> id=2
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never); // domain scope
    connectMock.mockResolvedValue(client as never);

    const res = await post({ career: "ict", track: "main", order: [3, 1, 2] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE content_phases SET phase_key = $1, sort_order = $2"),
      ["phase-1", 0, 3]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE content_phases SET phase_key = $1, sort_order = $2"),
      ["phase-3", 2, 2]
    );
    expect(client.release).toHaveBeenCalled();
  });
});
