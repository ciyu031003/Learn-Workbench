import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408", () => ({ getExam408Question: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Question } from "@/lib/exam-408";
import { GET } from "./route";

const questionMock = vi.mocked(getExam408Question);

beforeEach(() => {
  vi.clearAllMocks();
});

const url = (query: string) => new NextRequest("http://localhost/api/exam/408/question" + query);

const question = {
  key: "beokayy-408/2016-01",
  id: "2016-01",
  year: 2016,
  number: 1,
  type: "choice" as const,
  subject: { key: "beokayy-408/ds", title: "数据结构" },
  points: 2,
  body: "题干",
  stem: "题干",
  options: [{ letter: "A", text: "顺序表" }],
  answerText: "A",
  answerLetter: "A",
  imageRefs: [],
  answerImageRefs: [],
  videoUrl: null,
  tags: [],
  knowledgePoints: [{ key: "yuanabd-408/ds-01-01", title: "顺序表" }],
};

describe("GET /api/exam/408/question", () => {
  it("缺 key / key 超长返回 400，不查库", async () => {
    const missing = await GET(url(""));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: "key 必须是 408 真题 key", code: "validation_failed" });
    const tooLong = await GET(url("?key=" + "x".repeat(201)));
    expect(tooLong.status).toBe(400);
    expect(questionMock).not.toHaveBeenCalled();
  });

  it("key 去首尾空白后传库", async () => {
    questionMock.mockResolvedValueOnce(question);
    const response = await GET(url("?key=%20beokayy-408%2F2016-01%20"));
    expect(response.status).toBe(200);
    expect(questionMock).toHaveBeenCalledWith("beokayy-408/2016-01");
  });

  it("命中时返回 { question } 与私有缓存头", async () => {
    questionMock.mockResolvedValueOnce(question);
    const response = await GET(url("?key=beokayy-408%2F2016-01"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await response.json()).toEqual({ question });
  });

  it("题目不存在返回 404", async () => {
    questionMock.mockResolvedValueOnce(null);
    const response = await GET(url("?key=beokayy-408%2Fmissing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "真题不存在", code: "not_found" });
  });

  it("查询异常返回 500 结构化错误", async () => {
    questionMock.mockRejectedValueOnce(new Error("pg down"));
    const response = await GET(url("?key=beokayy-408%2F2016-01"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "408 真题加载失败", code: "internal_error" });
  });
});
