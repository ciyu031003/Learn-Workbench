import { describe, expect, it } from "vitest";

import {
  externalizePointKey,
  internalizePointKey,
  isExam408PointKey,
} from "./exam-408-point-key";

describe("App 端 408 知识点 key 前缀换算", () => {
  it("internalize：yuanabd → beokayy，其它原样", () => {
    expect(internalizePointKey("yuanabd-408/os-02-04")).toBe("beokayy-408/os-02-04");
    expect(internalizePointKey("beokayy-408/os-02-04")).toBe("beokayy-408/os-02-04");
    expect(internalizePointKey("algorithms/ds")).toBe("algorithms/ds");
    expect(internalizePointKey("  yuanabd-408/ds-01-01  ")).toBe("beokayy-408/ds-01-01");
  });

  it("externalize：beokayy → yuanabd，其它原样", () => {
    expect(externalizePointKey("beokayy-408/os-02-04")).toBe("yuanabd-408/os-02-04");
    expect(externalizePointKey("yuanabd-408/os-02-04")).toBe("yuanabd-408/os-02-04");
    expect(externalizePointKey("python/base/topic")).toBe("python/base/topic");
  });

  it("isExam408PointKey 两种前缀都认", () => {
    expect(isExam408PointKey("beokayy-408/ds-01-01")).toBe(true);
    expect(isExam408PointKey("yuanabd-408/ds-01-01")).toBe(true);
    expect(isExam408PointKey("")).toBe(false);
    expect(isExam408PointKey("ds-01-01")).toBe(false);
  });
});
