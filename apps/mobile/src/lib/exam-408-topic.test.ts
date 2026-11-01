import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exam408TopicCounts,
  getExam408Topic,
  normalizeExam408Topic,
} from "./exam-408-topic";

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test/" }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const point = {
  key: "beokayy-408/cn-01-01",
  title: "计算机网络概述",
  summary: "体系结构 · 概述",
  body: ["第一段", "第二段"],
  questionCount: 5,
  tags: ["408"],
  subject: { key: "beokayy-408/computer-network", title: "计算机网络" },
  chapter: { key: "beokayy-408/cn-01", title: "计算机网络体系结构", chapterNumber: 1 },
};

describe("normalizeExam408Topic", () => {
  it("归一化四类关联内容（新/旧字段名都兜住）", () => {
    const topic = normalizeExam408Topic({
      point,
      articles: [
        {
          key: "cs408/network-overview",
          title: "网络概述精读",
          subject_key: "computer-network",
          chapter_title: "体系结构",
          chapter_order: "1",
          slug: "network-overview",
          exam_frequency: "3",
        },
        { key: "bad-no-slug", title: "缺 slug 的条目" },
      ],
      cards: [
        {
          key: "408card/cn-01-001",
          subjectKey: "computer-network",
          chapter: 1,
          question: "网络的三个关键特征？",
          answer_steps: ["互连", "自治", "独立功能"],
          pitfall: "把主从关系当自治",
          mnemonic: "",
          star: true,
          demo_key: null,
          knowledge_point_key: "beokayy-408/cn-01-01",
        },
        { key: "", question: "缺 key 的卡" },
      ],
      demos: [
        {
          key: "408card/demo-tcp",
          subjectKey: "computer-network",
          title: "TCP 三次握手",
          description: "逐帧看握手",
          frameCount: 6,
          stepsCount: 6,
          knowledgePointKey: "beokayy-408/cn-05-03",
        },
      ],
      questions: [
        {
          key: "beokayy-408/2010-33",
          id: "2010-33",
          year: 2010,
          number: 33,
          type: "choice",
          subject: { key: "beokayy-408/computer-network", title: "计算机网络" },
          points: 2,
          body: "题干",
          stem: "题干",
          options: [
            { letter: "A", text: "选项一" },
            { letter: "", text: "缺字母" },
          ],
          answerText: "A",
          answerLetter: "A",
          tags: ["408"],
          knowledgePoints: [{ key: "beokayy-408/cn-01-01", title: "计算机网络概述" }],
        },
        { key: "missing-id" },
      ],
    });

    expect(topic?.point).toMatchObject({
      key: "beokayy-408/cn-01-01",
      title: "计算机网络概述",
      questionCount: 5,
      chapter: { chapterNumber: 1 },
    });
    expect(topic?.articles).toHaveLength(1);
    expect(topic?.articles[0]).toMatchObject({
      slug: "network-overview",
      subjectKey: "computer-network",
      chapter: "体系结构",
      chapterOrder: 1,
      examFrequency: 3,
    });
    expect(topic?.cards).toHaveLength(1);
    expect(topic?.cards[0]).toMatchObject({
      key: "408card/cn-01-001",
      answerSteps: ["互连", "自治", "独立功能"],
      pitfall: "把主从关系当自治",
      mnemonic: null,
      star: true,
      demoKey: null,
      knowledgePointKey: "beokayy-408/cn-01-01",
    });
    expect(topic?.demos).toHaveLength(1);
    expect(topic?.demos[0]).toMatchObject({ key: "408card/demo-tcp", stepsCount: 6 });
    expect(topic?.questions).toHaveLength(1);
    expect(topic?.questions[0]).toMatchObject({
      id: "2010-33",
      year: 2010,
      options: [{ letter: "A", text: "选项一" }],
      answerLetter: "A",
    });
    expect(exam408TopicCounts(topic)).toEqual({ articles: 1, cards: 1, demos: 1 });
  });

  it("缺 point.key/title 或非对象时返回 null", () => {
    expect(normalizeExam408Topic(null)).toBeNull();
    expect(normalizeExam408Topic("bad")).toBeNull();
    expect(normalizeExam408Topic({ point: { key: "x" } })).toBeNull();
    expect(normalizeExam408Topic({ point, articles: "bad", cards: null, demos: 1 })).toMatchObject({
      point: { key: "beokayy-408/cn-01-01" },
      articles: [],
      cards: [],
      demos: [],
      questions: [],
    });
  });

  it("空 topic 的计数为 0", () => {
    expect(exam408TopicCounts(null)).toEqual({ articles: 0, cards: 0, demos: 0 });
  });
});

describe("getExam408Topic", () => {
  it("拒绝非 408 key，不发请求", async () => {
    await expect(getExam408Topic("algorithms/ds")).rejects.toThrow("408 知识点 key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("成功时返回归一化结果", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ point, articles: [], cards: [], demos: [], questions: [] }));
    const topic = await getExam408Topic("beokayy-408/cn-01-01");
    expect(topic.point.title).toBe("计算机网络概述");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("key=beokayy-408%2Fcn-01-01");
  });

  it("非 2xx 抛服务端错误文案", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "知识点不存在" }, 404));
    await expect(getExam408Topic("beokayy-408/missing")).rejects.toThrow("知识点不存在");
  });

  it("结构不可识别时抛错（入口区块静默降级）", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ point: null }));
    await expect(getExam408Topic("beokayy-408/cn-01-01")).rejects.toThrow("知识点聚合数据不可用");
  });

  it("网络异常抛友好文案", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(getExam408Topic("beokayy-408/cn-01-01")).rejects.toThrow("网络不可用");
  });
});