/**
 * 学习内容落库的真实数据库演练（**默认跳过**，需要显式开启）。
 *
 * 单测把 pgPool 打桩，证明不了 unnest 批量 upsert / jsonb 往返 / 软归档这些只有真库才暴露的问题，
 * 所以留一个可复跑的真库演练：
 *
 *   $env:LWB_DB_DRILL="1"; pnpm -F web exec vitest run lib/content/learning-content.integration.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import { pgPool } from "@/lib/db";
import { buildLearningContentPlan, syncLearningContent } from "./learning-content-sync";
import { getQuestion, updateQuestion } from "./content-editor";
import { invalidateLearningTracksCache, loadAlgorithmAnimations, loadLearningTracks } from "./learning-repo";

const RUN = process.env.LWB_DB_DRILL === "1";

describe.skipIf(!RUN)("学习内容落库（真实 Postgres 演练）", () => {
  afterAll(async () => {
    await pgPool.end().catch(() => undefined);
  });

  it("内容包 → 数据库 → 读回，数量与分级一致且幂等", async () => {
    const plan = buildLearningContentPlan(undefined, "drill0001");
    expect(plan.counts.tracks).toBeGreaterThan(0);

    const first = await syncLearningContent(plan);
    expect(first.tracks).toBe(plan.counts.tracks);
    expect(first.questions).toBe(plan.counts.questions);

    invalidateLearningTracksCache();
    const tracks = await loadLearningTracks();
    expect(tracks.length).toBe(plan.counts.tracks);

    const stages = tracks.reduce((n, track) => n + track.stages.length, 0);
    const topics = tracks.reduce((n, track) => n + track.stages.reduce((m, stage) => m + stage.topics.length, 0), 0);
    const questions = tracks.reduce((n, track) => n + track.questions.length, 0);
    expect(stages).toBe(plan.counts.stages);
    expect(topics).toBe(plan.counts.topics);
    expect(questions).toBe(plan.counts.questions);

    // 分级（075 后由数据库直接给出 level，不再靠前端推导）
    const byLevel: Record<string, number> = {};
    for (const track of tracks) {
      for (const question of track.questions) {
        const level = question.level ?? "unknown";
        byLevel[level] = (byLevel[level] ?? 0) + 1;
      }
    }
    expect(byLevel["unknown"] ?? 0).toBe(0);
    expect(Object.values(byLevel).reduce((a, b) => a + b, 0)).toBe(questions);

    // 知识点讲义 / 题目解析等正文确实往返成功
    const withLesson = tracks.flatMap((t) => t.stages.flatMap((s) => s.topics)).filter((topic) => topic.lesson?.example?.code);
    expect(withLesson.length).toBeGreaterThan(0);
    // 解析：题目全部有解析；其中「原创题」要求 >= 20 字（408 真题库的解析是「参考答案：X」这类短文本）
    const explanations = tracks.flatMap((t) => t.questions).filter((q) => q.explanation.trim().length > 0);
    expect(explanations.length).toBe(questions);
    const longExplanations = explanations.filter((q) => q.explanation.length >= 20);
    expect(longExplanations.length).toBeGreaterThan(questions * 0.9);

    // 算法动图也从库里读得到（内容包 → 库 往返）
    const animations = await loadAlgorithmAnimations();
    expect(Object.keys(animations).length).toBe(plan.counts.animations);
    const firstAnimation = Object.values(animations)[0];
    expect(firstAnimation.length).toBeGreaterThanOrEqual(3);
    expect(firstAnimation[0].svg.startsWith("<svg")).toBe(true);

    // 后台编辑（content-editor）→ 前台读取立即生效，且非法改动被拒
    const sample = tracks[0].questions[0];
    const before = await getQuestion(sample.key);
    expect(before).not.toBeNull();

    const bad = await updateQuestion(sample.key, { answer: ["Z"] });
    expect(bad.ok).toBe(false);

    const edited = await updateQuestion(sample.key, { stem: before!.stem + "（后台编辑验证）" });
    expect(edited.ok).toBe(true);
    invalidateLearningTracksCache();
    const afterEdit = await loadLearningTracks();
    const changed = afterEdit.flatMap((t) => t.questions).find((q) => q.key === sample.key);
    expect(changed?.stem).toBe(before!.stem + "（后台编辑验证）");

    // 076：人工改过的题不会被下一次同步覆盖
    const resync = await syncLearningContent(plan);
    expect(resync.preserved.questions).toBeGreaterThan(0);
    invalidateLearningTracksCache();
    const afterResync = await loadLearningTracks();
    const kept = afterResync.flatMap((t) => t.questions).find((q) => q.key === sample.key);
    expect(kept?.stem).toBe(before!.stem + "（后台编辑验证）");

    // force=1 时以内容包为准（显式覆盖）
    const forced = await syncLearningContent(plan, { force: true });
    expect(forced.preserved.questions).toBe(0);
    invalidateLearningTracksCache();
    const afterForce = await loadLearningTracks();
    const reverted = afterForce.flatMap((t) => t.questions).find((q) => q.key === sample.key);
    expect(reverted?.stem).toBe(before!.stem);

    // 幂等：再同步一次数量不变
    const second = await syncLearningContent(plan);
    expect(second.questions).toBe(first.questions);
    expect(second.archived.questions).toBe(0);
  }, 180_000);
});
