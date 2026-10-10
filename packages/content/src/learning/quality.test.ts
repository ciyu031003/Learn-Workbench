/**
 * 内容质量契约（组二 · 阶段 9 = V3 纵轨 Phase C）。
 *
 * 这是**自动化内容校验**的 TS 侧：进 CI 靠 `pnpm test`（仓库 CI 的质量作业会跑全部 workspace 测试），
 * 库侧（已同步内容的状态/关联完整性）由 `scripts/check-content-quality.mjs` 负责（无库时自动跳过）。
 *
 * 校验项对应 V3 §Phase C 清单：必填 / 代码块语言标记 / 链接合法 / 来源许可 / 重复识别 /
 * 题目关联存在 / 排序无冲突 / 危险 HTML / 过时内容复查日期 / L0-L1 不进正式学习列表。
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { learningTracks } from "./index";
import {
  QUALITY_LEVELS,
  buildKnowledgeModel,
  isLearnable,
  isReviewed,
  knowledgeContentFingerprint,
  qualityOfTopic,
  type KnowledgeQualityLevel,
} from "./model";
import type { LearningTopic } from "./types";

const model = buildKnowledgeModel(learningTracks);

const ALLOWED_CODE_LANGUAGES = new Set([
  "bash",
  "c",
  "css",
  "dax",
  "go",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "powerquery",
  "python",
  "sql",
  "swift",
  "text",
  "tsx",
  "typescript",
  "xml",
  "yaml",
]);

/** 所有面向读者的文本（含代码）——危险 HTML/脚本检查的扫描面 */
function allTextOf(topic: LearningTopic): string[] {
  return [
    topic.title,
    topic.summary,
    topic.method,
    topic.exercise,
    topic.checkpoint,
    ...topic.concepts,
    ...topic.principles,
    ...topic.applications,
    ...topic.pitfalls,
    ...(topic.lesson?.overview ?? []),
    ...(topic.lesson?.mechanism ?? []),
    ...(topic.lesson?.practiceSteps ?? []),
    ...(topic.lesson?.masteryChecklist ?? []),
    topic.lesson?.example?.title ?? "",
    topic.lesson?.example?.code ?? "",
    topic.lesson?.example?.explanation ?? "",
  ];
}

describe("必填与模板完整性", () => {
  it("每个知识点都有标题/摘要/方法/练习/自测（L0 一条都不允许）", () => {
    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const where = `${track.slug}/${stage.key}/${topic.key}`;
          expect(topic.title.trim(), `${where} title`).not.toBe("");
          expect(topic.summary.trim(), `${where} summary`).not.toBe("");
          expect(topic.method.trim(), `${where} method`).not.toBe("");
          expect(topic.exercise.trim(), `${where} exercise`).not.toBe("");
          expect(topic.checkpoint.trim(), `${where} checkpoint`).not.toBe("");
        }
      }
    }
  });

  it("L0/L1 不进正式学习列表（当前内容库必须一条都没有）", () => {
    expect(model.stats.byQuality.L0).toBe(0);
    expect(model.stats.byQuality.L1).toBe(0);
    for (const point of model.points) {
      expect(isLearnable(point.qualityLevel), `${point.key} 应可学习`).toBe(true);
    }
  });

  it("单点分级与整棵模型口径一致（UI 角标不会与后台统计打架）", () => {
    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const single = qualityOfTopic(track, stage, topic);
          const inModel = model.points.find(
            (point) => point.trackSlug === track.slug && point.stageKey === stage.key && point.topicKey === topic.key
          )!;
          expect(single.level, `${inModel.key}`).toBe(inModel.qualityLevel);
          expect(single.missing).toEqual(inModel.qualityMissing);
        }
      }
    }
  });

  it("分级与 UI 门槛的映射是明确的（L4 才是已审核可学习）", () => {
    for (const level of QUALITY_LEVELS) {
      const learnable = isLearnable(level);
      expect(learnable).toBe(level !== "L0" && level !== "L1");
      expect(isReviewed(level)).toBe(level === "L4");
    }
    expect(isReviewed("L4" as KnowledgeQualityLevel)).toBe(true);
  });
});

describe("代码块与链接", () => {
  it("代码示例必须有语言标记，且用允许的小写语言名", () => {
    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const example = topic.lesson?.example;
          if (!example) continue;
          const where = `${track.slug}/${stage.key}/${topic.key}`;
          expect(example.language.trim(), `${where} 语言标记`).not.toBe("");
          expect(example.language, `${where} 语言名必须小写`).toBe(example.language.toLowerCase());
          expect(ALLOWED_CODE_LANGUAGES.has(example.language), `${where} 未知语言 ${example.language}`).toBe(true);
          expect(example.code.trim(), `${where} 代码为空`).not.toBe("");
        }
      }
    }
  });

  it("来源链接必须 https，且可复用来源必须有许可", () => {
    for (const track of learningTracks) {
      expect(track.sources.length, `${track.slug} 没有任何来源`).toBeGreaterThan(0);
      for (const source of track.sources) {
        expect(source.url.startsWith("https://"), `${track.slug} 来源 ${source.key} 不是 https`).toBe(true);
        expect(source.license.trim(), `${track.slug} 来源 ${source.key} 缺许可`).not.toBe("");
      }
      expect(
        track.sources.some((source) => source.usage === "import"),
        `${track.slug} 没有可复用（usage=import）来源`
      ).toBe(true);
    }
  });
});

describe("重复识别与排序", () => {
  it("同一课程内知识点标题不重复（归一化后比较）", () => {
    for (const track of learningTracks) {
      const seen = new Map<string, string>();
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const normalized = topic.title.trim().replace(/\s+/g, "").toLowerCase();
          const previous = seen.get(normalized);
          expect(previous, `${track.slug} 标题重复：${topic.title}（与 ${previous} 撞车）`).toBeUndefined();
          seen.set(normalized, `${stage.key}/${topic.key}`);
        }
      }
    }
  });

  it("同一课程内内容指纹不重复（允许不同字段写法，但正文相同即重复）", () => {
    for (const track of learningTracks) {
      const seen = new Map<string, string>();
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const fingerprint = knowledgeContentFingerprint(topic);
          const previous = seen.get(fingerprint);
          expect(previous, `${track.slug} 内容重复：${topic.key} 与 ${previous}`).toBeUndefined();
          seen.set(fingerprint, topic.key);
        }
      }
    }
  });

  it("阶段 key 与知识点 key 在课程内唯一，阶段顺序连续无空洞", () => {
    for (const track of learningTracks) {
      const stageKeys = track.stages.map((stage) => stage.key);
      expect(new Set(stageKeys).size, `${track.slug} 阶段 key 重复`).toBe(stageKeys.length);
      for (const stage of track.stages) {
        const topicKeys = stage.topics.map((topic) => topic.key);
        expect(topicKeys.length, `${stage.key} 空阶段`).toBeGreaterThan(0);
        expect(new Set(topicKeys).size, `${stage.key} 知识点 key 重复`).toBe(topicKeys.length);
      }
      const orders = model.points.filter((point) => point.trackSlug === track.slug).map((point) => point.sortOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});

describe("安全与时效", () => {
  it("正文不含危险 HTML / 脚本（渲染层按纯文本处理，内容侧也不允许出现）", () => {
    const dangerous = /<\s*(script|iframe|object|embed|style|link|meta)\b|on(error|load|click)\s*=|\bjavascript:/i;
    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const where = `${track.slug}/${stage.key}/${topic.key}`;
          for (const text of allTextOf(topic)) {
            expect(dangerous.test(text), `${where} 含危险片段：${text.slice(0, 60)}`).toBe(false);
          }
        }
      }
    }
  });

  it("题目关联存在：每个知识点至少 2 道题（explicit 或阶段回退口径）", () => {
    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          const quality = qualityOfTopic(track, stage, topic);
          expect(quality.missing, `${track.slug}/${stage.key}/${topic.key} 题量不足`).not.toContain("questions>=2");
        }
      }
    }
  });

  it("过时内容复查日期：内容包最后提交 + 180 天不得已过期（取不到 git 时跳过）", () => {
    let committedAt = "";
    try {
      committedAt = execFileSync("git", ["log", "-1", "--format=%cI", "--", "packages/content/src/learning"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      committedAt = "";
    }
    if (!committedAt) {
      console.log("[content-quality] 取不到内容包 git 提交时间 → 跳过时效检查（CI 浅克隆属正常）");
      return;
    }
    const staleAfter = Date.parse(committedAt) + 180 * 86_400_000;
    expect(Date.now(), `内容包自 ${committedAt} 起已超 180 天未复查`).toBeLessThan(staleAfter);
  });
});
