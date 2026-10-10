import { describe, expect, it } from "vitest";
import { buildKnowledgeModel, learningTracks } from "@learn-workbench/content";
import {
  DEFAULT_REVIEW_TTL_DAYS,
  buildContentSyncPlan,
  readContentPackageVersion,
} from "./knowledge-model";

const model = buildKnowledgeModel(learningTracks);

describe("buildContentSyncPlan（纯函数，dry-run 与正式同步共用）", () => {
  it("覆盖内容包全部知识点，且全部按 published 写入", () => {
    const plan = buildContentSyncPlan({ contentVersion: "abc123", contentUpdatedAt: "2026-10-01T00:00:00.000Z" });
    expect(plan.points).toHaveLength(model.stats.points);
    expect(plan.points.every((point) => point.status === "published")).toBe(true);
    expect(plan.points.every((point) => point.contentVersion === "abc123")).toBe(true);
    expect(plan.points.every((point) => point.contentUpdatedAt === "2026-10-01T00:00:00.000Z")).toBe(true);
  });

  it("stale_after = 内容包提交时间 + 复查周期（默认 180 天）", () => {
    const plan = buildContentSyncPlan({ contentVersion: "v", contentUpdatedAt: "2026-10-01T00:00:00.000Z" });
    const expected = new Date(Date.parse("2026-10-01T00:00:00.000Z") + DEFAULT_REVIEW_TTL_DAYS * 86_400_000).toISOString();
    expect(new Set(plan.points.map((point) => point.staleAfter))).toEqual(new Set([expected]));
  });

  it("复查周期可覆盖，且非法值被夹到 >= 1 天", () => {
    const base = { contentVersion: "v", contentUpdatedAt: "2026-10-01T00:00:00.000Z" };
    const short = buildContentSyncPlan({ ...base, reviewTtlDays: 30 });
    expect(short.points[0].staleAfter).toBe(new Date(Date.parse(base.contentUpdatedAt) + 30 * 86_400_000).toISOString());
    const clamped = buildContentSyncPlan({ ...base, reviewTtlDays: 0 });
    expect(clamped.points[0].staleAfter).toBe(new Date(Date.parse(base.contentUpdatedAt) + 86_400_000).toISOString());
  });

  it("拿不到内容包提交时间时如实留空，不编造日期", () => {
    const plan = buildContentSyncPlan({ contentVersion: "unknown" });
    expect(plan.points.every((point) => point.contentUpdatedAt === null)).toBe(true);
    expect(plan.points.every((point) => Number.isNaN(Date.parse(point.staleAfter)) === false)).toBe(true);
  });

  it("质量分级与缺项原样带入（Phase C 的校验门禁依赖它）", () => {
    const plan = buildContentSyncPlan({ contentVersion: "v" });
    const byKey = new Map(model.points.map((point) => [point.key, point]));
    for (const point of plan.points) {
      expect(point.qualityLevel).toBe(byKey.get(point.key)!.qualityLevel);
      expect(point.qualityMissing).toEqual(byKey.get(point.key)!.qualityMissing);
      expect(point.fingerprint).toBe(byKey.get(point.key)!.fingerprint);
    }
  });

  it("三张关联表都有内容：题↔知识点、关系、前置", () => {
    const plan = buildContentSyncPlan({ contentVersion: "v" });
    expect(plan.links.length).toBe(model.stats.links);
    expect(plan.relations.length).toBe(model.stats.relations);
    expect(plan.prerequisites.length).toBe(model.stats.prerequisites);
    expect(plan.relations.every((relation) => relation.relationSource === "derived")).toBe(true);
    expect(plan.prerequisites.every((edge) => edge.relationSource === "derived")).toBe(true);
  });

  it("待分类题（无知识点归属）如实上报，不静默丢弃", () => {
    const plan = buildContentSyncPlan({ contentVersion: "v" });
    expect(plan.unlinkedQuestions.length).toBe(model.stats.unlinkedQuestions);
    expect(plan.unlinkedQuestions.length + plan.links.length).toBe(model.stats.questions);
  });
});

describe("readContentPackageVersion", () => {
  it("从 git 读内容包版本（真实调用，非 mock）", () => {
    const { version, updatedAt } = readContentPackageVersion();
    expect(version === "unknown" || /^[0-9a-f]{7,12}$/.test(version)).toBe(true);
    if (updatedAt) expect(Number.isNaN(Date.parse(updatedAt))).toBe(false);
  });

  it("目录不是仓库时返回 unknown，而不是抛错", () => {
    const dir = process.env.TEMP ?? process.env.TMP ?? "/tmp";
    expect(readContentPackageVersion(dir).version).toBe("unknown");
  });
});
