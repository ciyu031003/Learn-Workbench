import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408", () => ({ getExam408Paper: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Paper } from "@/lib/exam-408";
import { GET } from "./route";

const paperMock = vi.mocked(getExam408Paper);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/exam/408/paper", () => {
  it("拒绝非法年份", async () => {
    const response = await GET(new NextRequest("http://localhost/api/exam/408/paper?year=abc"));
    expect(response.status).toBe(400);
    expect(paperMock).not.toHaveBeenCalled();
  });

  it("未收录年份返回 404", async () => {
    paperMock.mockResolvedValueOnce(null);
    const response = await GET(new NextRequest("http://localhost/api/exam/408/paper?year=2099"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("按年份返回原卷", async () => {
    paperMock.mockResolvedValueOnce({
      source: {
        key: "beokayy-408",
        name: "四〇八档案室",
        baseUrl: "https://zhenti.beokayy.club",
        licenseNote: "个人学习自用",
        capturedAt: null,
      },
      paper: { year: 2016, title: "2016 年 408 真题", totalScore: 150, questionCount: 47 },
      sections: [],
      questions: [],
    });

    const response = await GET(new NextRequest("http://localhost/api/exam/408/paper?year=2016"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paper: { year: 2016, questionCount: 47 } });
  });
});
