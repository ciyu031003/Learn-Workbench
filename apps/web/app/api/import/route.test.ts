import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/import", {
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

describe("POST /api/import", () => {
  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/import", { method: "POST", body: "x" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "JSON 解析失败" });
  });

  it("rejects non-workbench backups", async () => {
    const res = await post({ app: "other" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "备份文件格式不正确" });
  });

  it("wipes existing data and imports new rows in a transaction", async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => ({
      rows: sql.includes("INSERT INTO domain_trackers") ? [{ id: 99 }] : [],
    }));
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const backup = {
      app: "learn-workbench",
      progress: [{ topic_id: 1, done: true, note: null }],
      tasks: [{ task_date: "2026-08-13", title: "T", task_type: "study", career_key: "english", done: false, focus_minutes: 0, sort_order: 0 }],
      checkins: [{ checkin_date: "2026-08-13", note: null }],
      domains: [{ career_key: "english-c-abc", name: "英语学习", owner_id: "u-1", kind: "language", icon: "languages", color: "#2563eb", phase_prefix: "E" }],
      trackers: [{ domain_key: "english-c-abc", name: "单词量", unit: "个", target_value: 50, target_cadence: "daily", color: "#6366f1" }],
      tracker_logs: [{ domain_key: "english-c-abc", tracker_name: "单词量", log_date: "2026-09-03", value: 30, note: null }],
    };
    const res = await post(backup);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM topic_progress"), ["u-1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO topic_progress"), ["u-1", 1, true, null, expect.any(String)]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO daily_tasks"), ["u-1", "2026-08-13", "T", null, null, "study", "english", false, 0, 0]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO careers"), ["english-c-abc", "英语学习", null, false, "u-1", "language", "languages", "#2563eb", "E", false]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO domain_trackers"), ["u-1", "english-c-abc", "单词量", "个", 50, "daily", "#6366f1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO tracker_logs"), ["u-1", expect.any(Number), "2026-09-03", 30, null]);
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  it("rolls back and returns 500 when an insert fails", async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error("boom"));
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ app: "learn-workbench" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "导入失败" });
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    errSpy.mockRestore();
  });
});
