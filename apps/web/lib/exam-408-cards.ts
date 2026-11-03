import { DEFAULT_TIME_ZONE, dateKeyInZone } from "@learn-workbench/shared/domains";
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import { pgPool } from "@/lib/db";

/**
 * 408 刷卡（背诵卡）闭环 —— 内容表 exam_408_cards + 状态表 learning_review_cards 的读写层。
 *
 * 分工：
 *   - exam_408_cards 是**内容**（来自 408card.top 的个人学习镜像，529 张，subject_key 是
 *     data-structure / computer-organization / operating-system / computer-network 四个裸 key）；
 *   - 学习状态复用既有 learning_review_cards，用 track_slug='ex-408-cards' 隔离，
 *     question_key=卡 key、stage_key=科目 key、topic_key=知识点 key；
 *   - 排程算法用 ts-fsrs（与 learning 的 SRS 状态机共用同一张表、但互不干扰：
 *     track_slug 不同即互不覆盖）。
 *
 * 本文件分两半：**纯函数**（队列组装 / 评级映射 / 统计汇总，单测直接覆盖）与 **SQL 读写**
 * （loadCardQueue / loadCardStats / gradeCard）。页面与 route 只做参数校验与拼装。
 */

/** 刷卡轨道的 track_slug（与 learning_review_cards 的其它学习轨道隔离） */
export const CARD_TRACK_SLUG = "ex-408-cards";
/** 写入 learning_review_cards.algorithm_version 的版本串（与 fsrs-shadow 同源） */
export const CARD_ALGORITHM_VERSION = "ts-fsrs@5.4.2/fsrs-v6";
/** 业务"今天"按 Asia/Shanghai 口径（S5-1 决策 D3），与全站一致 */
export const CARD_TIME_ZONE = DEFAULT_TIME_ZONE;
export const CARD_QUEUE_DEFAULT_LIMIT = 20;
export const CARD_QUEUE_MAX_LIMIT = 50;

export const CARD_RATINGS = ["again", "hard", "good", "easy"] as const;
export type CardRating = (typeof CARD_RATINGS)[number];

/** 三档评级与 FSRS 的映射说明：不会=Again、模糊=Hard、会=Good（Easy 作为可选第四档保留） */
export const CARD_RATING_LABELS: Record<CardRating, string> = {
  again: "不会",
  hard: "模糊",
  good: "会",
  easy: "很熟",
};

/** 四个科目（顺序固定：页面科目切换、统计行顺序都按这里） */
export const CARD_SUBJECTS = [
  { key: "data-structure", title: "数据结构" },
  { key: "computer-organization", title: "计算机组成原理" },
  { key: "operating-system", title: "操作系统" },
  { key: "computer-network", title: "计算机网络" },
] as const;

export type CardSubjectKey = (typeof CARD_SUBJECTS)[number]["key"];

export function cardSubjectTitle(subjectKey: string): string {
  return CARD_SUBJECTS.find((subject) => subject.key === subjectKey)?.title ?? subjectKey;
}

export function isCardSubject(subjectKey: string): subjectKey is CardSubjectKey {
  return CARD_SUBJECTS.some((subject) => subject.key === subjectKey);
}

/**
 * 排程器参数与 lib/fsrs-shadow.ts 完全一致：同一套 ts-fsrs 参数，避免"影子预测"与
 * "真实排程"用两套 retention 导致同一张卡被算出两种 due。
 * 改动这里必须同步 fsrs-shadow.ts（lib/exam-408-cards.test.ts 有断言钉住版本串）。
 */
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

/* ============================ 纯函数：归一化 ============================ */

/** answer_steps 是 jsonb 数组；脏数据（字符串/对象/混合）一律只留字符串项 */
export function normalizeAnswerSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** pitfall / mnemonic / demoKey 这类可空文本：空串与空白统一成 null */
export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 评级入参校验（Body 可能来自第三方客户端，一律白名单） */
export function parseCardRating(value: unknown): CardRating | null {
  if (typeof value !== "string") return null;
  return (CARD_RATINGS as readonly string[]).includes(value) ? (value as CardRating) : null;
}

/**
 * 评级 → ts-fsrs Grade（Again=1 / Hard=2 / Good=3 / Easy=4）。
 * ts-fsrs 5.x 把"可评级"收窄成 Grade = Exclude<Rating, Rating.Manual>，Manual 只能改状态不能排程。
 */
export function cardRatingToFsrsRating(rating: CardRating): Grade {
  switch (rating) {
    case "again":
      return Rating.Again;
    case "hard":
      return Rating.Hard;
    case "good":
      return Rating.Good;
    case "easy":
      return Rating.Easy;
  }
}

/** 是否算"记住了"：只有「不会」判定为错，用于 learning_attempts.is_correct 与正确率 */
export function cardRatingIsCorrect(rating: CardRating): boolean {
  return rating !== "again";
}

/** 写 learning_attempts.chosen_answer 用：把评级当作"答案"落库，便于回放与审计 */
export function cardRatingChosenAnswer(rating: CardRating): string[] {
  return [rating];
}

/* ============================ 纯函数：FSRS 推进 ============================ */

function hydrateCard(raw: unknown, fallbackNow: Date): Card {
  if (!raw || typeof raw !== "object") return createEmptyCard(fallbackNow);
  const candidate = raw as Partial<Card>;
  const due = new Date(candidate.due instanceof Date ? candidate.due : String(candidate.due ?? ""));
  if (Number.isNaN(due.getTime())) return createEmptyCard(fallbackNow);
  const lastReview = candidate.last_review ? new Date(candidate.last_review) : undefined;
  return {
    due,
    stability: Number(candidate.stability) || 0,
    difficulty: Number(candidate.difficulty) || 0,
    elapsed_days: Number(candidate.elapsed_days) || 0,
    scheduled_days: Number(candidate.scheduled_days) || 0,
    learning_steps: Number(candidate.learning_steps) || 0,
    reps: Number(candidate.reps) || 0,
    lapses: Number(candidate.lapses) || 0,
    state: Number.isInteger(candidate.state) ? (candidate.state as State) : State.New,
    ...(lastReview && !Number.isNaN(lastReview.getTime()) ? { last_review: lastReview } : {}),
  };
}

/** learning_review_cards.status 的取值受 CHECK 约束限制：这里只产出 learning / review */
export type CardScheduleStatus = "learning" | "review";

function statusForCardState(state: State): CardScheduleStatus {
  // Relearning 与 New/Learning 都归 learning；Review 归 review（mastered 由人工/系统另行标记）
  return state === State.Review ? "review" : "learning";
}

export interface CardSchedule {
  /** 推进后的 FSRS 卡状态（写 fsrs_state） */
  card: Card;
  status: CardScheduleStatus;
  dueAt: string;
  intervalDays: number;
}

/**
 * 用一次评级推进 FSRS。纯函数：同样的输入 + 同样的 now 一定得到同样的结果（无随机 fuzz）。
 * 不传 currentState（undefined/null）时按"新卡"起步。
 */
export function advanceCardSchedule(
  currentState: unknown,
  rating: CardRating,
  now: Date,
): CardSchedule {
  const card = hydrateCard(currentState, now);
  const next = scheduler.next(card, now, cardRatingToFsrsRating(rating)).card;
  return {
    card: next,
    status: statusForCardState(next.state),
    dueAt: next.due.toISOString(),
    intervalDays: Math.max(0, Math.round(next.scheduled_days)),
  };
}

/* ============================ 纯函数：队列组装 ============================ */

export interface Exam408CardContent {
  key: string;
  subjectKey: string;
  chapter: number;
  question: string;
  answerSteps: string[];
  pitfall: string | null;
  mnemonic: string | null;
  star: boolean;
  demoKey: string | null;
  knowledgePointKey: string | null;
}

/** new=从未评过；due=评过且已到期；scheduled=评过但还没到期（只在易错本模式下出现） */
export type CardQueueState = "new" | "due" | "scheduled";

export interface Exam408QueueCard extends Exam408CardContent {
  state: CardQueueState;
  dueAt: string | null;
  lapses: number;
}

export interface CardQueueCandidate {
  card: Exam408CardContent;
  /** learning_review_cards.due_at；无状态行时为 null */
  dueAt: string | null;
  /** learning_review_cards.status；无状态行时为 null */
  status: string | null;
  lastResult: boolean | null;
  lapses: number;
}

export interface CardQueueResult {
  cards: Exam408QueueCard[];
  /** 全量（未截断）的到期卡数 —— 会话进度条与"还剩多少"都用它 */
  dueCount: number;
  /** 全量（未截断）的新卡数 */
  newCount: number;
}

export type CardQueueScope = "queue" | "mistake";

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return CARD_QUEUE_DEFAULT_LIMIT;
  return Math.min(CARD_QUEUE_MAX_LIMIT, Math.max(1, Math.floor(limit as number)));
}

function isSuspended(candidate: CardQueueCandidate): boolean {
  return candidate.status === "suspended";
}

/** "会不会算到期"：没状态行=新卡，不在队列里；有状态行且 due_at <= now 才算到期 */
export function cardQueueStateOf(candidate: CardQueueCandidate, now: Date): CardQueueState {
  if (!candidate.status || !candidate.dueAt) return "new";
  const due = Date.parse(candidate.dueAt);
  if (!Number.isFinite(due)) return "new";
  return due <= now.getTime() ? "due" : "scheduled";
}

function compareCards(a: CardQueueCandidate, b: CardQueueCandidate): number {
  const bySubject = a.card.subjectKey.localeCompare(b.card.subjectKey);
  if (bySubject !== 0) return bySubject;
  if (a.card.chapter !== b.card.chapter) return a.card.chapter - b.card.chapter;
  return a.card.key.localeCompare(b.card.key);
}

/**
 * 组装本次会话队列。
 *
 * queue 模式（默认）：到期卡优先（dueAt 升序，同 dueAt 按科目/章节/key），新卡补位
 * （科目/章节/key 升序）；这样"复习优先于学习"，且到期卡不足时自动用新卡补满，
 * 空库不会有半空队列。suspend 的卡两种模式都排除。
 *
 * mistake 模式（易错本）：只看"评过错"的卡（lapses>0 或上次评级是 again），
 * 按 lapses 降序、到期时间升序排；不受 due 限制（可以立即重刷）。
 */
export function assembleCardQueue(input: {
  candidates: readonly CardQueueCandidate[];
  now: Date;
  limit?: number;
  scope?: CardQueueScope;
}): CardQueueResult {
  const limit = clampLimit(input.limit);
  const scope = input.scope ?? "queue";
  const usable = input.candidates.filter((candidate) => !isSuspended(candidate));

  const due: CardQueueCandidate[] = [];
  const fresh: CardQueueCandidate[] = [];
  for (const candidate of usable) {
    const state = cardQueueStateOf(candidate, input.now);
    if (state === "due") due.push(candidate);
    else if (state === "new") fresh.push(candidate);
  }
  due.sort((a, b) => {
    const diff = (Date.parse(a.dueAt ?? "") || 0) - (Date.parse(b.dueAt ?? "") || 0);
    return diff !== 0 ? diff : compareCards(a, b);
  });
  fresh.sort(compareCards);

  const dueCount = due.length;
  const newCount = fresh.length;

  if (scope === "mistake") {
    const mistakes = usable
      .filter((candidate) => candidate.status !== null && (candidate.lapses > 0 || candidate.lastResult === false))
      .sort((a, b) => {
        if (b.lapses !== a.lapses) return b.lapses - a.lapses;
        const diff = (Date.parse(a.dueAt ?? "") || 0) - (Date.parse(b.dueAt ?? "") || 0);
        return diff !== 0 ? diff : compareCards(a, b);
      })
      .slice(0, limit)
      .map<Exam408QueueCard>((candidate) => ({
        ...candidate.card,
        state: cardQueueStateOf(candidate, input.now),
        dueAt: candidate.dueAt,
        lapses: candidate.lapses,
      }));
    return { cards: mistakes, dueCount, newCount };
  }

  const picked = [...due.slice(0, limit), ...fresh.slice(0, Math.max(0, limit - Math.min(limit, due.length)))];
  const cards = picked.map<Exam408QueueCard>((candidate) => ({
    ...candidate.card,
    state: cardQueueStateOf(candidate, input.now),
    dueAt: candidate.dueAt,
    lapses: candidate.lapses,
  }));
  return { cards, dueCount, newCount };
}

/* ============================ 纯函数：统计 ============================ */

export interface CardStatsRow {
  subjectKey: string;
  status: string | null;
  dueAt: string | null;
}

export interface CardAttemptCount {
  dayKey: string;
  subjectKey: string;
  graded: number;
  correct: number;
}

export interface CardSubjectStats {
  subjectKey: string;
  title: string;
  cards: number;
  newCount: number;
  dueCount: number;
  learningCount: number;
  masteredCount: number;
  doneToday: number;
  correctToday: number;
  accuracy: number | null;
}

export interface Exam408CardStats {
  mode: "stats";
  generatedAt: string;
  totals: {
    cards: number;
    newCount: number;
    dueCount: number;
    learningCount: number;
    masteredCount: number;
  };
  today: { done: number; correct: number; wrong: number; accuracy: number | null };
  streak: number;
  subjects: CardSubjectStats[];
}

function ratio(correct: number, done: number): number | null {
  if (done <= 0) return null;
  return Math.round((correct / done) * 100) / 100;
}

/** 日期键加减天数（纯整数运算，不受运行环境时区影响） */
export function shiftDateKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return dayKey;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/**
 * 连续刷卡天数：从今天往前数连续有记录的天数；今天还没刷时从昨天开始数
 * （"今天还没开始，不算断签"），与 learning 域的 streak 语义一致。
 */
export function computeCardStreak(days: readonly string[], todayKey: string): number {
  const seen = new Set(days.filter((day) => /^\d{4}-\d{2}-\d{2}$/u.test(day)));
  let cursor = seen.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (seen.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function countCardsFor(rows: readonly CardStatsRow[], subjectKey: string, now: Date) {
  let cards = 0;
  let newCount = 0;
  let dueCount = 0;
  let learningCount = 0;
  let masteredCount = 0;
  for (const row of rows) {
    if (row.subjectKey !== subjectKey) continue;
    cards += 1;
    if (!row.status || row.dueAt === null) {
      newCount += 1;
      continue;
    }
    if (row.status === "suspended") continue;
    if (row.status === "mastered") {
      masteredCount += 1;
      continue;
    }
    if (row.status === "learning") learningCount += 1;
    const due = Date.parse(row.dueAt);
    if (Number.isFinite(due) && due <= now.getTime()) dueCount += 1;
  }
  return { cards, newCount, dueCount, learningCount, masteredCount };
}

/**
 * 统计汇总（纯函数）。attemptCounts 是「按天 × 科目」聚合后的刷卡次数，
 * 由 SQL 侧先按 Asia/Shanghai 自然日分好组，这里只做口径拼装。
 */
export function summarizeCardStats(input: {
  rows: readonly CardStatsRow[];
  attemptCounts: readonly CardAttemptCount[];
  todayKey: string;
  now: Date;
  subject?: string | null;
}): Exam408CardStats {
  const subjectFilter = input.subject ?? null;
  // 每行科目一律给各自的真实今日数据（不受 subject 过滤影响），只有 totals/today/streak 按 subject 收窄
  const countsForToday = (subjectKey: string) =>
    input.attemptCounts
      .filter((item) => item.dayKey === input.todayKey && item.subjectKey === subjectKey)
      .reduce((acc, item) => ({ graded: acc.graded + item.graded, correct: acc.correct + item.correct }), {
        graded: 0,
        correct: 0,
      });

  const subjects = CARD_SUBJECTS.map<CardSubjectStats>((subject) => {
    const totals = countCardsFor(input.rows, subject.key, input.now);
    const today = countsForToday(subject.key);
    return {
      subjectKey: subject.key,
      title: subject.title,
      ...totals,
      doneToday: today.graded,
      correctToday: today.correct,
      accuracy: ratio(today.correct, today.graded),
    };
  });

  const scopedSubjects = subjectFilter ? subjects.filter((item) => item.subjectKey === subjectFilter) : subjects;
  const totals = scopedSubjects.reduce(
    (acc, item) => ({
      cards: acc.cards + item.cards,
      newCount: acc.newCount + item.newCount,
      dueCount: acc.dueCount + item.dueCount,
      learningCount: acc.learningCount + item.learningCount,
      masteredCount: acc.masteredCount + item.masteredCount,
    }),
    { cards: 0, newCount: 0, dueCount: 0, learningCount: 0, masteredCount: 0 },
  );
  const done = scopedSubjects.reduce((acc, item) => acc + item.doneToday, 0);
  const correct = scopedSubjects.reduce((acc, item) => acc + item.correctToday, 0);

  const streakDays = input.attemptCounts
    .filter((item) => !subjectFilter || item.subjectKey === subjectFilter)
    .map((item) => item.dayKey);

  return {
    mode: "stats",
    generatedAt: input.now.toISOString(),
    totals,
    today: { done, correct, wrong: Math.max(0, done - correct), accuracy: ratio(correct, done) },
    streak: computeCardStreak(streakDays, input.todayKey),
    subjects,
  };
}

/** 队列接口里附带的轻量统计（App 首页/进度条用，不查全量科目表） */
export interface CardQueueStats {
  newCount: number;
  dueCount: number;
  doneToday: number;
  streak: number;
}

export interface Exam408CardQueue {
  mode: "queue";
  generatedAt: string;
  cards: Exam408QueueCard[];
  stats: CardQueueStats;
  scope: CardQueueScope;
}

/* ============================ SQL：行映射 ============================ */

interface CardRow {
  key: string;
  subject_key: string;
  chapter: number;
  question: string;
  answer_steps: unknown;
  pitfall: string | null;
  mnemonic: string | null;
  star: boolean | null;
  demo_key: string | null;
  knowledge_point_key: string | null;
  status: string | null;
  due_at: string | null;
  lapses: number | null;
  last_result: boolean | null;
}

function mapCardRow(row: CardRow): { card: Exam408CardContent; candidate: CardQueueCandidate } {
  const card: Exam408CardContent = {
    key: String(row.key),
    subjectKey: String(row.subject_key),
    chapter: Number(row.chapter) || 0,
    question: String(row.question ?? ""),
    answerSteps: normalizeAnswerSteps(row.answer_steps),
    pitfall: normalizeOptionalText(row.pitfall),
    mnemonic: normalizeOptionalText(row.mnemonic),
    star: Boolean(row.star),
    demoKey: normalizeOptionalText(row.demo_key),
    knowledgePointKey: normalizeOptionalText(row.knowledge_point_key),
  };
  return {
    card,
    candidate: {
      card,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
      status: row.status ?? null,
      lastResult: row.last_result === null || row.last_result === undefined ? null : Boolean(row.last_result),
      lapses: Number(row.lapses) || 0,
    },
  };
}

const CARD_SELECT_COLUMNS = `
  SELECT c.key, c.subject_key, c.chapter, c.question, c.answer_steps, c.pitfall, c.mnemonic,
         c.star, c.demo_key, c.knowledge_point_key,
         r.status, r.due_at, r.lapses, r.last_result
    FROM exam_408_cards c
    LEFT JOIN learning_review_cards r
      ON r.user_id = $1 AND r.track_slug = $2 AND r.question_key = c.key
   WHERE c.status = 'published'
     AND ($3::text IS NULL OR c.subject_key = $3)`;

const CARD_SELECT = CARD_SELECT_COLUMNS + " ORDER BY c.subject_key, c.chapter, c.sort_order, c.key";

async function loadCardRows(userId: string, subject?: string | null): Promise<CardRow[]> {
  const { rows } = await pgPool.query<CardRow>(CARD_SELECT, [
    userId,
    CARD_TRACK_SLUG,
    subject && subject.length > 0 ? subject : null,
  ]);
  return rows;
}

/**
 * 单张卡详情（P3-1 速记卡详情页，App / Web 只读）。
 *
 * 与队列不同：这里不按到期/新卡过滤，任何已发布卡都能按 key 取到（搜索命中后跳详情）。
 * 未登录时 schedule 为 null（卡片内容本身是公开内容，不要求登录即可阅读）；
 * 登录时返回个人调度状态，供详情页展示「新卡 / 已到期 / 未到期」。
 */
export interface Exam408CardSchedule {
  state: CardQueueState;
  dueAt: string | null;
  lapses: number;
}

export interface Exam408CardDetail {
  card: Exam408CardContent;
  schedule: Exam408CardSchedule | null;
}

export async function loadCardDetail(
  cardKey: string,
  userId: string | null,
  options: { now?: Date } = {},
): Promise<Exam408CardDetail | null> {
  const { rows } = await pgPool.query<CardRow>(
    CARD_SELECT_COLUMNS + " AND c.key = $4 LIMIT 1",
    [userId, CARD_TRACK_SLUG, null, cardKey],
  );
  const row = rows[0];
  if (!row) return null;
  // mapCardRow 自己解释 $1 为 null 的语义：LEFT JOIN 未命中 → status/due_at 为 null
  const { card, candidate } = mapCardRow(row);
  return {
    card,
    schedule: userId
      ? {
          state: cardQueueStateOf(candidate, options.now ?? new Date()),
          dueAt: candidate.dueAt,
          lapses: candidate.lapses,
        }
      : null,
  };
}

interface AttemptAggregateRow {
  day_key: string;
  stage_key: string;
  graded: number;
  correct: number;
}

async function loadAttemptAggregates(userId: string): Promise<CardAttemptCount[]> {
  const { rows } = await pgPool.query<AttemptAggregateRow>(
    `SELECT (created_at AT TIME ZONE $3)::date::text AS day_key,
            stage_key,
            count(*)::int AS graded,
            count(*) FILTER (WHERE is_correct)::int AS correct
       FROM learning_attempts
      WHERE user_id = $1 AND track_slug = $2
      GROUP BY 1, 2
      ORDER BY 1 DESC
      LIMIT 400`,
    [userId, CARD_TRACK_SLUG, CARD_TIME_ZONE],
  );
  return rows.map((row) => ({
    dayKey: String(row.day_key),
    subjectKey: String(row.stage_key),
    graded: Number(row.graded) || 0,
    correct: Number(row.correct) || 0,
  }));
}

function todayKeyFor(now: Date): string {
  return dateKeyInZone(now, CARD_TIME_ZONE);
}

/* ============================ SQL：队列 / 统计 ============================ */

export async function loadCardQueue(
  userId: string,
  options: { subject?: string | null; limit?: number; scope?: CardQueueScope; now?: Date } = {},
): Promise<Exam408CardQueue> {
  const now = options.now ?? new Date();
  const [rows, aggregates] = await Promise.all([
    loadCardRows(userId, options.subject),
    loadAttemptAggregates(userId),
  ]);
  const candidates = rows.map((row) => mapCardRow(row).candidate);
  const queue = assembleCardQueue({
    candidates,
    now,
    limit: options.limit,
    scope: options.scope,
  });
  const todayKey = todayKeyFor(now);
  const todayCounts = aggregates
    .filter((item) => item.dayKey === todayKey && (!options.subject || item.subjectKey === options.subject))
    .reduce((acc, item) => ({ graded: acc.graded + item.graded, correct: acc.correct + item.correct }), {
      graded: 0,
      correct: 0,
    });
  const streakDays = aggregates
    .filter((item) => !options.subject || item.subjectKey === options.subject)
    .map((item) => item.dayKey);
  return {
    mode: "queue",
    scope: options.scope ?? "queue",
    generatedAt: now.toISOString(),
    cards: queue.cards,
    stats: {
      newCount: queue.newCount,
      dueCount: queue.dueCount,
      doneToday: todayCounts.graded,
      streak: computeCardStreak(streakDays, todayKey),
    },
  };
}

export async function loadCardStats(
  userId: string,
  options: { subject?: string | null; now?: Date } = {},
): Promise<Exam408CardStats> {
  const now = options.now ?? new Date();
  const [rows, aggregates] = await Promise.all([loadCardRows(userId, null), loadAttemptAggregates(userId)]);
  return summarizeCardStats({
    rows: rows.map((row) => ({
      subjectKey: String(row.subject_key),
      status: row.status ?? null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    })),
    attemptCounts: aggregates,
    todayKey: todayKeyFor(now),
    now,
    subject: options.subject ?? null,
  });
}

/* ============================ SQL：评级 ============================ */

export interface GradeCardInput {
  cardKey: string;
  rating: CardRating;
  clientId?: string | null;
}

export interface GradeCardResult {
  ok: true;
  cardKey: string;
  rating: CardRating;
  isCorrect: boolean;
  /** learning_review_cards.status（learning / review） */
  state: CardScheduleStatus;
  dueAt: string;
  intervalDays: number;
  streak: number;
  lapses: number;
  doneToday: number;
  remainingDue: number;
}

export class CardNotFoundError extends Error {
  constructor(cardKey: string) {
    super(`卡片不存在：${cardKey}`);
    this.name = "CardNotFoundError";
  }
}

interface ReviewCardStateRow {
  status: string | null;
  due_at: string | null;
  interval_days: number | null;
  streak: number | null;
  lapses: number | null;
}

interface CardMetaRow {
  key: string;
  subject_key: string;
  knowledge_point_key: string | null;
}

interface CountsRow {
  done_today: number;
  remaining_due: number;
}

async function loadSessionCounts(
  query: (sql: string, values?: unknown[]) => Promise<{ rows: CountsRow[] }>,
  userId: string,
  now: Date,
): Promise<{ doneToday: number; remainingDue: number }> {
  const { rows } = await query(
    `SELECT
        (SELECT count(*)::int FROM learning_attempts
          WHERE user_id = $1 AND track_slug = $2
            AND (created_at AT TIME ZONE $3)::date = ($4::timestamptz AT TIME ZONE $3)::date) AS done_today,
        (SELECT count(*)::int FROM learning_review_cards
          WHERE user_id = $1 AND track_slug = $2
            AND status <> 'suspended' AND due_at <= $4::timestamptz) AS remaining_due`,
    [userId, CARD_TRACK_SLUG, CARD_TIME_ZONE, now.toISOString()],
  );
  const row = rows[0];
  return { doneToday: Number(row?.done_today) || 0, remainingDue: Number(row?.remaining_due) || 0 };
}

/**
 * 记录一次评级：写 learning_attempts（幂等键 clientId）+ 推进 learning_review_cards。
 *
 * 为什么两条写在一个事务里：attempt 是统计与审计的事实来源，review card 是排程状态；
 * 两者不一致会出现"统计里刷了 30 张、队列却只推进了 29 张"。clientId 重放走
 * ON CONFLICT DO NOTHING → 不重复推进 FSRS（离线重放不会把卡白刷两次）。
 */
export async function gradeCard(
  userId: string,
  input: GradeCardInput,
  now: Date = new Date(),
): Promise<GradeCardResult> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const cardResult = await client.query<CardMetaRow>(
      `SELECT key, subject_key, knowledge_point_key
         FROM exam_408_cards
        WHERE key = $1 AND status = 'published'`,
      [input.cardKey],
    );
    const card = cardResult.rows[0];
    if (!card) throw new CardNotFoundError(input.cardKey);

    const isCorrect = cardRatingIsCorrect(input.rating);
    const clientId = input.clientId && input.clientId.trim().length > 0 ? input.clientId.trim() : null;
    const inserted = await client.query<{ id: string | number }>(
      `INSERT INTO learning_attempts
         (user_id, track_slug, stage_key, question_key, chosen_answer, is_correct, client_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        userId,
        CARD_TRACK_SLUG,
        card.subject_key,
        card.key,
        JSON.stringify(cardRatingChosenAnswer(input.rating)),
        isCorrect,
        clientId,
      ],
    );

    if (clientId && inserted.rows.length === 0) {
      // 幂等重放：不重复推进 FSRS，返回当前卡状态
      const existing = await client.query<ReviewCardStateRow>(
        `SELECT status, due_at, interval_days, streak, lapses
           FROM learning_review_cards
          WHERE user_id = $1 AND question_key = $2`,
        [userId, card.key],
      );
      await client.query("COMMIT");
      const row = existing.rows[0];
      const counts = await loadSessionCounts(
        (sql, values) => pgPool.query<CountsRow>(sql, values),
        userId,
        now,
      );
      const status = row?.status === "review" ? "review" : "learning";
      return {
        ok: true,
        cardKey: card.key,
        rating: input.rating,
        isCorrect,
        state: status as CardScheduleStatus,
        dueAt: row?.due_at ? new Date(row.due_at).toISOString() : now.toISOString(),
        intervalDays: Number(row?.interval_days) || 0,
        streak: Number(row?.streak) || 0,
        lapses: Number(row?.lapses) || 0,
        ...counts,
      };
    }

    const attemptId = inserted.rows[0]?.id ?? null;
    const currentResult = await client.query<ReviewCardStateRow & { fsrs_state: unknown }>(
      `SELECT status, due_at, interval_days, streak, lapses, fsrs_state
         FROM learning_review_cards
        WHERE user_id = $1 AND question_key = $2
        FOR UPDATE`,
      [userId, card.key],
    );
    const current = currentResult.rows[0];
    const schedule = advanceCardSchedule(current?.fsrs_state ?? null, input.rating, now);
    const nextStreak = cardRatingIsCorrect(input.rating) ? (Number(current?.streak) || 0) + 1 : 0;
    const nextLapses = (Number(current?.lapses) || 0) + (input.rating === "again" ? 1 : 0);

    const upserted = await client.query<ReviewCardStateRow>(
      `INSERT INTO learning_review_cards
         (user_id, question_key, track_slug, stage_key, topic_key, status, interval_days, ease,
          streak, lapses, due_at, last_result, algorithm_version, schedule_reason,
          last_attempt_id, fsrs_state, fsrs_due_at, fsrs_stability, fsrs_difficulty,
          fsrs_last_review_at, fsrs_updated_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 2.50, $8, $9, $10, $11, $12, 'fsrs-grade',
               $13, $14::jsonb, $15, $16, $17, $18, $19, now())
       ON CONFLICT (user_id, question_key) DO UPDATE SET
         track_slug = EXCLUDED.track_slug,
         stage_key = EXCLUDED.stage_key,
         topic_key = EXCLUDED.topic_key,
         status = EXCLUDED.status,
         interval_days = EXCLUDED.interval_days,
         ease = learning_review_cards.ease,
         streak = EXCLUDED.streak,
         lapses = EXCLUDED.lapses,
         due_at = EXCLUDED.due_at,
         last_result = EXCLUDED.last_result,
         algorithm_version = EXCLUDED.algorithm_version,
         schedule_reason = EXCLUDED.schedule_reason,
         suspended_from_status = NULL,
         suspended_at = NULL,
         completed_at = NULL,
         last_attempt_id = EXCLUDED.last_attempt_id,
         fsrs_state = EXCLUDED.fsrs_state,
         fsrs_due_at = EXCLUDED.fsrs_due_at,
         fsrs_stability = EXCLUDED.fsrs_stability,
         fsrs_difficulty = EXCLUDED.fsrs_difficulty,
         fsrs_last_review_at = EXCLUDED.fsrs_last_review_at,
         fsrs_updated_at = EXCLUDED.fsrs_updated_at,
         updated_at = now()
       RETURNING status, due_at, interval_days, streak, lapses`,
      [
        userId,
        card.key,
        CARD_TRACK_SLUG,
        card.subject_key,
        card.knowledge_point_key,
        schedule.status,
        schedule.intervalDays,
        nextStreak,
        nextLapses,
        schedule.dueAt,
        cardRatingIsCorrect(input.rating),
        CARD_ALGORITHM_VERSION,
        attemptId,
        JSON.stringify(schedule.card),
        schedule.dueAt,
        schedule.card.stability,
        schedule.card.difficulty,
        schedule.card.last_review ? schedule.card.last_review.toISOString() : null,
        now.toISOString(),
      ],
    );
    await client.query("COMMIT");

    const stored = upserted.rows[0];
    const counts = await loadSessionCounts((sql, values) => pgPool.query<CountsRow>(sql, values), userId, now);
    return {
      ok: true,
      cardKey: card.key,
      rating: input.rating,
      isCorrect,
      state: (stored?.status === "review" ? "review" : schedule.status) as CardScheduleStatus,
      dueAt: stored?.due_at ? new Date(stored.due_at).toISOString() : schedule.dueAt,
      intervalDays: Number(stored?.interval_days ?? schedule.intervalDays) || 0,
      streak: Number(stored?.streak ?? nextStreak) || 0,
      lapses: Number(stored?.lapses ?? nextLapses) || 0,
      ...counts,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
