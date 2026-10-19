import { describe, expect, it } from "vitest";
import {
  contentImageMeta,
  contentImageSrcSet,
  contentImageVariantUrl,
  isContentImageUrl,
  toManifestKey,
} from "./content-image";

/** 清单里真实存在的一张（1020×990，只生成了 640w 档） */
const SMALL = "/content-images/2009-03-1-redraw.06248cc2ed2a.png";
/** 清单里真实存在的一张（1920×830，两档都有） */
const LARGE = "/content-images/2009-04-1-redraw-20260927.41ac8fed75e2.png";

describe("isContentImageUrl", () => {
  it("只认 /content-images/ 下的原图", () => {
    expect(isContentImageUrl(SMALL)).toBe(true);
    expect(isContentImageUrl("https://cdn.example.com/a.png")).toBe(false);
    expect(isContentImageUrl("/holo/soccer/subject.webp")).toBe(false);
    expect(isContentImageUrl("/content-images/foo@640w.webp")).toBe(false);
    expect(isContentImageUrl("")).toBe(false);
  });
});

describe("toManifestKey", () => {
  it("去掉 query 与 hash", () => {
    expect(toManifestKey(SMALL + "?v=2")).toBe(SMALL);
    expect(toManifestKey(SMALL + "#top")).toBe(SMALL);
  });
});

describe("contentImageMeta", () => {
  it("命中清单返回宽高与档位", () => {
    expect(contentImageMeta(SMALL)).toEqual({ width: 1020, height: 990, widths: [640] });
    expect(contentImageMeta(LARGE)).toEqual({ width: 1920, height: 830, widths: [640, 1280] });
  });

  it("外部/未知图片返回 null（回退原图）", () => {
    expect(contentImageMeta("https://cdn.example.com/a.png")).toBeNull();
    expect(contentImageMeta("/content-images/not-generated.png")).toBeNull();
  });

  it("返回的 widths 是副本，调用方改不坏清单", () => {
    const meta = contentImageMeta(LARGE);
    meta?.widths.push(9999);
    expect(contentImageMeta(LARGE)?.widths).toEqual([640, 1280]);
  });
});

describe("contentImageVariantUrl", () => {
  it("按约定推导 WebP 路径", () => {
    expect(contentImageVariantUrl(SMALL, 640)).toBe(
      "/content-images/2009-03-1-redraw.06248cc2ed2a@640w.webp"
    );
    expect(contentImageVariantUrl(LARGE + "?v=2", 1280)).toBe(
      "/content-images/2009-04-1-redraw-20260927.41ac8fed75e2@1280w.webp"
    );
  });

  it("宽度非法时抛错（避免拼出坏 URL）", () => {
    expect(() => contentImageVariantUrl(SMALL, 0)).toThrow();
    expect(() => contentImageVariantUrl(SMALL, 12.5)).toThrow();
  });
});

describe("contentImageSrcSet", () => {
  it("按档位升序输出带 w 描述符的 srcSet", () => {
    expect(contentImageSrcSet(LARGE)).toBe(
      "/content-images/2009-04-1-redraw-20260927.41ac8fed75e2@640w.webp 640w, " +
        "/content-images/2009-04-1-redraw-20260927.41ac8fed75e2@1280w.webp 1280w"
    );
  });

  it("无清单记录返回 undefined", () => {
    expect(contentImageSrcSet("/content-images/not-generated.png")).toBeUndefined();
  });
});
