#!/usr/bin/env node
/**
 * csgraduates 408 → 内容包 TS 生成器（**自动生成，勿手改产物**）。
 *
 * 输入：`scripts/cs-graduates/crawl.mjs` 落下的 `.local/csgrad/*.jsonl`
 * 输出：
 *   - packages/content/src/learning/exam-408-grad.ts      课程骨架（4 阶段 · 25 章级知识点 · 教案 · 来源）
 *   - packages/content/src/learning/exam-408-grad-bank.ts 720 道 408 选择题（题干/选项/答案/解析）
 *
 * 为什么是「章级知识点」而不是站点的 88 个细页：
 *   内容契约要求每个已发布知识点**至少 2 道配套题**（TS 侧 quality.test.ts + 库侧 check-content-quality.mjs）。
 *   实测按章聚合后每章 3~59 道题（全部 ≥2），而按 88 个细页聚合有 14 页不足 2 道；
 *   细页内容并不丢弃 —— 每章知识点把各节的标题、段落、代码全部收进 `lesson`。
 *
 * 用法：node scripts/cs-graduates/generate.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_DIR = path.resolve(ROOT, ".local/csgrad");
const OUT_DIR = path.resolve(ROOT, "packages/content/src/learning");

const SOURCE_KEY = "csgraduates-408";
const SITE = "https://www.csgraduates.com";
const YEAR_RANGE = "2009–2026";

/** 站点章节顺序（教学顺序，不是字母序）；标题取自站点页面，这里只定顺序 */
const SUBJECTS = [
  {
    key: "ds",
    stageKey: "ex408g-ds-stage",
    title: "数据结构",
    weeks: "第 1-4 周",
    goal: "把线性表、树、图、查找与排序的表示、操作与复杂度讲透，并能按 408 真题的问法作答。",
    outcome: "看到一道数据结构真题，能立刻判断它在考哪一章的哪个操作，并说出复杂度与易错点。",
    chapters: ["basic", "linearlist", "array", "strings", "tree", "graph", "search", "sort"],
  },
  {
    key: "co",
    stageKey: "ex408g-co-stage",
    title: "计算机组成原理",
    weeks: "第 5-8 周",
    goal: "从数据表示到指令、CPU、存储与总线，建立「一条指令在机器上如何执行」的完整链路。",
    outcome: "能把 408 组成原理真题落到具体部件与周期上，而不是死记结论。",
    chapters: ["overview", "representation", "instruction", "cpu", "storage", "bus"],
  },
  {
    key: "os",
    stageKey: "ex408g-os-stage",
    title: "操作系统",
    weeks: "第 9-11 周",
    goal: "掌握进程、内存、文件与 I/O 四块的核心机制与真题考点分布。",
    outcome: "能解释资源如何被调度、隔离与持久化，并能算调度/置换/分配类真题。",
    chapters: ["concepts", "process", "memory", "files", "io_device"],
  },
  {
    key: "net",
    stageKey: "ex408g-net-stage",
    title: "计算机网络",
    weeks: "第 12-14 周",
    goal: "按分层体系结构掌握物理层到应用层的协议细节与计算类考点。",
    outcome: "能把一次通信拆到各层，并算清时延、窗口、子网划分等真题。",
    chapters: ["overall", "physical", "datalink", "network", "transport", "application"],
  },
];

const SUBJECT_BY_KEY = new Map(SUBJECTS.map((s) => [s.key, s]));

async function readJsonl(name) {
  const raw = await readFile(path.join(SRC_DIR, name), "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

const trim = (text, max) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("；"), cut.lastIndexOf("，"));
  return (lastStop > max * 0.6 ? cut.slice(0, lastStop + 1) : cut) + "…";
};

const dedupe = (items, max) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const text = String(item ?? "").replace(/\s+/g, " ").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
};

function sentencesOf(text) {
  return String(text ?? "")
    .split(/(?<=[。！？；])|\n/)
    .map((s) => s.trim())
    // 砍掉被公式/换行截断的半句（「时间复杂度 是」这种），只留读得通的整句
    .filter((s) => !/[是为的与和及或、：:（(]$/.test(s))
    .filter((s) => s.length >= 8);
}

/** 从各节段落/列表里挑「结论型」句子作为 principles（站点原文，不改写） */
function pickPrinciples(sections, limit = 6) {
  const marker = /性质|特点|必须|一定|唯一|规则|条件|公式|等于|不超过|不大于|不小于|时间复杂度|平均|优缺点|区别|定义是|指的是/;
  const out = [];
  for (const section of sections) {
    for (const item of section.lists.flatMap((l) => l.items)) {
      if (marker.test(item) && !item.trim().endsWith("？")) out.push(trim(item, 120));
    }
    for (const paragraph of section.paragraphs) {
      for (const sentence of sentencesOf(paragraph)) {
        if (marker.test(sentence) && !sentence.endsWith("？")) out.push(trim(sentence, 120));
      }
    }
  }
  return dedupe(out, limit);
}

/**
 * 易错点：只认站点原文里**明确提示注意**的句子。
 * 刻意不用「区别/不同/错误」这类词做触发 —— 它们大量出现在正常解释里，
 * 会把「UDP 校验和用于检测错误」这种陈述句错当成易错点。
 */
function pickPitfalls(sections, limit = 4) {
  const marker = /注意|易错|容易错|不要|避免|误区|切忌|小心|切记|容易混淆/;
  const out = [];
  for (const section of sections) {
    const pool = [...section.paragraphs.flatMap(sentencesOf), ...section.lists.flatMap((l) => l.items)];
    for (const item of pool) {
      if (marker.test(item) && !item.trim().endsWith("：") && !item.trim().endsWith("？")) out.push(trim(item, 110));
    }
  }
  return dedupe(out, limit);
}

/** 概念词表：去掉「功能/特点」这类过泛的小标题与只有标点的碎片 */
function cleanConcepts(items, max) {
  const tooGeneric = /^(功能|特点|概念|结构|定义|概述|总结|分类|作用|简介|说明|目录|项目|内容)$/;
  return dedupe(
    items
      .map((item) => String(item ?? "").replace(/[：:、，,。]+$/, "").trim())
      .filter((item) => item.length >= 2 && !tooGeneric.test(item)),
    max
  );
}

const tsString = (value) => JSON.stringify(String(value ?? ""));
const tsArray = (items, indent) => {
  if (items.length === 0) return "[]";
  const pad = " ".repeat(indent);
  return "[\n" + items.map((item) => `${pad}  ${tsString(item)},`).join("\n") + `\n${pad}]`;
};

async function main() {
  const [questions, solutions, knowledgeRows] = await Promise.all([
    readJsonl("questions.jsonl"),
    readJsonl("solutions.jsonl"),
    readJsonl("knowledge.jsonl"),
  ]);

  const leaves = knowledgeRows.filter((row) => row.page);
  const chapterRows = knowledgeRows.filter((row) => !row.page);
  const leafByPath = new Map(leaves.map((leaf) => [leaf.path, leaf]));
  const chapterTitleByKey = new Map(chapterRows.map((row) => [`${row.subject}/${row.chapter}`, row.title]));
  const chapterPathByKey = new Map(chapterRows.map((row) => [`${row.subject}/${row.chapter}`, row.path]));

  const leavesByChapter = new Map();
  for (const leaf of leaves) {
    const key = `${leaf.subject}/${leaf.chapter}`;
    if (!leavesByChapter.has(key)) leavesByChapter.set(key, []);
    leavesByChapter.get(key).push(leaf);
  }

  // ---- 题目 → 章（严格口径：所有知识点链接必须落在同一章才挂 topicKey） ----
  const chapterOfQuestion = new Map();
  for (const question of questions) {
    const chapters = new Set(
      question.knowledgePaths.map((p) => {
        const leaf = leafByPath.get(p);
        return leaf ? `${leaf.subject}/${leaf.chapter}` : null;
      }).filter(Boolean)
    );
    chapterOfQuestion.set(question, chapters.size === 1 ? [...chapters][0] : null);
  }

  const statsByChapter = new Map();
  for (const question of questions) {
    const key = chapterOfQuestion.get(question);
    if (!key) continue;
    const stat = statsByChapter.get(key) ?? { count: 0, years: new Set(), tags: new Map() };
    stat.count += 1;
    stat.years.add(question.year);
    for (const tag of question.tags) stat.tags.set(tag, (stat.tags.get(tag) ?? 0) + 1);
    statsByChapter.set(key, stat);
  }

  // ---- 建阶段 / 知识点 ----
  const stages = [];
  const topicKeyByChapter = new Map();
  for (const subject of SUBJECTS) {
    const topics = [];
    for (const chapter of subject.chapters) {
      const chapterKey = `${subject.key}/${chapter}`;
      const title = chapterTitleByKey.get(chapterKey) ?? chapter;
      const topicKey = `ex408g-${subject.key}-${chapter}`;
      topicKeyByChapter.set(chapterKey, topicKey);
      const chapterLeaves = leavesByChapter.get(chapterKey) ?? [];
      const stat = statsByChapter.get(chapterKey) ?? { count: 0, years: new Set(), tags: new Map() };
      const topTags = [...stat.tags.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
      const leafTitles = chapterLeaves.map((leaf) => leaf.title);
      const sections = chapterLeaves.flatMap((leaf) =>
        leaf.sections.map((section) => ({ ...section, leafTitle: leaf.title }))
      );
      const allParagraphs = sections.flatMap((section) => section.paragraphs);
      const allItems = sections.flatMap((section) => section.lists.flatMap((l) => l.items));
      const codeBlocks = sections.flatMap((section) => section.codes.map((c) => ({ ...c, section })));
      const years = [...stat.years].sort((a, b) => a - b);
      const yearSpan = years.length ? (years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`) : YEAR_RANGE;

      const concepts = cleanConcepts(
        [...leafTitles, ...sections.filter((s) => s.level <= 3).map((s) => s.heading)],
        10
      );

      const principles = pickPrinciples(sections);
      const principlesFinal =
        principles.length >= 3
          ? principles
          : dedupe(
              [
                ...principles,
                ...chapterLeaves.map(
                  (leaf) => `《${leaf.title}》覆盖的考点：${leaf.sections.map((s) => s.heading).filter(Boolean).slice(0, 5).join("、")}。`
                ),
              ],
              6
            );

      const pitfalls = pickPitfalls(sections);
      const pitfallsFinal =
        pitfalls.length > 0
          ? pitfalls
          : [
              `本章真题的易错点集中在${topTags.slice(0, 2).join("、") || leafTitles[0] || title}上；做题时逐个比对选项差异，别只凭“眼熟”。`,
            ];

      const applications = dedupe(
        [
          `408 真题考点分布：${topTags.slice(0, 6).map((tag) => `${tag}(${stat.tags.get(tag)})`).join("、") || leafTitles.slice(0, 4).join("、")}。`,
          `本章在 ${years.length} 个年份的真题中出现过（${yearSpan}），共 ${stat.count} 道选择题。`,
          ...chapterLeaves
            .map((leaf) => ({ title: leaf.title, body: trim(leaf.sections[0]?.paragraphs[0] ?? "", 90) }))
            .filter((entry) => entry.body.length >= 20)
            .map((entry) => `《${entry.title}》：${entry.body}`),
        ],
        8
      );

      const overview = dedupe(
        [
          `本章取自「计算机考研杂货铺」408 知识库的「${title}」，含 ${chapterLeaves.length} 个小节：${leafTitles.join("、")}。`,
          ...chapterLeaves.map((leaf) => `【${leaf.title}】${trim(leaf.sections[0]?.paragraphs[0] ?? leaf.priorityNote ?? "", 200)}`),
        ],
        12
      );
      const mechanism = dedupe(
        [
          ...allParagraphs.slice(1).map((p) => trim(p, 220)),
          ...allItems.filter((item) => item.length >= 12).map((item) => trim(item, 160)),
        ],
        14
      );

      const primaryCode = codeBlocks.find((c) => c.language === "c") ?? codeBlocks[0] ?? null;
      const example = primaryCode
        ? {
            title: `${primaryCode.section.leafTitle} · ${primaryCode.section.heading}`,
            language: primaryCode.language,
            code: primaryCode.code.length > 1400 ? primaryCode.code.slice(0, 1400) + "\n// …（完整代码见站点原文）" : primaryCode.code,
            explanation: trim(primaryCode.section.paragraphs[0] ?? `${primaryCode.section.heading} 的示例。`, 200),
          }
        : {
            title: `${title} · 章节结构`,
            language: "text",
            code: chapterLeaves
              .map((leaf) => `${leaf.title}\n${leaf.sections.map((s) => `  - ${s.heading}`).join("\n")}`)
              .join("\n\n"),
            explanation: "站点本章没有可摘录的代码示例，这里保留章节结构作为阅读索引。",
          };

      topics.push({
        key: topicKey,
        title,
        summary: trim(
          `《${title}》：${leafTitles.join("、")}。408 真题考点：${topTags.slice(0, 4).join("、") || leafTitles.slice(0, 3).join("、")}；匹配 ${stat.count} 道真题（${yearSpan}）。`,
          200
        ),
        concepts,
        principles: principlesFinal,
        applications,
        pitfalls: pitfallsFinal,
        method: `先按 ${leafTitles.slice(0, 3).join(" → ")} 的顺序读各节，再回做本章 ${stat.count} 道真题；错题回到对应小节复述一遍。`,
        exercise: `完成本章配套的 ${stat.count} 道 408 选择题（${yearSpan}），把错题记进练习记录，隔天重做一次。`,
        checkpoint: `能说清「${concepts.slice(0, 3).join("、")}」之间的区别，并把本章 ${stat.count} 道真题做到 80% 以上正确率。`,
        lesson: {
          overview,
          mechanism,
          example,
          practiceSteps: [
            `通读本章小节（${chapterLeaves.length} 个）：${leafTitles.join("、")}。`,
            `对照考点标签（${topTags.slice(0, 4).join("、") || "本章考点"}）定位自己薄弱的小节。`,
            `做本章 ${stat.count} 道真题，逐题写出「为什么选它、为什么不选那个」。`,
            "把错题的小节重读一遍，并用一句话写下错因。",
          ],
          masteryChecklist: [
            `能不看资料复述 ${concepts.slice(0, 3).join("、")} 的定义与区别。`,
            `能在限定时间内完成 ${stat.count} 道真题且正确率 ≥80%。`,
            `能说出${topTags.slice(0, 2).join("、") || "本章考点"}在真题里的常见问法。`,
          ],
        },
        _stat: { count: stat.count, yearSpan, leafCount: chapterLeaves.length },
      });
    }

    stages.push({
      key: subject.stageKey,
      title: subject.title,
      weeks: subject.weeks,
      goal: subject.goal,
      outcome: subject.outcome,
      topics,
      questionKeys: [],
      lesson: {
        overview: [
          `${subject.title}共 ${topics.length} 章、${topics.reduce((n, t) => n + t._stat.leafCount, 0)} 个小节，配套 ${topics.reduce((n, t) => n + t._stat.count, 0)} 道 408 真题。`,
          "本阶段按「章节顺序阅读 → 考点定位 → 真题验证 → 错题回读」推进，每一章都能在站点原文里找到依据。",
        ],
        studyLoop: [
          "先读一章的教案（overview 建立框架，mechanism 补细节）。",
          "按该章的考点标签定位薄弱小节，只精读那一节。",
          "做该章配套真题，错的题写出错因并回读对应小节。",
          "一章收尾时合上资料，复述该章的核心概念与易错点。",
        ],
        milestones: [
          { title: "读完前一半章节", evidence: "能说出每一章考什么、在真题里怎么问。" },
          { title: "整章真题正确率 ≥70%", evidence: "练习记录里该阶段真题正确率达标。" },
          { title: "错题清零", evidence: "错题重做一遍，能说明每个错误选项错在哪。" },
        ],
        completionCriteria: [
          `完成 ${topics.reduce((n, t) => n + t._stat.count, 0)} 道本章真题，正确率 ≥80%。`,
          "能合上讲清每章的核心概念、典型计算与易错点。",
          "能把这个阶段的真题按章节归类并说明考点分布。",
        ],
      },
    });
  }

  // ---- 题目 ----
  const bankQuestions = [];
  const usedKeys = new Set();
  for (const question of questions) {
    const subject = SUBJECT_BY_KEY.get(question.subject);
    if (!subject) continue;
    if (question.multiple || question.options.length < 2) continue;
    const answer = /^[A-D]$/.test(question.answer) ? question.answer : null;
    if (!answer) continue;
    const key = `csg-${question.year}-${question.number}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    const chapterKey = chapterOfQuestion.get(question);
    const topicKey = chapterKey ? topicKeyByChapter.get(chapterKey) : undefined;
    const cleanedExplanation = question.explanation
      .replace(/^\s*正确答案\s*[:：]?\s*[A-D]\s*/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // 契约要求解析 ≥20 字（`learning-content.test.ts`）。站点个别题只写「详见此节」，
    // 这里补一句**如实**的说明，而不是编造解析内容。
    const explanation =
      cleanedExplanation.length >= 20
        ? cleanedExplanation
        : `${cleanedExplanation}\n\n站点该题解析较简短，请对照四个选项的差异逐项核对。`.trim();
    bankQuestions.push({
      key,
      stageKey: subject.stageKey,
      ...(topicKey ? { topicKey } : {}),
      type: "single",
      stem: trim(question.stem, 900),
      options: question.options.map((option) => ({ key: option.key, text: trim(option.text, 400) })),
      answer: [answer],
      explanation: explanation || `正确答案：${answer}`,
      difficulty: "medium",
      tags: dedupe([...question.tags, subject.title, `${question.year} 年真题`], 6),
      sourceKey: SOURCE_KEY,
    });
  }

  // ---- 写 bank 文件 ----
  const bankLines = [];
  bankLines.push('import type { LearningQuestion } from "./types";');
  bankLines.push("");
  bankLines.push("/**");
  bankLines.push(" * 408 历年真题选择题（2009–2026，共 " + bankQuestions.length + " 道）。");
  bankLines.push(" *");
  bankLines.push(" * 由 `scripts/cs-graduates/` 从「计算机考研杂货铺」（https://www.csgraduates.com/）");
  bankLines.push(" * 的 408 真题页抓取并解析而来：题干 / 四个选项 / 正确答案 / 站点解析 / 考点标签。");
  bankLines.push(" * 归属：按站点每道题给出的知识点链接落到对应章节的知识点；跨章或无链接的保持阶段级。");
  bankLines.push(" * **自动生成，勿手改**（要改请改 crawl/parse 或 generate，再重跑）。");
  bankLines.push(" */");
  bankLines.push("export const exam408GradQuestions: LearningQuestion[] = [");
  for (const question of bankQuestions) {
    bankLines.push("  {");
    bankLines.push(`    key: ${tsString(question.key)},`);
    bankLines.push(`    stageKey: ${tsString(question.stageKey)},`);
    if (question.topicKey) bankLines.push(`    topicKey: ${tsString(question.topicKey)},`);
    bankLines.push(`    type: "single",`);
    bankLines.push(`    stem: ${tsString(question.stem)},`);
    bankLines.push(
      `    options: [${question.options
        .map((option) => `{ key: ${tsString(option.key)}, text: ${tsString(option.text)} }`)
        .join(", ")}],`
    );
    bankLines.push(`    answer: [${tsString(question.answer[0])}],`);
    bankLines.push(`    explanation: ${tsString(question.explanation)},`);
    bankLines.push(`    difficulty: ${tsString(question.difficulty)},`);
    bankLines.push(`    tags: [${question.tags.map((tag) => tsString(tag)).join(", ")}],`);
    bankLines.push(`    sourceKey: ${tsString(question.sourceKey)},`);
    bankLines.push("  },");
  }
  bankLines.push("];");
  bankLines.push("");
  await writeFile(path.join(OUT_DIR, "exam-408-grad-bank.ts"), bankLines.join("\n"), "utf8");

  // ---- 写 track 文件 ----
  const lines = [];
  lines.push('import { exam408GradQuestions } from "./exam-408-grad-bank";');
  lines.push('import type { LearningTrack } from "./types";');
  lines.push("");
  lines.push("/**");
  lines.push(" * 408 知识点精讲 + 历年真题（来源：计算机考研杂货铺 https://www.csgraduates.com/）。");
  lines.push(" *");
  lines.push(" * 结构：4 个阶段（四门课）= 站点 25 章 → 25 个章级知识点；");
  lines.push(" * 站点的 88 个细页（标题/段落/代码）全部收进对应章级知识点的 `lesson`。");
  lines.push(" * 题目见 `exam-408-grad-bank.ts`（" + bankQuestions.length + " 道选择题）。**自动生成，勿手改**。");
  lines.push(" */");
  lines.push("export const exam408GradTrack: LearningTrack = {");
  lines.push(`  slug: "ex-408-grad",`);
  lines.push(`  title: "408 知识点精讲 · 历年真题",`);
  lines.push(`  category: "408",`);
  lines.push(`  level: "综合",`);
  lines.push(`  accent: "#1F6F6B",`);
  lines.push(`  softAccent: "#E3F1EF",`);
  lines.push(`  icon: "library-outline",`);
  lines.push(
    `  summary: ${tsString(
      `按「计算机考研杂货铺」的 408 知识库整理的章级知识点（四门课 25 章），并配齐 ${bankQuestions.length} 道 ${YEAR_RANGE} 年 408 真题：题干、四个选项、正确答案与站点解析一应俱全。`
    )},`
  );
  lines.push(
    `  whyLearn: ${tsString(
      "408 的难点不在记结论，而在把结论对应到具体章节与问法。这套内容把四门课按章拆开：每章先给站点整理的知识点与章节结构，再挂上这一章历年真正考过的选择题与解析，形成一个「读一章 → 做这章的真题 → 回读错题小节」的闭环。与「408 计算机学科专业基础」课程互补：那门课讲考点框架，这套内容提供分章精讲与逐年真题解析。"
    )},`
  );
  lines.push(
    `  prerequisites: ${tsArray(["已学过数据结构与计算机组成的基础概念（或正在同步学习）", "能读写 C 语言片段", "会做二进制/补码等基本换算"], 2)},`
  );
  lines.push("  studyMethod: [");
  lines.push(`    "按「阶段 → 章 → 小节」读知识点，每章先建立框架再看细节",`);
  lines.push(`    "每章读完立刻做该章配套真题，用正确率判断是否真的读懂",`);
  lines.push(`    "错题回到对应小节复述一遍，并写下错因（比重复刷题有效）",`);
  lines.push("  ],");
  lines.push(`  estimatedHours: 220,`);
  lines.push(`  featured: true,`);
  lines.push("  sources: [");
  lines.push("    {");
  lines.push(`      key: ${tsString(SOURCE_KEY)},`);
  lines.push(`      name: "计算机考研杂货铺 · 408 知识库",`);
  lines.push(`      url: ${tsString(SITE + "/")},`);
  lines.push(`      license: "保留所有权利（站点声明）· 个人自用不商用",`);
  lines.push(`      usage: "import",`);
  lines.push(`      note: "408 知识点与 2009–2026 真题解析来源；个人学习自用、不商用，如实登记站点许可声明",`);
  lines.push("    },");
  lines.push("    {");
  lines.push(`      key: "xv6",`);
  lines.push(`      name: "xv6-riscv",`);
  lines.push(`      url: "https://github.com/mit-pdos/xv6-riscv",`);
  lines.push(`      license: "MIT",`);
  lines.push(`      usage: "reference",`);
  lines.push(`      note: "操作系统章节的实现参照，用于校对进程/页表/中断的讲解",`);
  lines.push("    },");
  lines.push("    {");
  lines.push(`      key: "nand2tetris",`);
  lines.push(`      name: "Nand2Tetris",`);
  lines.push(`      url: "https://github.com/nand2tetris/nand2tetris",`);
  lines.push(`      license: "MIT",`);
  lines.push(`      usage: "reference",`);
  lines.push(`      note: "组成原理章节的体系结构参照",`);
  lines.push("    },");
  lines.push("  ],");
  lines.push("  stages: [");
  for (const stage of stages) {
    lines.push("    {");
    lines.push(`      key: ${tsString(stage.key)},`);
    lines.push(`      title: ${tsString(stage.title)},`);
    lines.push(`      weeks: ${tsString(stage.weeks)},`);
    lines.push(`      goal: ${tsString(stage.goal)},`);
    lines.push(`      outcome: ${tsString(stage.outcome)},`);
    lines.push("      topics: [");
    for (const topic of stage.topics) {
      lines.push("        {");
      lines.push(`          key: ${tsString(topic.key)},`);
      lines.push(`          title: ${tsString(topic.title)},`);
      lines.push(`          summary: ${tsString(topic.summary)},`);
      lines.push(`          concepts: ${tsArray(topic.concepts, 10)},`);
      lines.push(`          principles: ${tsArray(topic.principles, 10)},`);
      lines.push(`          applications: ${tsArray(topic.applications, 10)},`);
      lines.push(`          pitfalls: ${tsArray(topic.pitfalls, 10)},`);
      lines.push(`          method: ${tsString(topic.method)},`);
      lines.push(`          exercise: ${tsString(topic.exercise)},`);
      lines.push(`          checkpoint: ${tsString(topic.checkpoint)},`);
      lines.push("          lesson: {");
      lines.push(`            overview: ${tsArray(topic.lesson.overview, 12)},`);
      lines.push(`            mechanism: ${tsArray(topic.lesson.mechanism, 12)},`);
      lines.push("            example: {");
      lines.push(`              title: ${tsString(topic.lesson.example.title)},`);
      lines.push(`              language: ${tsString(topic.lesson.example.language)},`);
      lines.push(`              code: ${tsString(topic.lesson.example.code)},`);
      lines.push(`              explanation: ${tsString(topic.lesson.example.explanation)},`);
      lines.push("            },");
      lines.push(`            practiceSteps: ${tsArray(topic.lesson.practiceSteps, 12)},`);
      lines.push(`            masteryChecklist: ${tsArray(topic.lesson.masteryChecklist, 12)},`);
      lines.push("          },");
      lines.push("        },");
    }
    lines.push("      ],");
    const stageQuestionKeys = bankQuestions.filter((q) => q.stageKey === stage.key).map((q) => q.key);
    lines.push(`      questionKeys: [${stageQuestionKeys.map((k) => tsString(k)).join(", ")}],`);
    lines.push("      lesson: {");
    lines.push(`        overview: ${tsArray(stage.lesson.overview, 8)},`);
    lines.push(`        studyLoop: ${tsArray(stage.lesson.studyLoop, 8)},`);
    lines.push("        milestones: [");
    for (const milestone of stage.lesson.milestones) {
      lines.push(`          { title: ${tsString(milestone.title)}, evidence: ${tsString(milestone.evidence)} },`);
    }
    lines.push("        ],");
    lines.push(`        completionCriteria: ${tsArray(stage.lesson.completionCriteria, 8)},`);
    lines.push("      },");
    lines.push("    },");
  }
  lines.push("  ],");
  lines.push("  questions: exam408GradQuestions,");
  lines.push("};");
  lines.push("");
  await writeFile(path.join(OUT_DIR, "exam-408-grad.ts"), lines.join("\n"), "utf8");

  const byTopic = bankQuestions.filter((q) => q.topicKey).length;
  console.log(
    `[cs-graduates] 生成完成：${stages.length} 阶段 / ${stages.reduce((n, s) => n + s.topics.length, 0)} 知识点 / ${bankQuestions.length} 题（挂知识点 ${byTopic}，阶段级 ${bankQuestions.length - byTopic}）`
  );
  console.log(`[cs-graduates] 未采用：多选或选项不足 ${questions.length - bankQuestions.length} 道`);
  console.log(`[cs-graduates] 解答题（暂不入题库，保留在 .local/csgrad/solutions.jsonl）：${solutions.length} 道`);
}

await main().catch((error) => {
  console.error(`[cs-graduates] 失败：${error?.stack ?? error}`);
  process.exitCode = 1;
});
