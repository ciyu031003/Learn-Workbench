import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchQuestionDetail,
  normalizeQuestionDetail,
  normalizeQuestionOptions,
} from "./exam-408-question";

/**
 * 408 真题详情数据层单测（P3-1）。
 *
 * 契约：GET /api/exam/408/question?key=<encodeURIComponent(key)>（公开，不带 Authorization）。
 * 这里既钉住"理想响应"的逐字段映射，也钉住脏数据兜底：
 * 缺字段、snake_case 旧字段、options 里混 null/重复字母、200 却不是 JSON ——
 * 详情页不能因为这些白屏或显示 NaN。
 */

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test/" }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const question = {
  key: "beokayy-408/2021/12",
  id: "408-2021-12",
  year: 2021,
  number: 12,
  type: "choice",
  subject: { key: "data-structure", title: "数据结构" },
  points: 2,
  body: "题干 markdown 原文",
  stem: "下列关于线性表的说法，正确的是（ ）。",
  options: [
    { letter: "A", text: "顺序表插入不需要移动元素" },
    { letter: "B", text: "链表支持随机访问" },
    { letter: "C", text: "顺序表支持随机访问" },
    { letter: "D", text: "以上都不对" },
  ],
  answerText: "顺序表按下标访问是 O(1)，链表需要从头遍历。",
  answerLetter: "C",
  imageRefs: ["/content-images/408/2021-12.png"],
  answerImageRefs: [],
  videoUrl: "https://example.com/v/2021-12",
  tags: ["线性表", "随机访问"],
  knowledgePoints: [{ key: "yuanabd-408/beokayy-408/ds-02-01", title: "线性表的存储结构" }],
};

const payload = { question };

describe("normalizeQuestionOptions", () => {
  it("保留合法项并丢弃 null / 非对象 / 缺字段 / 重复字母", () => {
    expect(
      normalizeQuestionOptions([
        { letter: "A", text: " 甲 " },
        null,
        42,
        { letter: "", text: "无字母" },
        { letter: "B", text: "   " },
        { letter: "A", text: "重复字母" },
        { letter: "C", text: "丙" },
      ]),
    ).toEqual([
      { letter: "A", text: "甲" },
      { letter: "C", text: "丙" },
    ]);
  });

  it("非数组给空数组", () => {
    expect(normalizeQuestionOptions(undefined)).toEqual([]);
    expect(normalizeQuestionOptions({ letter: "A", text: "甲" })).toEqual([]);
  });
});

describe("normalizeQuestionDetail", () => {
  it("完整响应逐字段映射", () => {
    expect(normalizeQuestionDetail(payload)).toEqual(question);
  });

  it("缺 id / 数字字段非法时用 key 与 0 兜底", () => {
    const normalized = normalizeQuestionDetail({
      question: { ...question, id: undefined, year: "2021", number: -3, points: "2.5分" },
    });
    expect(normalized?.id).toBe(question.key);
    expect(normalized?.year).toBe(2021);
    expect(normalized?.number).toBe(0);
    expect(normalized?.points).toBe(0);
  });

  it("snake_case 旧字段也能读", () => {
    const normalized = normalizeQuestionDetail({
      question: {
        key: "k",
        subject_key: "computer-network",
        subject_title: "计算机网络",
        answer_text: "答案",
        answer_letter: "B",
        image_refs: ["/a.png"],
        answer_image_refs: ["/b.png"],
        video_url: "https://example.com/v",
        knowledge_points: [{ key: "yuanabd-408/x", title: "知识点" }],
      },
    });
    expect(normalized).toMatchObject({
      key: "k",
      subject: { key: "computer-network", title: "计算机网络" },
      answerText: "答案",
      answerLetter: "B",
      imageRefs: ["/a.png"],
      answerImageRefs: ["/b.png"],
      videoUrl: "https://example.com/v",
      knowledgePoints: [{ key: "yuanabd-408/x", title: "知识点" }],
    });
  });

  it("type 只认 comprehensive，其余（含空值/脏值）按 choice", () => {
    expect(normalizeQuestionDetail({ question: { ...question, type: "comprehensive" } })?.type).toBe(
      "comprehensive",
    );
    expect(normalizeQuestionDetail({ question: { ...question, type: "essay" } })?.type).toBe("choice");
    expect(normalizeQuestionDetail({ question: { ...question, type: undefined } })?.type).toBe("choice");
  });

  it("缺 question / 缺 key 返回 null", () => {
    expect(normalizeQuestionDetail(null)).toBeNull();
    expect(normalizeQuestionDetail({})).toBeNull();
    expect(normalizeQuestionDetail({ question: null })).toBeNull();
    expect(normalizeQuestionDetail({ question: { ...question, key: "  " } })).toBeNull();
  });

  it("知识点头图缺 title 时用 key 兜底，并丢弃无 key 项", () => {
    const normalized = normalizeQuestionDetail({
      question: {
        ...question,
        knowledgePoints: [{ key: "yuanabd-408/a" }, { title: "没有 key" }, null, { key: "yuanabd-408/a", title: "重复" }],
      },
    });
    expect(normalized?.knowledgePoints).toEqual([{ key: "yuanabd-408/a", title: "yuanabd-408/a" }]);
  });
});

describe("fetchQuestionDetail", () => {
  it("公开请求：不带 Authorization，key 经 encodeURIComponent", async () => {
    fetchMock.mockResolvedValue(jsonResponse(payload));
    const result = await fetchQuestionDetail("beokayy-408/2021/12");
    expect(result.failure).toBeNull();
    expect(result.detail?.key).toBe(question.key);
    const [url, init] = fetchMock.mock.calls[0] as [string, unknown];
    expect(url).toBe(
      "https://api.test/api/exam/408/question?key=beokayy-408%2F2021%2F12",
    );
    expect(init).toBeUndefined();
  });

  it("key 为空或超 200 字符直接判 invalid，不发明请求", async () => {
    expect(await fetchQuestionDetail("  ")).toEqual({ detail: null, failure: "invalid" });
    expect(await fetchQuestionDetail("k".repeat(201))).toEqual({ detail: null, failure: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400/404/5xx 分别归类", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "key 必须是 408 真题 key" }, 400));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "invalid" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "真题不存在" }, 404));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "not-found" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "server" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "请先登录" }, 401));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "server" });
  });

  it("网络异常归一成 offline", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "offline" });
  });

  it("200 但结构不认识 / body 不是 JSON 都按 server 处理", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ question: null }));
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "server" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    expect(await fetchQuestionDetail("k")).toEqual({ detail: null, failure: "server" });
  });
});
