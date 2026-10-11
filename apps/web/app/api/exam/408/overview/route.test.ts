import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/exam-408", () => ({ getExam408Overview: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Overview } from "@/lib/exam-408";
import { GET } from "./route";

const overviewMock = vi.mocked(getExam408Overview);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/overview", () => {
  it("返回 408 总览", async () => {
    overviewMock.mockResolvedValueOnce({
      source: {
        key: "beokayy-408",
        name: "四〇八档案室",
        baseUrl: "https://zhenti.beokayy.club",
        licenseNote: "个人学习自用",
        capturedAt: null,
      },
      stats: { subjects: 4, chapters: 25, points: 99, papers: 18, questions: 846 },
      subjects: [],
      papers: [],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ stats: { questions: 846 } });
  });

  it("数据库异常时返回统一错误 envelope", async () => {
    overviewMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal_error" });
  });
});
