import { describe, it, expect, vi } from "vitest";

// AsyncStorage 是原生模块，vitest 下必须 mock（看板踩坑点 13）
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  EMPTY_OUTBOX,
  dequeue,
  enqueue,
  hasPendingFor,
  makeCreateOp,
  makeDeleteOp,
  makeUpdateOp,
  mergePendingEntries,
  nextLocalId,
  peek,
  pendingCount,
  type MealEntryInput,
} from "./nutrition-outbox";

const body = (name: string): MealEntryInput => ({
  date: "2026-09-15",
  meal: "lunch",
  name,
  amount: 1,
  unit: "份",
  kcal: 200,
  proteinG: 10,
  carbsG: 20,
  fatG: 5,
});

/**
 * v3 M4 离线发件箱契约：合并规则必须精确，否则会产生重复记录或丢改动。
 */
describe("nutrition outbox · 队列与合并", () => {
  it("create 入队并在 flush 顺序上排最后（先进先出）", () => {
    const s1 = enqueue(EMPTY_OUTBOX, makeCreateOp(body("米饭"), nextLocalId()));
    const s2 = enqueue(s1, makeCreateOp(body("牛奶"), nextLocalId()));
    expect(pendingCount(s2)).toBe(2);
    expect(peek(s2)?.kind).toBe("create");
  });

  it("同 clientId 的 create 只保留一条（重复点击不重复上传）", () => {
    const op = makeCreateOp(body("米饭"), nextLocalId(), "cid-1");
    const s1 = enqueue(EMPTY_OUTBOX, op);
    const s2 = enqueue(s1, { ...op, opId: "another" });
    expect(pendingCount(s2)).toBe(1);
    expect(s2.ops[0].opId).toBe("another");
  });

  it("编辑尚未上传的记录 → 合并进 create，不产生第二次请求", () => {
    const localId = nextLocalId();
    const s1 = enqueue(EMPTY_OUTBOX, makeCreateOp(body("米饭"), localId));
    const s2 = enqueue(s1, makeUpdateOp(localId, { amount: 2.5, kcal: 500 }));
    expect(pendingCount(s2)).toBe(1);
    const op = s2.ops[0];
    expect(op.kind).toBe("create");
    if (op.kind === "create") {
      expect(op.body.amount).toBe(2.5);
      expect(op.body.kcal).toBe(500);
      expect(op.body.name).toBe("米饭");
    }
  });

  it("删除尚未上传的记录 → 直接丢弃 create（不留脏请求）", () => {
    const localId = nextLocalId();
    const s1 = enqueue(EMPTY_OUTBOX, makeCreateOp(body("米饭"), localId));
    const s2 = enqueue(s1, makeDeleteOp(localId));
    expect(pendingCount(s2)).toBe(0);
  });

  it("已上传记录的多次编辑 → 合并成一条 update", () => {
    const s1 = enqueue(EMPTY_OUTBOX, makeUpdateOp(42, { amount: 2 }));
    const s2 = enqueue(s1, makeUpdateOp(42, { kcal: 400 }));
    expect(pendingCount(s2)).toBe(1);
    const op = s2.ops[0];
    if (op.kind === "update") {
      expect(op.body).toEqual({ amount: 2, kcal: 400 });
    }
  });

  it("删除已上传记录 → 去掉待发送的 update，只留 delete", () => {
    const s1 = enqueue(EMPTY_OUTBOX, makeUpdateOp(42, { amount: 2 }));
    const s2 = enqueue(s1, makeDeleteOp(42));
    expect(pendingCount(s2)).toBe(1);
    expect(s2.ops[0].kind).toBe("delete");
  });

  it("找不到对应本地记录的 update 被丢弃（不产生脏请求）", () => {
    const s1 = enqueue(EMPTY_OUTBOX, makeUpdateOp(-999, { amount: 2 }));
    expect(pendingCount(s1)).toBe(0);
  });

  it("hasPendingFor 覆盖 create(localId) 与 update/delete(id)", () => {
    const localId = nextLocalId();
    const s1 = enqueue(EMPTY_OUTBOX, makeCreateOp(body("米饭"), localId));
    expect(hasPendingFor(s1, localId)).toBe(true);
    const s2 = enqueue(s1, makeUpdateOp(7, { amount: 2 }));
    expect(hasPendingFor(s2, 7)).toBe(true);
    expect(hasPendingFor(s2, 8)).toBe(false);
  });

  it("dequeue 只移除指定操作", () => {
    const a = makeCreateOp(body("A"), nextLocalId());
    const b = makeCreateOp(body("B"), nextLocalId());
    const s = enqueue(enqueue(EMPTY_OUTBOX, a), b);
    const after = dequeue(s, a.opId);
    expect(pendingCount(after)).toBe(1);
    expect((after.ops[0] as { body: MealEntryInput }).body.name).toBe("B");
  });

  it("nextLocalId 稳定返回负数且不重复", () => {
    const a = nextLocalId();
    const b = nextLocalId();
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(0);
    expect(a).not.toBe(b);
  });

  it("mergePendingEntries：待同步条目在服务端刷新后依然可见（v6 P0-3）", () => {
    const localId = nextLocalId();
    const s = enqueue(EMPTY_OUTBOX, makeCreateOp(body("番茄鸡蛋面"), localId));
    const merged = mergePendingEntries([], s);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(localId);
    expect(merged[0].name).toBe("番茄鸡蛋面");
  });

  it("mergePendingEntries：服务端已有同一条时不重复插入", () => {
    const localId = nextLocalId();
    const s = enqueue(EMPTY_OUTBOX, makeCreateOp(body("鸡蛋"), localId));
    const server = [
      { id: 7, logDate: "2026-09-15", meal: "lunch" as const, foodId: null, name: "鸡蛋", amount: 1,
        unit: "个", kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3 },
    ];
    const merged = mergePendingEntries(server, s);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(7);
  });

  it("mergePendingEntries：服务端列表原样在前，待同步条目追加在后", () => {
    const s = enqueue(EMPTY_OUTBOX, makeCreateOp(body("牛奶"), nextLocalId()));
    const server = [
      { id: 1, logDate: "2026-09-15", meal: "breakfast" as const, foodId: null, name: "馒头", amount: 1,
        unit: "个", kcal: 223, proteinG: 7, carbsG: 47, fatG: 1.1 },
    ];
    const merged = mergePendingEntries(server, s);
    expect(merged.map((e) => e.name)).toEqual(["馒头", "牛奶"]);
  });

  it("mergePendingEntries：没有待同步时原样返回（保持引用）", () => {
    const server = [
      { id: 1, logDate: "2026-09-15", meal: "lunch" as const, foodId: null, name: "米饭", amount: 1,
        unit: "碗", kcal: 232, proteinG: 4.8, carbsG: 51.6, fatG: 0.6 },
    ];
    expect(mergePendingEntries(server, EMPTY_OUTBOX)).toBe(server);
  });
});
