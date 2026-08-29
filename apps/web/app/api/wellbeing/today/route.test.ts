import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/wellbeing", () => ({ buildTodayPlan: vi.fn() }));
vi.mock("@learn-workbench/shared", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, todayISO: vi.fn(() => "2026-08-29") };
});
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { buildTodayPlan } from "@/lib/wellbeing";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const planMock = vi.mocked(buildTodayPlan);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/wellbeing/today", () => {
  it("aggregates hydration/focus/energy/breaks into the today payload", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, amountMl: 500, source: "MANUAL", recordedAt: "x" }] } as never); // hydration
    queryMock.mockResolvedValueOnce({ rows: [{ id: 2, targetMl: 2500 }] } as never);                                  // goal
    queryMock.mockResolvedValueOnce({ rows: [{ id: 3, level: 4 }] } as never);                                       // energy
    queryMock.mockResolvedValueOnce({ rows: [{ seconds: 3600 }] } as never);                                         // focus
    queryMock.mockResolvedValueOnce({ rows: [] } as never);                                                          // breaks
    queryMock.mockResolvedValueOnce({ rows: [] } as never);                                                          // reminders due
    planMock.mockImplementation(({ focusMinutes }) => [{ time: "09:00", kind: "focus", label: `${focusMinutes}`, hint: "" }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-08-29");
    expect(body.hydration.totalMl).toBe(500);
    expect(body.hydration.targetMl).toBe(2500);
    expect(body.energy.level).toBe(4);
    expect(body.focusTodayMinutes).toBe(60);
    expect(body.nextBreakDue).toBe(true);
    expect(planMock).toHaveBeenCalledWith(expect.objectContaining({ focusMinutes: 60, energyLevel: 4, breakDue: true }));
    expect(body.plan).toEqual([{ time: "09:00", kind: "focus", label: "60", hint: "" }]);
  });

  it("defaults target to 2000 and energy to null when empty", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    planMock.mockReturnValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body.hydration.targetMl).toBe(2000);
    expect(body.energy).toBeNull();
    expect(body.focusTodayMinutes).toBe(0);
  });
});

