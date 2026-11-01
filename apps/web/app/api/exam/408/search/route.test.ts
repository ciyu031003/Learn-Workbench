import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exam-408-search")>();
  return { ...actual, searchExam408: vi.fn() };
});
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { SEARCH_MAX_QUERY_LENGTH, searchExam408 } from "@/lib/exam-408-search";
import { GET } from "./route";

const searchMock = vi.mocked(searchExam408);

beforeEach(() => {
  vi.clearAllMocks();
});

const url = (query: string) =>
  "http://localhost/api/exam/408/search?q=" + encodeURIComponent(query);

describe("GET /api/exam/408/search", () => {
  it("缺少 q 时返回空结果且不查库", async () => {
    const response = await GET(new NextRequest("http://localhost/api/exam/408/search"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ query: "", total: 0 });
    expect(payload.groups).toHaveLength(4);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("q 只有空白时同样返回空结果", async () => {
    const response = await GET(new NextRequest(url("   ")));
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe(0);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("超长搜索词返回 400 validation_failed", async () => {
    const response = await GET(new NextRequest(url("字".repeat(SEARCH_MAX_QUERY_LENGTH + 1))));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("正常搜索返回分组结果并按裁剪后的 query 调用库", async () => {
    const result = {
      query: "死锁",
      total: 2,
      limit: 8,
      groups: [
        { kind: "point" as const, label: "知识点", total: 1, hits: [] },
        { kind: "study" as const, label: "精读", total: 1, hits: [] },
      ],
    };
    searchMock.mockResolvedValueOnce(result);

    const response = await GET(new NextRequest(url("  死锁  ")));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(result);
    expect(searchMock).toHaveBeenCalledWith("死锁");
  });

  it("查询异常返回 500 internal_error", async () => {
    searchMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(new NextRequest(url("死锁")));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal_error" });
  });
});
