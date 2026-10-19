import { describe, expect, it } from "vitest";
import type { RoadmapPhase } from "@learn-workbench/shared/schemas";
import {
  applyTopicDone,
  computeOverallPercent,
  defaultExpanded,
  parsePhaseHash,
  reorderTrackPhases,
  resolveCareerKey,
} from "./roadmap-hooks";

function phase(id: number, track: "main" | "agent", topicDone: boolean[]): RoadmapPhase {
  return {
    id,
    phaseKey: "p" + id,
    title: "P" + id,
    weeks: null,
    track,
    summary: null,
    sortOrder: id,
    isCustom: false,
    topics: topicDone.map((done, i) => ({
      id: id * 100 + i,
      topicKey: "t" + id + "-" + i,
      title: "T" + id + "-" + i,
      summary: null,
      agentTask: null,
      sortOrder: i,
      done,
      note: null,
      isCustom: false,
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      items: [],
    })),
  } as unknown as RoadmapPhase;
}

describe("resolveCareerKey", () => {
  it("已保存领域仍可见时保留；被归档/删除则回退第一个可见领域", () => {
    const list = [{ career_key: "ict" }, { career_key: "english" }];
    expect(resolveCareerKey(list, "english")).toBe("english");
    expect(resolveCareerKey(list, "sports")).toBe("ict");
    expect(resolveCareerKey(list, undefined)).toBe("ict");
    expect(resolveCareerKey([], "english")).toBe("ict");
  });
});

describe("applyTopicDone（乐观更新）", () => {
  it("只改目标主题，返回新数组（不原地改）", () => {
    const phases = [phase(1, "main", [false, false]), phase(2, "main", [false])];
    const next = applyTopicDone(phases, 101, true);
    expect(next).not.toBe(phases);
    expect(next?.[0].topics[1].done).toBe(true);
    expect(next?.[0].topics[0].done).toBe(false);
    expect(next?.[1].topics[0].done).toBe(false);
    // 原数组未被修改（回滚依赖旧快照）
    expect(phases[0].topics[1].done).toBe(false);
  });

  it("phases 为 null 时原样返回（加载中）", () => {
    expect(applyTopicDone(null, 101, true)).toBeNull();
  });
});

describe("computeOverallPercent", () => {
  it("按主题数聚合百分比", () => {
    const phases = [phase(1, "main", [true, false, false]), phase(2, "main", [true])];
    expect(computeOverallPercent(phases)).toBe(50);
    expect(computeOverallPercent(null)).toBe(0);
    expect(computeOverallPercent([])).toBe(0);
  });
});

describe("parsePhaseHash", () => {
  it("解析 #phase-<id>，非法形式返回 null", () => {
    expect(parsePhaseHash("#phase-42")).toBe(42);
    expect(parsePhaseHash("#phase-0")).toBeNull();
    expect(parsePhaseHash("#phase-x")).toBeNull();
    expect(parsePhaseHash("")).toBeNull();
  });
});

describe("reorderTrackPhases", () => {
  it("同轨道重排并回写 sortOrder；跨轨道项保持原样", () => {
    const phases = [phase(1, "main", []), phase(2, "main", []), phase(3, "agent", [])];
    const result = reorderTrackPhases(phases, "main", 2, 1);
    expect(result).not.toBeNull();
    expect(result!.order).toEqual([2, 1]);
    // 与拆分前一致：数组顺序保持原样，只回写 sortOrder，随后静默刷新由服务端顺序覆盖
    expect(result!.ordered.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(result!.ordered.find((p) => p.id === 2)!.sortOrder).toBe(0);
    expect(result!.ordered.find((p) => p.id === 1)!.sortOrder).toBe(1);
  });

  it("来源/目标不在同轨道或相同时返回 null（不改状态）", () => {
    const phases = [phase(1, "main", []), phase(3, "agent", [])];
    expect(reorderTrackPhases(phases, "main", 1, 1)).toBeNull();
    expect(reorderTrackPhases(phases, "main", 1, 3)).toBeNull();
  });
});

describe("defaultExpanded", () => {
  it("默认展开前两个阶段，且不覆盖用户已折叠状态", () => {
    const phases = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(defaultExpanded(phases, {})).toEqual({ 1: true, 2: true });
    expect(defaultExpanded(phases, { 1: false })).toEqual({ 1: false, 2: true });
  });
});
