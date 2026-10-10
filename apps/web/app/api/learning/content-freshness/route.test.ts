import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/content/point-states", () => ({ stalePointKeys: vi.fn() }));
vi.mock("@/lib/content/knowledge-model", () => ({ DEFAULT_REVIEW_TTL_DAYS: 180 }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { stalePointKeys } from "@/lib/content/point-states";
import { GET } from "./route";

const staleMock = vi.mocked(stalePointKeys);

function req(track?: string): Request {
  const url = new URL("http://localhost/api/learning/content-freshness");
  if (track) url.searchParams.set("track", track);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  staleMock.mockResolvedValue(["python/python-foundation/python-values-control"]);
});

describe("GET /api/learning/content-freshness", () => {
  it("返回过期知识点列表与复查周期", async () => {
    const res = await GET(req("python"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ available: true, reviewTtlDays: 180 });
    expect(body.stale).toHaveLength(1);
  });

  it("库不可用 → 降级空列表，不 500", async () => {
    staleMock.mockRejectedValue(new Error("relation knowledge_points does not exist"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: false, stale: [] });
  });
});
