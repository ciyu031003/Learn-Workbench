import { describe, expect, it } from "vitest";

import {
  exam408PointHref,
  externalizePointKey,
  internalizePointKey,
  isExam408PointKey,
} from "./exam-408-point-key";

describe("408 知识点 key 前缀换算（beokayy-408 ↔ yuanabd-408）", () => {
  it("internalize：新前缀转内部，旧前缀/其它 key 原样", () => {
    expect(internalizePointKey("yuanabd-408/os-02-04")).toBe("beokayy-408/os-02-04");
    expect(internalizePointKey("beokayy-408/os-02-04")).toBe("beokayy-408/os-02-04");
    expect(internalizePointKey("algorithms/ds")).toBe("algorithms/ds");
    expect(internalizePointKey("  yuanabd-408/ds-01-01  ")).toBe("beokayy-408/ds-01-01");
    expect(internalizePointKey("")).toBe("");
  });

  it("externalize：内部前缀转新前缀，已是新前缀/其它 key 原样", () => {
    expect(externalizePointKey("beokayy-408/os-02-04")).toBe("yuanabd-408/os-02-04");
    expect(externalizePointKey("yuanabd-408/os-02-04")).toBe("yuanabd-408/os-02-04");
    expect(externalizePointKey("python/base/topic")).toBe("python/base/topic");
    expect(externalizePointKey("  beokayy-408/ds-01-01  ")).toBe("yuanabd-408/ds-01-01");
  });

  it("两个方向互为幂等：转两次结果不变", () => {
    for (const key of ["beokayy-408/cn-01-01", "yuanabd-408/cn-01-01"]) {
      expect(internalizePointKey(internalizePointKey(key))).toBe(internalizePointKey(key));
      expect(externalizePointKey(externalizePointKey(key))).toBe(externalizePointKey(key));
    }
  });

  it("isExam408PointKey 两种前缀都认，其它不认", () => {
    expect(isExam408PointKey("beokayy-408/ds-01-01")).toBe(true);
    expect(isExam408PointKey("yuanabd-408/ds-01-01")).toBe(true);
    expect(isExam408PointKey("ds-01-01")).toBe(false);
    expect(isExam408PointKey("")).toBe(false);
  });

  it("exam408PointHref 产出外部前缀的规范路径", () => {
    expect(exam408PointHref("beokayy-408/os-02-04")).toBe("/learn/408/points/yuanabd-408/os-02-04");
    expect(exam408PointHref("yuanabd-408/os-02-04")).toBe("/learn/408/points/yuanabd-408/os-02-04");
    expect(exam408PointHref(" ")).toBe("/learn/408/points");
  });
});
