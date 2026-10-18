import { describe, expect, it } from "vitest";
import { PUBLIC_PREFIXES, isPublicPath } from "./public-routes";

describe("PUBLIC_PREFIXES", () => {
  it("包含根路径、登录页与分享页", () => {
    expect([...PUBLIC_PREFIXES]).toEqual(["/", "/login", "/share"]);
  });
});

describe("isPublicPath", () => {
  it('根路径 "/" 命中（只匹配根，不做前缀匹配）', () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/roadmap")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });

  it("登录页命中自身与子路径，但不吞掉同前缀路径", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/reset")).toBe(true);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("分享页命中自身与子路径，但不吞掉同前缀路径", () => {
    expect(isPublicPath("/share")).toBe(true);
    expect(isPublicPath("/share/sport/1")).toBe(true);
    expect(isPublicPath("/share/a/b/c")).toBe(true);
    expect(isPublicPath("/sharel")).toBe(false);
  });

  it("归一化尾部斜杠", () => {
    expect(isPublicPath("/share/")).toBe(true);
    expect(isPublicPath("/share/sport/1/")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
  });

  it("剥离 query / hash（服务端与带参调用结果一致）", () => {
    expect(isPublicPath("/share/sport/1?from=wechat")).toBe(true);
    expect(isPublicPath("/login?from=%2Fdashboard")).toBe(true);
    expect(isPublicPath("/share/sport/1#detail")).toBe(true);
    expect(isPublicPath("/dashboard?x=1")).toBe(false);
  });

  it("空值不视为公开路径（保守：宁可校验会话）", () => {
    expect(isPublicPath("")).toBe(false);
    expect(isPublicPath(null)).toBe(false);
    expect(isPublicPath(undefined)).toBe(false);
  });
});
