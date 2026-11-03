import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_CARD_STATS,
  EMPTY_RATING_OUTBOX,
  applyLocalRatingStats,
  canSubmitRating,
  cardProgress,
  clampCardIndex,
  classifyRatingFailure,
  dequeueRating,
  enqueueRating,
  fetchCardDetail,
  fetchCardQueue,
  fetchCardStatsBoard,
  flipActionLabel,
  flipPhaseOf,
  flushRatingOutbox,
  formatAccuracy,
  makeRatingOp,
  mergeCardStatsWithPending,
  mergeRatingResultStats,
  nextCardIndex,
  nextFlipState,
  normalizeAnswerSteps,
  normalizeCardDetail,
  normalizeCardQueue,
  normalizeCardSchedule,
  normalizeCardStatsBoard,
  normalizeDrillCard,
  normalizeRatingResult,
  pendingRatingCount,
  queueCacheKey,
  progressLabel,
  ratingDirectionOf,
  resolveDrillLayout,
  subjectChipDisplay,
  ratingHint,
  ratingLabel,
  ratingVisual,
  removeCardFromQueue,
  saveCachedQueue,
  loadCachedQueue,
  saveRatingOutbox,
  loadRatingOutbox,
  subjectStatToCardStats,
  submitCardRating,
  toggleFlipPhase,
} from "./exam-408-cards";

/**
 * 408 刷卡数据层单测（v1.55）。
 *
 * 契约以 task-15 的 Web 实现为准（2026-11-01 ds-body 定稿）：
 *   GET ?mode=queue → { mode, generatedAt, cards[], stats{newCount,dueCount,doneToday,streak} }
 *   GET ?mode=stats → { totals, today{done,correct,wrong,accuracy}, streak, subjects[4] }
 *   POST { cardKey, rating, clientId } → { ok, cardKey, state, dueAt, doneToday, remainingDue, streak, ... }
 * 这里既钉住"理想响应"，也钉住脏数据/旧字段/错误体的兜底行为 —— 线上 500 错误体
 * 被当 200 解析过一次就会白屏，所以容错必须靠测试守住。
 */

const state = vi.hoisted(() => ({ token: "tok" as string | null }));
const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test/" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => state },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  state.token = "tok";
  storage.clear();
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

const card = {
  key: "408card/ds-01-001",
  subjectKey: "data-structure",
  chapter: 1,
  question: "线性表的基本特征是什么？",
  answerSteps: ["有限序列", "逻辑相邻", "同型元素"],
  pitfall: "把顺序表当逻辑结构",
  mnemonic: "有限、有序、同型",
  star: true,
  demoKey: null,
  knowledgePointKey: "beokayy-408/ds-02-01",
  state: "new",
  dueAt: null,
};

const queuePayload = {
  mode: "queue",
  generatedAt: "2026-11-01T10:00:00.000Z",
  cards: [card],
  stats: { newCount: 529, dueCount: 3, doneToday: 12, streak: 5 },
};

const statsPayload = {
  mode: "stats",
  generatedAt: "2026-11-01T10:00:00.000Z",
  totals: { cards: 529, newCount: 520, dueCount: 0, learningCount: 9, masteredCount: 0 },
  today: { done: 12, correct: 9, wrong: 3, accuracy: 0.75 },
  streak: 3,
  subjects: [
    { subjectKey: "data-structure", title: "数据结构", cards: 191, newCount: 190, dueCount: 0, learningCount: 1, masteredCount: 0, doneToday: 5, correctToday: 4, accuracy: 0.8 },
    { subjectKey: "computer-organization", title: "计算机组成原理", cards: 150, newCount: 148, dueCount: 2, learningCount: 2, masteredCount: 0, doneToday: 4, correctToday: 3, accuracy: 0.75 },
    { subjectKey: "operating-system", title: "操作系统", cards: 100, newCount: 99, dueCount: 1, learningCount: 1, masteredCount: 0, doneToday: 3, correctToday: 2, accuracy: 0.6667 },
    { subjectKey: "computer-network", title: "计算机网络", cards: 88, newCount: 88, dueCount: 0, learningCount: 0, masteredCount: 0, doneToday: 0, correctToday: 0, accuracy: null },
  ],
};

const ratingPayload = {
  ok: true,
  cardKey: "408card/ds-01-001",
  rating: "good",
  isCorrect: true,
  state: "learning",
  dueAt: "2026-11-01T10:10:00.000Z",
  intervalDays: 0,
  streak: 6,
  lapses: 0,
  doneToday: 13,
  remainingDue: 2,
};

describe("normalizeAnswerSteps", () => {
  it("数组原样保留并丢弃空白项", () => {
    expect(normalizeAnswerSteps([" A ", "", "B"])).toEqual(["A", "B"]);
  });

  it("脏字符串按换行/分号拆分，数组元素内部换行也展开", () => {
    expect(normalizeAnswerSteps("一线；二线\n三线")).toEqual(["一线", "二线", "三线"]);
    expect(normalizeAnswerSteps(["一步\n两步"])).toEqual(["一步", "两步"]);
  });

  it("非字符串/非数组给空数组", () => {
    expect(normalizeAnswerSteps(null)).toEqual([]);
    expect(normalizeAnswerSteps(42)).toEqual([]);
  });
});

describe("normalizeDrillCard", () => {
  it("完整卡片字段逐一映射", () => {
    expect(normalizeDrillCard(card)).toEqual({
      key: "408card/ds-01-001",
      subjectKey: "data-structure",
      chapter: 1,
      question: "线性表的基本特征是什么？",
      answerSteps: ["有限序列", "逻辑相邻", "同型元素"],
      pitfall: "把顺序表当逻辑结构",
      mnemonic: "有限、有序、同型",
      star: true,
      demoKey: "",
      knowledgePointKey: "beokayy-408/ds-02-01",
      state: "new",
      dueAt: null,
    });
  });

  it("null 的 pitfall/mnemonic/dueAt 归一成空串与 null", () => {
    const normalized = normalizeDrillCard({ ...card, pitfall: null, mnemonic: null, star: false, dueAt: "2026-11-01T10:10:00.000Z" });
    expect(normalized?.pitfall).toBe("");
    expect(normalized?.mnemonic).toBe("");
    expect(normalized?.star).toBe(false);
    expect(normalized?.dueAt).toBe("2026-11-01T10:10:00.000Z");
  });

  it("缺 key 或缺题干不算卡片", () => {
    expect(normalizeDrillCard({ ...card, key: "" })).toBeNull();
    expect(normalizeDrillCard({ ...card, question: "" })).toBeNull();
    expect(normalizeDrillCard(null)).toBeNull();
  });

  it("旧字段名（subject_key / answer_steps）也能读", () => {
    const normalized = normalizeDrillCard({ ...card, subjectKey: undefined, subject_key: "operating-system", answerSteps: undefined, answer_steps: ["旧字段"] });
    expect(normalized?.subjectKey).toBe("operating-system");
    expect(normalized?.answerSteps).toEqual(["旧字段"]);
  });
});

describe("normalizeCardQueue", () => {
  it("标准响应归一化", () => {
    expect(normalizeCardQueue(queuePayload)).toMatchObject({
      generatedAt: "2026-11-01T10:00:00.000Z",
      stats: { newCount: 529, dueCount: 3, doneToday: 12, streak: 5 },
    });
    expect(normalizeCardQueue(queuePayload)?.cards).toHaveLength(1);
  });

  it("空队列是合法响应（today 刷完）", () => {
    expect(normalizeCardQueue({ cards: [], stats: { newCount: 0, dueCount: 0, doneToday: 0, streak: 0 } })?.cards).toEqual([]);
  });

  it("结构不认识时返回 null（调用方回落缓存）", () => {
    expect(normalizeCardQueue({ error: "刷卡记录保存失败" })).toBeNull();
    expect(normalizeCardQueue("oops")).toBeNull();
    expect(normalizeCardQueue(null)).toBeNull();
  });

  it("缺 stats 时给全 0，脏子卡被过滤掉", () => {
    const normalized = normalizeCardQueue({ cards: [card, { key: "x" }] });
    expect(normalized?.cards).toHaveLength(1);
    expect(normalized?.stats).toEqual(EMPTY_CARD_STATS);
  });
});

describe("normalizeCardStatsBoard", () => {
  it("统计板四行科目原样读出", () => {
    const board = normalizeCardStatsBoard(statsPayload);
    expect(board?.subjects).toHaveLength(4);
    expect(board?.subjects[1]).toMatchObject({ subjectKey: "computer-organization", dueCount: 2, accuracy: 0.75 });
    expect(board?.today).toEqual({ done: 12, correct: 9, wrong: 3, accuracy: 0.75 });
    expect(board?.totals.cards).toBe(529);
    expect(board?.streak).toBe(3);
  });

  it("accuracy 夹到 0~1，缺失给 null", () => {
    const board = normalizeCardStatsBoard({ ...statsPayload, today: { done: 0, correct: 0, wrong: 0, accuracy: null }, subjects: [] });
    expect(board?.today.accuracy).toBeNull();
    expect(normalizeCardStatsBoard({ today: { accuracy: 1.4 } })?.today.accuracy).toBe(1);
  });

  it("错误体（无 totals/today/subjects/streak）返回 null", () => {
    expect(normalizeCardStatsBoard({ error: "请先登录" })).toBeNull();
  });
});

describe("normalizeRatingResult", () => {
  it("成功体映射（isCorrect 由服务端给）", () => {
    expect(normalizeRatingResult(ratingPayload)).toMatchObject({
      cardKey: "408card/ds-01-001",
      rating: "good",
      state: "learning",
      doneToday: 13,
      remainingDue: 2,
      streak: 6,
    });
  });

  it("ok:false 或缺 cardKey 视为失败", () => {
    expect(normalizeRatingResult({ ...ratingPayload, ok: false })).toBeNull();
    expect(normalizeRatingResult({ ...ratingPayload, cardKey: "" })).toBeNull();
  });

  it("rating 脏值退回 good，isCorrect 按 rating 推断", () => {
    const result = normalizeRatingResult({ cardKey: "k", rating: "unknown", ok: true });
    expect(result?.rating).toBe("good");
    expect(result?.isCorrect).toBe(true);
  });
});

describe("游标与进度", () => {
  it("nextCardIndex 到末尾返回 total", () => {
    expect(nextCardIndex(0, 3)).toBe(1);
    expect(nextCardIndex(2, 3)).toBe(3);
    expect(nextCardIndex(0, 0)).toBe(0);
  });

  it("clampCardIndex 夹在 0..total", () => {
    expect(clampCardIndex(-2, 5)).toBe(0);
    expect(clampCardIndex(9, 5)).toBe(5);
    expect(clampCardIndex(Number.NaN, 5)).toBe(0);
  });

  it("cardProgress 给出百分比", () => {
    expect(cardProgress(2, 4)).toEqual({ done: 2, total: 4, percent: 50 });
    expect(cardProgress(0, 0)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("统计合并", () => {
  it("评完一张：今日 +1；非 again 时待复习 -1，again 保持", () => {
    expect(applyLocalRatingStats({ newCount: 1, dueCount: 4, doneToday: 2, streak: 3 }, "good")).toEqual({ newCount: 1, dueCount: 3, doneToday: 3, streak: 3 });
    expect(applyLocalRatingStats({ newCount: 1, dueCount: 4, doneToday: 2, streak: 3 }, "again")).toEqual({ newCount: 1, dueCount: 4, doneToday: 3, streak: 3 });
  });

  it("服务端结果覆盖本地乐观值（doneToday/remainingDue/streak 取权威）", () => {
    const merged = mergeRatingResultStats(
      { newCount: 10, dueCount: 1, doneToday: 12, streak: 5 },
      { cardKey: "k", rating: "good", isCorrect: true, state: "review", dueAt: "", intervalDays: 1, streak: 6, doneToday: 13, remainingDue: 0 },
    );
    expect(merged).toEqual({ newCount: 10, dueCount: 0, doneToday: 13, streak: 6 });
  });

  it("评级的是新卡时本地 newCount -1（服务端不回 newCount）", () => {
    const merged = mergeRatingResultStats(
      { newCount: 10, dueCount: 0, doneToday: 0, streak: 0 },
      { cardKey: "k", rating: "good", isCorrect: true, state: "learning", dueAt: "", intervalDays: 0, streak: 1, doneToday: 1, remainingDue: 0 },
      "new",
    );
    expect(merged.newCount).toBe(9);
    expect(mergeRatingResultStats({ newCount: 0, dueCount: 0, doneToday: 0, streak: 0 }, { cardKey: "k", rating: "good", isCorrect: true, state: "review", dueAt: "", intervalDays: 1, streak: 1, doneToday: 1, remainingDue: 0 }, "due").newCount).toBe(0);
  });

  it("离线待同步数合并进今日计数，待复习夹到 0", () => {
    expect(mergeCardStatsWithPending({ newCount: 0, dueCount: 1, doneToday: 3, streak: 2 }, 2)).toEqual({ newCount: 0, dueCount: 0, doneToday: 5, streak: 2 });
    expect(mergeCardStatsWithPending({ newCount: 0, dueCount: 1, doneToday: 3, streak: 2 }, 0)).toEqual({ newCount: 0, dueCount: 1, doneToday: 3, streak: 2 });
  });

  it("科目行转队列口径统计", () => {
    const subject = normalizeCardStatsBoard(statsPayload)?.subjects[1];
    expect(subjectStatToCardStats(subject)).toEqual({ newCount: 148, dueCount: 2, doneToday: 4, streak: 0 });
    expect(subjectStatToCardStats(null)).toEqual(EMPTY_CARD_STATS);
  });

  it("百分比与评级文案", () => {
    expect(formatAccuracy(0.75)).toBe("75%");
    expect(formatAccuracy(0.6667)).toBe("67%");
    expect(formatAccuracy(null)).toBe("—");
    expect(ratingLabel("again")).toBe("忘记");
    expect(ratingLabel("hard")).toBe("模糊");
    expect(ratingLabel("good")).toBe("掌握");
    expect(ratingHint("again")).toBe("很快再见");
  });
});

describe("离线发件箱", () => {
  it("同一张卡只保留最后一次评级", () => {
    const a = makeRatingOp("card-a", "again", { clientId: "c1", now: 1000 });
    const b = makeRatingOp("card-a", "good", { clientId: "c2", now: 2000 });
    const outbox = enqueueRating(enqueueRating(EMPTY_RATING_OUTBOX, a), b);
    expect(pendingRatingCount(outbox)).toBe(1);
    expect(outbox.ops[0]).toMatchObject({ cardKey: "card-a", rating: "good", clientId: "c2" });
    expect(outbox.ops[0].queuedAt).toBe(new Date(2000).toISOString());
  });

  it("不同卡按入队顺序排列，出队按 opId", () => {
    const a = makeRatingOp("card-a", "good", { clientId: "c1" });
    const b = makeRatingOp("card-b", "hard", { clientId: "c2" });
    const outbox = enqueueRating(enqueueRating(EMPTY_RATING_OUTBOX, a), b);
    expect(outbox.ops.map((op) => op.cardKey)).toEqual(["card-a", "card-b"]);
    expect(pendingRatingCount(dequeueRating(outbox, "c1"))).toBe(1);
  });

  it("失败分类：网络/401/5xx/429 重试，其余 4xx 丢弃", () => {
    expect(classifyRatingFailure(0)).toBe("retry");
    expect(classifyRatingFailure(401)).toBe("retry");
    expect(classifyRatingFailure(500)).toBe("retry");
    expect(classifyRatingFailure(429)).toBe("retry");
    expect(classifyRatingFailure(400)).toBe("drop");
    expect(classifyRatingFailure(404)).toBe("drop");
  });

  it("缓存 key 按科目隔离（空科目走全局 key）", () => {
    expect(queueCacheKey("data-structure")).toBe("lwb.exam408.cards.queue.v1:data-structure");
    expect(queueCacheKey("  ")).toBe("lwb.exam408.cards.queue.v1");
  });

  it("发件箱持久化往返（损坏数据回落空队列）", async () => {
    const outbox = enqueueRating(EMPTY_RATING_OUTBOX, makeRatingOp("card-a", "good", { clientId: "c1" }));
    await saveRatingOutbox(outbox);
    expect(await loadRatingOutbox()).toEqual(outbox);
    storage.set("lwb.exam408.cards.outbox.v1", "{not json");
    expect(await loadRatingOutbox()).toEqual(EMPTY_RATING_OUTBOX);
  });

  it("队列缓存往返（空队列也会缓存，离线时不至于被判成没有缓存）", async () => {
    const queue = normalizeCardQueue(queuePayload)!;
    await saveCachedQueue("data-structure", queue);
    expect(await loadCachedQueue("data-structure")).toMatchObject({ stats: { doneToday: 12 } });
    await saveCachedQueue("data-structure", { ...queue, cards: [] });
    expect((await loadCachedQueue("data-structure"))?.cards).toEqual([]);
    // 没写过的科目仍然返回 null（与"空队列"区分）
    expect(await loadCachedQueue("computer-network")).toBeNull();
  });

  it("removeCardFromQueue 只摘掉指定的卡，统计保持不变", () => {
    const queue = normalizeCardQueue({ ...queuePayload, cards: [card, { ...card, key: "408card/ds-01-002" }] })!;
    const trimmed = removeCardFromQueue(queue, "408card/ds-01-001");
    expect(trimmed.cards.map((item) => item.key)).toEqual(["408card/ds-01-002"]);
    expect(trimmed.stats).toEqual(queue.stats);
    // 不存在的 key 原样返回（避免无谓重写）
    expect(removeCardFromQueue(trimmed, "408card/none")).toBe(trimmed);
  });
});

describe("网络出口", () => {
  it("未登录直接返回 unauthorized，不发明请求", async () => {
    state.token = null;
    expect(await fetchCardQueue()).toEqual({ queue: null, failure: "unauthorized" });
    expect(await fetchCardStatsBoard()).toEqual({ board: null, failure: "unauthorized" });
    expect(await submitCardRating({ cardKey: "k", rating: "good", clientId: "c" })).toEqual({ ok: false, retryable: true, result: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("队列请求带 subject 与 limit，并带 Bearer 头", async () => {
    fetchMock.mockResolvedValue(jsonResponse(queuePayload));
    const result = await fetchCardQueue("data-structure", 20);
    expect(result.queue?.cards).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/exam/408/cards?mode=queue&subject=data-structure&limit=20");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("401 归一成 unauthorized，网络异常归一成 offline", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "请先登录" }, 401));
    expect(await fetchCardQueue()).toEqual({ queue: null, failure: "unauthorized" });
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    expect(await fetchCardQueue()).toEqual({ queue: null, failure: "offline" });
  });

  it("200 但结构不认识按 server 失败（回落到缓存）", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "刷卡记录保存失败" }));
    expect(await fetchCardQueue()).toEqual({ queue: null, failure: "server" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "x" }));
    expect(await fetchCardStatsBoard()).toEqual({ board: null, failure: "server" });
  });

  it("统计板请求解析四行科目", async () => {
    fetchMock.mockResolvedValue(jsonResponse(statsPayload));
    const result = await fetchCardStatsBoard();
    expect(result.board?.subjects.map((item) => item.subjectKey)).toEqual([
      "data-structure",
      "computer-organization",
      "operating-system",
      "computer-network",
    ]);
  });

  it("POST 成功体解析；401/400 分别标为可重试/不可重试", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ratingPayload));
    const ok = await submitCardRating({ cardKey: "408card/ds-01-001", rating: "good", clientId: "c1" });
    expect(ok).toMatchObject({ ok: true, retryable: false, result: { doneToday: 13 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string; headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/exam/408/cards");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ cardKey: "408card/ds-01-001", rating: "good", clientId: "c1" });

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "请先登录" }, 401));
    expect(await submitCardRating({ cardKey: "k", rating: "good", clientId: "c" })).toMatchObject({ ok: false, retryable: true });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "刷卡数据无效" }, 400));
    expect(await submitCardRating({ cardKey: "k", rating: "good", clientId: "c" })).toMatchObject({ ok: false, retryable: false });
  });

  it("flushRatingOutbox 顺序补发：成功出队、4xx 丢弃、遇到可重试失败停手", async () => {
    const a = makeRatingOp("card-a", "good", { clientId: "c1" });
    const b = makeRatingOp("card-b", "again", { clientId: "c2" });
    const c = makeRatingOp("card-c", "hard", { clientId: "c3" });
    await saveRatingOutbox(enqueueRating(enqueueRating(enqueueRating(EMPTY_RATING_OUTBOX, a), b), c));

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...ratingPayload, cardKey: "card-a" }))
      .mockResolvedValueOnce(jsonResponse({ error: "卡片不存在" }, 404))
      .mockRejectedValueOnce(new Error("offline"));

    const result = await flushRatingOutbox();
    expect(result).toEqual({ sent: 1, remaining: 1 });
    const left = await loadRatingOutbox();
    expect(left.ops.map((op) => op.cardKey)).toEqual(["card-c"]);
  });

  it("flushRatingOutbox 未登录时只报剩余数、不发请求", async () => {
    await saveRatingOutbox(enqueueRating(EMPTY_RATING_OUTBOX, makeRatingOp("card-a", "good", { clientId: "c1" })));
    state.token = null;
    expect(await flushRatingOutbox()).toEqual({ sent: 0, remaining: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("翻面状态机（P11 修复：双向可切换）", () => {
  it("flipPhaseOf 把 flipped 映射成题干/答案", () => {
    expect(flipPhaseOf(false)).toBe("question");
    expect(flipPhaseOf(true)).toBe("answer");
  });

  it("toggleFlipPhase 可反复来回：题干→答案→题干→答案", () => {
    let phase = flipPhaseOf(false);
    phase = toggleFlipPhase(phase);
    expect(phase).toBe("answer");
    phase = toggleFlipPhase(phase);
    expect(phase).toBe("question");
    phase = toggleFlipPhase(phase);
    expect(phase).toBe("answer");
  });

  it("动作文案跟着面走：题干「显示答案」/答案「隐藏答案」", () => {
    expect(flipActionLabel(false)).toBe("显示答案");
    expect(flipActionLabel(true)).toBe("隐藏答案");
    // 文案与状态机保持一致（避免出现「点背面还提示显示答案」的旧 bug 文案）
    expect(flipActionLabel(flipPhaseOf(true) === "answer")).toBe("隐藏答案");
  });

  it("只有答案面允许评级", () => {
    expect(canSubmitRating(false)).toBe(false);
    expect(canSubmitRating(true)).toBe(true);
  });
});

describe("评级视觉映射", () => {
  it("三档各自有文案/提示/图标/色档/滑出方向", () => {
    expect(ratingVisual("again")).toEqual({
      label: "忘记",
      hint: "很快再见",
      icon: "refresh",
      tone: "danger",
      direction: -1,
    });
    expect(ratingVisual("hard")).toMatchObject({ label: "模糊", tone: "warning", direction: 0 });
    expect(ratingVisual("good")).toMatchObject({ label: "掌握", tone: "success", direction: 1 });
  });

  it("ratingLabel / ratingHint 与 ratingVisual 同源（不再各写一套）", () => {
    for (const rating of ["again", "hard", "good"] as const) {
      expect(ratingLabel(rating)).toBe(ratingVisual(rating).label);
      expect(ratingHint(rating)).toBe(ratingVisual(rating).hint);
      expect(ratingDirectionOf(rating)).toBe(ratingVisual(rating).direction);
    }
  });

  it("未知评级按「掌握」兜底（服务端加了新档也不会白屏）", () => {
    expect(ratingVisual("unknown" as never).label).toBe("掌握");
    expect(ratingDirectionOf("unknown" as never)).toBe(1);
  });
});

describe("进度文案", () => {
  it("进行中显示「第 x / N 张」", () => {
    expect(progressLabel(0, 20, false)).toBe("第 1 / 20 张");
    expect(progressLabel(7, 20, false)).toBe("第 8 / 20 张");
    expect(progressLabel(19, 20, false)).toBe("第 20 / 20 张");
  });

  it("刷完不出现「第 21 / 20 张」", () => {
    expect(progressLabel(20, 20, true)).toBe("第 20 / 20 张 · 已完成");
    expect(progressLabel(20, 20, false)).toBe("第 20 / 20 张");
  });

  it("空队列与脏输入", () => {
    expect(progressLabel(0, 0, false)).toBe("暂无卡片");
    expect(progressLabel(-3, 5, false)).toBe("第 1 / 5 张");
    expect(progressLabel(Number.NaN, 5, false)).toBe("第 1 / 5 张");
  });
});

describe("resolveDrillLayout（P13 刷卡布局档位）", () => {
  it("常规大屏（iPhone 13 可用高 763）：非紧凑、卡片地板约占可用高 58%", () => {
    const layout = resolveDrillLayout(763);
    expect(layout.compact).toBe(false);
    expect(layout.cardMinHeight).toBe(443); // round(763 × 0.58)
    expect(layout.cardMinHeight / 763).toBeGreaterThan(0.55);
    expect(layout.ratingMinHeight).toBe(76);
    expect(layout.showStatsLine).toBe(true);
    expect(layout.gap).toBe(8);
  });

  it("小屏（iPhone SE 647）走紧凑档：藏统计小字、按钮 64、卡片约 52%", () => {
    const layout = resolveDrillLayout(647);
    expect(layout.compact).toBe(true);
    expect(layout.cardMinHeight).toBe(336); // round(647 × 0.52)
    expect(layout.ratingMinHeight).toBe(64);
    expect(layout.showStatsLine).toBe(false);
    expect(layout.gap).toBe(6);
  });

  it("极小屏（320×568 的可用高 544）：地板被「可用高 − chrome 预留」收住（244=544−300）", () => {
    const layout = resolveDrillLayout(544);
    expect(layout.cardMinHeight).toBe(244);
    expect(layout.cardMinHeight / 544).toBeGreaterThan(0.4);
  });

  it("档位切换边界：699 紧凑 / 700 常规", () => {
    expect(resolveDrillLayout(699).compact).toBe(true);
    expect(resolveDrillLayout(700).compact).toBe(false);
  });

  it("任何屏高下「卡片地板 + 固定 chrome(300)」都不超过可用高（评级按钮不会被挤出屏幕）", () => {
    for (const usable of [400, 480, 544, 647, 699, 700, 763, 926]) {
      const layout = resolveDrillLayout(usable);
      expect(layout.cardMinHeight + 300).toBeLessThanOrEqual(usable);
      expect(layout.cardMinHeight).toBeGreaterThan(0);
    }
  });

  it("脏值/0 兜底：按 700 档计算，不抛错也不返回 0 高", () => {
    for (const usable of [0, Number.NaN, Number.NEGATIVE_INFINITY, 10]) {
      const layout = resolveDrillLayout(usable);
      expect(layout.compact).toBe(false);
      expect(layout.cardMinHeight).toBe(400); // round(min(700×0.58, 700−300))
      expect(layout.ratingMinHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("subjectChipDisplay（P13 科目 chip 缩到文字宽度）", () => {
  it("有待复习数：主文案 + 数字", () => {
    expect(subjectChipDisplay("数据结构", 3)).toEqual({ label: "数据结构", dueText: "3", hasDue: true });
  });

  it("无待复习数：不渲染右侧数字", () => {
    expect(subjectChipDisplay("计算机网络", 0)).toEqual({ label: "计算机网络", dueText: "", hasDue: false });
  });

  it("脏值兜底：负数/NaN/小数都不显示或取整", () => {
    expect(subjectChipDisplay("操作系统", -2).hasDue).toBe(false);
    expect(subjectChipDisplay("操作系统", Number.NaN).hasDue).toBe(false);
    expect(subjectChipDisplay("操作系统", 2.7).dueText).toBe("2");
  });

  it("标题首尾空白被裁掉（避免 chip 宽度虚高）", () => {
    expect(subjectChipDisplay("  数据结构  ", 1).label).toBe("数据结构");
    expect(subjectChipDisplay("", 1).label).toBe("");
  });
});



describe("单卡详情（P3-1：GET cards?mode=card&cardKey=）", () => {
  const detailPayload = {
    mode: "card",
    card,
    schedule: { state: "due", dueAt: "2026-11-03T10:00:00.000Z", lapses: 2 },
  };

  it("schedule：new/due/scheduled 透传，脏枚举按 new，缺 lapses 归 0", () => {
    expect(normalizeCardSchedule({ state: "due", dueAt: "2026-11-03T10:00:00.000Z", lapses: "2" })).toEqual({
      state: "due",
      dueAt: "2026-11-03T10:00:00.000Z",
      lapses: 2,
    });
    expect(normalizeCardSchedule({ state: "scheduled", due_at: "2026-11-09T10:00:00.000Z" })).toEqual({
      state: "scheduled",
      dueAt: "2026-11-09T10:00:00.000Z",
      lapses: 0,
    });
    // 历史口径 learning/review 不是详情契约状态：统一按 new
    expect(normalizeCardSchedule({ state: "learning" })?.state).toBe("new");
    expect(normalizeCardSchedule(null)).toBeNull();
    expect(normalizeCardSchedule("due")).toBeNull();
  });

  it("完整详情：卡本体复用 normalizeDrillCard，schedule 单独解析", () => {
    const detail = normalizeCardDetail(detailPayload);
    expect(detail?.card.key).toBe(card.key);
    expect(detail?.card.answerSteps).toEqual(card.answerSteps);
    expect(detail?.schedule).toEqual({
      state: "due",
      dueAt: "2026-11-03T10:00:00.000Z",
      lapses: 2,
    });
  });

  it("未登录 schedule=null 仍返回卡片内容；pitfall/mnemonic null 归一成空串", () => {
    const detail = normalizeCardDetail({
      mode: "card",
      card: { ...card, pitfall: null, mnemonic: null, demoKey: null, knowledgePointKey: null },
      schedule: null,
    });
    expect(detail?.schedule).toBeNull();
    expect(detail?.card.pitfall).toBe("");
    expect(detail?.card.mnemonic).toBe("");
    expect(detail?.card.demoKey).toBe("");
    expect(detail?.card.knowledgePointKey).toBe("");
  });

  it("mode 不是 card / 缺 card / 卡不完整都判无效", () => {
    expect(normalizeCardDetail({ ...detailPayload, mode: "queue" })).toBeNull();
    expect(normalizeCardDetail({ mode: "card", schedule: null })).toBeNull();
    expect(normalizeCardDetail({ mode: "card", card: { ...card, key: "" } })).toBeNull();
    expect(normalizeCardDetail(null)).toBeNull();
  });

  it("未登录不发 Authorization；登录带 Bearer，cardKey 经 encodeURIComponent", async () => {
    state.token = null;
    fetchMock.mockResolvedValue(jsonResponse({ mode: "card", card, schedule: null }));
    const anonymous = await fetchCardDetail("408card/ds-01-001");
    expect(anonymous.detail?.card.key).toBe(card.key);
    expect(anonymous.failure).toBeNull();
    const [anonUrl, anonInit] = fetchMock.mock.calls[0] as [string, unknown];
    expect(anonUrl).toBe(
      "https://api.test/api/exam/408/cards?mode=card&cardKey=408card%2Fds-01-001",
    );
    expect(anonInit).toBeUndefined();

    state.token = "tok";
    fetchMock.mockResolvedValueOnce(jsonResponse(detailPayload));
    const authed = await fetchCardDetail("408card/ds-01-001");
    expect(authed.detail?.schedule?.state).toBe("due");
    const [, authedInit] = fetchMock.mock.calls[1] as [string, { headers: Record<string, string> }];
    expect(authedInit.headers.Authorization).toBe("Bearer tok");
  });

  it("key 为空或超 120 字符直接判 invalid，不发明请求", async () => {
    expect(await fetchCardDetail(" ")).toEqual({ detail: null, failure: "invalid" });
    expect(await fetchCardDetail("k".repeat(121))).toEqual({ detail: null, failure: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400/404/5xx 分别归类，网络异常归 offline", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "cardKey 不合法" }, 400));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "invalid" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "速记卡不存在" }, 404));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "not-found" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "server" });
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "offline" });
  });

  it("200 但结构不认识按 server（不把队列体当详情）", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(queuePayload));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "server" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ mode: "card", card: null, schedule: null }));
    expect(await fetchCardDetail("k")).toEqual({ detail: null, failure: "server" });
  });
});

describe("nextFlipState（详情页复用刷卡翻面状态机）", () => {
  it("正反两面可无限来回切换", () => {
    let flipped = false;
    expect(nextFlipState(flipped)).toBe(true);
    flipped = nextFlipState(flipped);
    expect(nextFlipState(flipped)).toBe(false);
  });
});
