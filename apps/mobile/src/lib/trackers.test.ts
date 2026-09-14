import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/config", () => ({ getApiUrl: vi.fn(() => "http://test") }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) },
}));

import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import {
  fetchTrackers,
  upsertTracker,
  deleteTracker,
  fetchTrackerLogs,
  upsertTrackerLog,
  todayLocal,
} from "./trackers";

const getApiUrlMock = vi.mocked(getApiUrl);
const getStateMock = vi.mocked(useAppStore.getState);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getApiUrlMock.mockReturnValue("http://test");
  getStateMock.mockReturnValue({ token: "tok-1" } as never);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllGlobals?.();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

const tracker = {
  id: 7,
  domain_key: "english-c-abc",
  name: "单词量",
  unit: "个",
  target_value: 30,
  target_cadence: "daily",
  color: "#2563eb",
};

const log = {
  id: 11,
  tracker_id: 7,
  log_date: "2026-09-13",
  value: 42,
  note: null,
};

describe("trackers client", () => {
  it("fetchTrackers lists for a domain", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ trackers: [tracker, tracker] }));
    const list = await fetchTrackers("english-c-abc");
    expect(list).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/trackers?career=english-c-abc",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
    );
  });

  it("upsertTracker POSTs without id, PATCHes with id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tracker }, true, 201));
    await upsertTracker({ career: "english-c-abc", name: "单词量", unit: "个" });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://test/api/trackers",
      expect.objectContaining({ method: "POST" })
    );

    fetchMock.mockResolvedValueOnce(jsonResponse({ tracker }));
    await upsertTracker({ id: 7, targetValue: 50 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://test/api/trackers",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("fetchTrackerLogs lists logs with trackerId and limit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [log] }));
    const logs = await fetchTrackerLogs(7, 15);
    expect(logs).toHaveLength(1);
    expect(logs[0].log_date).toBe("2026-09-13");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/trackers/logs?trackerId=7&limit=15",
      expect.anything()
    );
  });

  it("upsertTrackerLog posts value + notes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ log }, true, 201));
    const saved = await upsertTrackerLog({ trackerId: 7, logDate: "2026-09-13", value: 42 });
    expect(saved.log_date).toBe("2026-09-13");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/trackers/logs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ trackerId: 7, logDate: "2026-09-13", value: 42 }),
      })
    );
  });

  it("deleteTracker issues DELETE with id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await deleteTracker(7);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/trackers?id=7",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("todayLocal returns YYYY-MM-DD", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
