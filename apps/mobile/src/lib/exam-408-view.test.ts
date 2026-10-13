import { describe, expect, it } from "vitest";
import type { Exam408Overview } from "@/lib/exam-408";
import {
  EXAM_408_EMPTY_STATS,
  exam408ChapterPreview,
  exam408DisplayTags,
  exam408OverviewStats,
  resolveExam408Subject,
} from "@/lib/exam-408-view";

const overview: Exam408Overview = {
  source: {
    key: "beokayy-408",
    name: "四〇八档案室",
    baseUrl: "https://zhenti.beokayy.club",
    licenseNote: "个人学习自用，不商用",
    capturedAt: null,
  },
  stats: {
    subjects: 2,
    chapters: 2,
    points: 2,
    papers: 1,
    questions: 47,
  },
  subjects: [
    {
      key: "beokayy-408/ds",
      shortName: "数据结构",
      title: "数据结构",
      chapterCount: 1,
      pointCount: 1,
      questionCount: 20,
      chapters: [
        {
          key: "beokayy-408/ds-01",
          title: "线性表",
          chapterNumber: 1,
          questionCount: 20,
          points: [
            {
              key: "beokayy-408/ds-01-01",
              title: "顺序表",
              pointNumber: 1,
              questionCount: 8,
              tags: ["408", "四〇八档案室", "线性表"],
            },
          ],
        },
      ],
    },
    {
      key: "beokayy-408/os",
      shortName: "操作系统",
      title: "操作系统",
      chapterCount: 1,
      pointCount: 1,
      questionCount: 12,
      chapters: [],
    },
  ],
  papers: [],
};

describe("exam 408 mobile view model", () => {
  it("按 key 选择科目，并在失效 key 下回退到第一科", () => {
    expect(resolveExam408Subject(overview, "beokayy-408/os")?.shortName).toBe(
      "操作系统",
    );
    expect(resolveExam408Subject(overview, "missing")?.shortName).toBe("数据结构");
    expect(resolveExam408Subject(null, "missing")).toBeNull();
  });

  it("为空总览使用稳定的零值统计", () => {
    expect(exam408OverviewStats(null)).toEqual(EXAM_408_EMPTY_STATS);
    expect(exam408OverviewStats(overview)).toBe(overview.stats);
  });

  it("生成章节预览并过滤内部标签", () => {
    expect(exam408ChapterPreview(overview.subjects[0]!.chapters[0]!)).toBe(
      "顺序表",
    );
    expect(
      exam408DisplayTags(
        overview.subjects[0]!.chapters[0]!.points[0]!.tags,
        3,
      ),
    ).toEqual(["线性表"]);
  });
});
