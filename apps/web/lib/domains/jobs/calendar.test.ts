import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { listUpcomingExamEvents } from "./calendar";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("listUpcomingExamEvents", () => {
  it("maps rows and computes non-negative daysLeft", async () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    queryMock.mockResolvedValue({
      rows: [{ id: 1, job_id: 2, kind: "exam", label: "笔试", event_at: future, note: null, title: "某岗位", source: "lagou", url: "https://x" }],
    } as never);
    const rows = await listUpcomingExamEvents(20);
    expect(rows[0].jobId).toBe(2);
    expect(rows[0].daysLeft).toBe(3);
    expect(rows[0].title).toBe("某岗位");
    expect(rows[0].note).toBe("");
    expect(rows[0].url).toBe("https://x");
    expect(queryMock.mock.calls[0][1]).toEqual([20]);
  });

  it("clamps daysLeft to 0 for past events", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    queryMock.mockResolvedValue({ rows: [{ id: 1, job_id: 2, kind: "exam", label: "笔试", event_at: past, note: null, title: "", source: "", url: "" }] } as never);
    const rows = await listUpcomingExamEvents();
    expect(rows[0].daysLeft).toBe(0);
  });
});
