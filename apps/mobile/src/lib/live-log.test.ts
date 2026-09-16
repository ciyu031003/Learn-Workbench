import { describe, expect, it } from "vitest";
import {
  DEFAULT_BACKGROUND_ID,
  LIVE_BACKGROUNDS,
  LIVE_LOG_MAX_STICKERS,
  addSticker,
  backgroundById,
  clearStickers,
  createLiveLog,
  cycleBackground,
  initialPlacement,
  moveSticker,
  parseLiveLog,
  removeSticker,
} from "./live-log";

describe("LiveLog · 贴纸增删", () => {
  it("新文档是空的、带版本号与默认背景", () => {
    const doc = createLiveLog();
    expect(doc.version).toBe(1);
    expect(doc.stickers).toHaveLength(0);
    expect(doc.bgId).toBe(DEFAULT_BACKGROUND_ID);
  });

  it("加贴纸：位置来自槽位、带轻微旋转、时间戳更新", () => {
    const doc = addSticker(createLiveLog(), "苹果");
    expect(doc.stickers).toHaveLength(1);
    expect(doc.stickers[0].name).toBe("苹果");
    expect(doc.stickers[0].rotate).not.toBe(0);
    expect(Number.isNaN(Date.parse(doc.updatedAt))).toBe(false);
  });

  it("空名字不加；到上限后不再加（返回原引用，调用方据此提示）", () => {
    let doc = createLiveLog();
    doc = addSticker(doc, "   ");
    expect(doc.stickers).toHaveLength(0);

    for (let i = 0; i < LIVE_LOG_MAX_STICKERS; i += 1) doc = addSticker(doc, `食物${i}`);
    expect(doc.stickers).toHaveLength(LIVE_LOG_MAX_STICKERS);
    const full = addSticker(doc, "多余的一张");
    expect(full).toBe(doc);
  });

  it("移动/缩放/旋转都会被夹到合法范围（拖出画布也回得来）", () => {
    let doc = addSticker(createLiveLog(), "米饭");
    const id = doc.stickers[0].id;
    doc = moveSticker(doc, id, { x: 5, y: -3, scale: 99, rotate: 400 });
    expect(doc.stickers[0]).toMatchObject({ x: 0.92, y: 0.08, scale: 2, rotate: 30 });
  });

  it("移动不存在的 id 时原样返回（避免无意义的重渲染）", () => {
    const doc = addSticker(createLiveLog(), "米饭");
    expect(moveSticker(doc, "nope", { x: 0.2 })).toBe(doc);
  });

  it("删除与清空", () => {
    let doc = addSticker(addSticker(createLiveLog(), "A"), "B");
    doc = removeSticker(doc, doc.stickers[0].id);
    expect(doc.stickers.map((s) => s.name)).toEqual(["B"]);
    expect(clearStickers(doc).stickers).toHaveLength(0);
  });
});

describe("LiveLog · 槽位与背景", () => {
  it("初始槽位散开且都在安全区内，第一轮不重复", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const p = initialPlacement(i);
      expect(p.x).toBeGreaterThanOrEqual(0.08);
      expect(p.x).toBeLessThanOrEqual(0.92);
      expect(p.y).toBeGreaterThanOrEqual(0.08);
      expect(p.y).toBeLessThanOrEqual(0.92);
      seen.add(`${p.x},${p.y}`);
    }
    expect(seen.size).toBe(8);
  });

  it("超过槽位数后仍然夹在安全区（第二轮微偏移）", () => {
    for (let i = 8; i < 20; i += 1) {
      const p = initialPlacement(i);
      expect(p.x).toBeGreaterThanOrEqual(0.08);
      expect(p.x).toBeLessThanOrEqual(0.92);
      expect(p.y).toBeGreaterThanOrEqual(0.08);
      expect(p.y).toBeLessThanOrEqual(0.92);
    }
  });

  it("背景循环切换，并且能跳过不可用的（Bing 拉不到图时）", () => {
    let doc = createLiveLog("dawn");
    doc = cycleBackground(doc, 1);
    expect(doc.bgId).toBe("meadow");
    doc = cycleBackground(doc, -1);
    expect(doc.bgId).toBe("dawn");

    // 跳过 bing 后循环里不再出现它
    const ids = new Set<string>();
    let cursor = createLiveLog("dawn");
    for (let i = 0; i < 8; i += 1) {
      cursor = cycleBackground(cursor, 1, ["bing"]);
      ids.add(cursor.bgId);
    }
    expect(ids.has("bing")).toBe(false);
    expect(ids.size).toBe(LIVE_BACKGROUNDS.length - 1);
  });

  it("未知背景 id 回落到默认（本机数据可能来自旧版本）", () => {
    expect(backgroundById("nope").id).toBe(DEFAULT_BACKGROUND_ID);
    expect(backgroundById("bing").kind).toBe("remote");
  });
});

describe("LiveLog · 本机存储容错解析", () => {
  it("非字符串 / 空 / 坏 JSON / 结构不对 → null（调用方新建空文档）", () => {
    expect(parseLiveLog(null)).toBeNull();
    expect(parseLiveLog("")).toBeNull();
    expect(parseLiveLog("{oops")).toBeNull();
    expect(parseLiveLog(JSON.stringify({ version: 2, stickers: [] }))).toBeNull();
    expect(parseLiveLog(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it("解析合法文档并夹取越界坐标、补齐缺失 id", () => {
    const raw = JSON.stringify({
      version: 1,
      updatedAt: "2026-09-16T10:00:00.000Z",
      bgId: "meadow",
      stickers: [
        { name: "苹果", x: 9, y: -1 },
        { name: "", x: 0.5, y: 0.5 },
        { name: "米饭", x: 0.4, y: 0.4, scale: 1.4, rotate: -12 },
      ],
    });
    const doc = parseLiveLog(raw);
    expect(doc).not.toBeNull();
    expect(doc!.bgId).toBe("meadow");
    expect(doc!.stickers).toHaveLength(2); // 空名字被丢弃
    expect(doc!.stickers[0]).toMatchObject({ name: "苹果", x: 0.92, y: 0.08 });
    expect(doc!.stickers[0].id).toBeTruthy();
    expect(doc!.stickers[1]).toMatchObject({ name: "米饭", scale: 1.4, rotate: -12 });
  });

  it("未知背景回落默认；贴纸条数按上限截断", () => {
    const raw = JSON.stringify({
      version: 1,
      bgId: "ancient",
      stickers: Array.from({ length: 40 }, (_, i) => ({ name: `F${i}`, x: 0.5, y: 0.5 })),
    });
    const doc = parseLiveLog(raw);
    expect(doc!.bgId).toBe(DEFAULT_BACKGROUND_ID);
    expect(doc!.stickers).toHaveLength(LIVE_LOG_MAX_STICKERS);
  });
});
