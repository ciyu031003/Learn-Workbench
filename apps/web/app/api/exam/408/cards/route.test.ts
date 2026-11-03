import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/exam-408-cards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exam-408-cards")>();
  return {
    ...actual,
    loadCardDetail: vi.fn(),
    loadCardQueue: vi.fn(),
    loadCardStats: vi.fn(),
    gradeCard: vi.fn(),
  };
});

import { currentUserId } from "@/lib/session";
import {
  CardNotFoundError,
  gradeCard,
  loadCardDetail,
  loadCardQueue,
  loadCardStats,
} from "@/lib/exam-408-cards";
import { GET, POST } from "./route";

const userMock = vi.mocked(currentUserId);
const detailMock = vi.mocked(loadCardDetail);
const queueMock = vi.mocked(loadCardQueue);
const statsMock = vi.mocked(loadCardStats);
const gradeMock = vi.mocked(gradeCard);

function request(url: string) {
  return new Request(url);
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/exam/408/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const queuePayload = {
  mode: "queue" as const,
  scope: "queue" as const,
  generatedAt: "2026-11-01T10:00:00.000Z",
  cards: [
    {
      key: "408card/ds-01-001",
      subjectKey: "data-structure",
      chapter: 1,
      question: "线性表的基本特征是什么？",
      answerSteps: ["有限序列", "逻辑相邻"],
      pitfall: null,
      mnemonic: null,
      star: true,
      demoKey: null,
      knowledgePointKey: null,
      state: "new" as const,
      dueAt: null,
      lapses: 0,
    },
  ],
  stats: { newCount: 529, dueCount: 0, doneToday: 0, streak: 0 },
};

const gradePayload = {
  ok: true as const,
  cardKey: "408card/ds-01-001",
  rating: "good" as const,
  isCorrect: true,
  state: "learning" as const,
  dueAt: "2026-11-01T10:10:00.000Z",
  intervalDays: 0,
  streak: 1,
  lapses: 0,
  doneToday: 1,
  remainingDue: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  userMock.mockResolvedValue("u-1");
});

describe("GET /api/exam/408/cards", () => {
  it("未登录返回 401，不查库", async () => {
    userMock.mockResolvedValueOnce(null);
    const response = await GET(request("http://localhost/api/exam/408/cards?mode=queue"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "请先登录", code: "unauthorized" });
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("默认返回队列，subject 缺省传 null、limit 不传", async () => {
    queueMock.mockResolvedValueOnce(queuePayload);
    const response = await GET(request("http://localhost/api/exam/408/cards"));
    expect(response.status).toBe(200);
    expect(queueMock).toHaveBeenCalledWith("u-1", { subject: null, limit: undefined, scope: "queue" });
    const payload = await response.json();
    expect(payload.cards[0]).toMatchObject({ key: "408card/ds-01-001", state: "new", star: true });
    expect(payload.stats).toEqual({ newCount: 529, dueCount: 0, doneToday: 0, streak: 0 });
  });

  it("透传 subject / limit / scope（易错本）", async () => {
    queueMock.mockResolvedValueOnce({ ...queuePayload, scope: "mistake" });
    const response = await GET(
      request("http://localhost/api/exam/408/cards?mode=queue&subject=operating-system&limit=12&scope=mistake"),
    );
    expect(response.status).toBe(200);
    expect(queueMock).toHaveBeenCalledWith("u-1", {
      subject: "operating-system",
      limit: 12,
      scope: "mistake",
    });
  });

  it("mode=stats 走统计分支", async () => {
    statsMock.mockResolvedValueOnce({
      mode: "stats",
      generatedAt: "2026-11-01T10:00:00.000Z",
      totals: { cards: 529, newCount: 529, dueCount: 0, learningCount: 0, masteredCount: 0 },
      today: { done: 0, correct: 0, wrong: 0, accuracy: null },
      streak: 0,
      subjects: [],
    });
    const response = await GET(request("http://localhost/api/exam/408/cards?mode=stats&subject=data-structure"));
    expect(response.status).toBe(200);
    expect(statsMock).toHaveBeenCalledWith("u-1", { subject: "data-structure" });
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("查询异常返回 500 结构化错误", async () => {
    queueMock.mockRejectedValueOnce(new Error("boom"));
    const response = await GET(request("http://localhost/api/exam/408/cards?mode=queue"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "刷卡队列加载失败", code: "internal_error" });
  });
});

describe("GET /api/exam/408/cards?mode=card", () => {
  const cardPayload = {
    card: {
      key: "408card/ds-01-001",
      subjectKey: "data-structure",
      chapter: 1,
      question: "线性表的基本特征是什么？",
      answerSteps: ["有限序列", "逻辑相邻"],
      pitfall: null,
      mnemonic: null,
      star: true,
      demoKey: null,
      knowledgePointKey: "beokayy-408/ds-01-01",
    },
    schedule: { state: "due" as const, dueAt: "2026-11-01T10:00:00.000Z", lapses: 1 },
  };

  it("缺 cardKey / 超长返回 400，不查库", async () => {
    const missing = await GET(request("http://localhost/api/exam/408/cards?mode=card"));
    expect(missing.status).toBe(400);
    const tooLong = await GET(
      request("http://localhost/api/exam/408/cards?mode=card&cardKey=" + "x".repeat(121)),
    );
    expect(tooLong.status).toBe(400);
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("未登录也能读卡片内容（schedule 为 null）", async () => {
    userMock.mockResolvedValueOnce(null);
    detailMock.mockResolvedValueOnce({ ...cardPayload, schedule: null });
    const response = await GET(
      request("http://localhost/api/exam/408/cards?mode=card&cardKey=408card%2Fds-01-001"),
    );
    expect(response.status).toBe(200);
    expect(detailMock).toHaveBeenCalledWith("408card/ds-01-001", null);
    expect(await response.json()).toEqual({ mode: "card", ...cardPayload, schedule: null });
  });

  it("登录时透传 userId 并返回个人调度状态 + 私有缓存头", async () => {
    detailMock.mockResolvedValueOnce(cardPayload);
    const response = await GET(
      request("http://localhost/api/exam/408/cards?mode=card&cardKey=408card%2Fds-01-001"),
    );
    expect(response.status).toBe(200);
    expect(detailMock).toHaveBeenCalledWith("408card/ds-01-001", "u-1");
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual({ mode: "card", ...cardPayload });
  });

  it("卡不存在返回 404", async () => {
    detailMock.mockResolvedValueOnce(null);
    const response = await GET(
      request("http://localhost/api/exam/408/cards?mode=card&cardKey=408card%2Fmissing"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "速记卡不存在", code: "not_found" });
  });

  it("查询异常返回 500 结构化错误", async () => {
    detailMock.mockRejectedValueOnce(new Error("boom"));
    const response = await GET(
      request("http://localhost/api/exam/408/cards?mode=card&cardKey=408card%2Fds-01-001"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "速记卡加载失败", code: "internal_error" });
  });
});

describe("POST /api/exam/408/cards", () => {
  it("未登录返回 401", async () => {
    userMock.mockResolvedValueOnce(null);
    const response = await POST(postRequest({ cardKey: "408card/ds-01-001", rating: "good" }));
    expect(response.status).toBe(401);
    expect(gradeMock).not.toHaveBeenCalled();
  });

  it("rating 不在白名单 / 缺 cardKey 返回 400", async () => {
    const invalidRating = await POST(postRequest({ cardKey: "408card/ds-01-001", rating: "perfect" }));
    expect(invalidRating.status).toBe(400);
    const missingKey = await POST(postRequest({ rating: "good" }));
    expect(missingKey.status).toBe(400);
    const notJson = await POST(
      new Request("http://localhost/api/exam/408/cards", { method: "POST", body: "not-json" }),
    );
    expect(notJson.status).toBe(400);
    expect(gradeMock).not.toHaveBeenCalled();
  });

  it("卡不存在返回 404", async () => {
    gradeMock.mockRejectedValueOnce(new CardNotFoundError("408card/missing"));
    const response = await POST(postRequest({ cardKey: "408card/missing", rating: "again" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "卡片不存在", code: "not_found" });
  });

  it("提交评级：trim clientId 后交给 gradeCard，并原样返回结果", async () => {
    gradeMock.mockResolvedValueOnce(gradePayload);
    const response = await POST(
      postRequest({ cardKey: " 408card/ds-01-001 ", rating: "good", clientId: " c-1 " }),
    );
    expect(response.status).toBe(200);
    expect(gradeMock).toHaveBeenCalledWith("u-1", {
      cardKey: "408card/ds-01-001",
      rating: "good",
      clientId: "c-1",
    });
    expect(await response.json()).toEqual(gradePayload);
  });

  it("不带 clientId 时传 null（不写幂等键）", async () => {
    gradeMock.mockResolvedValueOnce(gradePayload);
    const response = await POST(postRequest({ cardKey: "408card/ds-01-001", rating: "easy" }));
    expect(response.status).toBe(200);
    expect(gradeMock).toHaveBeenCalledWith("u-1", {
      cardKey: "408card/ds-01-001",
      rating: "easy",
      clientId: null,
    });
  });

  it("写库异常返回 500", async () => {
    gradeMock.mockRejectedValueOnce(new Error("pg down"));
    const response = await POST(postRequest({ cardKey: "408card/ds-01-001", rating: "hard" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "刷卡记录保存失败", code: "internal_error" });
  });
});
