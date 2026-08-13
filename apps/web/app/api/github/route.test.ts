import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/github", () => {
  it("returns the user's github records ordered by id desc", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 2, title: "b", url: null, content: null }],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ records: [{ id: 2, title: "b", url: null, content: null }] });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY id DESC"),
      ["u-1"]
    );
  });
});

describe("POST /api/github", () => {
  it("returns 400 when the title is empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "  " }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "名称不能为空" });
  });

  it("creates a record and returns 201", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 1, title: "repo", url: "https://github.com/x", content: "c" }],
    } as never);
    const res = await POST(
      new Request("http://localhost/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "repo", url: "https://github.com/x", content: "c" }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      record: { id: 1, title: "repo", url: "https://github.com/x", content: "c" },
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO resume_assets"),
      ["u-1", "repo", "https://github.com/x", "c"]
    );
  });
});

describe("DELETE /api/github", () => {
  it("returns 400 for an invalid id", async () => {
    const res = await DELETE(new Request("http://localhost/api/github?id=abc"));
    expect(res.status).toBe(400);
  });

  it("deletes the record for the current user", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/github?id=7"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM resume_assets WHERE id = $1"),
      [7, "u-1"]
    );
  });
});
