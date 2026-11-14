import { describe, expect, it } from "vitest";
import { DAILY_CARD_PLAN, bucketKeyOf, filterUnseen, localDateKey, parseSeenStore } from "./drill-progress-core";

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
