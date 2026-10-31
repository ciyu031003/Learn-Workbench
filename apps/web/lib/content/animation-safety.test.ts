import { describe, expect, it } from "vitest";
import { assertAnimationFramesSafe, isDangerousSvg } from "./animation-safety";

describe("isDangerousSvg（评审 2026-10-31 P2）", () => {
  it("拦截脚本/嵌入/样式注入标签", () => {
    for (const svg of [
      '<svg><script>alert(1)</script></svg>',
      '<iframe src="https://evil"></iframe>',
      '<foreignObject><body><img src=x onerror=alert(1)></body></foreignObject>',
      '<style>@import url(https://evil)</style>',
    ]) {
      expect(isDangerousSvg(svg), svg).toBe(true);
    }
  });

  it("拦截任意 on* 事件属性（含 SMIL 的 onbegin/onend/onrepeat）", () => {
    for (const svg of [
      '<svg onload="alert(1)">',
      '<rect onerror="alert(1)">',
      '<animate onbegin="alert(1)" dur="1s"/>',
      '<animate onend="alert(1)"/>',
      '<animate onrepeat="alert(1)"/>',
    ]) {
      expect(isDangerousSvg(svg), svg).toBe(true);
    }
  });

  it("拦截脚本协议与 data:text/html，拦截 use/image 外部引用，放行同文档片段", () => {
    expect(isDangerousSvg('<a href="javascript:alert(1)">x</a>')).toBe(true);
    expect(isDangerousSvg('<image href="data:text/html;base64,PHN2Zz4=" />')).toBe(true);
    expect(isDangerousSvg('<use href="https://evil/sprite.svg#x" />')).toBe(true);
    expect(isDangerousSvg('<use xlink:href="/uploads/a.svg#x" />')).toBe(true);
    // 同文档片段引用是合法用法
    expect(isDangerousSvg('<use href="#glyph-arrow" />')).toBe(false);
    expect(isDangerousSvg('<use xlink:href="#glyph-arrow" />')).toBe(false);
  });

  it("正常算法动图（含 SMIL animate/desc/text）放行", () => {
    const legit =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
      '<rect x="0" y="0" width="200" height="100" fill="#fff"/>' +
      '<animate attributeName="x" from="0" to="80" begin="0.3s" dur="1.2s" repeatCount="indefinite"/>' +
      '<text x="10" y="20">compare a[1] &lt; a[2]</text></svg>';
    expect(isDangerousSvg(legit)).toBe(false);
  });
});

describe("assertAnimationFramesSafe", () => {
  it("危险帧抛错并带 key/下标；正常帧与畸形行放行", () => {
    expect(() =>
      assertAnimationFramesSafe([{ caption: "ok", svg: "<svg><circle/></svg>" }], "bubble")
    ).not.toThrow();
    expect(() => assertAnimationFramesSafe([], "bubble")).not.toThrow();
    expect(() => assertAnimationFramesSafe(undefined, "bubble")).not.toThrow();
    expect(() =>
      assertAnimationFramesSafe([{ caption: "x" }, { caption: "bad", svg: '<animate onload="x"/>' }], "bubble")
    ).toThrow("bubble#1");
  });
});
