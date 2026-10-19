import { describe, expect, it } from "vitest";
import { buildLoginRedirect, shouldGuardSession } from "./use-session-guard";

describe("shouldGuardSession", () => {
  it("公开路径不校验会话（匿名访客不会被踢去登录）", () => {
    expect(shouldGuardSession("/")).toBe(false);
    expect(shouldGuardSession("/login")).toBe(false);
    expect(shouldGuardSession("/login/reset")).toBe(false);
    expect(shouldGuardSession("/share")).toBe(false);
    expect(shouldGuardSession("/share/sport/1")).toBe(false);
  });

  it("非公开路径需要校验会话", () => {
    expect(shouldGuardSession("/dashboard")).toBe(true);
    expect(shouldGuardSession("/settings")).toBe(true);
    expect(shouldGuardSession("/share-not-public")).toBe(true);
  });

  it("空值保守处理：宁可校验", () => {
    expect(shouldGuardSession("")).toBe(true);
    expect(shouldGuardSession(null)).toBe(true);
    expect(shouldGuardSession(undefined)).toBe(true);
  });
});

describe("buildLoginRedirect", () => {
  it("带 from 来源路径（URL 编码，登录后可回跳）", () => {
    expect(buildLoginRedirect("/dashboard")).toBe("/login?from=%2Fdashboard");
    expect(buildLoginRedirect("/settings/content")).toBe("/login?from=%2Fsettings%2Fcontent");
  });
});
