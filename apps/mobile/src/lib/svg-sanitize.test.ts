import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSvgSanitizeCache,
  sanitizeSvgForNative,
  svgSanitizeCacheSize,
} from "./svg-sanitize";

const RECT_WITH_POINTER_EVENTS =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#333" pointer-events="all" /></svg>';

beforeEach(() => {
  clearSvgSanitizeCache();
});

describe("sanitizeSvgForNative", () => {
  it("删除 pointer-events=\"all\"（线上崩溃根因）", () => {
    const output = sanitizeSvgForNative(RECT_WITH_POINTER_EVENTS);
    expect(output).not.toContain("pointer-events");
    expect(output).toContain('<rect x="1" y="1" width="8" height="8" fill="#333" />');
  });

  it("删除 none / 单引号 / 无引号值，保留其余属性", () => {
    expect(sanitizeSvgForNative('<path pointer-events="none" d="M0 0" />')).toBe('<path d="M0 0" />');
    expect(sanitizeSvgForNative("<rect pointer-events='all' fill='red' />")).toBe("<rect fill='red' />");
    expect(sanitizeSvgForNative("<rect pointer-events=all fill=red />")).toBe("<rect fill=red />");
  });

  it("删除 camelCase pointerEvents（防御性）", () => {
    expect(sanitizeSvgForNative('<rect pointerEvents="all" fill="red" />')).toBe('<rect fill="red" />');
  });

  it("style 内的 pointer-events 声明被删掉，其余声明保留", () => {
    const output = sanitizeSvgForNative('<rect style="fill: red; pointer-events: all; stroke-width: 2" />');
    expect(output).toBe('<rect style="fill: red; stroke-width: 2" />');
    expect(output).not.toContain("pointer-events");
  });

  it("style 只有 pointer-events 时整个 style 属性移除", () => {
    expect(sanitizeSvgForNative('<rect style="pointer-events:none" fill="red" />')).toBe('<rect fill="red" />');
    expect(sanitizeSvgForNative("<rect style='pointer-events:all' />")).toBe("<rect />");
  });

  it("普通 SVG 原样返回（不改变合法内容）", () => {
    const normal =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path d="M2 2h20v20H2z" fill="url(#g)"/><use xlink:href="#g" data-name="keep"/></svg>';
    expect(sanitizeSvgForNative(normal)).toBe(normal);
  });

  it("移除 script / foreignObject，保留普通图形", () => {
    const output = sanitizeSvgForNative(
      '<svg><script>alert(1)</script><foreignObject><div>x</div></foreignObject><circle cx="1" cy="1" r="1"/></svg>',
    );
    expect(output).not.toContain("<script");
    expect(output).not.toContain("foreignObject");
    expect(output).toContain('<circle cx="1" cy="1" r="1"/>');
  });

  it("空串 / 非字符串安全返回空串", () => {
    expect(sanitizeSvgForNative("")).toBe("");
    expect(sanitizeSvgForNative(null as unknown as string)).toBe("");
    expect(sanitizeSvgForNative(undefined as unknown as string)).toBe("");
  });

  it("有界缓存：同串命中缓存、清空后重新计算", () => {
    const first = sanitizeSvgForNative(RECT_WITH_POINTER_EVENTS);
    expect(svgSanitizeCacheSize()).toBe(1);
    const second = sanitizeSvgForNative(RECT_WITH_POINTER_EVENTS);
    expect(second).toBe(first);
    expect(svgSanitizeCacheSize()).toBe(1);
    clearSvgSanitizeCache();
    expect(svgSanitizeCacheSize()).toBe(0);
    expect(sanitizeSvgForNative(RECT_WITH_POINTER_EVENTS)).toBe(first);
  });
});
