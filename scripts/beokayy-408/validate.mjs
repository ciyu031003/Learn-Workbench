#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED,
  ORIGIN,
  SUBJECTS,
  asBoolean,
  asPositiveInt,
  mapLimit,
  parseArgs,
  readJson,
  resolveOutDir,
  sleep,
  sourceUrl,
  writeJson,
} from "./common.mjs";

const BASELINE = JSON.parse(
  await readFile(new URL("./baseline.json", import.meta.url), "utf8"),
);

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const PARSED_DIR = path.join(OUT_DIR, "parsed");
const REPORT_DIR = path.join(OUT_DIR, "validation");
const CHECK_ONLINE_IMAGES = asBoolean(args.online, false);
const IMAGE_CONCURRENCY = asPositiveInt(args["image-concurrency"], 2, 3);
const IMAGE_GAP_MS = asPositiveInt(args["image-gap"], 250, 3000);

async function main() {
  const manifest = await readJson(path.join(OUT_DIR, "raw", "manifest.json"));
  const papersFile = await readJson(path.join(PARSED_DIR, "papers.json"));
  const questionsFile = await readJson(path.join(PARSED_DIR, "questions.json"));
  const knowledgeFile = await readJson(
    path.join(PARSED_DIR, "knowledge-index.json"),
  );

  const papers = papersFile.papers ?? [];
  const questions = questionsFile.questions ?? [];
  const subjects = knowledgeFile.subjects ?? [];
  const errors = [];
  const warnings = [];

  validateQuestions(questions, errors, warnings, BASELINE);
  validatePapers(papers, questions, errors, warnings, BASELINE);
  validateKnowledge(subjects, questions, errors, warnings, BASELINE);
  validateSamples(manifest, papers, errors, warnings);

  const imageCheck = CHECK_ONLINE_IMAGES
    ? await validateImages(questions)
    : { enabled: false, checked: 0, ok: 0, failed: [] };
  for (const failure of imageCheck.failed) {
    errors.push({
      code: "image_unavailable",
      message: `${failure.url} returned ${failure.status ?? failure.error}`,
    });
  }

  const report = {
    version: 1,
    checkedAt: new Date().toISOString(),
    ok: errors.length === 0,
    source: {
      origin: ORIGIN,
      capturedAt: manifest.capturedAt,
      bundleUrl: manifest.discovery?.bundleUrl ?? null,
    },
    summary: {
      years: papers.length,
      questions: questions.length,
      choices: questions.filter((question) => question.type === "choice").length,
      comprehensive: questions.filter(
        (question) => question.type === "comprehensive",
      ).length,
      imageQuestions: questions.filter((question) => question.imageRefs.length > 0)
        .length,
      knowledgeSubjects: subjects.length,
      knowledgePoints: subjects.reduce(
        (total, subject) =>
          total +
          subject.chapters.reduce(
            (chapterTotal, chapter) => chapterTotal + chapter.points.length,
            0,
          ),
        0,
      ),
      onlineImages: imageCheck,
    },
    errors,
    warnings,
  };

  await writeJson(path.join(REPORT_DIR, "report.json"), report);

  console.log(
    [
      `[beokayy-408] validation ${report.ok ? "passed" : "failed"}`,
      `years=${report.summary.years}`,
      `questions=${report.summary.questions}`,
      `baseline=${BASELINE.minimum.papers}p/${BASELINE.minimum.questions}q`,
      `errors=${errors.length}`,
      `warnings=${warnings.length}`,
      `onlineImages=${imageCheck.checked}`,
    ].join(" "),
  );

  if (!report.ok) process.exitCode = 1;
}

function validateQuestions(questions, errors, warnings, baseline = BASELINE) {
  const ids = new Set();

  if (questions.length < baseline.minimum.questions) {
    errors.push({
      code: "question_count_regression",
      message: `Expected at least ${baseline.minimum.questions} questions, got ${questions.length}.`,
    });
  }

  for (const question of questions) {
    if (!/^\d{4}-\d{2}$/.test(question.id)) {
      errors.push({
        code: "invalid_question_id",
        questionId: question.id,
        message: "Question id must use YYYY-NN.",
      });
    }
    if (ids.has(question.id)) {
      errors.push({
        code: "duplicate_question_id",
        questionId: question.id,
        message: "Question id is duplicated.",
      });
    }
    ids.add(question.id);

    if (
      !["choice", "comprehensive"].includes(question.type)
    ) {
      errors.push({
        code: "invalid_question_type",
        questionId: question.id,
        message: `Unknown question type: ${question.type}`,
      });
    }

    if (!question.body.trim()) {
      errors.push({
        code: "missing_body",
        questionId: question.id,
        message: "Question body is empty.",
      });
    }

    if (!question.answerText.trim()) {
      errors.push({
        code: "missing_answer",
        questionId: question.id,
        message: "Answer is empty.",
      });
    }

    if (question.type === "choice") {
      if (question.options.length !== 4 || question.optionCount !== 4) {
        errors.push({
          code: "invalid_choice_options",
          questionId: question.id,
          message: `Expected 4 options, got parsed=${question.options.length}, declared=${question.optionCount}.`,
        });
      }
      if (!question.answerLetter) {
        errors.push({
          code: "missing_choice_answer",
          questionId: question.id,
          message: "Unable to extract an A-D answer letter.",
        });
      }
      if (question.points !== EXPECTED.score.choice) {
        errors.push({
          code: "invalid_choice_points",
          questionId: question.id,
          message: `Expected ${EXPECTED.score.choice} points, got ${question.points}.`,
        });
      }
    }

    if (question.type === "comprehensive") {
      if (question.options.length > 0) {
        warnings.push({
          code: "comprehensive_has_options",
          questionId: question.id,
          message: "Comprehensive question unexpectedly has parsed options.",
        });
      }
      if (question.points <= 0) {
        errors.push({
          code: "invalid_comprehensive_points",
          questionId: question.id,
          message: `Expected a positive score, got ${question.points}.`,
        });
      }
    }

    if (question.hasImage && question.imageRefs.length === 0) {
      errors.push({
        code: "missing_image_reference",
        questionId: question.id,
        message: "hasImage is true but imageRefs is empty.",
      });
    }
  }
}

function validatePapers(papers, questions, errors, warnings, baseline = BASELINE) {
  if (papers.length < baseline.minimum.papers) {
    errors.push({
      code: "invalid_year_count",
      message: `Expected at least ${baseline.minimum.papers} papers, got ${papers.length}.`,
    });
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));

  for (const paper of papers) {
    if (paper.questionIds.length !== EXPECTED.questionsPerYear) {
      errors.push({
        code: "invalid_paper_question_count",
        year: paper.year,
        message: `Expected ${EXPECTED.questionsPerYear} questions, got ${paper.questionIds.length}.`,
      });
    }

    if (paper.totalScore !== EXPECTED.pointsPerYear) {
      errors.push({
        code: "invalid_paper_score",
        year: paper.year,
        message: `Expected ${EXPECTED.pointsPerYear} points, got ${paper.totalScore}.`,
      });
    }

    const numbers = new Set();
    const typeCounts = { choice: 0, comprehensive: 0 };
    const subjectCounts = new Map();
    let actualScore = 0;
    let comprehensiveScore = 0;

    for (const questionId of paper.questionIds) {
      const question = questionById.get(questionId);
      if (!question) {
        errors.push({
          code: "missing_paper_question",
          year: paper.year,
          questionId,
          message: "Paper references a question that is missing from questions.json.",
        });
        continue;
      }
      numbers.add(question.number);
      typeCounts[question.type] = (typeCounts[question.type] ?? 0) + 1;
      subjectCounts.set(
        question.subject,
        (subjectCounts.get(question.subject) ?? 0) + 1,
      );
      actualScore += question.points;
      if (question.type === "comprehensive") {
        comprehensiveScore += question.points;
      }
    }

    for (let number = 1; number <= EXPECTED.questionsPerYear; number++) {
      if (!numbers.has(number)) {
        errors.push({
          code: "missing_question_number",
          year: paper.year,
          message: `Question number ${number} is missing.`,
        });
      }
    }

    if (typeCounts.choice !== EXPECTED.choicesPerYear) {
      errors.push({
        code: "invalid_choice_count",
        year: paper.year,
        message: `Expected ${EXPECTED.choicesPerYear} choice questions, got ${typeCounts.choice}.`,
      });
    }

    if (typeCounts.comprehensive !== EXPECTED.comprehensivePerYear) {
      errors.push({
        code: "invalid_comprehensive_count",
        year: paper.year,
        message: `Expected ${EXPECTED.comprehensivePerYear} comprehensive questions, got ${typeCounts.comprehensive}.`,
      });
    }

    if (actualScore !== EXPECTED.pointsPerYear) {
      errors.push({
        code: "invalid_computed_score",
        year: paper.year,
        message: `Question points sum to ${actualScore}, expected ${EXPECTED.pointsPerYear}.`,
      });
    }

    if (comprehensiveScore !== EXPECTED.score.comprehensivePointsPerYear) {
      errors.push({
        code: "invalid_comprehensive_score",
        year: paper.year,
        message: `Comprehensive questions sum to ${comprehensiveScore}, expected ${EXPECTED.score.comprehensivePointsPerYear}.`,
      });
    }

    if (subjectCounts.size !== SUBJECTS.length) {
      warnings.push({
        code: "unexpected_subject_count",
        year: paper.year,
        message: `Expected ${SUBJECTS.length} subjects, got ${subjectCounts.size}.`,
      });
    }
  }
}

function validateKnowledge(subjects, questions, errors, warnings, baseline = BASELINE) {
  if (subjects.length < baseline.minimum.subjects) {
    errors.push({
      code: "invalid_knowledge_subject_count",
      message: `Expected at least ${baseline.minimum.subjects} knowledge subjects, got ${subjects.length}.`,
    });
  }

  const expectedKeys = new Set(Object.keys(baseline.minimum.subjectsByKey));
  const actualKeys = new Set(subjects.map((subject) => subject.key));
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) {
      errors.push({
        code: "missing_knowledge_subject",
        subjectKey: key,
        message: "Knowledge subject page is missing.",
      });
    }
  }

  const questionIds = new Set(questions.map((question) => question.id));
  const pointKeys = new Set();

  for (const subject of subjects) {
    const minimum = baseline.minimum.subjectsByKey[subject.key];
    if (!minimum) {
      warnings.push({
        code: "unknown_knowledge_subject",
        subjectKey: subject.key,
        message: "Knowledge subject is not present in the tracked baseline.",
      });
    } else {
      const pointCount = subject.chapters.reduce(
        (total, chapter) => total + chapter.points.length,
        0,
      );
      const questionLinks = subject.chapters.reduce(
        (total, chapter) =>
          total +
          chapter.points.reduce(
            (pointTotal, point) => pointTotal + point.questionIds.length,
            0,
          ),
        0,
      );
      if (subject.chapters.length < minimum.chapters) {
        errors.push({
          code: "knowledge_chapter_regression",
          subjectKey: subject.key,
          message: `Expected at least ${minimum.chapters} chapters, got ${subject.chapters.length}.`,
        });
      }
      if (pointCount < minimum.points) {
        errors.push({
          code: "knowledge_point_regression",
          subjectKey: subject.key,
          message: `Expected at least ${minimum.points} points, got ${pointCount}.`,
        });
      }
      if (questionLinks < minimum.questionLinks) {
        errors.push({
          code: "knowledge_link_regression",
          subjectKey: subject.key,
          message: `Expected at least ${minimum.questionLinks} question links, got ${questionLinks}.`,
        });
      }
    }

    if (subject.chapters.length === 0) {
      errors.push({
        code: "empty_knowledge_subject",
        subjectKey: subject.key,
        message: "Knowledge subject has no chapters.",
      });
    }

    for (const chapter of subject.chapters) {
      if (!String(chapter.title ?? "").trim()) {
        errors.push({
          code: "empty_knowledge_chapter_title",
          subjectKey: subject.key,
          chapterKey: chapter.key,
          message: "Knowledge chapter title is empty.",
        });
      }
      if (chapter.points.length === 0) {
        warnings.push({
          code: "empty_knowledge_chapter",
          subjectKey: subject.key,
          chapterKey: chapter.key,
          message: "Knowledge chapter has no points.",
        });
      }

      for (const point of chapter.points) {
        if (!String(point.title ?? "").trim()) {
          errors.push({
            code: "empty_knowledge_point_title",
            subjectKey: subject.key,
            pointKey: point.key,
            message: "Knowledge point title is empty.",
          });
        }
        if (pointKeys.has(point.key)) {
          errors.push({
            code: "duplicate_knowledge_point",
            pointKey: point.key,
            message: "Knowledge point key is duplicated.",
          });
        }
        pointKeys.add(point.key);

        if (point.questionIds.length !== point.declaredQuestionCount) {
          errors.push({
            code: "knowledge_question_count_mismatch",
            pointKey: point.key,
            message: `Declared ${point.declaredQuestionCount} links, parsed ${point.questionIds.length}.`,
          });
        }

        for (const questionId of point.questionIds) {
          if (!questionIds.has(questionId)) {
            errors.push({
              code: "unknown_knowledge_question",
              pointKey: point.key,
              questionId,
              message: "Knowledge point references an unknown question.",
            });
          }
        }
      }
    }
  }
}

function validateSamples(manifest, papers, errors, warnings) {
  const sampleEntries = (manifest.entries ?? []).filter(
    (entry) => entry.kind === "question-sample" && entry.status === 200,
  );
  const expectedSamples = Number(manifest.discovery?.questionSamples?.length ?? 0);

  if (sampleEntries.length !== expectedSamples) {
    errors.push({
      code: "question_sample_failure",
      message: `Expected ${expectedSamples} question samples, got ${sampleEntries.length}.`,
    });
  }

  for (const sample of sampleEntries) {
    const questionId = sample.url.split("/").at(-1);
    const year = Number(questionId?.slice(0, 4));
    if (!papers.some((paper) => paper.year === year)) {
      warnings.push({
        code: "orphan_question_sample",
        questionId,
        message: "Question sample does not match a parsed paper year.",
      });
    }
  }
}

async function validateImages(questions) {
  const urls = [
    ...new Set(
      questions.flatMap((question) => [
        ...question.imageRefs,
        ...question.answerImageRefs,
      ]),
    ),
  ].map((reference) => new URL(reference, ORIGIN).toString());

  const cacheFile = path.join(REPORT_DIR, "image-checks.json");
  const cache = await readJson(cacheFile).catch(() => ({ items: [] }));
  const cachedByUrl = new Map(
    (cache.items ?? []).map((item) => [item.url, item]),
  );
  let checks = 0;

  const results = await mapLimit(urls, IMAGE_CONCURRENCY, async (url) => {
    const cached = cachedByUrl.get(url);
    if (cached?.status === 200 || cached?.status === 206) return cached;

    const result = await checkImage(url);
    checks++;
    await sleep(IMAGE_GAP_MS);
    return result;
  });

  const items = results.filter(Boolean);
  await writeJson(cacheFile, {
    version: 1,
    checkedAt: new Date().toISOString(),
    items,
  });

  return {
    enabled: true,
    checked: checks,
    cached: items.length - checks,
    ok: items.filter((item) => item.status === 200 || item.status === 206).length,
    failed: items.filter((item) => item.status !== 200 && item.status !== 206),
  };
}

async function checkImage(url) {
  let status = null;
  let error = null;
  let contentType = null;

  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "user-agent":
          "learn-workbench-408-research/1.0 (personal study snapshot; no automated bypass)",
      },
    });
    status = head.status;
    contentType = head.headers.get("content-type");
  } catch (caught) {
    error = String(caught?.message ?? caught);
  }

  if (status !== 200 && status !== 206) {
    try {
      const ranged = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          range: "bytes=0-0",
          "user-agent":
            "learn-workbench-408-research/1.0 (personal study snapshot; no automated bypass)",
        },
      });
      status = ranged.status;
      contentType = ranged.headers.get("content-type");
      await ranged.body?.cancel();
    } catch (caught) {
      error = String(caught?.message ?? caught);
    }
  }

  return { url, status, contentType, error };
}

const IS_MAIN =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

export {
  validateKnowledge,
  validatePapers,
  validateQuestions,
};

if (IS_MAIN) await main();
