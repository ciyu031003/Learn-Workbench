/**
 * Unified course-package / question-bank format.
 *
 * The package is the review boundary, not the publishing boundary:
 * every package is validated before it can become import items, and the
 * default target status is always `review`. A separate explicit action is
 * required before reviewed content is published.
 */
import { createHash } from "node:crypto";

export const CONTENT_PACKAGE_FORMAT_VERSION = 1;
export const CONTENT_PACKAGE_STATUSES = ["review", "approved"];
export const CONTENT_PACKAGE_DOMAINS = ["learning", "exam-408"];
export const CONTENT_PACKAGE_SOURCE_USAGES = ["import", "reference", "personal-study"];
export const CONTENT_PACKAGE_QUESTION_TYPES = ["choice", "comprehensive"];
export const CONTENT_PACKAGE_OPTION_LETTERS = ["A", "B", "C", "D"];

const UNSAFE_HTML = [
  /<script\b/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /\bon[a-z]+\s*=/i,
  /javascript:/i,
];

function text(value) {
  return String(value ?? "").trim();
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value === undefined ? null : value;
}

export function packageFingerprint(value) {
  return createHash("sha1").update(canonicalJson(value)).digest("hex");
}

export function normalizeContentPackage(input) {
  const value = input && typeof input === "object" ? input : {};
  const chapters = (Array.isArray(value.chapters) ? value.chapters : []).map((chapter) => ({
    ...chapter,
    key: text(chapter?.key),
    title: text(chapter?.title),
    subjectKey: text(chapter?.subjectKey),
    subjectTitle: text(chapter?.subjectTitle),
    points: (Array.isArray(chapter?.points) ? chapter.points : []).map((point) => ({
      ...point,
      key: text(point?.key),
      title: text(point?.title),
      summary: text(point?.summary),
      tags: uniqueStrings(point?.tags),
      sourceUrl: text(point?.sourceUrl),
    })),
  }));

  const questions = (Array.isArray(value.questions) ? value.questions : []).map((question) => ({
    ...question,
    key: text(question?.key),
    externalId: text(question?.externalId),
    type: text(question?.type).toLowerCase(),
    subjectKey: text(question?.subjectKey),
    prompt: text(question?.prompt),
    tags: uniqueStrings(question?.tags),
    knowledgePointKeys: uniqueStrings(question?.knowledgePointKeys),
    options: (Array.isArray(question?.options) ? question.options : []).map((option) => ({
      key: text(option?.key ?? option?.letter).toUpperCase(),
      text: text(option?.text),
    })),
    answer: {
      ...(question?.answer ?? {}),
      text: text(question?.answer?.text),
      choice: text(question?.answer?.choice).toUpperCase(),
    },
    sourceUrl: text(question?.sourceUrl),
  }));

  return {
    ...value,
    formatVersion: Number(value.formatVersion),
    packageKey: text(value.packageKey),
    title: text(value.title),
    domain: text(value.domain),
    status: text(value.status).toLowerCase(),
    source: {
      ...(value.source ?? {}),
      key: text(value.source?.key),
      name: text(value.source?.name),
      url: text(value.source?.url),
      license: text(value.source?.license),
      usage: text(value.source?.usage),
      ref: text(value.source?.ref),
      capturedAt: text(value.source?.capturedAt),
    },
    course: {
      ...(value.course ?? {}),
      key: text(value.course?.key),
      title: text(value.course?.title),
      category: text(value.course?.category),
    },
    chapters,
    questions,
    review: {
      ...(value.review ?? {}),
      status: text(value.review?.status || "pending").toLowerCase(),
      reviewer: text(value.review?.reviewer),
      reviewedAt: text(value.review?.reviewedAt),
      note: text(value.review?.note),
    },
  };
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function findUnsafeText(value, path, errors) {
  const content = typeof value === "string" ? value : canonicalJson(value);
  if (UNSAFE_HTML.some((pattern) => pattern.test(content))) {
    errors.push(`${path}: contains unsafe HTML or script-like content`);
  }
}

function addDuplicateErrors(items, keyOf, label, errors) {
  const seen = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const previous = seen.get(key);
    if (previous) errors.push(`${label}: duplicate key ${key}`);
    else seen.set(key, item);
  }
}

/**
 * Validate a package and return deterministic import items.
 *
 * `strict` promotes quality warnings to errors. This keeps the CLI useful for
 * local generation while giving CI/publish gates a fail-closed mode.
 */
export function validateContentPackage(input, options = {}) {
  const pkg = normalizeContentPackage(input);
  const strict = options.strict === true;
  const errors = [];
  const warnings = [];
  const pointKeys = new Set();
  const points = [];

  if (pkg.formatVersion !== CONTENT_PACKAGE_FORMAT_VERSION) {
    errors.push(`formatVersion: expected ${CONTENT_PACKAGE_FORMAT_VERSION}`);
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,120}$/.test(pkg.packageKey)) {
    errors.push("packageKey: must be a lowercase stable key (3-121 chars)");
  }
  if (!pkg.title) errors.push("title: required");
  if (!CONTENT_PACKAGE_DOMAINS.includes(pkg.domain)) {
    errors.push(`domain: expected one of ${CONTENT_PACKAGE_DOMAINS.join(", ")}`);
  }
  if (!CONTENT_PACKAGE_STATUSES.includes(pkg.status)) {
    errors.push("status: expected review or approved");
  }
  if (pkg.status !== "review") {
    errors.push("status: packages must enter the import pipeline as review");
  }

  if (!pkg.source.key) errors.push("source.key: required");
  if (!pkg.source.name) errors.push("source.name: required");
  if (!isHttpsUrl(pkg.source.url)) errors.push("source.url: must be an https URL");
  if (!pkg.source.license) errors.push("source.license: required");
  if (!CONTENT_PACKAGE_SOURCE_USAGES.includes(pkg.source.usage)) {
    errors.push(`source.usage: expected one of ${CONTENT_PACKAGE_SOURCE_USAGES.join(", ")}`);
  }
  findUnsafeText(pkg.source.license, "source.license", errors);

  if (!pkg.course.key) errors.push("course.key: required");
  if (!pkg.course.title) errors.push("course.title: required");
  if (!pkg.course.category) errors.push("course.category: required");
  if (pkg.chapters.length === 0) errors.push("chapters: at least one chapter is required");
  addDuplicateErrors(pkg.chapters, (chapter) => chapter.key, "chapters", errors);

  for (const [chapterIndex, chapter] of pkg.chapters.entries()) {
    const chapterPath = `chapters[${chapterIndex}]`;
    if (!chapter.key) errors.push(`${chapterPath}.key: required`);
    if (!chapter.title) errors.push(`${chapterPath}.title: required`);
    if (!chapter.subjectKey) warnings.push(`${chapterPath}.subjectKey: empty`);
    if (!chapter.subjectTitle) warnings.push(`${chapterPath}.subjectTitle: empty`);
    if (chapter.points.length === 0) errors.push(`${chapterPath}.points: at least one point is required`);

    addDuplicateErrors(chapter.points, (point) => point.key, `${chapterPath}.points`, errors);
    for (const [pointIndex, point] of chapter.points.entries()) {
      const pointPath = `${chapterPath}.points[${pointIndex}]`;
      if (!point.key) errors.push(`${pointPath}.key: required`);
      if (!point.title) errors.push(`${pointPath}.title: required`);
      if (!point.summary) warnings.push(`${pointPath}.summary: empty`);
      if (point.sourceUrl && !isHttpsUrl(point.sourceUrl)) {
        errors.push(`${pointPath}.sourceUrl: must be an https URL`);
      }
      findUnsafeText(point.title, `${pointPath}.title`, errors);
      findUnsafeText(point.summary, `${pointPath}.summary`, errors);
      pointKeys.add(point.key);
      points.push({ ...point, chapterKey: chapter.key, subjectKey: chapter.subjectKey });
    }
  }

  if (pkg.questions.length === 0) errors.push("questions: at least one question is required");
  addDuplicateErrors(pkg.questions, (question) => question.key, "questions", errors);

  const linkedQuestionCount = new Map();
  for (const [questionIndex, question] of pkg.questions.entries()) {
    const questionPath = `questions[${questionIndex}]`;
    if (!question.key) errors.push(`${questionPath}.key: required`);
    if (!question.externalId) warnings.push(`${questionPath}.externalId: empty`);
    if (!CONTENT_PACKAGE_QUESTION_TYPES.includes(question.type)) {
      errors.push(`${questionPath}.type: expected choice or comprehensive`);
    }
    if (!question.subjectKey) warnings.push(`${questionPath}.subjectKey: empty`);
    if (!question.prompt) errors.push(`${questionPath}.prompt: required`);
    if (question.sourceUrl && !isHttpsUrl(question.sourceUrl)) {
      errors.push(`${questionPath}.sourceUrl: must be an https URL`);
    }
    if (question.knowledgePointKeys.length === 0) {
      errors.push(`${questionPath}.knowledgePointKeys: at least one link is required`);
    }
    for (const pointKey of question.knowledgePointKeys) {
      if (!pointKeys.has(pointKey)) {
        errors.push(`${questionPath}.knowledgePointKeys: unknown point ${pointKey}`);
      } else {
        linkedQuestionCount.set(pointKey, (linkedQuestionCount.get(pointKey) ?? 0) + 1);
      }
    }

    findUnsafeText(question.prompt, `${questionPath}.prompt`, errors);
    findUnsafeText(question.answer.text, `${questionPath}.answer.text`, errors);
    findUnsafeText(question.options, `${questionPath}.options`, errors);

    if (question.type === "choice") {
      if (question.options.length !== 4) {
        errors.push(`${questionPath}.options: choice questions require exactly four options`);
      }
      const optionKeys = question.options.map((option) => option.key);
      if (new Set(optionKeys).size !== optionKeys.length) {
        errors.push(`${questionPath}.options: option keys must be unique`);
      }
      for (const option of question.options) {
        if (!CONTENT_PACKAGE_OPTION_LETTERS.includes(option.key)) {
          errors.push(`${questionPath}.options: invalid option key ${option.key || "(empty)"}`);
        }
        if (!option.text) errors.push(`${questionPath}.options: option text is required`);
      }
      if (!CONTENT_PACKAGE_OPTION_LETTERS.includes(question.answer.choice)) {
        errors.push(`${questionPath}.answer.choice: required for choice questions`);
      }
    }
    if (!question.answer.text) errors.push(`${questionPath}.answer.text: required`);
  }

  for (const point of points) {
    if (!linkedQuestionCount.has(point.key)) {
      warnings.push(`point ${point.key}: has no linked question`);
    }
  }

  if (strict) {
    for (const warning of warnings) errors.push(`strict: ${warning}`);
  }

  const stats = {
    chapters: pkg.chapters.length,
    points: points.length,
    questions: pkg.questions.length,
    links: pkg.questions.reduce((total, question) => total + question.knowledgePointKeys.length, 0),
    subjects: new Set(pkg.chapters.map((chapter) => chapter.subjectKey).filter(Boolean)).size,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats,
    package: pkg,
    importItems: errors.length === 0 ? buildPackageImportItems(pkg) : [],
    fingerprint: packageFingerprint(pkg),
    publishable: pkg.status === "approved" && pkg.review.status === "approved",
  };
}

export function buildPackageImportItems(input) {
  const pkg = normalizeContentPackage(input);
  const items = [];
  // exam-408 materialization belongs to the dedicated exam_408_* importer.
  // Marking these as unmapped keeps a generic learning-import run from
  // accidentally creating a parallel knowledge_points copy.
  const auditOnly = pkg.domain === "exam-408";

  for (const chapter of pkg.chapters) {
    for (const point of chapter.points) {
      items.push({
        kind: "knowledge-point",
        externalKey: `point:${point.key}`,
        targetKey: point.key,
        title: point.title,
        path: `${pkg.packageKey}/${chapter.key}/${point.key}`,
        unmapped: auditOnly,
        payload: {
          packageKey: pkg.packageKey,
          packageFingerprint: packageFingerprint(pkg),
          domain: pkg.domain,
          courseKey: pkg.course.key,
          courseTitle: pkg.course.title,
          chapterKey: chapter.key,
          chapterTitle: chapter.title,
          subjectKey: chapter.subjectKey,
          subjectTitle: chapter.subjectTitle,
          pointKey: point.key,
          title: point.title,
          summary: point.summary,
          tags: point.tags,
          sourceUrl: point.sourceUrl,
          status: "review",
        },
      });
    }
  }

  for (const question of pkg.questions) {
    items.push({
      kind: "question",
      externalKey: `question:${question.key}`,
      targetKey: question.key,
      title: question.externalId || question.key,
      path: `${pkg.packageKey}/questions/${question.key}`,
      unmapped: auditOnly,
      hasAnswer: true,
      payload: {
        packageKey: pkg.packageKey,
        packageFingerprint: packageFingerprint(pkg),
        domain: pkg.domain,
        courseKey: pkg.course.key,
        questionKey: question.key,
        externalId: question.externalId,
        type: question.type,
        subjectKey: question.subjectKey,
        year: question.year ?? null,
        number: question.number ?? null,
        pointsPossible: question.pointsPossible ?? null,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        knowledgePointKeys: question.knowledgePointKeys,
        tags: question.tags,
        sourceUrl: question.sourceUrl,
        status: "review",
      },
    });
  }

  return items;
}
