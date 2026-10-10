import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning-read", () => ({ recordReadState: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { recordReadState } from "@/lib/learning-read";
import { POST } from "./route";

const userMock = vi.mocked(currentUserId);
const recordMock = vi.mocked(recordReadState);

const valid = {
  pointKey: "python/python-foundation/python-values-control",
  trackSlug: "python",
  stageKey: "python-foundation",
  topicKey: "python-values-control",
};

function req(body: unknown): Request {
  return new Request("http://localhost/api/learning/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/learning/read", () => {
  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    expect((await POST(req(valid))).status).toBe(401);
  });

  it("字段缺失 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await POST(req({ pointKey: "a/b/c" }))).status).toBe(400);
  });

  it("progress 越界 → 400（不允许 -1 或 101）", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await POST(req({ ...valid, progress: 101 }))).status).toBe(400);
    expect((await POST(req({ ...valid, progress: -1 }))).status).toBe(400);
  });

  it("正常上报 → 201 并回传状态", async () => {
    userMock.mockResolvedValue("u-1");
    recordMock.mockResolvedValue({
      ...valid,
      firstReadAt: "2026-10-10T00:00:00.000Z",
      lastReadAt: "2026-10-10T00:00:00.000Z",
      progress: 90,
      readCount: 2,
    });
    const res = await POST(req({ ...valid, progress: 90, clientId: "c-1" }));
    expect(res.status).toBe(201);
    expect(recordMock).toHaveBeenCalledWith("u-1", { ...valid, progress: 90, clientId: "c-1" });
    expect((await res.json()).progress).toBe(90);
  });
});
