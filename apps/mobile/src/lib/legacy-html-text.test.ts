import { describe, expect, it } from "vitest";
import { normalizeLegacyHtmlText, sanitizeLearningTracks } from "./legacy-html-text";
import type { LearningTrack } from "@learn-workbench/content/types";

describe("normalizeLegacyHtmlText", () => {
  it("restores scraped <p> paragraphs into plain text", () => {
    expect(
      normalizeLegacyHtmlText("<p>a = [1,2,3]</p><p>print(len(a))</p><p>以上代码输出结果为？</p>")
    ).toBe("a = [1,2,3]\n\nprint(len(a))\n\n以上代码输出结果为？");
  });

  it("keeps isolated tags that are the question content", () => {
    const css = "选择所有 <p> 元素的 CSS 选择器是？";
    expect(normalizeLegacyHtmlText(css)).toBe(css);
    expect(normalizeLegacyHtmlText("<p>")).toBe("<p>");
    expect(normalizeLegacyHtmlText("正确答案：A. <br>")).toBe("正确答案：A. <br>");
  });

  it("decodes entities only inside real HTML blocks", () => {
    expect(normalizeLegacyHtmlText("<p>a &lt; b</p><p>c &amp; d</p>")).toBe("a < b\n\nc & d");
    expect(normalizeLegacyHtmlText("XML 中实体引用 &lt; 表示什么？")).toBe("XML 中实体引用 &lt; 表示什么？");
  });
});

describe("sanitizeLearningTracks", () => {
  it("cleans stem / options / explanation but keeps answer keys", () => {
    const track = {
      slug: "t",
      questions: [
        {
          key: "q1",
          stageKey: "s",
          type: "single",
          stem: "<p>stem</p><p>line</p>",
          options: [
            { key: "A", text: "<p>one</p><p>two</p>" },
            { key: "B", text: "<p>" },
          ],
          answer: ["A"],
          explanation: "<p>because</p><p>detail</p>",
          difficulty: "easy",
          tags: [],
          sourceKey: "t",
        },
      ],
    } as unknown as LearningTrack;
    const [clean] = sanitizeLearningTracks([track]);
    const q = clean.questions[0];
    expect(q.stem).toBe("stem\n\nline");
    expect(q.options[0].text).toBe("one\n\ntwo");
    expect(q.options[1].text).toBe("<p>");
    expect(q.explanation).toBe("because\n\ndetail");
    expect(q.answer).toEqual(["A"]);
  });
});
