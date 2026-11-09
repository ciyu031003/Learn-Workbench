import { describe, expect, it } from "vitest";
import { identityInitial, identityName } from "./identity-name";

describe("identityName", () => {
  it("prefers nickname, then login name, then brand fallback", () => {
    expect(identityName(" 阿梨 ", "admin")).toBe("阿梨");
    expect(identityName(null, "admin")).toBe("admin");
    expect(identityName("", null)).toBe("学习工作台");
  });
});

describe("identityInitial", () => {
  it("takes one full code point", () => {
    expect(identityInitial("阿梨")).toBe("阿");
    expect(identityInitial("admin")).toBe("A");
    expect(identityInitial("😀小明")).toBe("😀");
    expect(identityInitial("")).toBe("旅");
  });
});
