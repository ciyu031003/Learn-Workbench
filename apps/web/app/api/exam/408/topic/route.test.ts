import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408-topic", () => ({ getExam408Topic: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408Topic } from "@/lib/exam-408-topic";
import { GET } from "./route";

const topicMock = vi.mocked(getExam408Topic);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/topic", () => {
  it("拒绝非 408 key", async () => {
    const response = await GET(new NextRequest("http://localhost/api/exam/408/topic?key=algorithms/ds"));
    expect(response.status).toBe(400);
    expect(topicMock).not.toHaveBeenCalled();
  });

  it("缺少 key 视为非法", async () => {
    const response = await GET(new NextRequest("http://localhost/api/exam/408/topic"));
    expect(response.status).toBe(400);
    expect(topicMock).not.toHaveBeenCalled();
  });

  it("知识点不存在返回 404", async () => {
    topicMock.mockResolvedValueOnce(null);
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/topic?key=beokayy-408%2Fmissing"),
    );
    expect(response.status).toBe(404);
  });

  it("返回聚合正文、文章、卡片、演示与真题", async () => {
    topicMock.mockResolvedValueOnce({
      point: {
        key: "beokayy-408/os-02-04",
        title: "死锁",
        summary: "操作系统 · 进程管理",
        body: ["死锁考四个必要条件。"],
        questionCount: 13,
        tags: ["408"],
        subject: { key: "beokayy-408/operating-system", title: "操作系统" },
        chapter: { key: "beokayy-408/os-02", title: "进程管理", chapterNumber: 2 },
      },
      articles: [
        {
          slug: "死锁",
          title: "死锁",
          chapter: "进程管理",
          chapterOrder: 16010,
          sortOrder: 1,
          importance: "must",
          importanceLabel: "重点必读",
          examFrequency: 11,
          knowledgePointKey: "beokayy-408/os-02-04",
          readingMinutes: 2,
        },
      ],
      cards: [
        {
          key: "408card/os-7",
          subjectKey: "operating-system",
          chapter: 2,
          question: "死锁的四个必要条件？",
          answerSteps: ["互斥", "不剥夺"],
          pitfall: null,
          mnemonic: null,
          star: false,
          demoKey: null,
          knowledgePointKey: "beokayy-408/os-02-04",
        },
      ],
      demos: [],
      questions: [],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/topic?key=beokayy-408%2Fos-02-04"),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.point).toMatchObject({ title: "死锁", questionCount: 13 });
    expect(payload.point.body).toEqual(["死锁考四个必要条件。"]);
    expect(payload.articles).toHaveLength(1);
    expect(payload.articles[0]).toMatchObject({ slug: "死锁", importanceLabel: "重点必读" });
    expect(payload.cards[0]).toMatchObject({ key: "408card/os-7", answerSteps: ["互斥", "不剥夺"] });
    expect(payload.demos).toEqual([]);
    expect(payload.questions).toEqual([]);
  });

  it("查询抛错时返回 500 结构化错误", async () => {
    topicMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/topic?key=beokayy-408%2Fos-02-04"),
    );
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.code).toBe("internal_error");
  });
});
