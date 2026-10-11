import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408", () => ({ getExam408Point: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Point } from "@/lib/exam-408";
import { GET } from "./route";

const pointMock = vi.mocked(getExam408Point);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/point", () => {
  it("拒绝非 408 key", async () => {
    const response = await GET(new NextRequest("http://localhost/api/exam/408/point?key=algorithms/ds"));
    expect(response.status).toBe(400);
    expect(pointMock).not.toHaveBeenCalled();
  });

  it("知识点不存在返回 404", async () => {
    pointMock.mockResolvedValueOnce(null);
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/point?key=beokayy-408%2Fmissing"),
    );
    expect(response.status).toBe(404);
  });

  it("返回知识点与关联题目", async () => {
    pointMock.mockResolvedValueOnce({
      source: {
        key: "beokayy-408",
        name: "四〇八档案室",
        baseUrl: "https://zhenti.beokayy.club",
        licenseNote: "个人学习自用",
        capturedAt: null,
      },
      point: {
        key: "beokayy-408/ds-01-01",
        title: "顺序表",
        summary: "数据结构 · 线性表",
        questionCount: 8,
        tags: ["408"],
        subject: { key: "beokayy-408/ds", title: "数据结构" },
        chapter: { key: "beokayy-408/ds-01", title: "线性表", chapterNumber: 1 },
      },
      questions: [],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/point?key=beokayy-408%2Fds-01-01"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ point: { title: "顺序表", questionCount: 8 } });
  });
});
