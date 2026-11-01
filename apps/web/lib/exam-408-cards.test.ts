import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { FSRS_SHADOW_ALGORITHM_VERSION } from "@/lib/fsrs-shadow";
import {
  CARD_ALGORITHM_VERSION,
  CARD_TIME_ZONE,
  CARD_TRACK_SLUG,
  CardNotFoundError,
  advanceCardSchedule,
  assembleCardQueue,
  cardRatingChosenAnswer,
  cardRatingIsCorrect,
  cardRatingToFsrsRating,
  cardSubjectTitle,
  cardQueueStateOf,
  computeCardStreak,
  gradeCard,
  loadCardQueue,
  loadCardStats,
  normalizeAnswerSteps,
  normalizeOptionalText,
  parseCardRating,
  shiftDateKey,
  summarizeCardStats,
  type CardQueueCandidate,
} from "./exam-408-cards";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);

const NOW = new Date("2026-11-01T10:00:00.000Z");

function candidate(overrides: Partial<CardQueueCandidate> = {}): CardQueueCandidate {
  return {
    card: {
      key: "408card/ds-01-001",
      subjectKey: "data-structure",
      chapter: 1,
      question: "线性表的基本特征？",
      answerSteps: ["有限序列"],
      pitfall: null,
      mnemonic: null,
      star: false,
      demoKey: null,
      knowledgePointKey: null,
    },
    dueAt: null,
    status: null,
    lastResult: null,
    lapses: 0,
    ...overrides,
  };
}

function mockClient() {
  const query = vi.fn();
  const release = vi.fn();
  connectMock.mockResolvedValue({ query, release } as never);
  return { query, release };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("常量与评级映射", () => {
  it("轨道与算法版本串固定（与 fsrs-shadow 同源，改动会在此报警）", () => {
    expect(CARD_TRACK_SLUG).toBe("ex-408-cards");
    expect(CARD_ALGORITHM_VERSION).toBe("ts-fsrs@5.4.2/fsrs-v6");
    expect(CARD_ALGORITHM_VERSION).toBe(FSRS_SHADOW_ALGORITHM_VERSION);
    expect(CARD_TIME_ZONE).toBe("Asia/Shanghai");
  });

  it("三档评级映射到 FSRS：不会=Again、模糊=Hard、会=Good（easy 保留）", () => {
    expect(cardRatingToFsrsRating("again")).toBe(1);
    expect(cardRatingToFsrsRating("hard")).toBe(2);
    expect(cardRatingToFsrsRating("good")).toBe(3);
    expect(cardRatingToFsrsRating("easy")).toBe(4);
    expect(cardRatingIsCorrect("again")).toBe(false);
    expect(cardRatingIsCorrect("hard")).toBe(true);
    expect(cardRatingIsCorrect("good")).toBe(true);
    expect(cardRatingChosenAnswer("good")).toEqual(["good"]);
  });

  it("评级入参白名单", () => {
    expect(parseCardRating("good")).toBe("good");
    expect(parseCardRating(" AGAIN ")).toBeNull(); // 大小写/空白都不放行，客户端统一小写
    expect(parseCardRating("perfect")).toBeNull();
    expect(parseCardRating(3)).toBeNull();
    expect(parseCardRating(undefined)).toBeNull();
  });

  it("科目标题映射", () => {
    expect(cardSubjectTitle("data-structure")).toBe("数据结构");
    expect(cardSubjectTitle("unknown-subject")).toBe("unknown-subject");
  });
});

describe("归一化", () => {
  it("answer_steps 只保留非空字符串，脏数据归一成空数组", () => {
    expect(normalizeAnswerSteps([" 第一步 ", "", 42, null, { a: 1 }, "第二步"])).toEqual([
      "第一步",
      "第二步",
    ]);
    expect(normalizeAnswerSteps("这不是数组")).toEqual([]);
    expect(normalizeAnswerSteps(undefined)).toEqual([]);
  });

  it("可空文本：空白归一成 null", () => {
    expect(normalizeOptionalText(" 易错点 ")).toBe("易错点");
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalText(0)).toBeNull();
  });
});

describe("advanceCardSchedule（FSRS 推进）", () => {
  it("新卡评 Good：进入 learning，due 在将来，不改写外部状态", () => {
    const schedule = advanceCardSchedule(null, "good", NOW);
    expect(schedule.status).toBe("learning");
    expect(Date.parse(schedule.dueAt)).toBeGreaterThan(NOW.getTime());
    expect(schedule.card.reps).toBe(1);
    expect(schedule.card.state).not.toBe(0); // 不再是 New
    expect(schedule.intervalDays).toBeGreaterThanOrEqual(0);
  });

  it("同一输入多次调用结果完全一致（关闭 fuzz，可复现）", () => {
    const a = advanceCardSchedule(null, "hard", NOW);
    const b = advanceCardSchedule(null, "hard", NOW);
    expect(a.dueAt).toBe(b.dueAt);
    expect(a.card.stability).toBe(b.card.stability);
  });

  it("Again 与 Easy 的 due 严格分档（again 最近、easy 最远）", () => {
    const again = advanceCardSchedule(null, "again", NOW);
    const good = advanceCardSchedule(null, "good", NOW);
    const easy = advanceCardSchedule(null, "easy", NOW);
    expect(Date.parse(again.dueAt)).toBeLessThanOrEqual(Date.parse(good.dueAt));
    expect(Date.parse(good.dueAt)).toBeLessThan(Date.parse(easy.dueAt));
  });

  it("能承接库里存的 fsrs_state（对象）继续排程", () => {
    const first = advanceCardSchedule(null, "good", NOW);
    const second = advanceCardSchedule(JSON.parse(JSON.stringify(first.card)), "good", NOW);
    expect(second.card.reps).toBeGreaterThan(first.card.reps);
  });
});

describe("assembleCardQueue（队列组装）", () => {
  it("到期卡优先、按 dueAt 升序；新卡补位", () => {
    const dueSoon = candidate({
      card: { ...candidate().card, key: "408card/ds-01-002" },
      dueAt: "2026-11-01T09:00:00.000Z",
      status: "review",
    });
    const dueLater = candidate({
      card: { ...candidate().card, key: "408card/ds-01-003" },
      dueAt: "2026-11-01T09:30:00.000Z",
      status: "learning",
    });
    const fresh = candidate({ card: { ...candidate().card, key: "408card/ds-02-001", chapter: 2 } });
    const queue = assembleCardQueue({ candidates: [fresh, dueLater, dueSoon], now: NOW, limit: 10 });
    expect(queue.cards.map((card) => card.key)).toEqual([
      "408card/ds-01-002",
      "408card/ds-01-003",
      "408card/ds-02-001",
    ]);
    expect(queue.cards.map((card) => card.state)).toEqual(["due", "due", "new"]);
    expect(queue.dueCount).toBe(2);
    expect(queue.newCount).toBe(1);
  });

  it("未被到期限制的卡不进队列；suspend 卡两种模式都排除", () => {
    const future = candidate({
      dueAt: "2026-12-01T00:00:00.000Z",
      status: "review",
      lapses: 2,
      lastResult: false,
    });
    const suspended = candidate({
      card: { ...candidate().card, key: "408card/ds-01-009" },
      dueAt: "2026-10-01T00:00:00.000Z",
      status: "suspended",
    });
    const queue = assembleCardQueue({ candidates: [future, suspended], now: NOW, limit: 10 });
    expect(queue.cards).toEqual([]);
    const mistakes = assembleCardQueue({
      candidates: [future, suspended],
      now: NOW,
      limit: 10,
      scope: "mistake",
    });
    expect(mistakes.cards.map((card) => card.key)).toEqual(["408card/ds-01-001"]);
    expect(mistakes.cards[0]?.state).toBe("scheduled");
  });

  it("limit 截断，并夹在 1..50 之间", () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      candidate({ card: { ...candidate().card, key: `408card/ds-01-${String(index).padStart(3, "0")}` } }),
    );
    expect(assembleCardQueue({ candidates: many, now: NOW, limit: 5 }).cards).toHaveLength(5);
    expect(assembleCardQueue({ candidates: many, now: NOW, limit: 999 }).cards).toHaveLength(50);
    expect(assembleCardQueue({ candidates: many, now: NOW, limit: 0 }).cards).toHaveLength(1);
    expect(assembleCardQueue({ candidates: many, now: NOW }).cards).toHaveLength(20);
  });

  it("易错本按 lapses 降序，且只看评过错（lastResult=false 或 lapses>0）的卡", () => {
    const wrong1 = candidate({
      card: { ...candidate().card, key: "408card/ds-01-004" },
      status: "review",
      lapses: 3,
      lastResult: false,
      dueAt: "2026-11-05T00:00:00.000Z",
    });
    const wrong2 = candidate({
      card: { ...candidate().card, key: "408card/ds-01-005" },
      status: "learning",
      lapses: 1,
      lastResult: true,
      dueAt: "2026-11-02T00:00:00.000Z",
    });
    const clean = candidate({
      card: { ...candidate().card, key: "408card/ds-01-006" },
      status: "review",
      lapses: 0,
      lastResult: true,
      dueAt: "2026-11-01T09:00:00.000Z",
    });
    const mistakes = assembleCardQueue({
      candidates: [clean, wrong2, wrong1],
      now: NOW,
      limit: 10,
      scope: "mistake",
    });
    expect(mistakes.cards.map((card) => card.key)).toEqual(["408card/ds-01-004", "408card/ds-01-005"]);
    expect(mistakes.cards[0]?.lapses).toBe(3);
  });

  it("cardQueueStateOf：无状态=新卡、已到期=due、未到期=scheduled", () => {
    expect(cardQueueStateOf(candidate(), NOW)).toBe("new");
    expect(cardQueueStateOf(candidate({ dueAt: "2026-10-01T00:00:00.000Z", status: "review" }), NOW)).toBe("due");
    expect(cardQueueStateOf(candidate({ dueAt: "2026-12-01T00:00:00.000Z", status: "review" }), NOW)).toBe(
      "scheduled",
    );
  });
});

describe("统计（连续天数 / 汇总）", () => {
  it("日期键加减不跨时区漂移", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateKey("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("连续天数：包含今天；今天没刷从昨天算；断档即停", () => {
    expect(computeCardStreak(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01")).toBe(3);
    expect(computeCardStreak(["2026-10-31", "2026-10-30"], "2026-11-01")).toBe(2);
    expect(computeCardStreak(["2026-10-30"], "2026-11-01")).toBe(0);
    expect(computeCardStreak([], "2026-11-01")).toBe(0);
  });

  it("科目统计：新卡/到期/学习中分开数，今日正确率按当天 attempt 汇总", () => {
    const stats = summarizeCardStats({
      rows: [
        { subjectKey: "data-structure", status: null, dueAt: null },
        { subjectKey: "data-structure", status: "review", dueAt: "2026-10-30T00:00:00.000Z" },
        { subjectKey: "data-structure", status: "learning", dueAt: "2026-11-05T00:00:00.000Z" },
        { subjectKey: "data-structure", status: "suspended", dueAt: "2026-10-01T00:00:00.000Z" },
        { subjectKey: "operating-system", status: "mastered", dueAt: "2026-10-01T00:00:00.000Z" },
      ],
      attemptCounts: [
        { dayKey: "2026-11-01", subjectKey: "data-structure", graded: 4, correct: 3 },
        { dayKey: "2026-10-31", subjectKey: "data-structure", graded: 2, correct: 2 },
        { dayKey: "2026-11-01", subjectKey: "operating-system", graded: 1, correct: 0 },
      ],
      todayKey: "2026-11-01",
      now: NOW,
    });
    expect(stats.totals).toEqual({
      cards: 5,
      newCount: 1,
      dueCount: 1,
      learningCount: 1,
      masteredCount: 1,
    });
    expect(stats.subjects).toHaveLength(4);
    expect(stats.subjects[0]).toMatchObject({
      subjectKey: "data-structure",
      title: "数据结构",
      cards: 4,
      newCount: 1,
      dueCount: 1,
      learningCount: 1,
      doneToday: 4,
      correctToday: 3,
      accuracy: 0.75,
    });
    expect(stats.today).toEqual({ done: 5, correct: 3, wrong: 2, accuracy: 0.6 });
    expect(stats.streak).toBe(2);
  });

  it("subject 收窄 totals/today/streak，但 subjects 仍给四行各自的真实数据", () => {
    const stats = summarizeCardStats({
      rows: [
        { subjectKey: "data-structure", status: null, dueAt: null },
        { subjectKey: "operating-system", status: null, dueAt: null },
        { subjectKey: "operating-system", status: null, dueAt: null },
      ],
      attemptCounts: [
        { dayKey: "2026-11-01", subjectKey: "data-structure", graded: 1, correct: 1 },
        { dayKey: "2026-11-01", subjectKey: "operating-system", graded: 3, correct: 0 },
      ],
      todayKey: "2026-11-01",
      now: NOW,
      subject: "operating-system",
    });
    expect(stats.totals.cards).toBe(2);
    expect(stats.today).toMatchObject({ done: 3, correct: 0, accuracy: 0 });
    expect(stats.subjects.find((item) => item.subjectKey === "data-structure")?.doneToday).toBe(1);
  });

  it("当天没有刷卡时正确率为 null 而不是 0", () => {
    const stats = summarizeCardStats({
      rows: [{ subjectKey: "data-structure", status: null, dueAt: null }],
      attemptCounts: [],
      todayKey: "2026-11-01",
      now: NOW,
    });
    expect(stats.today.accuracy).toBeNull();
    expect(stats.subjects[0]?.accuracy).toBeNull();
  });
});

describe("SQL 层（mock pgPool）", () => {
  it("loadCardQueue：LEFT JOIN 状态表取队列，并按队列口径给 stats", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            key: "408card/ds-01-001",
            subject_key: "data-structure",
            chapter: 1,
            question: "线性表的基本特征？",
            answer_steps: ["有限序列"],
            pitfall: "",
            mnemonic: null,
            star: true,
            demo_key: null,
            knowledge_point_key: null,
            status: null,
            due_at: null,
            lapses: 0,
            last_result: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ day_key: "2026-11-01", stage_key: "data-structure", graded: 3, correct: 2 }],
      } as never);

    const queue = await loadCardQueue("u-1", { now: NOW });
    expect(String(queryMock.mock.calls[0]?.[0])).toContain("FROM exam_408_cards");
    expect(String(queryMock.mock.calls[0]?.[0])).toContain("LEFT JOIN learning_review_cards");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["u-1", "ex-408-cards", null]);
    expect(queue.cards).toHaveLength(1);
    expect(queue.cards[0]).toMatchObject({ key: "408card/ds-01-001", pitfall: null, star: true, state: "new" });
    expect(queue.stats).toEqual({ newCount: 1, dueCount: 0, doneToday: 3, streak: 1 });
    expect(queue.scope).toBe("queue");
  });

  it("loadCardStats：四行科目 + 今日/连续天数", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { subject_key: "data-structure", status: "review", due_at: "2026-10-30T00:00:00.000Z" },
          { subject_key: "computer-network", status: null, due_at: null },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ day_key: "2026-11-01", stage_key: "data-structure", graded: 2, correct: 1 }],
      } as never);
    const stats = await loadCardStats("u-1", { now: NOW });
    expect(stats.subjects).toHaveLength(4);
    expect(stats.totals).toMatchObject({ cards: 2, newCount: 1, dueCount: 1 });
    expect(stats.today).toMatchObject({ done: 2, correct: 1, accuracy: 0.5 });
  });

  it("gradeCard：一个事务里写 attempt + upsert 复习卡，再读会话计数", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ key: "408card/ds-01-001", subject_key: "data-structure", knowledge_point_key: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "11" }] }) // INSERT attempt
      .mockResolvedValueOnce({ rows: [] }) // 无历史状态
      .mockResolvedValueOnce({
        rows: [
          {
            status: "learning",
            due_at: "2026-11-01T10:10:00.000Z",
            interval_days: 0,
            streak: 1,
            lapses: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    queryMock.mockResolvedValueOnce({ rows: [{ done_today: 1, remaining_due: 0 }] } as never);

    const result = await gradeCard("u-1", { cardKey: "408card/ds-01-001", rating: "good", clientId: "c-1" }, NOW);

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    const attempt = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO learning_attempts"),
    );
    expect(attempt?.[1]).toEqual([
      "u-1",
      "ex-408-cards",
      "data-structure",
      "408card/ds-01-001",
      JSON.stringify(["good"]),
      true,
      "c-1",
    ]);
    const upsert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO learning_review_cards"),
    );
    expect(String(upsert?.[0])).toContain("ON CONFLICT (user_id, question_key) DO UPDATE");
    expect(upsert?.[1]?.[5]).toBe("learning");
    expect(upsert?.[1]?.[11]).toBe("ts-fsrs@5.4.2/fsrs-v6");
    expect(result).toMatchObject({
      ok: true,
      cardKey: "408card/ds-01-001",
      rating: "good",
      isCorrect: true,
      state: "learning",
      doneToday: 1,
      remainingDue: 0,
    });
    expect(client.release).toHaveBeenCalled();
  });

  it("gradeCard：cardKey 不存在抛 CardNotFoundError 并回滚", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // 查不到卡
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    await expect(
      gradeCard("u-1", { cardKey: "408card/missing", rating: "again" }, NOW),
    ).rejects.toBeInstanceOf(CardNotFoundError);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("gradeCard：同 clientId 重放不重复推进 FSRS（跳到幂等分支）", async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ key: "408card/ds-01-001", subject_key: "data-structure", knowledge_point_key: null }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT ... DO NOTHING → 无行
      .mockResolvedValueOnce({
        rows: [{ status: "review", due_at: "2026-11-04T10:00:00.000Z", interval_days: 3, streak: 2, lapses: 0 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    queryMock.mockResolvedValueOnce({ rows: [{ done_today: 5, remaining_due: 2 }] } as never);

    const result = await gradeCard("u-1", { cardKey: "408card/ds-01-001", rating: "good", clientId: "c-1" }, NOW);

    expect(
      client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO learning_review_cards")),
    ).toBe(false);
    expect(result).toMatchObject({ state: "review", intervalDays: 3, streak: 2, doneToday: 5, remainingDue: 2 });
  });
});
