import { describe, expect, it } from "vitest";
import { countArray, countOps, describeLedger, summarizeLedger } from "./sync-ledger-core";

const base = {
  businessCount: 0,
  businessOldestAt: null as string | null,
  nutrition: 0,
  upload: 0,
  learning: 0,
  exam408: 0,
};

describe("sync ledger core", () => {
  it("sums five channels into one total", () => {
    const ledger = summarizeLedger({
      ...base,
      businessCount: 3,
      businessOldestAt: "2026-11-17T01:00:00.000Z",
      nutrition: 2,
      upload: 1,
      learning: 4,
    });
    expect(ledger.total).toBe(10);
    expect(ledger.byChannel).toEqual({ business: 3, nutrition: 2, upload: 1, learning: 4, exam408: 0 });
    expect(ledger.oldestPendingAt).toBe("2026-11-17T01:00:00.000Z");
    expect(ledger.loaded).toBe(true);
  });

  it("clamps negative / NaN counts", () => {
    const ledger = summarizeLedger({ ...base, businessCount: -5, nutrition: Number.NaN });
    expect(ledger.total).toBe(0);
    expect(ledger.oldestPendingAt).toBeNull();
  });

  it("only reports oldest when business changes exist", () => {
    const ledger = summarizeLedger({ ...base, nutrition: 1, businessOldestAt: "2026-11-17T01:00:00.000Z" });
    expect(ledger.oldestPendingAt).toBeNull();
    expect(ledger.total).toBe(1);
  });

  it("parses op queues and arrays, and never lies on corrupt data", () => {
    expect(countOps(null)).toBe(0);
    expect(countOps(JSON.stringify({ ops: [1, 2] }))).toBe(2);
    expect(countOps(JSON.stringify([1]))).toBe(1);
    expect(countOps("{broken")).toBeNull();
    expect(countArray(JSON.stringify([1, 2, 3]))).toBe(3);
    expect(countArray("nope")).toBeNull();
  });

  it("describes without zero channels", () => {
    const ledger = summarizeLedger({ ...base, businessCount: 2, nutrition: 1, exam408: 3 });
    expect(describeLedger(ledger)).toBe("待同步 6 条（记录 2 · 饮食 1 · 刷卡 3）");
    expect(describeLedger(null)).toBe("正在读取待同步队列…");
    expect(describeLedger({ ...ledger, total: 0 })).toBe("全部已同步");
  });
});
