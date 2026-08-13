import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, POST, PATCH } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/tasks", () => {
  it("queries tasks for the given date (defaults to today)", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, title: "T" }] } as never);
    const res = await GET(new Request("http://localhost/api/tasks?date=2026-08-13"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tasks: [{ id: 1, title: "T" }] });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "2026-08-13"]);
  });
});

describe("POST /api/tasks", () => {
  it("returns 400 when the title is empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "  " }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "标题不能为空" });
  });

  it("creates a task with normalized phaseId", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 9, title: "学" }] } as never);
    const res = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDate: "2026-08-14", title: "学", taskType: "study", phaseId: "" }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ task: { id: 9, title: "学" } });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO daily_tasks"), ["u-1", "2026-08-14", "学", "study", null]);
  });
});

describe("PATCH /api/tasks", () => {
  it("returns 400 for an invalid id", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "x", done: true }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when there is nothing to update", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("builds a dynamic UPDATE for boolean fields", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, done: true }] } as never);
    const res = await PATCH(
      new Request("http://localhost/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, done: true }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ task: { id: 1, done: true } });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('done = $1'),
      [true, 1, "u-1"]
    );
  });
});
