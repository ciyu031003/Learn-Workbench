import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/trackers", () => {
  it("lists trackers for the given domain", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, name: "单词量" }] } as never);
    const res = await GET(new Request("http://localhost/api/trackers?career=english"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trackers: [{ id: 1, name: "单词量" }] });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "english"]);
  });
});

describe("POST /api/trackers", () => {
  it("requires login", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/trackers", { method: "POST", body: JSON.stringify({ name: "x" }) }));
    expect(res.status).toBe(401);
  });

  it("creates a tracker with normalized fields", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 9, name: "单词量", unit: "个" }] } as never);
    const res = await POST(new Request("http://localhost/api/trackers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career: "english", name: " 单词量 ", unit: "个", targetValue: 50, targetCadence: "daily" }),
    }));
    expect(res.status).toBe(201);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO domain_trackers"),
      ["u-1", "english", "单词量", "个", 50, "daily", "#6366f1"]
    );
  });
});

describe("PATCH /api/trackers", () => {
  it("updates an owned tracker", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, name: "新名" }] } as never);
    const res = await PATCH(new Request("http://localhost/api/trackers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, name: "新名", unit: "分钟" }),
    }));
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE domain_trackers"), ["u-1", "新名", "分钟", 1]);
  });
});

describe("DELETE /api/trackers", () => {
  it("requires login", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/trackers?id=1"));
    expect(res.status).toBe(401);
  });

  it("cascades tracker logs in a transaction", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await DELETE(new Request("http://localhost/api/trackers?id=1"));
    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith("DELETE FROM tracker_logs WHERE tracker_id = $1", [1]);
    expect(query).toHaveBeenCalledWith("DELETE FROM domain_trackers WHERE id = $1", [1]);
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });
});
