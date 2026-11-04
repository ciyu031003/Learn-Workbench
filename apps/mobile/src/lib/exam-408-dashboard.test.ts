import { describe, expect, it } from "vitest";
import type { Exam408CardStatsBoard } from "./exam-408-cards";
import type { PaperAttemptRecord } from "./paper-history";
import {
  NO_STAT_VALUE,
  accuracyPercent,
  averagePaperScore,
  bestPaperScore,
  countOrNull,
  exam408DashNotice,
  exam408DashStats,
  paperScoreBars,
  paperScoreRatio,
  paperScoreRanking,
  reviewedCardCount,
} from "./exam-408-dashboard";

/**
 * 408「我的学习统计」视图模型单测（v2.2）。
 *
 * 钉住的口径：
 * - 未登录 / 401 / 离线：指标卡必须是「—」+ 明确降级提示，**绝不显示 0 冒充数据**；
 * - 套卷只有本机缓存时仍然出数（来源文案可区分）；
 * - 柱图由旧到新、最新一根高亮；排行按得分降序且同分保留最近一次；
 * - 脏数据（NaN / 负数 / 满分为 0）不产生 NaN、不画出溢出柱。
 */

function board(overrides: Partial<Exam408CardStatsBoard["totals"]> = {}, todayDone = 5): Exam408CardStatsBoard {
  return {
    totals: { cards: 120, newCount: 80, dueCount: 10, learningCount: 8, masteredCount: 12, ...overrides },
    today: { done: todayDone, correct: 4, wrong: 1, accuracy: 0.8 },
    streak: 3,
    subjects: [],
  };
}

function attempt(overrides: Partial<PaperAttemptRecord> = {}): PaperAttemptRecord {
  return {
    id: "a-1",
    year: 2024,
    score: 80,
    totalScore: 150,
    correct: 32,
    wrong: 8,
    unanswered: 2,
    durationSeconds: 5400,
    startedAt: "2026-11-01T10:00:00.000Z",
    submittedAt: "2026-11-01T11:00:00.000Z",
    byPoint: [],
    bySubject: [],
    ...overrides,
  };
}

describe("基础清洗", () => {
  it("countOrNull 只接受非负有限数，其余 → null", () => {
    expect(countOrNull(12)).toBe(12);
    expect(countOrNull("12")).toBe(12);
    expect(countOrNull(3.7)).toBe(3);
    expect(countOrNull(-1)).toBeNull();
    expect(countOrNull(Number.NaN)).toBeNull();
    expect(countOrNull("abc")).toBeNull();
    expect(countOrNull(undefined)).toBeNull();
  });

  it("accuracyPercent 只按已判题算，没有已判题 → 0", () => {
    expect(accuracyPercent(32, 8)).toBe(80);
    expect(accuracyPercent(0, 0)).toBe(0);
    expect(accuracyPercent("3", "1")).toBe(75);
    expect(accuracyPercent(-3, 1)).toBe(0);
  });

  it("reviewedCardCount = learning + mastered", () => {
    expect(reviewedCardCount(board())).toBe(20);
    expect(reviewedCardCount(null)).toBeNull();
  });

  it("bestPaperScore / averagePaperScore 对脏数据安全", () => {
    const attempts = [attempt({ score: 60 }), attempt({ score: 90 }), attempt({ score: Number.NaN })];
    expect(bestPaperScore(attempts)).toEqual({ score: 90, totalScore: 150 });
    expect(bestPaperScore([])).toBeNull();
    expect(averagePaperScore([attempt({ score: 60 }), attempt({ score: 91 })])).toBe(76);
    expect(averagePaperScore([])).toBeNull();
  });

  it("paperScoreRatio 夹在 0..1，满分为 0 不产生 NaN", () => {
    expect(paperScoreRatio(attempt({ score: 75, totalScore: 150 }))).toBe(0.5);
    expect(paperScoreRatio(attempt({ score: 300, totalScore: 150 }))).toBe(1);
    expect(paperScoreRatio(attempt({ score: 80, totalScore: 0 }))).toBe(0);
    expect(paperScoreRatio(null)).toBe(0);
  });
});

describe("图表数据", () => {
  it("柱图由旧到新、最新一根高亮、柱高按满分归一", () => {
    const bars = paperScoreBars([
      attempt({ id: "new", year: 2024, score: 80 }),
      attempt({ id: "mid", year: 2023, score: 60 }),
      attempt({ id: "old", year: 2022, score: 90 }),
    ]);
    expect(bars.map((bar) => bar.label)).toEqual(["2022", "2023", "2024"]);
    expect(bars.map((bar) => bar.valueLabel)).toEqual(["90", "60", "80"]);
    expect(bars.map((bar) => bar.value)).toEqual([0.6, 0.4, 80 / 150]);
    expect(bars.map((bar) => bar.highlight)).toEqual([false, false, true]);
  });

  it("柱图 limit 截断的是「最近」而不是最旧", () => {
    // attempts 约定是倒序（最新在前），这里按 2025 → 2018 生成
    const attempts = Array.from({ length: 8 }, (_, index) =>
      attempt({ id: "a" + index, year: 2025 - index, score: index })
    );
    const bars = paperScoreBars(attempts, 3);
    expect(bars.map((bar) => bar.label)).toEqual(["2023", "2024", "2025"]);
  });

  it("排行按得分降序、同分保留最近一次、带正确率", () => {
    const items = paperScoreRanking([
      attempt({ id: "a", year: 2024, score: 96, correct: 40, wrong: 10 }),
      attempt({ id: "b", year: 2023, score: 120, correct: 45, wrong: 5 }),
      attempt({ id: "c", year: 2022, score: 96, correct: 30, wrong: 30 }),
    ]);
    expect(items.map((item) => item.label)).toEqual(["2023 年", "2024 年", "2022 年"]);
    expect(items[0].valueLabel).toBe("120 分");
    expect(items[0].hint).toBe("正确率 90%");
    expect(items[1].key).toBe("a");
  });

  it("空记录 → 空数组（图走空态，不画全 0）", () => {
    expect(paperScoreBars([])).toEqual([]);
    expect(paperScoreRanking([])).toEqual([]);
  });
});

describe("exam408DashStats", () => {
  it("登录 + 有成绩：四格取数、无提示条、无空态", () => {
    const dash = exam408DashStats({
      board: board(),
      boardFailure: null,
      attempts: [attempt({ id: "a", score: 80 }), attempt({ id: "b", score: 60 })],
      attemptsSource: "remote",
      attemptsFailure: null,
      attemptsTotal: 2,
    });
    expect(dash.cards).toMatchObject({ value: "120", unit: "张", hint: "今日 5" });
    expect(dash.reviewed).toMatchObject({ value: "20", unit: "张", hint: "已掌握 12" });
    expect(dash.papers).toMatchObject({ value: "2", unit: "次", hint: "均分 70" });
    expect(dash.best).toMatchObject({ value: "80", unit: "分", hint: "满分 150" });
    expect(dash.emptyHint).toBeNull();
    expect(dash.notice).toBeNull();
  });

  it("未登录且没有本机缓存：全部「—」+ 登录提示，不显示 0", () => {
    const dash = exam408DashStats({
      board: null,
      boardFailure: "unauthorized",
      attempts: [],
      attemptsSource: "local",
      attemptsFailure: "unauthorized",
    });
    expect(dash.cards.value).toBe(NO_STAT_VALUE);
    expect(dash.reviewed.value).toBe(NO_STAT_VALUE);
    expect(dash.papers.value).toBe(NO_STAT_VALUE);
    expect(dash.best.value).toBe(NO_STAT_VALUE);
    expect(dash.cards.hint).toBe("登录后同步");
    expect(dash.emptyHint).toContain("登录后自动同步");
    expect(dash.notice).toBe("刷卡统计需登录后显示；套卷成绩读取本机记录");
  });

  it("只有本机缓存成绩：次数/最佳仍出数，提示条说明来源", () => {
    const dash = exam408DashStats({
      board: null,
      boardFailure: "offline",
      attempts: [attempt({ id: "local-1", score: 100, totalScore: 150 })],
      attemptsSource: "local",
      attemptsFailure: "offline",
    });
    expect(dash.papers).toMatchObject({ value: "1", hint: "均分 100" });
    expect(dash.best).toMatchObject({ value: "100", hint: "满分 150" });
    expect(dash.cards.hint).toBe("网络异常");
    expect(dash.notice).toContain("套卷成绩读取本机记录");
  });

  it("pending：首次读取显示「读取中」而不是「登录后同步」", () => {
    const dash = exam408DashStats({
      board: null,
      boardFailure: null,
      attempts: [],
      attemptsSource: "remote",
      attemptsFailure: null,
      pending: true,
    });
    expect(dash.cards.hint).toBe("读取中");
    expect(dash.papers.hint).toBe("读取中");
  });

  it("服务端总数大于本地列表时用总数", () => {
    const dash = exam408DashStats({
      board: null,
      boardFailure: "server",
      attempts: [attempt({ id: "a" })],
      attemptsSource: "remote",
      attemptsFailure: null,
      attemptsTotal: 20,
    });
    expect(dash.papers.value).toBe("20");
  });

  it("离线缓存 board 的提示文案", () => {
    const dash = exam408DashStats({
      board: board(),
      boardFailure: "offline",
      boardCached: true,
      attempts: [],
      attemptsSource: "remote",
      attemptsFailure: null,
    });
    expect(dash.notice).toBe("刷卡统计是上次的离线缓存");
    expect(dash.cards.value).toBe("120");
  });
});

describe("exam408DashNotice", () => {
  it("登录失败但没有缓存时才提示登录", () => {
    expect(exam408DashNotice({ boardFailure: "unauthorized", attemptsSource: "remote" })).toBe(
      "刷卡统计需登录后显示"
    );
    expect(
      exam408DashNotice({ boardFailure: "unauthorized", boardCached: true, attemptsSource: "remote" })
    ).toBe("刷卡统计是上次的离线缓存");
    expect(exam408DashNotice({ boardFailure: null, attemptsSource: "remote" })).toBeNull();
  });
});
