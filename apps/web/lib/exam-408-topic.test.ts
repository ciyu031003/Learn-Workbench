import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  getExam408Topic,
  mapCard,
  mapDemo,
  mapQuestion,
  type Exam408TopicQuestionRow,
} from "./exam-408-topic";

const queryMock = vi.mocked(pgPool.query);

const pointRow = {
  key: "beokayy-408/os-02-04",
  title: "死锁",
  summary: "操作系统 · 进程管理",
  body: ["死锁考四个必要条件。", "安全状态一定没有死锁。"],
  question_count: 13,
  tags: ["408", "死锁"],
  subject_key: "beokayy-408/operating-system",
  subject_title: "操作系统",
  chapter_key: "beokayy-408/os-02",
  chapter_title: "进程管理",
  chapter_number: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExam408Topic", () => {
  it("聚合知识点正文、精读文章、速记卡、演示与真题", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [pointRow] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "cs408/死锁",
            subject_key: "operating-system",
            chapter: "进程管理",
            chapter_order: 16010,
            sort_order: 1,
            slug: "死锁",
            title: "死锁",
            importance: "must",
            exam_frequency: 11,
            knowledge_point_key: "beokayy-408/os-02-04",
            content_chars: 900,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "408card/os-7",
            subject_key: "operating-system",
            chapter: 2,
            question: "死锁的四个必要条件？",
            answer_steps: ["互斥", "不剥夺", "请求并保持", "循环等待"],
            pitfall: "把资源不足当成死锁原因",
            mnemonic: null,
            star: true,
            demo_key: "demo-deadlock",
            knowledge_point_key: "beokayy-408/os-02-04",
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            key: "demo-deadlock",
            subject_key: "operating-system",
            title: "死锁的循环等待",
            description: "两个进程互相等待对方资源",
            frame_count: 6,
            steps_count: 4,
            knowledge_point_key: "beokayy-408/os-02-04",
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          questionRow({
            key: "beokayy-408/2021-31",
            question_id: "2021-31",
            paper_year: 2021,
            question_number: 31,
          }),
        ],
      } as never);

    const topic = await getExam408Topic("beokayy-408/os-02-04");

    expect(topic?.point).toMatchObject({
      key: "beokayy-408/os-02-04",
      title: "死锁",
      questionCount: 13,
      subject: { key: "beokayy-408/operating-system", title: "操作系统" },
      chapter: { title: "进程管理", chapterNumber: 2 },
    });
    expect(topic?.point.body).toHaveLength(2);

    expect(topic?.articles).toHaveLength(1);
    expect(topic?.articles[0]).toMatchObject({
      slug: "死锁",
      title: "死锁",
      knowledgePointKey: "beokayy-408/os-02-04",
      importance: "must",
      importanceLabel: "重点必读",
      // 精读按「2.5 字符 ≈ 1 汉字」折算：900 字符 → 约 1 分钟
      readingMinutes: 1,
    });

    expect(topic?.cards[0]).toEqual({
      key: "408card/os-7",
      subjectKey: "operating-system",
      chapter: 2,
      question: "死锁的四个必要条件？",
      answerSteps: ["互斥", "不剥夺", "请求并保持", "循环等待"],
      pitfall: "把资源不足当成死锁原因",
      mnemonic: null,
      star: true,
      demoKey: "demo-deadlock",
      knowledgePointKey: "beokayy-408/os-02-04",
    });

    expect(topic?.demos[0]).toMatchObject({
      key: "demo-deadlock",
      frameCount: 6,
      stepsCount: 4,
      knowledgePointKey: "beokayy-408/os-02-04",
    });

    expect(topic?.questions[0]).toMatchObject({
      key: "beokayy-408/2021-31",
      year: 2021,
      number: 31,
      answerLetter: "A",
    });
    // 6 次查询：1 次知识点 + 4 次聚合查询（其中 articles/cards/demos/questions 各一）
    expect(queryMock).toHaveBeenCalledTimes(5);
  });

  it("知识点不存在时返回 null 且只查一次", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);

    expect(await getExam408Topic("beokayy-408/missing")).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("四类内容都没有时返回空数组而不是 null", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [pointRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const topic = await getExam408Topic("beokayy-408/os-02-04");

    expect(topic).not.toBeNull();
    expect(topic?.articles).toEqual([]);
    expect(topic?.cards).toEqual([]);
    expect(topic?.demos).toEqual([]);
    expect(topic?.questions).toEqual([]);
  });
});

describe("mapCard / mapDemo / mapQuestion", () => {
  it("卡片脏字段归一化：answer_steps 只留字符串，空文本转 null", () => {
    const card = mapCard({
      key: "408card/x",
      subject_key: "data-structure",
      chapter: 3,
      question: "循环队列判满？",
      answer_steps: ["(rear + 1) % n == front", 42, null, "  "],
      pitfall: "   ",
      mnemonic: "模 n 余 1",
      star: null,
      demo_key: "",
      knowledge_point_key: null,
    });

    expect(card.answerSteps).toEqual(["(rear + 1) % n == front"]);
    expect(card.pitfall).toBeNull();
    expect(card.mnemonic).toBe("模 n 余 1");
    expect(card.star).toBe(false);
    expect(card.demoKey).toBeNull();
    expect(card.knowledgePointKey).toBeNull();
  });

  it("演示行缺 steps 或帧数时兜底为 0", () => {
    const demo = mapDemo({
      key: "demo-x",
      subject_key: "computer-network",
      title: "三次握手",
      description: null,
      frame_count: null as unknown as number,
      steps_count: null as unknown as number,
      knowledge_point_key: "beokayy-408/cn-05-03",
    });

    expect(demo.description).toBe("");
    expect(demo.frameCount).toBe(0);
    expect(demo.stepsCount).toBe(0);
  });

  it("题目 options / image_refs / knowledge_points 脏数据被过滤", () => {
    const question = mapQuestion(
      questionRow({
        options: [{ letter: "A", text: "甲" }, { letter: "", text: "乙" }, null, "丙"],
        image_refs: ["/content-images/x.png", 7],
        knowledge_points: [{ key: "beokayy-408/os-02-04", title: "死锁" }, { key: "", title: "x" }],
      }),
    );

    expect(question.options).toEqual([{ letter: "A", text: "甲" }]);
    expect(question.imageRefs).toEqual(["/content-images/x.png"]);
    expect(question.knowledgePoints).toEqual([{ key: "beokayy-408/os-02-04", title: "死锁" }]);
  });
});

function questionRow(overrides: Partial<Exam408TopicQuestionRow>): Exam408TopicQuestionRow {
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
    subject_key: "beokayy-408/operating-system",
    subject_title: "操作系统",
    knowledge_points: [],
    ...overrides,
  };
}
