import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { GET, equipmentImageUrl } from "./route";

const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("equipmentImageUrl", () => {
  it("桶内相对路径 → /equipment/ 站内地址（分段编码）", () => {
    expect(equipmentImageUrl("badminton-racket/yonex-astrox99.webp")).toBe(
      "/equipment/badminton-racket/yonex-astrox99.webp"
    );
    expect(equipmentImageUrl("badminton-racket/中文 名.webp")).toContain("%E4%B8%AD");
  });
});

describe("GET /api/equipment", () => {
  it("只查已上架条目，并返回站内图片地址", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 1, category: "badminton-racket", brand: "YONEX", model: "ASTROX 99 PRO",
          imagePath: "badminton-racket/yonex-astrox-99-pro.webp", width: 900, height: 900,
        },
      ],
    } as never);
    const res = await GET(new Request("http://localhost/api/equipment?category=badminton-racket"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].imageUrl).toBe("/equipment/badminton-racket/yonex-astrox-99-pro.webp");
    expect(String(queryMock.mock.calls[0][0])).toContain("is_listed = true");
    expect(String(queryMock.mock.calls[0][0])).toContain("category = $1");
    expect(res.headers.get("Cache-Control")).toContain("max-age=600");
  });

  it("关键词同时匹配型号与品牌，limit 超过 100 被钳到 100", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/equipment?q=ASTROX&limit=999"));
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("model ILIKE $1");
    expect(sql).toContain("brand ILIKE $1");
    expect((queryMock.mock.calls[0][1] as unknown[])[1]).toBe(100);
  });

  it("无参数时默认 40 条", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await GET(new Request("http://localhost/api/equipment"));
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe(40);
  });
});
