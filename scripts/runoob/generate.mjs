#!/usr/bin/env node
/**
 * runoob 抓取结果 → `packages/content` 课程内容（自动生成，勿手改产物）。
 *
 * 输入：`.local/runoob/{quizzes,pages}.jsonl`（由 `scripts/runoob/crawl.mjs` 产出）
 * 输出：`packages/content/src/learning/runoob-<track>.ts`（三个课程，题内嵌）
 *
 * 结构映射：
 *   课程（track）  = 主题域（前端开发 / 编程语言 / 计算机基础）
 *   阶段（stage）  = 一个教程（HTML / CSS / Python …）
 *   知识点（topic）= 该教程按站内顺序切成的一簇页面（标题见 `topics.mjs`）
 *   题目           = 该教程的官方测验题，按与页面的文本相似度归属到知识点
 *
 * 硬约束（内容契约）：每阶段 ≥3 知识点、每题必须挂在某阶段、每知识点 ≥2 题。
 * 因此本脚本在归属之后会做**配平**：题少的知识点从同阶段题最多的知识点借题。
 *
 * 用法：node scripts/runoob/generate.mjs [--check]
 *   --check 只打印统计与抽样，不写文件
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RUNOOB_ORIGIN, RUNOOB_STAGES, RUNOOB_TRACKS, findUnsafe } from "../lib/runoob.mjs";
import { RUNOOB_TOPICS } from "./topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IN_DIR = path.resolve(ROOT, ".local/runoob");
const OUT_DIR = path.join(ROOT, "packages/content/src/learning");
const CHECK_ONLY = process.argv.includes("--check");
const SOURCE_KEY = "runoob-com";
const LICENSE = "站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用";

// ---------------------------------------------------------------- 文本工具
/** 危险片段中和：站点示例代码本来就含 `<script>`/`<meta>` 这类**正文标签**，
 *  渲染层按纯文本处理，这里把尖括号换成全角，既保留可读性又不触发内容安全闸门。 */
function neutralize(text) {
  return String(text ?? "")
    .replace(/<\s*(\/?)\s*(script|iframe|object|embed|style|link|meta|applet)\b([^<>]*)>/gi, "＜$1$2$3＞")
    .replace(/<\s*(\/?)\s*(script|iframe|object|embed|style|link|meta|applet)\b/gi, "＜$1$2")
    .replace(/\bon(error|load|click|mouseover|focus|submit)\s*=/gi, "on$1＝")
    .replace(/javascript:/gi, "javascript：");
}

const cleanup = (text) =>
  String(text ?? "")
    .replace(/&mldr;|&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&times;/gi, "×")
    .replace(/&divide;/gi, "÷")
    .replace(/&copy;/gi, "©")
    .replace(/&ldquo;/gi, "“")
    .replace(/&rdquo;/gi, "”")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»");

/** 统一出口：清理实体 → 中和危险片段 → 收口空白 */
function clean(text) {
  return neutralize(cleanup(text))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clip = (text, max) => {
  const value = clean(text);
  return value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";
};

const unique = (list) => {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const value = String(item ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

function sentences(text) {
  return clean(text)
    .split(/[。！？；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && s.length <= 200);
}

const NOISE = /分享笔记|必须登录|^评论|^关注|^广告|在线工具|参考手册|更多测验|有用的资源|下一步|该学习什么/;

// ---------------------------------------------------------------- 相似度（分簇用）
function tokensOf(text) {
  const out = new Set();
  const raw = String(text ?? "").toLowerCase();
  for (const word of raw.match(/[a-z0-9_+#.]{2,}/g) ?? []) out.add(word);
  for (const run of raw.replace(/[^\u4e00-\u9fff]+/g, " ").split(/\s+/)) {
    for (let i = 0; i + 1 < run.length; i += 1) out.add(run.slice(i, i + 2));
  }
  return out;
}

function similarity(tokensA, tokensB) {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let hit = 0;
  for (const token of tokensB) if (tokensA.has(token)) hit += 1;
  return hit / Math.sqrt(tokensA.size * tokensB.size);
}

/**
 * 把有序页面切成 k 个**大小均衡**的连续簇，边界尽量落在「相邻标题差异最大」的位置。
 *
 * 做法：每个边界只在理想位置 ± 窗口内挑选，窗口内取割裂度最大的位置（DP 保证单调且每簇 ≥minSize）。
 */
function splitClusters(pages, k, minSize = 3) {
  const n = pages.length;
  const actualK = Math.max(1, Math.min(k, Math.floor(n / minSize) || 1));
  if (actualK <= 1) return [pages];
  if (actualK * minSize === n) {
    return Array.from({ length: actualK }, (_, i) => pages.slice(i * minSize, (i + 1) * minSize));
  }
  const aTokens = pages.map((page) => tokensOf(page.title));
  const gap = new Array(n).fill(0);
  for (let i = 1; i < n; i += 1) gap[i] = 1 - similarity(aTokens[i - 1], aTokens[i]);

  const ideal = n / actualK;
  const window = Math.max(2, Math.floor(ideal / 2));
  // 边界 j 的可选位置（页码前缀长度）
  const options = [];
  for (let j = 1; j < actualK; j += 1) {
    const center = Math.round(j * ideal);
    const low = Math.max(j * minSize, center - window);
    const high = Math.min(n - (actualK - j) * minSize, center + window);
    const list = [];
    for (let pos = low; pos <= high; pos += 1) list.push(pos);
    options.push(list);
  }
  if (options.some((list) => list.length === 0)) {
    // 退化：等分
    return Array.from({ length: actualK }, (_, i) => pages.slice(i * minSize, (i + 1) * minSize));
  }
  const NEG = -1e9;
  let dp = new Map([[0, 0]]);
  const back = [];
  for (let j = 0; j < options.length; j += 1) {
    const next = new Map();
    const layer = new Map();
    for (const pos of options[j]) {
      let best = NEG;
      let bestPrev = -1;
      for (const [prev, value] of dp) {
        if (prev >= pos || pos - prev < minSize) continue;
        const score = value + gap[pos];
        if (score > best) {
          best = score;
          bestPrev = prev;
        }
      }
      if (bestPrev >= 0) {
        next.set(pos, best);
        layer.set(pos, bestPrev);
      }
    }
    dp = next;
    back.push(layer);
  }
  let end = -1;
  let bestValue = NEG;
  for (const [pos, value] of dp) {
    if (value > bestValue && n - pos >= minSize) {
      bestValue = value;
      end = pos;
    }
  }
  if (end < 0) return Array.from({ length: actualK }, (_, i) => pages.slice(i * minSize, (i + 1) * minSize));
  const cuts = [end];
  for (let j = options.length - 1; j >= 1; j -= 1) cuts.unshift(back[j].get(cuts[0]));
  const clusters = [];
  const bounds = [0, ...cuts, n];
  for (let i = 0; i + 1 < bounds.length; i += 1) clusters.push(pages.slice(bounds[i], bounds[i + 1]));
  return clusters.filter((cluster) => cluster.length > 0);
}

// ---------------------------------------------------------------- 知识点内容
function buildTopicContent(stage, title, cluster, questions, topicKey) {
  const sections = cluster.flatMap((page) => page.sections.map((section) => ({ ...section, pageTitle: page.title })));
  const pageTitles = cluster.map((page) => clip(page.title, 40));
  const proseSections = sections.filter((section) => section.text && !NOISE.test(section.heading ?? ""));

  const concepts = unique(
    sections
      .map((section) => clean(section.heading))
      .filter((heading) => heading && heading.length <= 26 && !NOISE.test(heading))
  ).slice(0, 10);

  const pageTitleSet = new Set(cluster.map((page) => clean(page.title)));
  const isHeadingLike = (sentence) =>
    sentence.length < 12 || pageTitleSet.has(sentence) || /^(HTML|CSS|Java|Python|Go|PHP|SQL|XML|C#|C\+\+)?\s*\S*\s*(实例|示例|参考手册|测验|教程)$/.test(sentence);

  const principles = unique(
    proseSections
      .flatMap((section) => sentences(section.text).slice(0, 2))
      .filter((sentence) => sentence.length >= 12 && !isHeadingLike(sentence))
  ).slice(0, 8);

  const applications = unique(
    sections
      .filter((section) => section.codes.length > 0)
      .map((section) => {
        const first = clean(section.codes[0]).split("\n")[0];
        return first ? `示例：${clip(first, 80)}` : "";
      })
  ).slice(0, 6);

  const PITFALL_RE = /注意|警告|不要|必须|避免|否则|错误|陷阱|不能|禁止|失效/;
  const pitfalls = unique(
    proseSections
      .flatMap((section) => sentences(section.text))
      .filter((sentence) => PITFALL_RE.test(sentence))
  ).slice(0, 5);

  const overview = unique(
    proseSections.slice(0, 8).map((section) =>
      clip(
        `【${clip(section.pageTitle, 26)}】${section.heading ? section.heading + "：" : ""}${
          sentences(section.text).find((sentence) => !isHeadingLike(sentence)) ?? section.text
        }`,
        180
      )
    )
  ).slice(0, 6);

  const mechanism = unique(
    proseSections
      .flatMap((section) => sentences(section.text))
      .filter((sentence) => sentence.length >= 14 && !isHeadingLike(sentence))
  ).slice(0, 10);

  // 示例代码：优先选**不含危险片段**的长示例（HTML/Vue 示例常带 <script>，退而求其次再中和）
  const codeCandidates = sections
    .filter((section) => section.codes.some((code) => clean(code).length >= 20))
    .map((section) => {
      const code = section.codes.reduce((best, current) => (clean(current).length > clean(best).length ? current : best), "");
      const safe = findUnsafe(code).length === 0 && findUnsafe(neutralize(code)).length === 0;
      return { section, code, score: clean(code).length + (safe ? 400 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  const chosen = codeCandidates[0];
  const example = chosen
    ? {
        title: clip(`${chosen.section.pageTitle} · ${chosen.section.heading || "示例"}`, 60),
        language: stage.language,
        code: clean(chosen.code).slice(0, 1600),
        explanation: clip(
          sentences(chosen.section.text)[0] ?? `示例代码取自「${chosen.section.pageTitle}」，可直接改参数观察输出差异。`,
          200
        ),
      }
    : {
        title: clip(`${pageTitles[0] ?? stage.title} · 示例`, 60),
        language: stage.language,
        code: clean(cluster.map((page) => page.sections.find((s) => s.text)?.text ?? "").find(Boolean) ?? stage.title).slice(0, 800),
        explanation: `本节以概念与用法为主，示例请对照「${stage.title}」站点原文动手验证。`,
      };

  const titleList = pageTitles.slice(0, 5).join(" → ") + (pageTitles.length > 5 ? " → …" : "");
  const pitfalls_final = pitfalls.length
    ? pitfalls
    : [`本节以示例为主：动手前先确认语言/工具版本与站点示例一致，否则输出可能对不上。`];

  return {
    key: topicKey,
    title,
    summary: clip(
      `${title}（${stage.title}）：${principles[0] ?? topics0Fallback(pageTitles)} 本节含 ${cluster.length} 页、${questions.length} 道配套题。`,
      240
    ),
    concepts: concepts.length ? concepts : pageTitles,
    principles: principles.length ? principles : [`${title} 的用法与结论见本节 ${cluster.length} 页原文示例。`],
    applications: applications.length ? applications : [`配套练习：本节 ${questions.length} 道测验题覆盖了这些用法。`],
    pitfalls: pitfalls_final,
    method: clip(`按站内顺序读「${titleList}」，每页先看示例再读结论，最后回做题。`, 220),
    exercise: `完成本节配套的 ${questions.length} 道题；把错题原文记进练习记录，隔天重做一遍。`,
    checkpoint: `能说清${concepts.length ? `「${concepts.slice(0, 3).join("、")}」` : "本节要点"}的用法，并把 ${questions.length} 道题做到 80% 以上正确率。`,
    lesson: {
      overview: overview.length ? overview : [clip(`${title}：${stage.title} 的对应章节。`, 160)],
      mechanism: mechanism.length ? mechanism : principles,
      example,
      practiceSteps: [
        `先通读本节 ${cluster.length} 页：${pageTitles.slice(0, 4).join("、")}${pageTitles.length > 4 ? " 等" : ""}。`,
        `把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。`,
        `做完本节 ${questions.length} 道测验题，错题回到对应小节复述一遍。`,
        `用一句话写下本节最容易踩的坑，贴到自己的笔记里。`,
      ],
      masteryChecklist: [
        `能不看示例说出「${title}」的核心用法与适用场景。`,
        `能独立写出本节至少一个示例并跑通。`,
        `本节 ${questions.length} 道测验题正确率达到 80% 以上。`,
      ],
    },
  };
}

const topics0Fallback = (pageTitles) =>
  pageTitles.length ? `覆盖 ${pageTitles.slice(0, 3).join("、")} 等 ${pageTitles.length} 页内容。` : "见站点对应章节。";

// ---------------------------------------------------------------- 题目
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function buildQuestion(stage, quiz, index, topicKey) {
  const letters = quiz.options.map((_, i) => LETTERS[i]);
  const answerLetter = letters[quiz.correctIndex];
  const answerText = clean(quiz.options[quiz.correctIndex]);
  const note = clean(quiz.incorrectResponse || quiz.correctResponse || "");
  const detail =
    note.length >= 12 ? note : `本题考查「${clip(quiz.stem, 40)}」，正确答案是 ${answerText}。`;
  const explanation = clip(
    `正确答案：${answerLetter}. ${answerText}\n\n${detail}\n\n考点：${stage.title}。可回到对应知识点原文复习。`,
    400
  );
  return {
    key: `rn-${quiz.slug}-${quiz.no}`,
    stageKey: `rn-${stage.id}-stage`,
    topicKey,
    type: "single",
    stem: clip(quiz.stem, 300),
    options: quiz.options.map((text, i) => ({ key: LETTERS[i], text: clip(text, 160) })),
    answer: [answerLetter],
    explanation,
    difficulty: index < 3 ? "easy" : "medium",
    tags: unique([stage.title.replace(/\s*教程$/, ""), "菜鸟教程", "选择题"]).slice(0, 4),
    sourceKey: SOURCE_KEY,
  };
}

// ---------------------------------------------------------------- 阶段教案
function buildStage(stage, topics, questions, pages) {
  const stageKey = `rn-${stage.id}-stage`;
  const pageCount = pages.length;
  return {
    key: stageKey,
    title: stage.title,
    weeks: `第 ${1} 阶段`,
    goal: `把「${stage.title}」的 ${pageCount} 页内容按 ${topics.length} 个知识点串起来，并能独立写出示例。`,
    outcome: `能在不看文档的情况下写出${stage.title}的典型用法，并把 ${questions.length} 道配套题做到 80% 以上正确率。`,
    topics,
    questionKeys: questions.map((question) => question.key),
    lesson: {
      overview: [
        `《${stage.title}》取自菜鸟教程，共 ${pageCount} 页，整理为 ${topics.length} 个知识点、${questions.length} 道配套测验题。`,
        `知识点顺序保持站内阅读顺序：${topics.map((topic) => topic.title).join(" → ")}。`,
      ],
      studyLoop: [
        "按知识点顺序读原文，每个知识点先看示例再读结论。",
        `读完一个知识点立刻做它的配套题（本节共 ${questions.length} 道），用正确率判断是否真的读懂。`,
        "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
        "全部知识点过完后，隔天把错题重做一遍。",
      ],
      milestones: [
        { title: `读完 ${topics[0]?.title ?? stage.title} 并跑通示例`, evidence: "本地示例输出与站点示例一致" },
        { title: "完成全部配套测验", evidence: `题正确率 ≥ 80%（共 ${questions.length} 道）` },
        { title: "能独立复述全部知识点", evidence: "不看文档说出每个知识点的用法与易错点" },
      ],
      completionCriteria: [
        `《${stage.title}》${topics.length} 个知识点全部读完。`,
        `配套 ${questions.length} 道题完成，正确率 ≥ 80%。`,
        "至少独立写出 3 个示例并跑通。",
      ],
    },
  };
}

// ---------------------------------------------------------------- 序列化
function serialize(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const pad2 = "  ".repeat(indent + 1);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inline =
      value.every((item) => ["string", "number", "boolean"].includes(typeof item)) &&
      value.map((item) => JSON.stringify(item)).join(", ").length <= 96;
    if (inline) return `[${value.map((item) => serialize(item)).join(", ")}]`;
    return `[\n${value.map((item) => pad2 + serialize(item, indent + 1)).join(",\n")}\n${pad}]`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  return `{\n${keys.map((key) => `${pad2}${key}: ${serialize(value[key], indent + 1)}`).join(",\n")}\n${pad}}`;
}

// ---------------------------------------------------------------- 主流程
async function main() {
  const readJsonl = async (name) =>
    (await readFile(path.join(IN_DIR, name), "utf8"))
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

  const quizRows = await readJsonl("quizzes.jsonl");
  const pageRows = await readJsonl("pages.jsonl");
  const quizBySlug = new Map(quizRows.map((row) => [row.slug, row]));

  const trackOrder = RUNOOB_TRACKS.map((track) => track.slug);
  const tracks = new Map(
    RUNOOB_TRACKS.map((meta) => [
      meta.slug,
      { meta, stages: [], questions: [], pageCount: 0, topicCount: 0 },
    ])
  );

  const report = [];
  const problems = [];

  for (const stage of RUNOOB_STAGES) {
    const pages = pageRows.filter((row) => row.stage === stage.id);
    const titles = RUNOOB_TOPICS[stage.id] ?? [];
    const quizQuestions = stage.quizzes.flatMap((slug) => {
      const row = quizBySlug.get(slug);
      if (!row) throw new Error(`测验未抓到：${slug}`);
      return row.questions.map((question, position) => ({ ...question, slug, no: position + 1 }));
    });
    if (titles.length < 3) problems.push(`${stage.id}: 知识点标题不足 3 个`);
    if (titles.length > Math.floor(quizQuestions.length / 2)) {
      problems.push(`${stage.id}: 知识点 ${titles.length} 个 > 题数/2 (${Math.floor(quizQuestions.length / 2)})`);
    }
    if (pages.length < titles.length * 3) problems.push(`${stage.id}: 页面 ${pages.length} 不足以切成 ${titles.length} 簇`);

    const clusters = splitClusters(pages, titles.length);
    if (clusters.length !== titles.length) {
      problems.push(`${stage.id}: 实际簇数 ${clusters.length} ≠ 标题数 ${titles.length}`);
    }

    // 每页 → 知识点；每题 → 与每个知识点（页标题+正文）的相似度矩阵
    const topicPages = new Map();
    clusters.forEach((cluster, index) => {
      topicPages.set(`rn-${stage.id}-${index + 1}`, cluster);
    });
    const pageTokens = new Map(
      pages.map((page) => [
        page.path,
        tokensOf(`${page.title} ${page.sections.map((section) => `${section.heading} ${section.text}`).join(" ").slice(0, 1500)}`),
      ])
    );
    const questionScores = quizQuestions.map((question) => {
      const tokens = tokensOf(`${question.stem} ${question.options.join(" ")}`);
      const row = new Map();
      for (const [topicKey, cluster] of topicPages) {
        let best = 0;
        for (const page of cluster) best = Math.max(best, similarity(tokens, pageTokens.get(page.path) ?? new Set()));
        row.set(topicKey, best);
      }
      return row;
    });

    const topicKeys = [...topicPages.keys()];
    const assigned = new Map(topicKeys.map((key) => [key, []])); // topicKey -> questionIndex[]
    questionScores.forEach((row, questionIndex) => {
      let bestKey = topicKeys[0];
      let bestScore = -1;
      for (const key of topicKeys) {
        const score = row.get(key) ?? 0;
        if (score > bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }
      assigned.get(bestKey).push(questionIndex);
    });

    // 配平：先把「题 < 2」的知识点补到 2，再收敛 max-min ≤ 2（每次挑对该知识点最像的题）
    const moveOne = (from, to) => {
      const candidates = [...assigned.get(from)].sort(
        (a, b) => (questionScores[b].get(to) ?? 0) - (questionScores[a].get(to) ?? 0)
      );
      if (candidates.length <= 2) return false;
      const pick = candidates[0];
      assigned.set(from, assigned.get(from).filter((index) => index !== pick));
      assigned.get(to).push(pick);
      return true;
    };
    for (let guard = 0; guard < 500; guard += 1) {
      const bySize = [...topicKeys].sort((a, b) => assigned.get(a).length - assigned.get(b).length);
      const target = bySize.find((key) => assigned.get(key).length < 2);
      if (!target) break;
      const donor = [...topicKeys].sort((a, b) => assigned.get(b).length - assigned.get(a).length)[0];
      if (!donor || !moveOne(donor, target)) {
        problems.push(`${stage.id}: ${target} 题量不足且无可借的知识点`);
        break;
      }
    }
    const average = quizQuestions.length / topicKeys.length;
    for (let guard = 0; guard < 500; guard += 1) {
      const bySize = [...topicKeys].sort((a, b) => assigned.get(a).length - assigned.get(b).length);
      const min = bySize[0];
      const max = bySize[bySize.length - 1];
      if (assigned.get(max).length - assigned.get(min).length <= 2) break;
      if (assigned.get(min).length >= Math.ceil(average)) break;
      if (!moveOne(max, min)) break;
    }

    // 生成知识点 + 题目
    const stageTopics = [];
    const stageQuestions = [];
    clusters.forEach((cluster, index) => {
      const topicKey = `rn-${stage.id}-${index + 1}`;
      const indices = [...(assigned.get(topicKey) ?? [])].sort((a, b) => a - b);
      const questions = indices.map((sourceIndex, questionIndex) =>
        buildQuestion(stage, quizQuestions[sourceIndex], questionIndex, topicKey)
      );
      stageTopics.push(buildTopicContent(stage, titles[index], cluster, questions, topicKey));
      stageQuestions.push(...questions);
    });

    const track = tracks.get(stage.track);
    track.stages.push(buildStage(stage, stageTopics, stageQuestions, pages));
    track.questions.push(...stageQuestions);
    track.pageCount += pages.length;
    track.topicCount += stageTopics.length;

    report.push({
      stage: stage.id,
      pages: pages.length,
      topics: stageTopics.length,
      questions: stageQuestions.length,
      minQuestions: Math.min(...stageTopics.map((topic) => stageQuestions.filter((q) => q.topicKey === topic.key).length)),
    });
  }

  // 轨道元数据
  const finalTracks = trackOrder.map((slug) => {
    const { meta, stages, questions, pageCount, topicCount } = tracks.get(slug);
    const stageTitles = stages.map((stage) => stage.title);
    return {
      slug: meta.slug,
      title: meta.title,
      category: meta.category,
      level: meta.level,
      accent: meta.accent,
      softAccent: meta.softAccent,
      icon: meta.icon,
      summary: clip(
        `菜鸟教程（runoob.com）${stageTitles.join(" / ")} 的系统整理：${stageTitles.length} 个教程、${topicCount} 个知识点、${questions.length} 道官方测验题。知识点保持站内阅读顺序，题按内容相似度归属到对应知识点。`,
        320
      ),
      whyLearn: clip(
        `${stageTitles.join("、")} 是上手这些技术最常用的入门路径；菜鸟教程的示例短、能直接跑。本课程把它们按知识点重新编排，并为每个知识点配上官方测验题，形成「读一节 → 做这一节的题 → 回读错题」的闭环。`,
        340
      ),
      prerequisites: ["会使用浏览器或命令行", "能读写基本的代码片段", "愿意动手敲示例并跑通"],
      studyMethod: [
        "按知识点顺序读原文，先看示例再看结论。",
        "每读完一个知识点立刻做它的配套题，用正确率判断是否读懂。",
        "错题回到对应知识点复述一遍，并写下错因。",
      ],
      estimatedHours: Math.max(6, Math.round(pageCount / 12)),
      featured: false,
      stages,
      questions,
      sources: [
        {
          key: SOURCE_KEY,
          name: "菜鸟教程（runoob.com）",
          url: RUNOOB_ORIGIN,
          license: LICENSE,
          usage: "import",
          note: "抓取口径：只抓有官方测验的 19 个教程的知识点与测验题；robots.txt 未禁止教程页（仅禁 /try/ 等），请求限并发并留间隔。",
        },
        {
          key: "runoob-quiz",
          name: "菜鸟教程 · 在线测验",
          url: `${RUNOOB_ORIGIN}/quiz/`,
          license: LICENSE,
          usage: "reference",
          note: "题目与答案来自测验页内嵌的 quizData（题干/选项/正确下标/解析）。",
        },
      ],
    };
  });

  // 校验
  for (const track of finalTracks) {
    for (const stage of track.stages) {
      for (const topic of stage.topics) {
        const count = track.questions.filter((question) => question.topicKey === topic.key).length;
        if (count < 2) problems.push(`${topic.key}: 题量 ${count} < 2`);
        for (const text of [topic.title, topic.summary, topic.method, topic.exercise, topic.checkpoint,
          ...topic.concepts, ...topic.principles, ...topic.applications, ...topic.pitfalls,
          ...(topic.lesson?.overview ?? []), ...(topic.lesson?.mechanism ?? []),
          ...(topic.lesson?.practiceSteps ?? []), ...(topic.lesson?.masteryChecklist ?? []),
          topic.lesson?.example?.code ?? "", topic.lesson?.example?.title ?? "", topic.lesson?.example?.explanation ?? ""]) {
          const unsafe = findUnsafe(text);
          if (unsafe.length) problems.push(`${topic.key}: 危险片段 ${unsafe.join(",")} → ${String(text).slice(0, 60)}`);
        }
      }
    }
  }

  console.log("[runoob] 阶段统计：");
  for (const row of report) {
    console.log(
      `  ${row.stage.padEnd(11)} 页 ${String(row.pages).padStart(3)} · 知识点 ${String(row.topics).padStart(2)} · 题 ${String(row.questions).padStart(3)} · 单点最少题 ${row.minQuestions}`
    );
  }
  const totalQuestions = finalTracks.reduce((n, track) => n + track.questions.length, 0);
  const totalTopics = finalTracks.reduce((n, track) => n + track.stages.reduce((m, stage) => m + stage.topics.length, 0), 0);
  console.log(
    `[runoob] 合计：课程 ${finalTracks.length} · 阶段 ${finalTracks.reduce((n, t) => n + t.stages.length, 0)} · 知识点 ${totalTopics} · 题 ${totalQuestions}`
  );
  if (problems.length) {
    console.log(`[runoob] 问题 ${problems.length} 条：`);
    for (const problem of problems.slice(0, 20)) console.log("  - " + problem);
  } else {
    console.log("[runoob] 校验通过");
  }
  if (CHECK_ONLY) return;
  if (problems.length) throw new Error(`生成前校验未通过（${problems.length} 条），请先修复`);

  await mkdir(OUT_DIR, { recursive: true });
  const FILES = {
    "rn-frontend": "runoob-frontend.ts",
    "rn-lang": "runoob-lang.ts",
    "rn-cs-tools": "runoob-cs-tools.ts",
  };
  const NAMES = {
    "rn-frontend": "runoobFrontendTrack",
    "rn-lang": "runoobLangTrack",
    "rn-cs-tools": "runoobCsToolsTrack",
  };
  for (const track of finalTracks) {
    const header =
      `/**\n` +
      ` * 「${track.title}」——来源：菜鸟教程 https://www.runoob.com/ 。\n` +
      ` *\n` +
      ` * 由 \`scripts/runoob/crawl.mjs\` + \`scripts/runoob/generate.mjs\` 自动生成 —— **请勿手改**，\n` +
      ` * 要改请改 \`scripts/runoob/topics.mjs\` 的标题目录（或抓取/解析层）后重跑。\n` +
      ` *\n` +
      ` * 阶段 ${track.stages.length} 个 · 知识点 ${track.stages.reduce((n, s) => n + s.topics.length, 0)} 个 · 题目 ${track.questions.length} 道。\n` +
      ` */\n` +
      `import type { LearningTrack } from "./types";\n\n`;
    const body = `export const ${NAMES[track.slug]}: LearningTrack = ${serialize(track)};\n`;
    await writeFile(path.join(OUT_DIR, FILES[track.slug]), header + body, "utf8");
    console.log(`[runoob] 写入 ${FILES[track.slug]}（${(header + body).length} 字符）`);
  }
}

await main().catch((error) => {
  console.error("[runoob] 生成失败：" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
