import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/job-applications", () => ({
  updateApplicationStage: vi.fn(),
  deleteApplication: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { updateApplicationStage, deleteApplication } from "@/lib/job-applications";
import { logger } from "@/lib/logger";
import { PUT, DELETE } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const updateMock = vi.mocked(updateApplicationStage);
const deleteMock = vi.mocked(deleteApplication);
const errorMock = vi.mocked(logger.error);
const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => vi.clearAllMocks());

describe("PUT /api/jobs/applications/[id]", () => {
  it("returns 400 for invalid id", async () => {
    const res = await PUT(new Request("http://localhost"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await PUT(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid stage", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await PUT(jsonReq({ stage: "nope" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when update returns null", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    updateMock.mockResolvedValue(null);
    const res = await PUT(jsonReq({ stage: "applied" }), ctx);
    expect(res.status).toBe(404);
  });

  it("updates stage and note", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    updateMock.mockResolvedValue({ id: 5, stage: "interview1" } as never);
    const res = await PUT(jsonReq({ stage: "interview1", note: "ok" }), ctx);
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("u-1", 5, "interview1", "ok");
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    updateMock.mockRejectedValue(new Error("boom"));
    const res = await PUT(jsonReq({ stage: "applied" }), ctx);
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});

describe("DELETE /api/jobs/applications/[id]", () => {
  it("returns 400 for invalid id", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when nothing deleted", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    deleteMock.mockResolvedValue(false);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes successfully", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    deleteMock.mockResolvedValue(true);
    const res = await DELETE(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("u-1", 5);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
