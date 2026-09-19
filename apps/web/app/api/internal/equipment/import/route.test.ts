import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { POST, isSafeEquipmentPath } from "./route";

const queryMock = vi.mocked(pgPool.query);

function post(body: unknown, secret = "s3cret") {
  return new Request("http://localhost/api/internal/equipment/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
  queryMock.mockResolvedValue({ rows: [] } as never);
});

afterEach(() => vi.unstubAllEnvs());

describe("isSafeEquipmentPath", () => {
  it("只接受 <category>/<file>.webp", () => {
    expect(isSafeEquipmentPath("badminton-racket/a-b.webp")).toBe(true);
    expect(isSafeEquipmentPath("../etc/passwd")).toBe(false);
    expect(isSafeEquipmentPath("badminton-racket/a.png")).toBe(false);
    expect(isSafeEquipmentPath("badminton-racket/../../a.webp")).toBe(false);
  });
});

describe("POST /api/internal/equipment/import", () => {
  it("缺密钥或密钥不对返回 403", async () => {
    const res = await POST(post({ items: [{ category: "badminton-racket", brand: "Y", model: "M", path: "badminton-racket/a.webp" }] }, "wrong"));
    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("空 items 返回 400", async () => {
    const res = await POST(post({ items: [] }));
    expect(res.status).toBe(400);
  });

  it("非法分类/路径被跳过，合法条目 upsert", async () => {
    const res = await POST(
      post({
        items: [
          { category: "badminton-racket", brand: "YONEX", model: "ASTROX 99 PRO", path: "badminton-racket/yonex-astrox.webp", width: 900, height: 900, bytes: 1234 },
          { category: "evil", brand: "X", model: "Y", path: "badminton-racket/a.webp" },
          { category: "badminton-shoes", brand: "YONEX", model: "65Z3", path: "../../etc/passwd" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.skipped).toHaveLength(2);
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (category, brand, model) DO UPDATE");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("超过 500 条直接拒绝", async () => {
    const items = Array.from({ length: 501 }, () => ({ category: "badminton-racket", brand: "Y", model: "M", path: "badminton-racket/a.webp" }));
    const res = await POST(post({ items }));
    expect(res.status).toBe(400);
  });
});
