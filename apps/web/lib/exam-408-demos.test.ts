import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

import { pgPool } from "@/lib/db";
import {
  exam408DemoSubjectLabel,
  getExam408Demo,
  getExam408Demos,
  groupExam408Demos,
  normalizeDemoStepFrame,
  normalizeDemoSteps,
} from "./exam-408-demos";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExam408Demos", () => {
  it("只取 published 并映射成前端模型（含步骤数）", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          key: "408card/ds-array-01",
          subject_key: "beokayy-408/data-structure",
          title: "顺序表插入",
          description: "逐帧看插入时元素后移",
          frame_count: 6,
          steps_count: 6,
          knowledge_point_key: "beokayy-408/ds-02-01",
        },
        {
          key: "408card/os-page-02",
          subject_key: "beokayy-408/operating-system",
          title: "页面置换",
          description: null,
          frame_count: 0,
          steps_count: 0,
          knowledge_point_key: null,
        },
      ],
    } as never);

    const demos = await getExam408Demos();

    expect(demos).toEqual([
      {
        key: "408card/ds-array-01",
        subjectKey: "beokayy-408/data-structure",
        title: "顺序表插入",
        description: "逐帧看插入时元素后移",
        frameCount: 6,
        stepsCount: 6,
        knowledgePointKey: "beokayy-408/ds-02-01",
      },
      {
        key: "408card/os-page-02",
        subjectKey: "beokayy-408/operating-system",
        title: "页面置换",
        description: "",
        frameCount: 0,
        stepsCount: 0,
        knowledgePointKey: null,
      },
    ]);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(String(queryMock.mock.calls[0]?.[0])).toContain("status = 'published'");
  });
});

describe("getExam408Demo", () => {
  it("返回归一化后的步骤与来源地址", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          key: "408card/ds-array-01",
          subject_key: "beokayy-408/data-structure",
          title: "顺序表插入",
          description: "逐帧看插入时元素后移",
          steps: [
            { explain: "找到插入位置", frame: "public/content-demos/408card/ds-array-01/1.webp" },
            { explain: "元素后移", frame: "/content-demos/408card/ds-array-01/2.webp" },
            { explain: "纯文字步骤", frame: null },
            { explain: "", frame: "" },
          ],
          frame_count: 3,
          knowledge_point_key: "beokayy-408/ds-02-01",
          source_base_url: "https://408card.top/",
        },
      ],
    } as never);

    const detail = await getExam408Demo("408card/ds-array-01");

    expect(detail).toMatchObject({
      key: "408card/ds-array-01",
      knowledgePointKey: "beokayy-408/ds-02-01",
      frameCount: 3,
      sourceUrl: "https://408card.top/",
    });
    expect(detail?.steps).toEqual([
      { explain: "找到插入位置", frame: "/content-demos/408card/ds-array-01/1.webp" },
      { explain: "元素后移", frame: "/content-demos/408card/ds-array-01/2.webp" },
      { explain: "纯文字步骤", frame: null },
    ]);
  });

  it("不存在的演示返回 null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    expect(await getExam408Demo("408card/missing")).toBeNull();
  });
});

describe("normalizeDemoStepFrame", () => {
  it("只放行 content-demos 相对路径与 http(s)", () => {
    expect(normalizeDemoStepFrame("/content-demos/a/1.webp")).toBe("/content-demos/a/1.webp");
    expect(normalizeDemoStepFrame("public/content-demos/a/1.png")).toBe("/content-demos/a/1.png");
    expect(normalizeDemoStepFrame("https://cdn.example.com/a/1.webp")).toBe("https://cdn.example.com/a/1.webp");
    expect(normalizeDemoStepFrame("javascript:alert(1)")).toBeNull();
    expect(normalizeDemoStepFrame("/content-images/a.png")).toBeNull();
    expect(normalizeDemoStepFrame("../etc/passwd")).toBeNull();
    expect(normalizeDemoStepFrame(null)).toBeNull();
    expect(normalizeDemoStepFrame(42)).toBeNull();
  });
});

describe("normalizeDemoSteps", () => {
  it("丢掉空步骤与非对象项", () => {
    expect(
      normalizeDemoSteps([
        { explain: "第一步", frame: "/content-demos/a/1.webp" },
        { explain: "  ", frame: null },
        "oops",
        null,
      ]),
    ).toEqual([{ explain: "第一步", frame: "/content-demos/a/1.webp" }]);
    expect(normalizeDemoSteps("bad")).toEqual([]);
  });
});

describe("目录分组", () => {
  it("按四科固定顺序分组，未知科目排最后", () => {
    const groups = groupExam408Demos([
      { key: "n1", subjectKey: "beokayy-408/computer-network", title: "网络", description: "", frameCount: 1, stepsCount: 1, knowledgePointKey: null },
      { key: "u1", subjectKey: "408card/misc", title: "其它", description: "", frameCount: 1, stepsCount: 1, knowledgePointKey: null },
      { key: "d1", subjectKey: "beokayy-408/data-structure", title: "结构", description: "", frameCount: 1, stepsCount: 1, knowledgePointKey: null },
      { key: "d2", subjectKey: "beokayy-408/data-structure", title: "结构2", description: "", frameCount: 1, stepsCount: 1, knowledgePointKey: null },
    ]);
    expect(groups.map((group) => group.subjectKey)).toEqual([
      "beokayy-408/data-structure",
      "beokayy-408/computer-network",
      "408card/misc",
    ]);
    expect(groups[0]?.demos.map((demo) => demo.key)).toEqual(["d1", "d2"]);
    expect(groups[2]?.label).toBe("MISC");
  });

  it("科目名有兜底，不出现空标题", () => {
    expect(exam408DemoSubjectLabel("beokayy-408/operating-system")).toBe("操作系统");
    expect(exam408DemoSubjectLabel("weird-key")).toBe("WEIRD KEY");
  });
});
