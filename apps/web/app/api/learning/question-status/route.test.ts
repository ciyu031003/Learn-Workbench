import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/content/question-lifecycle", () => ({
  listQuestionStatuses: vi.fn(),
  questionStatusCounts: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
import { listQuestionStatuses, questionStatusCounts } from "@/lib/content/question-lifecycle";
import { GET } from "./route";

const listMock = vi.mocked(listQuestionStatuses);
const countsMock = vi.mocked(questionStatusCounts);

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([
    { key: "py-q1", status: "published", trackSlug: "python", stageKey: "python-foundation", topicKey: "python-values-control" },
    { key: "py-q2", status: "archived", trackSlug: "python", stageKey: "python-foundation", topicKey: "python-values-control" },
  ]);
  countsMock.mockResolvedValue({ draft: 0, review: 0, published: 1, archived: 1 });
});

describe("GET /api/learning/question-status", () => {
  it("返回状态列表与计数", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.counts).toEqual({ draft: 0, review: 0, published: 1, archived: 1 });
    expect(body.statuses).toEqual([
      { key: "py-q1", status: "published" },
      { key: "py-q2", status: "archived" },
    ]);
  });

  it("库不可用时降级为 available:false + 空列表，不 500", async () => {
    listMock.mockRejectedValue(new Error("relation learning_questions does not exist"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ available: false, counts: null, statuses: [] });
    expect(JSON.stringify(body)).not.toContain("does not exist");
  });
});
