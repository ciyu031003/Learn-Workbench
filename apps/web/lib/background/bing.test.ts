import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  DEFAULT_BING_DAYS,
  bingStartDateToIso,
  buildBingArchiveUrl,
  clampBingDays,
  fetchBingWallpapers,
  getBackgroundImage,
  getBackgroundSummary,
  md5Hex,
  parseJpegSize,
  resolveBingImageUrl,
} from "./bing";

const queryMock = vi.mocked(pgPool.query);
const warnMock = vi.mocked(logger.warn);

/** 造一张带 SOF0 的最小 JPEG（宽高可控），用于解析测试。 */
function jpegBytes(width = 1920, height = 1080, padTo = 2048): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.alloc(2 + 16);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0.writeUInt16BE(16, 2);
  const sof = Buffer.alloc(2 + 17);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8; // precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3; // components
  const eoi = Buffer.from([0xff, 0xd9]);
  const head = Buffer.concat([soi, app0, sof, eoi]);
  if (head.length >= padTo) return head;
  return Buffer.concat([head, Buffer.alloc(padTo - head.length)]);
}

const apiJson = (dates: string[]) =>
  JSON.stringify({
    images: dates.map((startdate) => ({
      startdate,
      urlbase: "/th?id=OHR.Test_" + startdate,
      copyright: "测试版权 " + startdate,
    })),
  });

function imageResponse(buffer: Buffer) {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("天数与 URL", () => {
  it("days 默认 7，并被夹到 1-8", () => {
    expect(clampBingDays(undefined)).toBe(DEFAULT_BING_DAYS);
    expect(clampBingDays(0)).toBe(1);
    expect(clampBingDays(99)).toBe(8);
    expect(clampBingDays(3.9)).toBe(3);
  });

  it("HPImageArchive URL 带 format/idx/n/mkt", () => {
    const url = buildBingArchiveUrl(7);
    expect(url).toContain("HPImageArchive.aspx");
    expect(url).toContain("format=js");
    expect(url).toContain("idx=0");
    expect(url).toContain("n=7");
    expect(url).toContain("mkt=zh-CN");
  });

  it("startdate 转 ISO 日期，非法值返回 null", () => {
    expect(bingStartDateToIso("20261031")).toBe("2026-10-31");
    expect(bingStartDateToIso("20260231")).toBeNull();
    expect(bingStartDateToIso("2026-10-31")).toBeNull();
    expect(bingStartDateToIso(undefined)).toBeNull();
  });

  it("下载地址优先 urlbase + 1920x1080", () => {
    expect(resolveBingImageUrl({ urlbase: "/th?id=OHR.X" })).toBe(
      "https://www.bing.com/th?id=OHR.X_1920x1080.jpg",
    );
    expect(resolveBingImageUrl({ url: "/th?id=OHR.Y&pid=hp" })).toBe(
      "https://www.bing.com/th?id=OHR.Y&pid=hp",
    );
    expect(resolveBingImageUrl({ url: "https://cdn.example/x.jpg" })).toBe("https://cdn.example/x.jpg");
    expect(resolveBingImageUrl({})).toBeNull();
  });
});

describe("JPEG 尺寸与 md5", () => {
  it("从 SOF0 解析宽高", () => {
    expect(parseJpegSize(jpegBytes(1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(parseJpegSize(jpegBytes(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it("非 JPEG 返回 null", () => {
    expect(parseJpegSize(Buffer.from("not-a-jpeg"))).toBeNull();
    expect(parseJpegSize(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("md5 稳定", () => {
    expect(md5Hex(Buffer.from("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("fetchBingWallpapers", () => {
  it("抓取多天并 upsert（首次 saved=N，第二次 updated=N=幂等）", async () => {
    const jpg = jpegBytes();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(apiJson(["20261031", "20261030"]), { status: 200 }))
      .mockResolvedValueOnce(imageResponse(jpg))
      .mockResolvedValueOnce(imageResponse(jpg));
    const queryable = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ inserted: true }] })
        .mockResolvedValueOnce({ rows: [{ inserted: true }] })
        .mockResolvedValueOnce({ rows: [{ inserted: false }] })
        .mockResolvedValueOnce({ rows: [{ inserted: false }] }),
    };

    const first = await fetchBingWallpapers({ days: 2, fetchImpl, queryable });
    expect(first.saved).toBe(2);
    expect(first.updated).toBe(0);
    expect(first.dates).toEqual(["2026-10-30", "2026-10-31"]);
    expect(first.failed).toEqual([]);

    const sql = String(queryable.query.mock.calls[0]?.[0]);
    expect(sql).toContain("INSERT INTO background_images");
    expect(sql).toContain("ON CONFLICT (source, image_date) DO UPDATE");
    expect(sql).toContain("image_data");
    const params = queryable.query.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toBe("bing");
    expect(params[1]).toBe("2026-10-31");
    expect(params[7]).toBe("测试版权 20261031");
    expect(Buffer.isBuffer(params[8])).toBe(true);

    fetchImpl
      .mockResolvedValueOnce(new Response(apiJson(["20261031", "20261030"]), { status: 200 }))
      .mockResolvedValueOnce(imageResponse(jpg))
      .mockResolvedValueOnce(imageResponse(jpg));
    const second = await fetchBingWallpapers({ days: 2, fetchImpl, queryable });
    expect(second.saved).toBe(0);
    expect(second.updated).toBe(2);
  });

  it("单日下载失败只跳过该日，不阻断其它日期", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(apiJson(["20261031", "20261030"]), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(imageResponse(jpegBytes()));
    const queryable = { query: vi.fn().mockResolvedValue({ rows: [{ inserted: true }] }) };

    const result = await fetchBingWallpapers({ days: 2, fetchImpl, queryable });
    expect(result.saved).toBe(1);
    expect(result.dates).toEqual(["2026-10-30"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.date).toBe("2026-10-31");
    expect(warnMock).toHaveBeenCalled();
  });

  it("接口失败时返回空结果并记录错误", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const result = await fetchBingWallpapers({ days: 7, fetchImpl, queryable: { query: vi.fn() } });
    expect(result).toMatchObject({ saved: 0, updated: 0, dates: [] });
    expect(result.failed[0]?.date).toBe("*");
  });

  it("接口没有 images 时同样安全返回", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ images: [] }), { status: 200 }));
    const result = await fetchBingWallpapers({ days: 7, fetchImpl, queryable: { query: vi.fn() } });
    expect(result.saved).toBe(0);
    expect(result.failed[0]?.date).toBe("*");
  });
});

describe("读路径", () => {
  it("getBackgroundSummary 映射 DB 行（今日优先由 SQL 排序）", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          image_date: "2026-10-31",
          remote_url: "https://www.bing.com/x.jpg",
          copyright: "版权",
          width: 1920,
          height: 1080,
          mime: "image/jpeg",
        },
      ],
    } as never);
    const summary = await getBackgroundSummary("2026-10-31");
    expect(summary).toEqual({
      date: "2026-10-31",
      remoteUrl: "https://www.bing.com/x.jpg",
      copyright: "版权",
      width: 1920,
      height: 1080,
      mime: "image/jpeg",
    });
    const sql = String(queryMock.mock.calls[0]?.[0]);
    expect(sql).toContain("image_data IS NOT NULL");
    expect(sql).toContain("ORDER BY (image_date = $2::date) DESC");
  });

  it("getBackgroundSummary 无行返回 null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await expect(getBackgroundSummary("2026-10-31")).resolves.toBeNull();
  });

  it("getBackgroundImage 返回二进制与 mime；无数据返回 null", async () => {
    const data = jpegBytes(320, 200, 1200);
    queryMock.mockResolvedValueOnce({
      rows: [{ image_data: data, mime: "image/jpeg", md5_hash: "abc", updated_at: new Date("2026-10-31T00:00:00Z") }],
    } as never);
    const image = await getBackgroundImage("2026-10-31");
    expect(image?.data.length).toBe(data.length);
    expect(image?.mime).toBe("image/jpeg");
    expect(image?.md5).toBe("abc");

    queryMock.mockResolvedValueOnce({ rows: [{ image_data: null }] } as never);
    await expect(getBackgroundImage("2026-10-31")).resolves.toBeNull();
  });
});
