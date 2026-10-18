import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { allowLegacyAnonCookie, isUuid, signAnonCookieValue, verifyAnonCookieValue } from "./anon-cookie";

const UUID = "11111111-2222-3333-4444-555555555555";
const SECRET = "test-secret-0123456789";

describe("anon-cookie（S1-7 签名）", () => {
  beforeEach(() => {
    process.env.ANON_COOKIE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.ANON_COOKIE_SECRET;
    delete process.env.ANON_COOKIE_ALLOW_LEGACY;
  });

  it("isUuid 只接受 UUID 形态", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("签名后能 round-trip 出原 uuid", () => {
    const signed = signAnonCookieValue(UUID);
    expect(signed.startsWith(UUID + ".")).toBe(true);
    expect(verifyAnonCookieValue(signed)).toBe(UUID);
  });

  it("篡改 uuid 或签名都会被拒绝", () => {
    const signed = signAnonCookieValue(UUID);
    const [, sig] = signed.split(".");
    expect(verifyAnonCookieValue("22222222-2222-3333-4444-555555555555." + sig)).toBeNull();
    expect(verifyAnonCookieValue(UUID + "." + sig.slice(0, -1) + "A")).toBeNull();
    expect(verifyAnonCookieValue(UUID + ".short")).toBeNull();
  });

  it("兼容旧版未签名 UUID（默认开启），可关闭", () => {
    expect(allowLegacyAnonCookie()).toBe(true);
    expect(verifyAnonCookieValue(UUID)).toBe(UUID);
    process.env.ANON_COOKIE_ALLOW_LEGACY = "0";
    expect(verifyAnonCookieValue(UUID)).toBeNull();
  });

  it("没有密钥时（本地开发）只做形态校验", () => {
    delete process.env.ANON_COOKIE_SECRET;
    delete process.env.CRON_SECRET;
    expect(verifyAnonCookieValue(UUID)).toBe(UUID);
    expect(signAnonCookieValue(UUID)).toBe(UUID);
    expect(verifyAnonCookieValue("garbage")).toBeNull();
  });

  it("空值返回 null", () => {
    expect(verifyAnonCookieValue(null)).toBeNull();
    expect(verifyAnonCookieValue("")).toBeNull();
    expect(verifyAnonCookieValue("   ")).toBeNull();
  });
});
