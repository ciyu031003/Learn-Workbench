import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/logs", () => {
  it("clamps the limit between 1 and 200", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "ict" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ value: "ict" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    await GET(new Request("http://localhost/api/logs?limit=9999"));
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.any(String), ["u-1", "ict", 200]);
    await GET(new Request("http://localhost/api/logs?limit=0"));
    expect(queryMock).toHaveBeenNthCalledWith(4, expect.any(String), ["u-1", "ict", 1]);
  });

  it("filters by an explicit career param", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/logs?limit=50&career=english"));
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "english", 50]);
  });
});

describe("POST /api/logs", () => {
  it("returns 400 for an invalid kind", async () => {
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "bad", title: "t", content: "c" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "kind 无效" });
  });

  it("returns 400 when title or content is empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "review", title: "", content: "" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "标题与内容不能为空" });
  });

  it("creates a log entry", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 3, kind: "feynman" }] } as never);
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "feynman", title: "费曼", content: "讲稿" }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ log: { id: 3, kind: "feynman" } });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "feynman", "ict", "费曼", "讲稿"]);
  });
});
