import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractAnswerLetter,
  parseQuestionBody,
} from "../beokayy-408/common.mjs";
import { validateKnowledge } from "../beokayy-408/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE = JSON.parse(
  readFileSync(path.join(ROOT, "scripts", "beokayy-408", "baseline.json"), "utf8"),
);

test("beokayy-408 baseline covers all four 408 subjects", () => {
  assert.equal(BASELINE.minimum.subjects, 4);
  assert.deepEqual(
    Object.keys(BASELINE.minimum.subjectsByKey).sort(),
    [
      "computer-network",
      "computer-organization",
      "data-structure",
      "operating-system",
    ],
  );
  for (const minimum of Object.values(BASELINE.minimum.subjectsByKey)) {
    assert.ok(minimum.chapters > 0);
    assert.ok(minimum.points > 0);
    assert.ok(minimum.questionLinks > 0);
  }
});

test("parseQuestionBody parses four line options and keeps the stem", () => {
  const parsed = parseQuestionBody(
    ["Which option is correct?", "A. alpha", "B. beta", "C. gamma", "D. delta"].join(
      "\n",
    ),
  );
  assert.equal(parsed.optionSource, "lines");
  assert.equal(parsed.stem, "Which option is correct?");
  assert.deepEqual(
    parsed.options.map((option) => option.letter),
    ["A", "B", "C", "D"],
  );
  assert.equal(parsed.options[2].text, "gamma");
});

test("parseQuestionBody parses the four-image option grid", () => {
  const parsed = parseQuestionBody(
    [
      "Choose the matching diagram.",
      ":::image-grid",
      "![A](a.png)",
      "![B](b.png)",
      "![C](c.png)",
      "![D](d.png)",
      ":::",
    ].join("\n"),
  );
  assert.equal(parsed.optionSource, "image-grid");
  assert.equal(parsed.options.length, 4);
  assert.equal(parsed.stem, "Choose the matching diagram.");
});

test("extractAnswerLetter only accepts a standalone A-D answer", () => {
  assert.equal(extractAnswerLetter("Answer: C"), "C");
  assert.equal(extractAnswerLetter("答案：D"), "D");
  assert.equal(extractAnswerLetter("Option AB"), null);
  assert.equal(extractAnswerLetter("No answer"), null);
});

test("validateKnowledge detects chapter, point and link regressions", () => {
  const errors = [];
  const warnings = [];
  const baseline = {
    minimum: {
      subjects: 1,
      subjectsByKey: {
        "data-structure": {
          chapters: 2,
          points: 2,
          questionLinks: 2,
        },
      },
    },
  };

  validateKnowledge(
    [
      {
        key: "data-structure",
        chapters: [
          {
            key: "ds-01",
            title: "Chapter",
            points: [
              {
                key: "ds-01-01",
                title: "Point",
                declaredQuestionCount: 1,
                questionIds: ["2009-01"],
              },
            ],
          },
        ],
      },
    ],
    [{ id: "2009-01" }],
    errors,
    warnings,
    baseline,
  );

  assert.deepEqual(
    errors.map((error) => error.code).sort(),
    [
      "knowledge_chapter_regression",
      "knowledge_link_regression",
      "knowledge_point_regression",
    ],
  );
  assert.equal(warnings.length, 0);
});
