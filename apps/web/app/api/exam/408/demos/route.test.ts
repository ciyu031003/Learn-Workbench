import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408-demos", () => ({
  getExam408Demos: vi.fn(),
  getExam408Demo: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Demo, getExam408Demos } from "@/lib/exam-408-demos";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const listMock = vi.mocked(getExam408Demos);
const detailMock = vi.mocked(getExam408Demo);
const loggerMock = vi.mocked(logger);

const summary = {
  key: "408card/ds-array-01",
  subjectKey: "beokayy-408/data-structure",
  title: "顺序表插入",
  description: "逐帧看插入时元素后移",
  frameCount: 6,
  stepsCount: 6,
  knowledgePointKey: "beokayy-408/ds-02-01",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/demos", () => {
  it("不带 key 时返回演示目录", async () => {
    listMock.mockResolvedValueOnce([summary]);

    const response = await GET(new NextRequest("http://localhost/api/exam/408/demos"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ list: [summary] });
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("带 key 时返回单个演示详情", async () => {
    detailMock.mockResolvedValueOnce({
      key: "408card/ds-array-01",
      subjectKey: "beokayy-408/data-structure",
      title: "顺序表插入",
      description: "逐帧看插入时元素后移",
      steps: [{ explain: "找到插入位置", frame: "/content-demos/408card/ds-array-01/1.webp" }],
      frameCount: 1,
      knowledgePointKey: "beokayy-408/ds-02-01",
      sourceUrl: "https://408card.top/",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/demos?key=408card%2Fds-array-01"),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.demo).toMatchObject({
      key: "408card/ds-array-01",
      frameCount: 1,
      sourceUrl: "https://408card.top/",
    });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("非法 key 返回 400 且不打库", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/demos?key=javascript%3Aalert(1)"),
    );
    expect(response.status).toBe(400);
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("演示不存在返回 404", async () => {
    detailMock.mockResolvedValueOnce(null);
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/demos?key=408card%2Fmissing"),
    );
    expect(response.status).toBe(404);
  });

  it("目录查询抛错时返回 500 并记录日志", async () => {
    listMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(new NextRequest("http://localhost/api/exam/408/demos"));
    expect(response.status).toBe(500);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("详情查询抛错时返回 500 并记录日志", async () => {
    detailMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/demos?key=408card%2Fds-array-01"),
    );
    expect(response.status).toBe(500);
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
