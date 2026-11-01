import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/exam-408-map", () => ({ getExam408KnowledgeMap: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { getExam408KnowledgeMap } from "@/lib/exam-408-map";
import { GET } from "./route";

const mapMock = vi.mocked(getExam408KnowledgeMap);

const map = {
  key: "data-structure:图",
  subjectKey: "data-structure",
  subjectTitle: "数据结构",
  subjectShortName: "DS",
  chapter: "图",
  topicSlug: "data-structure-图-knowledge-map",
  topicTitle: "📊 章节知识图谱",
  nodes: [
    {
      slug: "data-structure-graph-defs",
      title: "图的基本定义",
      type: "core" as const,
      desc: "",
      order: 0,
      importance: "must" as const,
      importanceLabel: "重点必读",
      examFrequency: 2,
      pointKey: "beokayy-408/ds-05-01",
      studySlug: "data-structure-graph-defs",
      href: "/learn/408/study/data-structure-graph-defs",
      target: "study" as const,
      counts: { cards: 3, demos: 0, questions: 12 },
    },
  ],
  stats: { nodes: 1, core: 1, ext: 0, cards: 3, demos: 0, questions: 12, examFrequency: 2 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exam/408/map", () => {
  it("?topic= 按精读文章 slug 返回图谱", async () => {
    mapMock.mockResolvedValueOnce(map);
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/map?topic=" + encodeURIComponent("data-structure-图-knowledge-map")),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.map.chapter).toBe("图");
    expect(payload.map.nodes[0].href).toBe("/learn/408/study/data-structure-graph-defs");
    expect(mapMock).toHaveBeenCalledWith({ topicSlug: "data-structure-图-knowledge-map" });
  });

  it("?subject=&chapter= 按科目与章节返回图谱", async () => {
    mapMock.mockResolvedValueOnce(map);
    const response = await GET(
      new NextRequest("http://localhost/api/exam/408/map?subject=data-structure&chapter=" + encodeURIComponent("图")),
    );
    expect(response.status).toBe(200);
    expect(mapMock).toHaveBeenCalledWith({ subjectKey: "data-structure", chapter: "图" });
  });

  it("缺参数 / 两种模式混用 / subject 缺 chapter 返回 400", async () => {
    const none = await GET(new NextRequest("http://localhost/api/exam/408/map"));
    expect(none.status).toBe(400);
    const both = await GET(
      new NextRequest("http://localhost/api/exam/408/map?topic=x&subject=data-structure&chapter=y"),
    );
    expect(both.status).toBe(400);
    const noChapter = await GET(new NextRequest("http://localhost/api/exam/408/map?subject=data-structure"));
    expect(noChapter.status).toBe(400);
    expect(mapMock).not.toHaveBeenCalled();
  });

  it("非法 topic / subject / chapter 返回 400", async () => {
    const emptyTopic = await GET(new NextRequest("http://localhost/api/exam/408/map?topic="));
    expect(emptyTopic.status).toBe(400);
    const longTopic = await GET(new NextRequest("http://localhost/api/exam/408/map?topic=" + "a".repeat(301)));
    expect(longTopic.status).toBe(400);
    const badSubject = await GET(
      new NextRequest("http://localhost/api/exam/408/map?subject=DS_1&chapter=%E5%9B%BE"),
    );
    expect(badSubject.status).toBe(400);
    const emptyChapter = await GET(
      new NextRequest("http://localhost/api/exam/408/map?subject=data-structure&chapter="),
    );
    expect(emptyChapter.status).toBe(400);
  });

  it("图谱不存在返回 404", async () => {
    mapMock.mockResolvedValueOnce(null);
    const response = await GET(new NextRequest("http://localhost/api/exam/408/map?topic=missing"));
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found");
  });

  it("查询抛错返回 500 并记录日志", async () => {
    mapMock.mockRejectedValueOnce(new Error("db down"));
    const response = await GET(new NextRequest("http://localhost/api/exam/408/map?subject=data-structure&chapter=x"));
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("internal_error");
  });
});
