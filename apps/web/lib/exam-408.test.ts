import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { getExam408Overview, getExam408Paper, getExam408Point } from "./exam-408";

const queryMock = vi.mocked(pgPool.query);

const sourceRow = {
  key: "beokayy-408",
  name: "四〇八档案室",
  base_url: "https://zhenti.beokayy.club",
  license_note: "个人学习自用，不商用",
  captured_at: new Date("2026-10-11T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExam408Overview", () => {
  it("按科目和章节组装知识点与试卷概览", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sourceRow] } as never)
      .mockResolvedValueOnce({
        rows: [{ key: "beokayy-408/ds", short_name: "数据结构", title: "数据结构" }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "beokayy-408/ds-01",
            subject_key: "beokayy-408/ds",
            chapter_number: 1,
            title: "线性表",
            question_count: 20,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "beokayy-408/ds-01-01",
            chapter_key: "beokayy-408/ds-01",
            point_number: 1,
            title: "顺序表",
            question_count: 8,
            tags: ["408", "线性表"],
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ year: 2016, title: "2016 年全国硕士研究生招生考试 408 真题", total_score: 150, question_count: 47 }],
      } as never);

    const overview = await getExam408Overview();

    expect(overview.stats).toEqual({ subjects: 1, chapters: 1, points: 1, papers: 1, questions: 47 });
    expect(overview.subjects[0]).toMatchObject({
      shortName: "数据结构",
      chapterCount: 1,
      pointCount: 1,
      questionCount: 20,
    });
    expect(overview.subjects[0]?.chapters[0]?.points[0]).toEqual({
      key: "beokayy-408/ds-01-01",
      title: "顺序表",
      pointNumber: 1,
      questionCount: 8,
      tags: ["408", "线性表"],
    });
    expect(overview.source.capturedAt).toBe("2026-10-11T00:00:00.000Z");
  });
});

describe("getExam408Paper", () => {
  it("按原题号返回选择题与综合题分段", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sourceRow] } as never)
      .mockResolvedValueOnce({
        rows: [{ year: 2016, title: "2016 年 408 真题", total_score: 150, question_count: 2 }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          questionRow({
            key: "beokayy-408/2016-01",
            question_id: "2016-01",
            question_number: 1,
            type: "choice",
            points: 2,
            image_refs: ["/content-images/2016-01.png"],
          }),
          questionRow({
            key: "beokayy-408/2016-41",
            question_id: "2016-41",
            question_number: 41,
            type: "comprehensive",
            points: 7,
          }),
        ],
      } as never);

    const paper = await getExam408Paper(2016);

    expect(paper?.sections).toEqual([
      { type: "choice", title: "单项选择题", from: 1, to: 1, totalScore: 2 },
      { type: "comprehensive", title: "综合应用题", from: 41, to: 41, totalScore: 7 },
    ]);
    expect(paper?.questions[0]?.imageRefs).toEqual(["/content-images/2016-01.png"]);
  });

  it("不存在的年份返回 null", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sourceRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    expect(await getExam408Paper(1999)).toBeNull();
  });
});

describe("getExam408Point", () => {
  it("返回知识点元数据和关联题目", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sourceRow] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "beokayy-408/ds-01-01",
            title: "顺序表",
            summary: "数据结构 · 线性表",
            question_count: 2,
            tags: ["408", "顺序表"],
            subject_key: "beokayy-408/ds",
            subject_title: "数据结构",
            chapter_key: "beokayy-408/ds-01",
            chapter_title: "线性表",
            chapter_number: 1,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          questionRow({
            key: "beokayy-408/2016-01",
            question_id: "2016-01",
            question_number: 1,
            type: "choice",
            points: 2,
            knowledge_points: [{ key: "beokayy-408/ds-01-01", title: "顺序表" }],
          }),
        ],
      } as never);

    const detail = await getExam408Point("beokayy-408/ds-01-01");

    expect(detail?.point).toMatchObject({
      title: "顺序表",
      questionCount: 2,
      subject: { key: "beokayy-408/ds", title: "数据结构" },
      chapter: { title: "线性表", chapterNumber: 1 },
    });
    expect(detail?.questions[0]?.knowledgePoints).toEqual([{ key: "beokayy-408/ds-01-01", title: "顺序表" }]);
  });

  it("知识点不存在返回 null", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sourceRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    expect(await getExam408Point("beokayy-408/missing")).toBeNull();
  });
});

function questionRow(overrides: Record<string, unknown>) {
  return {
    key: "beokayy-408/2016-01",
    question_id: "2016-01",
    paper_year: 2016,
    question_number: 1,
    type: "choice",
    points: 2,
    body: "题干",
    stem: "题干",
    options: [
      { letter: "A", text: "甲" },
      { letter: "B", text: "乙" },
    ],
    answer_text: "答案：A",
    answer_letter: "A",
    image_refs: [],
    answer_image_refs: [],
    video_url: null,
    tags: ["408"],
    subject_key: "beokayy-408/ds",
    subject_title: "数据结构",
    knowledge_points: [],
    ...overrides,
  };
}
