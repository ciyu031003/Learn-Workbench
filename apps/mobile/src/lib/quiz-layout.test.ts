import { describe, expect, it } from "vitest";
import { quizFooterPaddingBottom, quizTopBarPaddingTop } from "./quiz-layout";

describe("quiz safe-area spacing", () => {
  it("keeps the quiz toolbar below the Android status bar", () => {
    expect(quizTopBarPaddingTop(24)).toBe(32);
    expect(quizTopBarPaddingTop(48)).toBe(56);
    expect(quizTopBarPaddingTop(0)).toBe(8);
  });

  it("keeps footer actions above gesture navigation", () => {
    expect(quizFooterPaddingBottom(0)).toBe(24);
    expect(quizFooterPaddingBottom(24)).toBe(36);
    expect(quizFooterPaddingBottom(48)).toBe(60);
  });
});
