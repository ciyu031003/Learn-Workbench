import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408-study", () => ({
  getExam408StudyOverview: vi.fn(),
  getExam408StudySubject: vi.fn(),
  getExam408StudyTopic: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import {
  getExam408StudyOverview,
  getExam408StudySubject,
  getExam408StudyTopic,
} from "@/lib/exam-408-study";
import { GET } from "./route";

const overviewMock = vi.mocked(getExam408StudyOverview);
const subjectMock = vi.mocked(getExam408StudySubject);
const topicMock = vi.mocked(getExam408StudyTopic);

const source = {
  key: "cs408-cloud",
  name: "408 知识库 · 知识精读",
  baseUrl: "https://cs408.cloud/",
  licenseNote: "个人学习、非商业用途",
  capturedAt: null,
};

const topic = {
  slug: "data_structure-intro-basic",
  title: "数据结构基本概念",
  chapter: "绪论",
  chapterOrder: 1010,
  sortOrder: 1,
  importance: "must" as const,
  importanceLabel: "重点必读",
  examFrequency: 2,
  knowledgePointKey: "beokayy-408/ds-01-01",
  readingMinutes: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/study", () => {
  it("无参数返回知识树总览", async () => {
    overviewMock.mockResolvedValueOnce({
      source,
      stats: { subjects: 1, chapters: 1, topics: 1, readingMinutes: 3 },
      subjects: [
        {
          key: "data-structure",
          title: "数据结构",
          shortName: "DS",
          chapterCount: 1,
          topicCount: 1,
          readingMinutes: 3,
          chapters: [{ chapter: "绪论", chapterOrder: 1010, topics: [topic] }],
        },
      ],
    });
    const response = await GET(new NextRequest("http://localhost/api/exam/408/study"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.mode).toBe("overview");
    expect(payload.stats.topics).toBe(1);
    expect(payload.source.baseUrl).toBe("https://cs408.cloud/");
    expect(subjectMock).not.toHaveBeenCalled();
  });

  it("?subject= 返回单科章节树", async () => {
    subjectMock.mockResolvedValueOnce({
      source,
      subject: {
        key: "data-structure",
        title: "数据结构",
        shortName: "DS",
        chapterCount: 1,
        topicCount: 1,
        readingMinutes: 3,
        chapters: [{ chapter: "绪论", chapterOrder: 1010, topics: [topic] }],
      },
    });
    const response = await GET(new NextRequest("http://localhost/api/exam/408/study?subject=data-structure"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.mode).toBe("subject");
    expect(payload.subject.chapters[0].topics[0].slug).toBe(topic.slug);
    expect(subjectMock).toHaveBeenCalledWith("data-structure");
  });

  it("?slug= 返回单篇正文（含 blocks/toc/上一节下一节）", async () => {
    topicMock.mockResolvedValueOnce({
      source,
      subject: { key: "data-structure", title: "数据结构", shortName: "DS" },
      topic: { ...topic, contentMd: "## 存储结构", tags: ["408"], sourceUrl: "https://cs408.cloud/study?topic=x" },
      blocks: [{ type: "heading", id: "h-sec-0", level: 2, text: "存储结构" }],
      toc: [{ id: "h-sec-0", text: "存储结构", level: 2 }],
      excerpt: "存储结构",
      prev: null,
      next: { slug: "next", title: "下一篇", chapter: "绪论" },
    });
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/study?slug=data_structure-intro-basic"),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.mode).toBe("topic");
    expect(payload.topic.sourceUrl).toContain("cs408.cloud");
    expect(payload.toc).toEqual([{ id: "h-sec-0", text: "存储结构", level: 2 }]);
    expect(payload.next.slug).toBe("next");
  });

  it("subject 与 slug 同时给出返回 400", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/study?subject=data-structure&slug=x"),
    );
    expect(response.status).toBe(400);
    expect(topicMock).not.toHaveBeenCalled();
  });

  it("空 slug 与非法 subject 返回 400", async () => {
    const empty = await GET(new NextRequest("http://localhost/api/exam/408/study?slug="));
    expect(empty.status).toBe(400);
    const badSubject = await GET(new NextRequest("http://localhost/api/exam/408/study?subject=DS_1"));
    expect(badSubject.status).toBe(400);
    const badSlug = await GET(
      new NextRequest("http://localhost/api/exam/408/study?slug=" + encodeURIComponent("a".repeat(301))),
    );
    expect(badSlug.status).toBe(400);
  });

  it("文章或科目不存在返回 404", async () => {
    topicMock.mockResolvedValueOnce(null);
    const missingTopic = await GET(new NextRequest("http://localhost/api/exam/408/study?slug=missing"));
    expect(missingTopic.status).toBe(404);
    subjectMock.mockResolvedValueOnce(null);
    const missingSubject = await GET(new NextRequest("http://localhost/api/exam/408/study?subject=computer-network"));
    expect(missingSubject.status).toBe(404);
  });

  it("查询抛错返回 500 并记录日志", async () => {
    overviewMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(new NextRequest("http://localhost/api/exam/408/study"));
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.code).toBe("internal_error");
  });
});
