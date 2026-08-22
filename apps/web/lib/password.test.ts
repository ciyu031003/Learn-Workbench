import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "./password";

describe("password", () => {
  it("hashes and verifies a correct password", async () => {
    const stored = await hashPassword("s3cret!");
    expect(stored).toMatch(/^scrypt:65536:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(needsRehash(stored)).toBe(false);
    expect(await verifyPassword("s3cret!", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct-password");
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("uses a random salt so the same password hashes differently", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("verifies legacy salt:hash format and marks it for rehash", async () => {
    // 旧格式：Node scrypt 默认参数（N=16384, r=8, p=1, keylen=64）
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync("legacy-pw", salt, 64).toString("hex");
    const stored = `${salt}:${hash}`;
    expect(needsRehash(stored)).toBe(true);
    expect(await verifyPassword("legacy-pw", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("returns false for malformed stored values", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "no-colon")).toBe(false);
    expect(await verifyPassword("x", "abc:zzz")).toBe(false);
  });
});