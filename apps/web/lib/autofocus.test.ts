import { describe, it, expect } from "vitest";
import { parseAutofocusParams } from "./autofocus";

describe("parseAutofocusParams", () => {
  it("解析一键学习：autofocus=study&minutes=25", () => {
    expect(parseAutofocusParams("?autofocus=study&minutes=25")).toEqual({ mode: "focus", minutes: 25 });
  });

  it("解析一键运动：autofocus=exercise&minutes=30", () => {
    expect(parseAutofocusParams("?autofocus=exercise&minutes=30")).toEqual({ mode: "exercise", minutes: 30 });
  });

  it("运动模式解析 label 与 stype（写入运动记录）", () => {
    expect(parseAutofocusParams("?autofocus=exercise&minutes=30&label=" + encodeURIComponent("篮球") + "&stype=BALL")).toEqual({
      mode: "exercise", minutes: 30, label: "篮球", stype: "BALL",
    });
    // stype 非法枚举被丢弃；label 空白被丢弃
    expect(parseAutofocusParams("?autofocus=exercise&label=%20&stype=HACK")).toEqual({ mode: "exercise", minutes: undefined });
    // focus 模式不带运动参数
    expect(parseAutofocusParams("?autofocus=study&minutes=25&label=X")).toEqual({ mode: "focus", minutes: 25 });
  });

  it("autofocus 缺省或非法时返回 null（忽略）", () => {
    expect(parseAutofocusParams("")).toBeNull();
    expect(parseAutofocusParams("?minutes=25")).toBeNull();
    expect(parseAutofocusParams("?autofocus=foo&minutes=25")).toBeNull();
    expect(parseAutofocusParams("?autofocus=STUDY")).toBeNull(); // 大小写敏感
  });

  it("minutes 缺省/非法/超界时回退 undefined（用计时器默认时长）", () => {
    expect(parseAutofocusParams("?autofocus=study")).toEqual({ mode: "focus", minutes: undefined });
    expect(parseAutofocusParams("?autofocus=exercise&minutes=abc")).toEqual({ mode: "exercise", minutes: undefined });
    expect(parseAutofocusParams("?autofocus=study&minutes=0")).toEqual({ mode: "focus", minutes: undefined });
    expect(parseAutofocusParams("?autofocus=study&minutes=-5")).toEqual({ mode: "focus", minutes: undefined });
    expect(parseAutofocusParams("?autofocus=exercise&minutes=99999")).toEqual({ mode: "exercise", minutes: undefined });
    expect(parseAutofocusParams("?autofocus=study&minutes=Infinity")).toEqual({ mode: "focus", minutes: undefined });
  });

  it("minutes 边界值 1 和 180 生效，181 回退", () => {
    expect(parseAutofocusParams("?autofocus=study&minutes=1")).toEqual({ mode: "focus", minutes: 1 });
    expect(parseAutofocusParams("?autofocus=study&minutes=180")).toEqual({ mode: "focus", minutes: 180 });
    expect(parseAutofocusParams("?autofocus=study&minutes=181")).toEqual({ mode: "focus", minutes: undefined });
  });

  it("minutes 小数取整", () => {
    expect(parseAutofocusParams("?autofocus=exercise&minutes=29.6")).toEqual({ mode: "exercise", minutes: 30 });
  });
});
