import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 写接口 / 校验类接口的「不 500」扫描（2026-09-15）
 *
 * 背景：匿名 500 事故（空 token → hashToken(null)）说明**只测 happy path 不够**。
 * 本文件两批：
 *   A. 输入健壮性：畸形 JSON / 缺必填 / 非法 id / 越界数值 × 两种作用域（已登录 / 匿名），
 *      客户端问题必须 4xx，绝不 5xx；
 *   B. 数据库故障注入：`pgPool.query` 抛 Postgres 约束冲突（23514），且用**最小合法请求体**
 *      确保真正走到写库那一步 —— 断言处理器不把异常抛出（未捕获异常在 Next 里就是 500）。
 *
 * 覆盖：营养（条目/目标/常用食物）、饮水、体重、习惯（条目/打卡）、日志、任务、
 * 打卡、进度、专注、计量、训练、证书。
 */
vi.mock("@/lib/db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));
vi.mock("@/lib/session", () => ({
  currentUserId: vi.fn(),
  currentUser: vi.fn(),
  currentSessionToken: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn(),
  sessionCookieName: "lwb_session",
}));
vi.mock("@/lib/anon", () => ({
  ANON_COOKIE: "lwb_anon",
  getAnonId: vi.fn(),
  anonFilterSql: (i: number) => `(anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $${i})`,
  userScope: vi.fn(),
  scopeWhere: vi.fn((_scope: unknown, base: unknown[]) => ({ params: [...base], sql: "" })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";

// ---- 路由处理器 ----
import { POST as nutritionPost, PATCH as nutritionPatch, DELETE as nutritionDelete } from "@/app/api/nutrition/route";
import { PUT as targetPut } from "@/app/api/nutrition/target/route";
import { POST as foodPost } from "@/app/api/nutrition/foods/route";
import { POST as weightPost, DELETE as weightDelete } from "@/app/api/wellbeing/weight/route";
import { POST as waterPost, DELETE as waterDelete } from "@/app/api/wellbeing/hydration/route";
import { POST as habitsPost } from "@/app/api/habits/route";
import { PATCH as habitPatch, DELETE as habitDelete } from "@/app/api/habits/[id]/route";
import { POST as habitLogPost } from "@/app/api/habits/logs/route";
import { POST as logsPost } from "@/app/api/logs/route";
import { POST as tasksPost, PATCH as tasksPatch } from "@/app/api/tasks/route";
import { POST as checkinPost } from "@/app/api/checkin/route";
import { POST as progressPost } from "@/app/api/progress/route";
import { POST as focusPost } from "@/app/api/focus/route";
import { POST as trackersPost } from "@/app/api/trackers/route";
import { POST as workoutsPost } from "@/app/api/workouts/route";
import { POST as certificatesPost } from "@/app/api/certificates/route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;

/** 路由处理器的具体签名各不相同（有的带 ctx、有的返回 NextResponse），统一按宽松签名登记 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<any>;

interface Case {
  name: string;
  handler: AnyHandler;
  /** 请求体（字符串原样发送，便于造畸形 JSON） */
  body?: string;
  /** 最小合法请求体：故障注入批用它，确保真正走到写库那一步 */
  validBody?: string;
  method?: string;
  url?: string;
  /** 动态路由参数（`[id]` 这类） */
  params?: Record<string, string>;
  /** `4xx` = 客户端问题必须 4xx；`lt500` = 只要不是 5xx */
  expect: "4xx" | "lt500";
}

const MALFORMED = "{ not json";
const json = (v: unknown) => JSON.stringify(v);
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

const NUTRITION_VALID = json({ date: "2026-09-15", meal: "lunch", name: "米饭", kcal: 230 });

const CASES: Case[] = [
  // 营养：条目写接口
  { name: "nutrition POST / 畸形 JSON", handler: nutritionPost, body: MALFORMED, validBody: NUTRITION_VALID, expect: "4xx" },
  { name: "nutrition POST / 缺名称", handler: nutritionPost, body: json({ kcal: 100 }), validBody: NUTRITION_VALID, expect: "4xx" },
  { name: "nutrition POST / 名称超长 + 热量越界", handler: nutritionPost, body: json({ name: "x".repeat(500), kcal: 1e12 }), validBody: NUTRITION_VALID, expect: "lt500" },
  { name: "nutrition POST / 数量为字符串负数", handler: nutritionPost, body: json({ name: "x", amount: "-3", kcal: "-1" }), validBody: NUTRITION_VALID, expect: "lt500" },
  { name: "nutrition PATCH / 畸形 JSON", handler: nutritionPatch, body: MALFORMED, validBody: json({ id: 1, amount: 2 }), method: "PATCH", expect: "4xx" },
  { name: "nutrition PATCH / id 非数字", handler: nutritionPatch, body: json({ id: "abc" }), validBody: json({ id: 1, amount: 2 }), method: "PATCH", expect: "4xx" },
  { name: "nutrition DELETE / id 非法", handler: nutritionDelete, method: "DELETE", url: "?id=abc", expect: "4xx" },
  // 目标
  { name: "target PUT / 畸形 JSON", handler: targetPut, body: MALFORMED, validBody: json({ weightKg: 70 }), method: "PUT", expect: "4xx" },
  {
    name: "target PUT / 越界与非法枚举",
    handler: targetPut,
    body: json({ weightKg: 9999, heightCm: -5, sex: "x", activityLevel: "y" }),
    validBody: json({ weightKg: 70, heightCm: 175, birthYear: 1996, sex: "male", activityLevel: "light" }),
    method: "PUT",
    expect: "lt500",
  },
  // 常用食物
  { name: "foods POST / 畸形 JSON", handler: foodPost, body: MALFORMED, validBody: json({ name: "自制沙拉", kcal: 250 }), expect: "4xx" },
  { name: "foods POST / 空名称", handler: foodPost, body: json({ name: "  " }), validBody: json({ name: "自制沙拉", kcal: 250 }), expect: "4xx" },
  // 饮水
  { name: "hydration POST / 畸形 JSON", handler: waterPost, body: MALFORMED, validBody: json({ amountMl: 250 }), expect: "4xx" },
  { name: "hydration POST / 负数", handler: waterPost, body: json({ amountMl: -1 }), validBody: json({ amountMl: 250 }), expect: "4xx" },
  { name: "hydration POST / 超上限", handler: waterPost, body: json({ amountMl: 99999 }), validBody: json({ amountMl: 250 }), expect: "4xx" },
  { name: "hydration DELETE / id 非法", handler: waterDelete, method: "DELETE", url: "?id=x", expect: "4xx" },
  // 体重
  { name: "weight POST / 畸形 JSON", handler: weightPost, body: MALFORMED, validBody: json({ weightKg: 62.4 }), expect: "4xx" },
  { name: "weight POST / 无体重", handler: weightPost, body: json({ note: "x" }), validBody: json({ weightKg: 62.4 }), expect: "4xx" },
  { name: "weight DELETE / id 非法", handler: weightDelete, method: "DELETE", url: "?id=0", expect: "4xx" },
  // 习惯（动态路由：注意传 ctx）
  { name: "habits POST / 畸形 JSON", handler: habitsPost, body: MALFORMED, validBody: json({ name: "饮水", isBoolean: false, targetValue: 8 }), expect: "4xx" },
  { name: "habits POST / 空名称", handler: habitsPost, body: json({ name: "" }), validBody: json({ name: "饮水", isBoolean: false, targetValue: 8 }), expect: "4xx" },
  { name: "habits PATCH / 畸形 JSON", handler: habitPatch, body: MALFORMED, validBody: json({ name: "早睡" }), method: "PATCH", params: { id: "7" }, expect: "4xx" },
  { name: "habits PATCH / id 非数字", handler: habitPatch, body: json({ name: "x" }), validBody: json({ name: "早睡" }), method: "PATCH", params: { id: "abc" }, expect: "4xx" },
  { name: "habits DELETE / id 非法", handler: habitDelete, method: "DELETE", params: { id: "abc" }, expect: "4xx" },
  { name: "habit logs POST / 畸形 JSON", handler: habitLogPost, body: MALFORMED, validBody: json({ habitId: 1, date: "2026-09-15", value: 1 }), expect: "4xx" },
  { name: "habit logs POST / 无 habitId", handler: habitLogPost, body: json({ date: "2026-09-15" }), validBody: json({ habitId: 1, date: "2026-09-15", value: 1 }), expect: "4xx" },
  // 学习域
  { name: "logs POST / 畸形 JSON", handler: logsPost, body: MALFORMED, validBody: json({ kind: "feynman", title: "讲稿", body: "内容" }), expect: "4xx" },
  { name: "tasks POST / 畸形 JSON", handler: tasksPost, body: MALFORMED, validBody: json({ title: "背单词", taskDate: "2026-09-15" }), expect: "4xx" },
  { name: "tasks POST / 空标题", handler: tasksPost, body: json({ title: "   " }), validBody: json({ title: "背单词", taskDate: "2026-09-15" }), expect: "4xx" },
  { name: "tasks PATCH / 畸形 JSON", handler: tasksPatch, body: MALFORMED, validBody: json({ id: 1, done: true }), method: "PATCH", expect: "4xx" },
  { name: "tasks PATCH / id 非数字", handler: tasksPatch, body: json({ id: "x" }), validBody: json({ id: 1, done: true }), method: "PATCH", expect: "4xx" },
  { name: "tasks PATCH / id 为超大浮点", handler: tasksPatch, body: json({ id: 1e30 }), validBody: json({ id: 1, done: true }), method: "PATCH", expect: "lt500" },
  // 打卡：没有必填字段，畸形 body 退化为「不带备注打卡」是合理语义（只要不是 5xx）
  { name: "checkin POST / 畸形 JSON（无必填字段，允许成功）", handler: checkinPost, body: MALFORMED, validBody: json({ note: "ok" }), expect: "lt500" },
  { name: "progress POST / 畸形 JSON", handler: progressPost, body: MALFORMED, validBody: json({ topicId: 1, done: true }), expect: "4xx" },
  { name: "progress POST / 百分比越界", handler: progressPost, body: json({ topicId: 1, pct: 9999 }), validBody: json({ topicId: 1, done: true }), expect: "lt500" },
  { name: "focus POST / 畸形 JSON", handler: focusPost, body: MALFORMED, validBody: json({ clientId: "c1", durationSeconds: 1500 }), expect: "4xx" },
  { name: "focus POST / 时长超大", handler: focusPost, body: json({ clientId: "c1", durationSeconds: 1e12 }), validBody: json({ clientId: "c1", durationSeconds: 1500 }), expect: "lt500" },
  { name: "trackers POST / 畸形 JSON", handler: trackersPost, body: MALFORMED, validBody: json({ career: "ict", name: "单词量", unit: "个" }), expect: "4xx" },
  { name: "workouts POST / 畸形 JSON", handler: workoutsPost, body: MALFORMED, validBody: json({ name: "胸部训练", durationSeconds: 2400 }), expect: "4xx" },
  { name: "certificates POST / 畸形 JSON", handler: certificatesPost, body: MALFORMED, validBody: json({ name: "HCIA", issuer: "华为" }), expect: "4xx" },
];

function makeRequest(c: Case, bodyOverride?: string): Request {
  const method = c.method ?? "POST";
  const init: RequestInit = { method };
  const payload = bodyOverride ?? c.body;
  if (payload !== undefined) {
    init.body = payload;
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(`http://localhost/api/x${c.url ?? ""}`, init);
}

const run = (c: Case, bodyOverride?: string) =>
  c.handler(makeRequest(c, bodyOverride), c.params ? ctx(c.params) : undefined);

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rows: [] } as never);
  vi.mocked(pgPool.connect).mockResolvedValue({
    query: vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  } as never);
  userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
});

describe.each([
  ["已登录", { uid: "u-1", anonId: null }],
  ["匿名设备", { uid: null, anonId: "anon-1" }],
])("A. 写接口输入健壮性 · %s", (_label, scope) => {
  beforeEach(() => {
    userScopeMock.mockResolvedValue(scope as never);
  });

  for (const c of CASES) {
    it(c.name, async () => {
      const res = await run(c);
      expect(res.status).toBeLessThan(500);
      if (c.expect === "4xx") {
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      }
    });
  }
});

describe.each([
  ["已登录", { uid: "u-1", anonId: null }],
  ["匿名设备", { uid: null, anonId: "anon-1" }],
])("B. 写库时约束冲突（最小合法请求体）· %s", (_label, scope) => {
  beforeEach(() => {
    userScopeMock.mockResolvedValue(scope as never);
  });

  /**
   * 只让**写语句**失败（INSERT/UPDATE/DELETE），读语句正常返回空集。
   * 理由：读失败导致 500 是合理的 HTTP 语义（服务端依赖不可用）；
   * 而「客户端数据触发 CHECK/唯一键约束」必须翻译成 4xx —— 这才是要守的边界。
   */
  function armWriteFailure() {
    const pgError = Object.assign(new Error('new row violates check constraint "x_check"'), { code: "23514" });
    queryMock.mockImplementation((async (sql: unknown) => {
      const s = String(sql).trimStart().toUpperCase();
      if (s.startsWith("SELECT") || s.startsWith("WITH") || s.startsWith("INSERT")) {
        // INSERT ... ON CONFLICT / RETURNING 也走写路径：这里只放行纯读与幂等预查
        if (s.startsWith("INSERT")) throw pgError;
        return { rows: [] };
      }
      throw pgError;
    }) as never);
    vi.mocked(pgPool.connect).mockResolvedValue({
      query: vi.fn(async () => {
        throw pgError;
      }),
      release: vi.fn(),
    } as never);
  }

  for (const c of CASES) {
    it(`${c.name} / 不抛异常`, async () => {
      armWriteFailure();
      let res: Response | null = null;
      let thrown: unknown = null;
      try {
        res = await run(c, c.validBody);
      } catch (e) {
        thrown = e;
      }
      // 未捕获异常在生产会变成 500：必须显式暴露
      expect(thrown).toBeNull();
      expect(res).not.toBeNull();
      expect((res as Response).status).toBeLessThan(500);
    });
  }
});
