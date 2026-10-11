import { describe, expect, it } from "vitest";

import {
  autoStudySegmentSeconds,
  autoStudyZoneForPathname,
} from "./auto-study-timer";

describe("autoStudyZoneForPathname", () => {
  it("将题库及所有子页面归入同一计时区间", () => {
    expect(autoStudyZoneForPathname("/quiz")).toMatchObject({
      key: "quiz",
      label: "题库学习",
    });
    expect(autoStudyZoneForPathname("/quiz/read")).toMatchObject({ key: "quiz" });
    expect(autoStudyZoneForPathname("/quiz/408-point")).toMatchObject({ key: "quiz" });
    expect(autoStudyZoneForPathname("/quiz/paper/2016")).toMatchObject({ key: "quiz" });
  });

  it("只把面试页面归入面试计时区间", () => {
    expect(autoStudyZoneForPathname("/interview")).toMatchObject({
      key: "interview",
      label: "面试刷题",
    });
    expect(autoStudyZoneForPathname("/learn")).toBeNull();
    expect(autoStudyZoneForPathname("/quiz-notes")).toBeNull();
  });

  it("把独立 408 专区纳入学习计时", () => {
    expect(autoStudyZoneForPathname("/exam-408")).toMatchObject({
      key: "exam408",
      label: "408 考研",
    });
  });

  it("忽略查询参数并修正无前导斜杠路径", () => {
    expect(autoStudyZoneForPathname("quiz/read?topic=x")).toMatchObject({ key: "quiz" });
    expect(autoStudyZoneForPathname("/interview?module=os")).toMatchObject({
      key: "interview",
    });
  });
});

describe("autoStudySegmentSeconds", () => {
  it("按整秒结算并在异常时返回 0", () => {
    expect(autoStudySegmentSeconds(1_000, 5_900)).toBe(4);
    expect(autoStudySegmentSeconds(null, 5_900)).toBe(0);
    expect(autoStudySegmentSeconds(5_900, 1_000)).toBe(0);
  });

  it("给单段时长设置上限，避免异常后台计时污染统计", () => {
    expect(autoStudySegmentSeconds(0, 24 * 60 * 60 * 1000, 12 * 60 * 60)).toBe(
      12 * 60 * 60
    );
  });
});
