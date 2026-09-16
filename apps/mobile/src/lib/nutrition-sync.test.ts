import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v4 P1-4 回归防线：饮食写操作的**四分类**发货 + 发件箱毒丸跳过。
 *
 * 背景（v1.3.5 真机反馈）：旧实现把"任何非 2xx / 任何异常"都当成"网络不可用"，
 * 于是明明开着流量也一直弹「当前网络不可用，联网后会自动补发」。
 */

const mem = vi.hoisted(() => ({ data: {} as Record<string, string> }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.data[k] ?? null,
    setItem: async (k: string, v: string) => {
      mem.data[k] = v;
    },
    removeItem: async (k: string) => {
      delete mem.data[k];
    },
  },
}));

const net = vi.hoisted(() => ({
  type: "WIFI" as string,
  reachable: true as boolean | undefined,
}));
vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", WIFI: "WIFI", CELLULAR: "CELLULAR" },
  getNetworkStateAsync: async () => ({ type: net.type, isInternetReachable: net.reachable }),
}));

vi.mock("@/config", () => ({ getApiUrl: () => "https://example.test" }));

import { EMPTY_OUTBOX, flushOutbox, makeCreateOp, saveOutbox, type MealEntryInput } from "./nutrition-outbox";
import { flushNutritionOutbox, isRetryable, sendNutritionOp, toFlushOutcome } from "./nutrition-sync";

const body = (name: string): MealEntryInput => ({
  date: "2026-09-16",
  meal: "lunch",
  name,
  amount: 1,
  unit: "份",
  kcal: 300,
  proteinG: 10,
  carbsG: 30,
  fatG: 8,
});

function mockFetch(impl: (url: string) => { status: number; ok?: boolean; error?: string } | "throw") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const r = impl(String(url));
      if (r === "throw") throw new TypeError("Network request failed");
      return {
        ok: r.ok ?? (r.status >= 200 && r.status < 300),
        status: r.status,
        json: async () => (r.error ? { error: r.error } : {}),
      } as unknown as Response;
    })
  );
}

describe("sendNutritionOp · 四分类", () => {
  beforeEach(() => {
    net.type = "WIFI";
    net.reachable = true;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("2xx → ok", async () => {
    mockFetch(() => ({ status: 201 }));
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), "tok");
    expect(r.ok).toBe(true);
  });

  it("401 → auth（保留在队列里等登录，但要让用户知道）", async () => {
    mockFetch(() => ({ status: 401, error: "未登录" }));
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), null);
    expect(r).toMatchObject({ ok: false, kind: "auth", status: 401 });
    expect(isRetryable(r)).toBe(true);
    expect(toFlushOutcome(r)).toBe("retry");
  });

  it("500 → server（可重试，静默入队）", async () => {
    mockFetch(() => ({ status: 500, error: "保存失败，请稍后重试" }));
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), "tok");
    expect(r).toMatchObject({ ok: false, kind: "server", status: 500 });
    expect(isRetryable(r)).toBe(true);
  });

  it("400 → client：带服务端原因、不入队（重试永远不会成功）", async () => {
    mockFetch(() => ({ status: 400, error: "食物名称不能为空" }));
    const r = await sendNutritionOp(makeCreateOp(body(""), 1), "tok");
    expect(r).toMatchObject({ ok: false, kind: "client", status: 400, message: "食物名称不能为空" });
    expect(isRetryable(r)).toBe(false);
    expect(toFlushOutcome(r)).toBe("drop");
  });

  it("404 → client（例如食物已下架）", async () => {
    mockFetch(() => ({ status: 404, error: "未找到食物" }));
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), "tok");
    expect(r).toMatchObject({ ok: false, kind: "client", status: 404 });
  });

  it("请求抛异常 + 设备无网 → offline（静默入队）", async () => {
    net.type = "NONE";
    net.reachable = false;
    mockFetch(() => "throw");
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), "tok");
    expect(r).toMatchObject({ ok: false, kind: "offline" });
    expect(isRetryable(r)).toBe(true);
  });

  it("请求抛异常但设备有网（连接被拒/TLS）→ server，而不是误报没网", async () => {
    mockFetch(() => "throw");
    const r = await sendNutritionOp(makeCreateOp(body("米饭"), 1), "tok");
    expect(r).toMatchObject({ ok: false, kind: "server" });
  });
});

describe("flushOutbox · 毒丸跳过", () => {
  afterEach(() => {
    mem.data = {};
    vi.unstubAllGlobals();
  });

  it("4xx 的那条被丢弃后继续处理后续记录（旧实现会永久堵住队首）", async () => {
    let state = EMPTY_OUTBOX;
    state = (await import("./nutrition-outbox")).enqueue(state, makeCreateOp(body("毒丸"), 1));
    state = (await import("./nutrition-outbox")).enqueue(state, makeCreateOp(body("正常"), 2));
    await saveOutbox(state);

    const seen: number[] = [];
    const result = await flushOutbox(async (op) => {
      seen.push(op.kind === "create" ? op.localId : -1);
      return op.kind === "create" && op.localId === 1 ? "drop" : "ok";
    });

    expect(seen).toEqual([1, 2]);
    expect(result).toMatchObject({ sent: 1, dropped: 1, remaining: 0 });
  });

  it("retry 时停下并保留该条与后续", async () => {
    let state = EMPTY_OUTBOX;
    const { enqueue } = await import("./nutrition-outbox");
    state = enqueue(state, makeCreateOp(body("A"), 1));
    state = enqueue(state, makeCreateOp(body("B"), 2));
    await saveOutbox(state);

    const result = await flushOutbox(async () => "retry");
    expect(result).toMatchObject({ sent: 0, dropped: 0, remaining: 2 });
  });
});

describe("flushNutritionOutbox", () => {
  afterEach(() => {
    mem.data = {};
    vi.unstubAllGlobals();
  });

  it("离线时保留队列、不抛错（供 sync-engine 静默调用）", async () => {
    net.type = "NONE";
    net.reachable = false;
    const { enqueue } = await import("./nutrition-outbox");
    await saveOutbox(enqueue(EMPTY_OUTBOX, makeCreateOp(body("米饭"), 1)));
    mockFetch(() => "throw");
    const r = await flushNutritionOutbox(null);
    expect(r.remaining).toBe(1);
  });
});
