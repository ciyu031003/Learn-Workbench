import { describe, expect, it } from "vitest";
import type { Exam408Overview } from "@/lib/exam-408";
import {
  EXAM_408_EMPTY_STATS,
  exam408BodyParagraphs,
  exam408ChapterPreview,
  exam408DisplayTags,
  exam408GradStageForSubject,
  exam408OverviewStats,
  exam408PointHref,
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

describe("exam408PointHref（知识点跳转 href；params 冻结的真修复在 exam-408-pending）", () => {
  it("含斜杠的 key 必须整体编码成一个查询值（%2F），不能被当路径切分", () => {
    expect(exam408PointHref("beokayy-408/ds-01-01")).toBe(
      "/quiz/408-point?key=yuanabd-408%2Fds-01-01",
    );
  });

  it("不同知识点生成不同 href（URL 仍是导航载体，深链可用）", () => {
    const first = exam408PointHref("beokayy-408/ds-01-01");
    const second = exam408PointHref("beokayy-408/os-03-02");
    expect(first).not.toBe(second);
    expect(second).toContain("os-03-02");
  });

  it("首尾空白会被 trim；空 key 退化为裸路由", () => {
    expect(exam408PointHref("  beokayy-408/ds-02-01  ")).toBe(
      "/quiz/408-point?key=yuanabd-408%2Fds-02-01",
    );
    expect(exam408PointHref("   ")).toBe("/quiz/408-point");
  });
});

describe("exam408GradStageForSubject（真题索引科目 → ex-408-grad 讲义阶段）", () => {
  it("四科 key（带 beokayy-408/ 前缀与裸 key）都映射到对应讲义阶段", () => {
    expect(exam408GradStageForSubject("beokayy-408/data-structure")).toBe("ex408g-ds-stage");
    expect(exam408GradStageForSubject("beokayy-408/computer-organization")).toBe("ex408g-co-stage");
    expect(exam408GradStageForSubject("beokayy-408/operating-system")).toBe("ex408g-os-stage");
    expect(exam408GradStageForSubject("beokayy-408/computer-network")).toBe("ex408g-net-stage");
    expect(exam408GradStageForSubject("data-structure")).toBe("ex408g-ds-stage");
  });

  it("未知科目返回 null（调用方隐藏讲义入口）", () => {
    expect(exam408GradStageForSubject("beokayy-408/unknown-subject")).toBeNull();
    expect(exam408GradStageForSubject("")).toBeNull();
    expect(exam408GradStageForSubject("   ")).toBeNull();
  });
});

describe("exam408BodyParagraphs（知识点正文归一化，v1.54.0）", () => {
  it("按原顺序返回段落，并 trim 首尾空白", () => {
    expect(exam408BodyParagraphs(["  第一段。 ", "第二段。"])).toEqual([
      { text: "第一段。", heading: false },
      { text: "第二段。", heading: false },
    ]);
  });

  it("以【】开头的段落标记为小标题（加粗渲染）", () => {
    const paragraphs = exam408BodyParagraphs([
      "线性表的顺序表示把逻辑相邻的元素放成物理相邻。",
      "【地址公式】第 i 个元素的地址等于首地址加 (i−1) 乘元素长度 L。",
    ]);
    expect(paragraphs.map((paragraph) => paragraph.heading)).toEqual([false, true]);
    // 只按前缀判定，段落内部的【 不当标题
    expect(exam408BodyParagraphs(["正文里提到【地址公式】这种写法"])[0]?.heading).toBe(false);
  });

  it("缺省 / null / 空数组都归一成空数组（旧接口无 body 列时整块不渲染）", () => {
    expect(exam408BodyParagraphs(undefined)).toEqual([]);
    expect(exam408BodyParagraphs(null)).toEqual([]);
    expect(exam408BodyParagraphs([])).toEqual([]);
    // 防御线上脏数据：非数组（历史字段曾按 string 返回）不能让页面崩
    expect(exam408BodyParagraphs("字符串不是段落数组" as unknown as string[])).toEqual([]);
  });

  it("丢弃空串与纯空白段，避免渲染出空行", () => {
    expect(exam408BodyParagraphs(["", "  ", "\n", "唯一一段。"])).toEqual([
      { text: "唯一一段。", heading: false },
    ]);
  });
});