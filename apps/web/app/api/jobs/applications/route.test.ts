import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/job-applications", () => ({
  listApplications: vi.fn(),
  applicationStats: vi.fn(),
  addApplication: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { listApplications, applicationStats, addApplication } from "@/lib/job-applications";
import { logger } from "@/lib/logger";
import { GET, POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listApplications);
const statsMock = vi.mocked(applicationStats);
const addMock = vi.mocked(addApplication);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/applications", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns applications and stats", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    statsMock.mockResolvedValue({ favorite: 0 } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).applications).toEqual([]);
    expect(listMock).toHaveBeenCalledWith("u-1");
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});

describe("POST /api/jobs/applications", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid jobId", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ jobId: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid stage", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ jobId: 5, stage: "nope" }));
    expect(res.status).toBe(400);
  });

  it("creates an application for a valid stage", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    addMock.mockResolvedValue({ id: 1, stage: "applied" } as never);
    const res = await POST(jsonReq({ jobId: 5, stage: "applied" }));
    expect(res.status).toBe(201);
    expect(addMock).toHaveBeenCalledWith("u-1", 5, "applied");
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    addMock.mockRejectedValue(new Error("boom"));
    const res = await POST(jsonReq({ jobId: 5, stage: "applied" }));
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
