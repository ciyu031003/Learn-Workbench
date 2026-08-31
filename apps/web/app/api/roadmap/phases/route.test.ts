import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

function req(method: string, body?: unknown, query = "") {
  return new Request(`http://localhost/api/roadmap/phases${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

describe("POST /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(req("POST", { title: "t" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty title", async () => {
    const res = await POST(req("POST", { title: "  " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "阶段标题不能为空" });
  });

  it("creates a custom phase and renumbers the track", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 9 }] } as never) // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [{ id: 9, phase_key: "phase-8", title: "新阶段", weeks: null, track: "main", summary: null, sort_order: 7, is_custom: true }] } as never); // SELECT created
    connectMock.mockResolvedValue(client as never);

    const res = await POST(req("POST", { career: "ict", track: "main", title: " 新阶段 ", summary: "", weeks: "第 37-40 周" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.phase.phase_key).toBe("phase-8");
    expect(json.phase.is_custom).toBe(true);

    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO content_phases"), [
      "ict", "新阶段", "第 37-40 周", "main", null, "u-1",
    ]);
    // renumberTrack 使用独立连接
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
    expect(client.release).toHaveBeenCalled();
  });
});

describe("PATCH /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await PATCH(req("PATCH", { id: 1, title: "t" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const res = await PATCH(req("PATCH", { id: "x", title: "t" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the phase does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PATCH(req("PATCH", { id: 999, title: "t" }));
    expect(res.status).toBe(400);
  });

  it("updates title/summary/weeks and renumbers the same track", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main" }] } as never) // SELECT current
      .mockResolvedValueOnce({ rows: [] } as never); // UPDATE
    connectMock.mockResolvedValue(client as never);

    const res = await PATCH(req("PATCH", { id: 1, title: "改后", summary: "s", weeks: "第 1-2 周" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE content_phases"), [
      "改后", "s", "第 1-2 周", 1,
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });

  it("renumbers both tracks when moving to another track", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "agent" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    connectMock.mockResolvedValue(client as never);

    const res = await PATCH(req("PATCH", { id: 8, track: "main" }));
    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "agent"]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });
});

describe("DELETE /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(req("DELETE", undefined, "?id=1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const res = await DELETE(req("DELETE", undefined, "?id=abc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the phase does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await DELETE(req("DELETE", undefined, "?id=999"));
    expect(res.status).toBe(400);
  });

  it("deletes the phase and renumbers the track", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main" }] } as never) // SELECT current
      .mockResolvedValueOnce({ rows: [] } as never); // DELETE
    connectMock.mockResolvedValue(client as never);

    const res = await DELETE(req("DELETE", undefined, "?id=3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("DELETE FROM content_phases"), [3]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });
});
