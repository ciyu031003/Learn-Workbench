import { describe, expect, it } from "vitest";
import {
  DAILY_CARD_PLAN,
  bucketKeyOf,
  drillBucketKey,
  filterUnseen,
  localDateKey,
  parseDrillPointerStore,
  pickRoundOrder,
  roundOrderPosition,
  parseSeenStore,
  pruneDrillPointerStore,
  resolveDrillResumeIndex,
} from "./drill-progress-core";

describe("drill-progress", () => {
  it("keeps the daily plan at 20 cards", () => {
    expect(DAILY_CARD_PLAN).toBe(20);
  });

  it("builds a local date key without UTC drift", () => {
    expect(localDateKey(new Date(2026, 10, 14, 0, 30))).toBe("2026-11-14");
    expect(localDateKey(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });

  it("uses a stable bucket for the all-subject scope", () => {
    expect(bucketKeyOf("")).toBe("all");
    expect(bucketKeyOf("   ")).toBe("all");
    expect(bucketKeyOf("data-structure")).toBe("data-structure");
  });

  it("filters seen cards and preserves queue order", () => {
    const cards = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(filterUnseen(cards, [])).toEqual(cards);
    expect(filterUnseen(cards, ["a", "c"])).toEqual([{ key: "b" }]);
    expect(filterUnseen(cards, ["x"])).toEqual(cards);
  });

  it("parses a stored bucket and drops malformed entries", () => {
    const raw = JSON.stringify({
      all: { date: "2026-11-14", keys: ["a", "b"] },
      bad: { date: 1, keys: ["x"] },
      half: { date: "2026-11-14" },
    });
    expect(parseSeenStore(raw)).toEqual({ all: { date: "2026-11-14", keys: ["a", "b"] } });
    expect(parseSeenStore("not json")).toEqual({});
    expect(parseSeenStore(null)).toEqual({});
  });
});

describe("drill pointer（续播位置）", () => {
  const today = "2026-11-16";

  it("按 cardKey 恢复：服务端插卡/删卡后仍停在同一张", () => {
    const cards = [{ key: "c" }, { key: "d" }, { key: "e" }];
    const pointer = { date: today, cardKey: "d", index: 0 };
    expect(resolveDrillResumeIndex(cards, pointer, today)).toBe(1);
  });

  it("卡片不在队列里时退回保存的 index，并夹在范围内", () => {
    const cards = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(resolveDrillResumeIndex(cards, { date: today, cardKey: "gone", index: 2 }, today)).toBe(2);
    expect(resolveDrillResumeIndex(cards, { date: today, cardKey: "gone", index: 99 }, today)).toBe(2);
    expect(resolveDrillResumeIndex(cards, { date: today, cardKey: "gone", index: -3 }, today)).toBe(0);
  });

  it("跨天 / 空队列 / 没有指针都从第一张开始", () => {
    const cards = [{ key: "a" }, { key: "b" }];
    expect(resolveDrillResumeIndex(cards, { date: "2026-11-15", cardKey: "b", index: 1 }, today)).toBe(0);
    expect(resolveDrillResumeIndex([], { date: today, cardKey: "a", index: 0 }, today)).toBe(0);
    expect(resolveDrillResumeIndex(cards, null, today)).toBe(0);
  });

  it("今日队列与易错本的指针分桶，互不影响", () => {
    expect(drillBucketKey("data-structure", "queue")).toBe("queue|data-structure");
    expect(drillBucketKey("", "mistake")).toBe("mistake|all");
  });

  it("解析损坏数据时丢弃异常项", () => {
    const raw = JSON.stringify({
      "queue|ds": { date: today, cardKey: "a", index: 3 },
      "queue|bad": { date: 1, cardKey: "b", index: 0 },
      "queue|half": { date: today, cardKey: "" },
    });
    expect(parseDrillPointerStore(raw)).toEqual({
      "queue|ds": { date: today, cardKey: "a", index: 3 },
      "queue|half": { date: today, cardKey: "", index: 0 },
    });
    expect(parseDrillPointerStore("nope")).toEqual({});
  });

  it("只保留当天指针", () => {
    const store = {
      a: { date: today, cardKey: "k", index: 1 },
      b: { date: "2026-11-15", cardKey: "k", index: 2 },
    };
    expect(pruneDrillPointerStore(store, today)).toEqual({ a: store.a });
  });

  it("已看卡被过滤后，重进停在它后面的第一张（今日队列 10/20 场景）", () => {
    const full = [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }, { key: "e" }];
    const remaining = full.filter((card) => card.key !== "c");
    const pointer = { date: today, cardKey: "c", index: 2 };
    // c 已看 → 从 d 继续，而不是回到 a
    expect(resolveDrillResumeIndex(remaining, pointer, today, full)).toBe(2);
    expect(remaining[2].key).toBe("d");
  });

  it("服务端在指针卡前插入新卡时，仍按 cardKey 定位", () => {
    const full = [{ key: "new" }, { key: "a" }, { key: "b" }];
    const pointer = { date: today, cardKey: "b", index: 1 };
    expect(resolveDrillResumeIndex(full, pointer, today, full)).toBe(2);
  });

  it("指针卡被服务端移除时，按原槽位停在补位上来的那张", () => {
    const full = [{ key: "a" }, { key: "c" }, { key: "d" }];
    const pointer = { date: today, cardKey: "b", index: 1 };
    expect(resolveDrillResumeIndex(full, pointer, today, full)).toBe(1);
    expect(full[1].key).toBe("c");
  });

  it("看到最后一张后重进：未看的 a/b 不会被吞掉，从剩余队列开头继续", () => {
    const full = [{ key: "a" }, { key: "b" }, { key: "c" }];
    const remaining = full.filter((card) => card.key !== "c");
    const pointer = { date: today, cardKey: "c", index: 2 };
    expect(resolveDrillResumeIndex(remaining, pointer, today, full)).toBe(0);
  });

  it("全部看完（剩余为空）时由调用方走完成态，不会回到第一张", () => {
    const full = [{ key: "a" }, { key: "b" }];
    const pointer = { date: today, cardKey: "b", index: 1 };
    expect(resolveDrillResumeIndex([], pointer, today, full)).toBe(0);
  });

  it("整轮快照比剩余队列长时，用快照计算第 11 / 20 张", () => {
    const snapshot = Array.from({ length: 20 }, (_, i) => ({ key: "k" + (i + 1) }));
    const remaining = snapshot.slice(10);
    const order = pickRoundOrder(remaining, snapshot);
    expect(order).toHaveLength(20);
    expect(roundOrderPosition(order, remaining[0].key, 0)).toBe(10);
    expect(roundOrderPosition(order, remaining[9].key, 9)).toBe(19);
  });

  it("服务端新增卡不在快照里时：保留快照顺序并把新卡接在后面", () => {
    const snapshot = [{ key: "a" }, { key: "b" }, { key: "c" }];
    const current = [{ key: "new" }, { key: "b" }];
    expect(pickRoundOrder(current, snapshot)).toEqual([
      { key: "a" }, { key: "b" }, { key: "c" }, { key: "new" },
    ]);
    const order = pickRoundOrder(current, snapshot);
    // 新卡被接在快照后面：位置是第 4 张（下标 3）
    expect(roundOrderPosition(order, "new", 2)).toBe(3);
    // 完全找不到的卡（极端脏数据）：退回本会话下标，不显示成第 1 张
    expect(roundOrderPosition(order, "ghost", 2)).toBe(2);
  });

  it("没有 fullOrder 时保留旧口径：夹在当前队列范围内", () => {
    const remaining = [{ key: "a" }, { key: "b" }];
    const pointer = { date: today, cardKey: "gone", index: 9 };
    expect(resolveDrillResumeIndex(remaining, pointer, today)).toBe(1);
  });
});
