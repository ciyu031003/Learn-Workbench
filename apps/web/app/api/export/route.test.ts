import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/export", () => {
  it("exports all seven data tables", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.app).toBe("learn-workbench");
    expect(json.schemaVersion).toBe("0.1.0");
    expect(["progress", "tasks", "sessions", "checkins", "logs", "certificates", "github", "domains", "trackers", "tracker_logs"]).toEqual(
      Object.keys(json).filter((k) => !["app", "schemaVersion", "exportedAt"].includes(k))
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM topic_progress"), ["u-1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM resume_assets"), ["u-1"]);
    expect(release).toHaveBeenCalled();
  });
});
