import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
export const DEFAULT_OUT_DIR = path.join(REPO_ROOT, ".local", "beokayy-408");
export const ORIGIN = "https://zhenti.beokayy.club";

export const SUBJECTS = [
  { key: "data-structure", short: "DS", label: "数据结构" },
  { key: "computer-organization", short: "CO", label: "计算机组成原理" },
  { key: "operating-system", short: "OS", label: "操作系统" },
  { key: "computer-network", short: "CN", label: "计算机网络" },
];

export const EXPECTED = {
  years: 18,
  questionsPerYear: 47,
  choicesPerYear: 40,
  comprehensivePerYear: 7,
  pointsPerYear: 150,
  score: {
    choice: 2,
    comprehensivePointsPerYear: 70,
  },
};

export function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;

    const equals = arg.indexOf("=");
    if (equals > 2) {
      out[arg.slice(2, equals)] = arg.slice(equals + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      index++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function resolveOutDir(args) {
  const value = String(args.out ?? DEFAULT_OUT_DIR);
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

export function asPositiveInt(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(maximum, Math.floor(number));
}

export function asBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function mapLimit(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(Math.max(1, limit), list.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= list.length) return;
        results[index] = await worker(list[index], index);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

export function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
}

export function stripTags(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseQuestionBody(body) {
  const normalized = String(body ?? "").replaceAll("\r\n", "\n");
  const imageGrid = parseImageGridOptions(normalized);
  if (imageGrid) return imageGrid;
  return parseLineOptions(normalized);
}

function parseImageGridOptions(body) {
  const match = body.match(/:::image-grid\s*\n([\s\S]*?)\n:::/);
  if (!match || match.index === undefined) return null;

  const images = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^!\[[^\]]*\]\([^)]+\)$/.test(line));

  if (images.length !== 4) return null;

  const stem = `${body.slice(0, match.index)}\n${body.slice(match.index + match[0].length)}`.trim();
  return {
    stem,
    options: images.map((text, index) => ({
      letter: String.fromCharCode(65 + index),
      text,
    })),
    optionSource: "image-grid",
  };
}

function parseLineOptions(body) {
  const lines = body.split("\n");
  const matches = [];

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].trim().match(/^([A-D])[.．、)]\s*(.*)$/);
    if (!match) continue;
    matches.push({
      index,
      letter: match[1],
      firstLine: match[2],
    });
  }

  const selected = [];
  for (const match of matches) {
    const expected = String.fromCharCode(65 + selected.length);
    if (selected.length === 0 && match.letter !== "A") continue;
    if (match.letter !== expected) continue;
    selected.push(match);
    if (match.letter === "D") break;
  }

  if (selected.length !== 4) {
    return {
      stem: body.trim(),
      options: [],
      optionSource: null,
    };
  }

  const options = selected.map((entry, index) => {
    const next = selected[index + 1];
    const end = next?.index ?? lines.length;
    const text = [entry.firstLine, ...lines.slice(entry.index + 1, end)]
      .join("\n")
      .trim();
    return { letter: entry.letter, text };
  });

  return {
    stem: lines.slice(0, selected[0].index).join("\n").trim(),
    options,
    optionSource: "lines",
  };
}

export function extractAnswerLetter(answer) {
  const text = String(answer ?? "");
  const patterns = [
    /(?:答案|正确答案)\s*[:：]?\s*([A-D])(?![A-Za-z])/i,
    /(?:选|应选|故选)\s*([A-D])(?![A-Za-z])/i,
    /(?:^|\s)([A-D])(?=$|\s|[。；;，,])/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

export function sourceUrl(pathname) {
  return new URL(pathname, ORIGIN).toString();
}

export function extensionForContentType(contentType) {
  const type = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type.includes("html")) return ".html";
  if (type.includes("javascript") || type.includes("ecmascript")) return ".js";
  if (type.includes("json")) return ".json";
  if (type.includes("svg")) return ".svg";
  if (type.includes("png")) return ".png";
  if (type.includes("jpeg")) return ".jpg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("text")) return ".txt";
  return ".bin";
}
