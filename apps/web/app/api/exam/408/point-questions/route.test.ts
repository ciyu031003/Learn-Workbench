import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408", () => ({ getExam408Point: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Point } from "@/lib/exam-408";
import { GET, normalizePointKey, parseQuestionYear } from "./route";

const pointMock = vi.mocked(getExam408Point);

beforeEach(() => {
  vi.clearAllMocks();
});

const url = (query: string) => "http://localhost/api/exam/408/point-questions" + query;
const detail = (questions: Array<{ key: string; year: number; number: number }>) =>
  ({
    source: { key: "beokayy-408", name: "", baseUrl: "", licenseNote: "", capturedAt: null },
    point: {
      key: "beokayy-408/os-02-04",
      title: "死锁",
      summary: "",
      body: [],
      questionCount: questions.length,
      tags: [],
      subject: { key: "beokayy-408/operating-system", title: "操作系统" },
      chapter: { key: "beokayy-408/os-02", title: "进程管理", chapterNumber: 2 },
    },
    questions,
  }) as never;

describe("normalizePointKey / parseQuestionYear", () => {
  it("解码 %2F、折叠斜杠、去首尾空白", () => {
    expect(normalizePointKey("beokayy-408%2Fos-02-04")).toBe("beokayy-408/os-02-04");
    expect(normalizePointKey("  beokayy-408//os-02-04  ")).toBe("beokayy-408/os-02-04");
    expect(normalizePointKey("/beokayy-408/os-02-04/")).toBe("beokayy-408/os-02-04");
    expect(normalizePointKey(null)).toBe("");
  });

  it("年份只接受四位且在 2000-2100", () => {
    expect(parseQuestionYear("2021")).toBe(2021);
    expect(parseQuestionYear("1999")).toBeNull();
    expect(parseQuestionYear("2101")).toBeNull();
    expect(parseQuestionYear("21")).toBeNull();
    expect(parseQuestionYear("2021a")).toBeNull();
    expect(parseQuestionYear(null)).toBeNull();
  });
});

describe("GET /api/exam/408/point-questions", () => {
  it("key 形状不对返回 400", async () => {
    const response = await GET(new NextRequest(url("?key=algorithms/ds&year=2021")));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(pointMock).not.toHaveBeenCalled();
  });

  it("缺少 key / year 都返回 400", async () => {
    expect((await GET(new NextRequest(url("?year=2021")))).status).toBe(400);
    expect((await GET(new NextRequest(url("?key=beokayy-408%2Fos-02-04")))).status).toBe(400);
    expect(pointMock).not.toHaveBeenCalled();
  });

  it("知识点不存在返回 404", async () => {
    pointMock.mockResolvedValueOnce(null);
    const response = await GET(new NextRequest(url("?key=beokayy-408%2Fos-02-04&year=2021")));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("只返回指定年份，并按题号升序", async () => {
    pointMock.mockResolvedValueOnce(
      detail([
        { key: "q-2021-31", year: 2021, number: 31 },
        { key: "q-2019-30", year: 2019, number: 30 },
        { key: "q-2021-23", year: 2021, number: 23 },
      ]),
    );
    const response = await GET(new NextRequest(url("?key=beokayy-408%2Fos-02-04&year=2021")));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    const payload = await response.json();
    expect(payload).toMatchObject({ key: "beokayy-408/os-02-04", year: 2021, total: 2 });
    expect(payload.questions.map((question: { key: string }) => question.key)).toEqual([
      "q-2021-23",
      "q-2021-31",
    ]);
  });

  it("该年没有题目返回 200 空数组（不是 404）", async () => {
    pointMock.mockResolvedValueOnce(detail([{ key: "q-2019-30", year: 2019, number: 30 }]));
    const response = await GET(new NextRequest(url("?key=beokayy-408%2Fos-02-04&year=2022")));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 0, questions: [] });
  });

  it("数据库异常返回 500", async () => {
    pointMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(new NextRequest(url("?key=beokayy-408%2Fos-02-04&year=2021")));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal_error" });
  });
});
