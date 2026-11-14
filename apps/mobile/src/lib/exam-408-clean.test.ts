import { describe, expect, it } from "vitest";
import { cleanAnswerText, cleanExamStem } from "./exam-408-clean";

describe("cleanAnswerText", () => {
  it("strips bare answer labels and single letters", () => {
    expect(cleanAnswerText("答案：A")).toBe("");
    expect(cleanAnswerText("答案: C\n解析：栈是后进先出")).toBe("解析：栈是后进先出");
  });

  it("strips bold answer labels without leaking markdown", () => {
    expect(cleanAnswerText("**答案：**\n\n**（1）算法基本设计思想**")).toBe("**（1）算法基本设计思想**");
    expect(cleanAnswerText("**答案：A**")).toBe("");
  });

  it("strips multi-letter objective answers completely", () => {
    expect(cleanAnswerText("答案：AB")).toBe("");
    expect(cleanAnswerText("答案：AB\n解析：两者都满足")).toBe("解析：两者都满足");
  });

  it("does not eat prose that merely starts with a capital letter", () => {
    expect(cleanAnswerText("答案：C语言中数组下标从 0 开始")).toBe("C语言中数组下标从 0 开始");
  });

  it("keeps answers without a label intact", () => {
    expect(cleanAnswerText("先逆置前半段，再逆置后半段")).toBe("先逆置前半段，再逆置后半段");
  });

  it("strips a markdown heading answer label", () => {
    expect(cleanAnswerText("### 【答案】\n\n1）页大小为 4KB")).toBe("1）页大小为 4KB");
    expect(cleanAnswerText("### 答案\n\n（1）继续")).toBe("（1）继续");
  });

  it("removes answer image markdown because answerImageRefs renders it", () => {
    expect(cleanAnswerText("（1）结构如下：\n\n![](/content-images/a.png)\n\n（2）继续")).toBe(
      "（1）结构如下：\n\n（2）继续",
    );
  });
});

describe("cleanExamStem", () => {
  it("drops image markdown and keeps image links as caption text", () => {
    expect(cleanExamStem("题干\n![图1](/content-images/a.png)\n[题图](/content-images/b.png)")).toBe("题干\n题图");
  });

  it("does not eat math angle brackets", () => {
    expect(cleanExamStem("设 <v0,v1> <net1,16> 为向量")).toBe("设 <v0,v1> <net1,16> 为向量");
  });
});
