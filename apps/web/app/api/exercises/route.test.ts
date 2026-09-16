import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { EXERCISE_CATALOG } from "@learn-workbench/shared";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

const req = (qs = "") => new Request(`https://learn.yuanabd.cn/api/exercises${qs}`);

const dbRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "7",
  key: "bench-press",
  name: "卧推",
  muscle_group: "胸",
  category: "STRENGTH",
  equipment: "杠铃",
  ...over,
});

describe("GET /api/exercises", () => {
  it("从库里返回动作字典（含 camelCase 字段映射）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [dbRow(), dbRow({ id: 9, key: "squat", name: "深蹲", muscle_group: "腿" })] } as never);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.exercises).toHaveLength(2);
    expect(body.exercises[0]).toEqual({
      id: 7,
      key: "bench-press",
      name: "卧推",
      muscleGroup: "胸",
      category: "STRENGTH",
      equipment: "杠铃",
    });
  });

  it("把 q / category / limit 透传给 SQL（参数化，不做字符串拼接）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [dbRow()] } as never);
    await GET(req("?q=卧推&category=strength&limit=5"));
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("FROM exercise_items");
    expect(String(sql)).toContain("$1::text");
    expect(params).toEqual(["卧推", "strength", 5]);
  });

  it("把 q 里的 LIKE 通配符转义（否则 ?q=% 库路径匹配全部、回退路径匹配 0 条）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [dbRow()] } as never);
    await GET(req("?q=100%25_off"));
    const [sql, params] = queryMock.mock.calls[0];
    expect(params[0]).toBe("100\\%\\_off");
    expect(String(sql)).toContain("ESCAPE");
  });

  it("limit 非法/越界时钳制，缺失时用默认 100", async () => {
    queryMock.mockResolvedValue({ rows: [dbRow()] } as never);
    await GET(req("?limit=9999"));
    expect(queryMock.mock.calls[0][1]).toEqual(["", "", 200]);
    await GET(req("?limit=abc"));
    expect(queryMock.mock.calls[1][1]).toEqual(["", "", 100]);
    await GET(req(""));
    expect(queryMock.mock.calls[2][1]).toEqual(["", "", 100]);
    await GET(req("?limit=0"));
    expect(queryMock.mock.calls[3][1]).toEqual(["", "", 1]);
  });

  it("库为空时回退内置目录（id 为 null，客户端用 key 标识）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await GET(req());
    const body = await res.json();
    expect(body.exercises).toHaveLength(EXERCISE_CATALOG.length);
    expect(body.exercises[0]).toMatchObject({ id: null, key: "bench-press", name: "卧推", muscleGroup: "胸" });
    expect(body.exercises.every((e: { id: number | null }) => e.id === null)).toBe(true);
  });

  it("库不可用（未迁移/连接失败）同样回退，且覆盖 40+ 个健身房动作", async () => {
    queryMock.mockRejectedValueOnce(new Error("relation \"exercise_items\" does not exist"));
    const res = await GET(req());
    const body = await res.json();
    expect(body.exercises.length).toBeGreaterThanOrEqual(40);
    const keys = body.exercises.map((e: { key: string }) => e.key);
    for (const k of ["bench-press", "deadlift", "squat", "pull-up", "lateral-raise", "triceps-pushdown", "plank", "hip-thrust"]) {
      expect(keys).toContain(k);
    }
  });

  it("回退路径支持 q（中文名 / 部位 / 器械）与 category 过滤", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    const byName = await (await GET(req("?q=硬拉"))).json();
    expect(byName.exercises.map((e: { name: string }) => e.name)).toEqual(["硬拉", "罗马尼亚硬拉", "相扑硬拉"]);

    const byMuscle = await (await GET(req("?q=肩"))).json();
    expect(byMuscle.exercises.length).toBeGreaterThanOrEqual(8);
    expect(byMuscle.exercises.every((e: { muscleGroup: string }) => e.muscleGroup === "肩")).toBe(true);

    const aerobic = await (await GET(req("?category=AEROBIC&limit=3"))).json();
    expect(aerobic.exercises).toHaveLength(3);
    expect(aerobic.exercises.every((e: { category: string }) => e.category === "AEROBIC")).toBe(true);

    const none = await (await GET(req("?category=BALL"))).json();
    expect(none.exercises).toEqual([]);
  });
});
