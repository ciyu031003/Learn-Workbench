import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { GET, POST, normalizePairs, normalizeRecord, normalizeSignatureMove } from "./route";

const queryMock = vi.mocked(pgPool.query);
const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("normalizePairs", () => {
  it("keeps labelled entries and caps at 20", () => {
    const out = normalizePairs([
      { label: "球拍", value: "雷霆80" },
      { label: "  " },
      { value: "无标签" },
      null,
    ]);
    expect(out).toEqual([{ label: "球拍", value: "雷霆80" }]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizePairs("x")).toEqual([]);
  });
});

describe("GET /api/sports/profiles", () => {
  it("returns an empty list for anonymous visitors without calling currentUserId", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ profiles: [] });
    expect(userMock).not.toHaveBeenCalled();
  });

  it("lists the user's profiles", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ id: 1, sportKey: "badminton" }] } as never);
    const res = await GET();
    expect((await res.json()).profiles).toHaveLength(1);
  });
});

describe("POST /api/sports/profiles", () => {
  it("requires login", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects a missing sportKey", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: {} });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("upserts a profile with gear and a share slug when public", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: {
        sportKey: "badminton", identity: "双打搭子", levelText: "中羽 1 级", handedness: "right",
        playStyle: "混双", gear: [{ label: "球拍", value: "雷霆80" }], isPublic: true,
      },
    });
    queryMock.mockResolvedValue({ rows: [{ id: 1, sportKey: "badminton", isPublic: true }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(args[1]).toBe("badminton");
    expect(args[4]).toBe("right");
    expect(JSON.parse(String(args[7]))).toEqual([{ label: "球拍", value: "雷霆80" }]);
    expect(args[9]).toBe(true);
    // 公开时生成分享短链
    expect(String(args[10])).toMatch(/^sp-/);
  });

  it("drops an invalid handedness", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { sportKey: "badminton", handedness: "both" } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect((queryMock.mock.calls[0][1] as unknown[])[4]).toBeNull();
  });

  it("把战绩（场次/胜/负）与绝技一起写库", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { sportKey: "badminton", matchesPlayed: 20, wins: 15, losses: 5, signatureMove: "疾风·劈杀" },
    });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[11]).toBe(20);
    expect(args[12]).toBe(15);
    expect(args[13]).toBe(5);
    expect(args[14]).toBe("疾风·劈杀");
  });

  it("未填战绩时写 0（不产生 null 违反 NOT NULL）", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { sportKey: "tennis" } });
    queryMock.mockResolvedValue({ rows: [{ id: 2 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[11]).toBe(0);
    expect(args[12]).toBe(0);
    expect(args[13]).toBe(0);
    expect(args[14]).toBeNull();
  });
});

describe("normalizeRecord", () => {
  it("场次取「填写场次」与「胜+负」的较大者，并算出胜率", () => {
    expect(normalizeRecord({ matchesPlayed: 20, wins: 15, losses: 5 })).toEqual({ matches: 20, wins: 15, losses: 5, winRate: 75 });
    // 只填胜负时场次自动补全，避免卡面显示 0 场
    expect(normalizeRecord({ wins: 6, losses: 4 })).toEqual({ matches: 10, wins: 6, losses: 4, winRate: 60 });
  });

  it("负数与非法值归零，小数截断", () => {
    expect(normalizeRecord({ matchesPlayed: -5, wins: "abc", losses: 2.7 })).toEqual({ matches: 2, wins: 0, losses: 2, winRate: 0 });
    expect(normalizeRecord({})).toEqual({ matches: 0, wins: 0, losses: 0, winRate: null });
  });
});

describe("normalizeSignatureMove", () => {
  it("裁剪空白并截断到 40 字", () => {
    expect(normalizeSignatureMove("  疾风·劈杀  ")).toBe("疾风·劈杀");
    expect(normalizeSignatureMove("")).toBeNull();
    expect(normalizeSignatureMove(null)).toBeNull();
    expect(normalizeSignatureMove(undefined)).toBeNull();
    expect(normalizeSignatureMove("x".repeat(80))?.length).toBe(40);
  });
});
