/**
 * csgraduates（计算机考研杂货铺）408 内容的纯解析层。
 *
 * 为什么单独一层：抓取脚本（`scripts/cs-graduates/crawl.mjs`）与生成脚本
 * （`scripts/cs-graduates/generate.mjs`）都需要"HTML → 结构化数据"这一步，
 * 而这一步是最容易出错、也最值得被单测钉住的部分（见 `csgraduates.test.mjs`）。
 *
 * 站点结构（Hugo + Docsy，2026-10 实测）：
 *   - 408 真题页 `/study_methods/408quiz/<year>/`
 *       选择题：`<h4 id=学科>学科</h4>` → `<h5 id=序号>序号</h5>` → `<p>题干</p>`
 *              → `<div class="choice-container" data-answer=D data-tags=…>`
 *                → `<div class="explanation" id=explanation-…>正确答案：<span class=correct-answer-text>D</span> + 解析`
 *       解答题：`<div class="answer-container" data-tags=…>` → `<div class="solution-detail">…解答…</div>`
 *   - 知识点页 `/{data_structure|constitution_principle|operating_system|computer_network}/<章>/<页>/`
 *
 * 站点是**静态 HTML**，没有 API；因此解析只依赖 DOM 结构，不做任何猜测性文本裁剪。
 */
import { attr, cleanText, decodeEntities, parseHtml, query, queryAll, textContent } from "./simple-dom.js";

/** 出现即换行的块级标签（`richText` 用） */
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "details", "div", "dl", "dt",
  "figure", "figcaption", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
  "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "ul",
]);

/** 408 四门课 → 站内目录 slug */
export const SUBJECTS = [
  { key: "ds", slug: "data_structure", label: "数据结构", headings: ["数据结构"] },
  { key: "co", slug: "constitution_principle", label: "计算机组成原理", headings: ["组成原理", "计算机组成原理"] },
  { key: "os", slug: "operating_system", label: "操作系统", headings: ["操作系统"] },
  { key: "net", slug: "computer_network", label: "计算机网络", headings: ["计算机网络"] },
];

const SUBJECT_BY_SLUG = new Map(SUBJECTS.map((s) => [s.slug, s]));

/** 站内学科小标题（含 Hugo 去重后缀 `-1`）→ 四门课之一的 key */
export function subjectKeyFromHeading(heading) {
  const name = String(heading ?? "").replace(/-\d+$/, "").trim();
  const hit = SUBJECTS.find((s) => s.headings.includes(name) || s.label === name);
  return hit?.key ?? null;
}

export function subjectOfPath(pathname) {
  const first = String(pathname ?? "").replace(/^\/+/, "").split("/")[0];
  return SUBJECT_BY_SLUG.get(first) ?? null;
}

/** `<pre><code class=language-c>` 里 Prism 的行包装：每行是一个 `span[style*=display:flex]` */
function codeTextOf(pre) {
  const code = query(pre, "code") ?? pre;
  const lines = [];
  for (const child of code.children) {
    if (child.tag !== "span") continue;
    if (!/display\s*:\s*flex/.test(attr(child, "style"))) continue;
    // 代码行**不能**用 cleanText：它会把缩进压成 1 个空格，C 代码就没法看了。
    lines.push(
      textContent(child)
        .replace(/\r/g, "")
        .replace(/\t/g, "    ")
        .replace(/\u3000/g, " ")
        .replace(/\n+$/, "")
        .replace(/[ ]+$/, "")
    );
  }
  if (lines.length > 0) return lines.join("\n").replace(/^\n+|\n+$/g, "");
  return normalizeText(textContent(code));
}

/** 带换行的可见文本（`textContent` 会把 `<p>`/`<pre>` 粘成一行，这里不行） */
export function richText(el) {
  if (!el) return "";
  if (el.tag === "#text") return el.text ?? "";
  if (el.tag === "br") return "\n";
  if (el.tag === "pre") return "\n" + codeTextOf(el) + "\n";
  const inner = el.children.map(richText).join("");
  return BLOCK_TAGS.has(el.tag) ? "\n" + inner + "\n" : inner;
}

/**
 * 中文排版收口：站点在行内 `<strong>/<code>` 前后常留空格（`非空单链表 L 的头指针`），
 * 中文与中文之间的这类空格去掉更接近正常阅读；**中日韩与拉丁字母之间保留**（`O(n) 的` 不能粘死）。
 */
function tidyCjkSpacing(text) {
  const CJK = "\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef";
  return text
    .replace(new RegExp(`([${CJK}]) +([${CJK}])`, "g"), "$1$2")
    .replace(new RegExp(`([${CJK}]) +([${CJK}])`, "g"), "$1$2");
}

/** 归一化：解实体 → 合并空白 → 压掉多余空行 → 中文空格收口 */
export function normalizeText(raw) {
  const collapsed = decodeEntities(String(raw ?? ""))
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u3000]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return tidyCjkSpacing(collapsed).trim();
}

export function plainText(el) {
  return normalizeText(richText(el));
}

/** 文档序的元素列表（`queryAll` 的分支顺序不跨兄弟节点，这里需要严格文档序） */
export function elementsInOrder(root) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tag === "#text") continue;
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

export function classList(el) {
  return String(attr(el, "class") ?? "").split(/\s+/).filter(Boolean);
}

export function hasClass(el, name) {
  return classList(el).includes(name);
}

/** 同父节点下、紧随其后的第一个带该类名的兄弟（站点把解答与题块并列放在同级） */
function followingSiblingWithClass(el, name) {
  const parent = el.parent;
  if (!parent) return null;
  const index = parent.children.indexOf(el);
  for (let i = index + 1; i < parent.children.length; i++) {
    const sib = parent.children[i];
    if (sib.tag === "#text") continue;
    if (hasClass(sib, name)) return sib;
    if (/^h[1-6]$/.test(sib.tag)) return null;
  }
  return null;
}

/** 同一父节点下、位于 `el` 之前、直到「上一个小标题/上一个题块」为止的兄弟文本 */
function precedingStemText(el) {
  const parent = el.parent;
  if (!parent) return "";
  const index = parent.children.indexOf(el);
  const parts = [];
  for (let i = index - 1; i >= 0; i--) {
    const sib = parent.children[i];
    if (sib.tag === "#text") continue;
    if (/^h[1-6]$/.test(sib.tag)) break;
    if (hasClass(sib, "choice-container") || hasClass(sib, "answer-container")) break;
    parts.unshift(plainText(sib));
  }
  return normalizeText(parts.join("\n"));
}

export function parseSitemapUrls(xml) {
  return [...String(xml ?? "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * 把 sitemap 的 URL 清单分成「要抓什么」。
 * 只认 408 相关：四门课的知识点页 + `/study_methods/408quiz/<年>/` 真题页。
 * 数学 / 英语 / 政治 / 经验贴一律不进（用户口径：只取 408）。
 */
export function planTargets(urls, origin = "http://www.csgraduates.com") {
  const quiz = [];
  const knowledge = [];
  const chapters = [];
  const seen = new Set();
  for (const raw of urls) {
    let pathname;
    try {
      pathname = new URL(raw).pathname;
    } catch {
      continue;
    }
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    const quizYear = pathname.match(/^\/study_methods\/408quiz\/(\d{4})\/$/);
    if (quizYear) {
      quiz.push({ year: Number(quizYear[1]), url: origin + pathname });
      continue;
    }
    const subject = subjectOfPath(pathname);
    if (!subject) continue;
    const segs = pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (segs.length === 1) continue; // 学科首页，没有知识点正文
    if (segs.length === 2) chapters.push({ subject: subject.key, slug: subject.slug, chapter: segs[1], url: origin + pathname });
    else if (segs.length === 3) {
      knowledge.push({
        subject: subject.key,
        slug: subject.slug,
        chapter: segs[1],
        page: segs[2],
        path: pathname,
        url: origin + pathname,
      });
    }
  }
  quiz.sort((a, b) => a.year - b.year);
  knowledge.sort((a, b) => a.path.localeCompare(b.path));
  chapters.sort((a, b) => a.url.localeCompare(b.url));
  return { quiz, knowledge, chapters };
}

/** 「答案速对」表格（`<details>` 里的 No./Ans 两列对）：用来交叉校验每题的 data-answer */
export function parseAnswerTable(root) {
  const table = query(root, "details table") ?? query(root, "table");
  if (!table) return [];
  const rows = queryAll(table, "tr");
  const out = [];
  for (const tr of rows) {
    const cells = queryAll(tr, "td").map((td) => cleanText(textContent(td)));
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const no = Number(cells[i]);
      const ans = (cells[i + 1] ?? "").toUpperCase();
      if (Number.isInteger(no) && /^[A-D]$/.test(ans)) out.push({ no, answer: ans });
    }
  }
  return out.sort((a, b) => a.no - b.no);
}

const CODE_LANG = new Set(["bash", "c", "cpp", "c++", "css", "go", "html", "java", "javascript", "json", "python", "sql", "text", "typescript", "xml", "yaml"]);

function langOf(pre) {
  const code = query(pre, "code") ?? pre;
  const cls = classList(code).find((c) => c.startsWith("language-"));
  const lang = cls ? cls.slice("language-".length).toLowerCase() : "";
  // 归一化到内容包白名单里的写法：C/C++ 统一记 c，各种 shell 统一记 bash。
  const normalized = lang === "cpp" || lang === "c++" ? "c" : lang === "sh" || lang === "shell" || lang === "zsh" ? "bash" : lang;
  return CODE_LANG.has(normalized) ? normalized : lang ? normalized : "text";
}

function optionKeyOf(label) {
  const span = query(label, "span.choice-label");
  const text = cleanText(textContent(span));
  const hit = text.match(/^([A-D])/);
  if (hit) return hit[1];
  const input = query(label, "input");
  return String(attr(input, "value") ?? "").toUpperCase();
}

function optionTextOf(label) {
  const span = query(label, "span.choice-text");
  return plainText(span ?? label);
}

/**
 * 解析一页 408 真题。返回选择题（含答案与解析）、解答题（含参考解答）与答案速对表。
 * 学科按「文档序中最近的那个 h4」归属 —— 站点用 h4 分节，且每节的题目连续排列。
 */
export function parseQuizPage(html, url = "") {
  const root = parseHtml(html);
  const main = query(root, "#content-panel") ?? root;
  const ordered = elementsInOrder(main);

  const questions = [];
  const solutions = [];
  let subject = null;
  let number = null;

  for (const el of ordered) {
    if (el.tag === "h4") {
      subject = subjectKeyFromHeading(cleanText(textContent(el)));
      continue;
    }
    if (el.tag === "h5") {
      const parsed = Number(cleanText(textContent(el)));
      if (Number.isInteger(parsed)) number = parsed;
      continue;
    }
    if (hasClass(el, "choice-container")) {
      const labels = queryAll(el, "form label.choice-option");
      const options = [];
      for (const label of labels) {
        const key = optionKeyOf(label);
        const text = optionTextOf(label);
        if (key && text) options.push({ key, text });
      }
      const explanationEl = queryAll(el, "div.explanation").find((d) => !hasClass(d, "correct-answer-text"));
      const explanation = explanationEl ? plainText(explanationEl) : "";
      const correctText = query(el, "span.correct-answer-text");
      const answer = String(attr(el, "data-answer") ?? "").toUpperCase() || cleanText(textContent(correctText)).toUpperCase();
      const kpLinks = queryAll(el, "a.quiz-tag-kp-link")
        .map((a) => attr(a, "href"))
        .map((href) => {
          const m = String(href).match(/^(\/[a-z_]+\/[a-z_]+\/[a-z_]+\/)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      questions.push({
        url,
        number,
        subject,
        stem: precedingStemText(el),
        options,
        answer,
        multiple: attr(el, "data-multiple") === "true",
        tags: String(attr(el, "data-tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        knowledgePaths: [...new Set(kpLinks)],
        explanation,
        hasCode: queryAll(el, "pre").length > 0,
      });
      continue;
    }
    if (hasClass(el, "answer-container")) {
      // 解答块与题块**并列**（同级兄弟），不是子节点
      const detail = queryAll(el, "div.solution-detail")[0] ?? followingSiblingWithClass(el, "solution-detail");
      const kpLinks = queryAll(el, "a.quiz-tag-kp-link")
        .map((a) => attr(a, "href"))
        .map((href) => {
          const m = String(href).match(/^(\/[a-z_]+\/[a-z_]+\/[a-z_]+\/)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      solutions.push({
        url,
        number,
        subject,
        stem: precedingStemText(el),
        tags: String(attr(el, "data-tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        knowledgePaths: [...new Set(kpLinks)],
        solution: detail ? plainText(detail) : "",
        code: detail
          ? queryAll(detail, "pre")
              .map((pre) => ({ language: langOf(pre), code: codeTextOf(pre) }))
              .filter((c) => c.code.trim().length > 0)
          : [],
      });
    }
  }

  const year = Number(String(url).match(/(\d{4})\/?$/)?.[1] ?? 0) || null;
  const title = cleanText(textContent(query(main, "h1")));
  return { url, year, title, questions, solutions, answerTable: parseAnswerTable(main) };
}

/**
 * 解析一页 408 知识点。
 * 抽出：标题 / 优先级角标 / 小节（标题 + 段落 + 列表 + 代码）。不做摘要裁剪 —— 摘要由生成层决定。
 */
export function parseKnowledgePage(html, url = "") {
  const root = parseHtml(html);
  const main = query(root, "#content-panel") ?? root;
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const subject = subjectOfPath(pathname);
  const segs = pathname.replace(/^\/+|\/+$/g, "").split("/");

  const title = cleanText(textContent(query(main, "h1")));
  const bodyText = plainText(main);
  const priority =
    /高优先级/.test(bodyText) ? "high" : /中优先级/.test(bodyText) ? "medium" : /低优先级/.test(bodyText) ? "low" : null;

  // 站点把「重要程度」写在正文开头的角标里（🔥 高优先级）
  const priorityNote = (bodyText.match(/([^\n]{0,80}?(?:高优先级|中优先级|低优先级)[^\n]{0,200})/) ?? [])[1] ?? "";

  const sections = [];
  let current = null;
  const push = () => {
    if (current && (current.paragraphs.length || current.lists.length || current.codes.length)) sections.push(current);
  };
  const ordered = elementsInOrder(main);
  for (const el of ordered) {
    if (/^h[1-4]$/.test(el.tag)) {
      const text = cleanText(textContent(el));
      if (!text || text === title) continue;
      push();
      current = { heading: text, level: Number(el.tag.slice(1)), paragraphs: [], lists: [], codes: [] };
      continue;
    }
    if (!current) continue;
    if (el.tag === "pre") {
      const code = codeTextOf(el);
      if (code.trim()) current.codes.push({ language: langOf(el), code });
      continue;
    }
    if (el.tag === "p") {
      // 跳过造型用的图片说明与导航文本
      const text = plainText(el);
      if (text && !/^(自动选项验证|回到顶部|固定导航栏|刷新选项|批量检查已选|答题板|反馈|题目收藏|我的课程)$/.test(text)) {
        current.paragraphs.push(text);
      }
      continue;
    }
    if (el.tag === "ul" || el.tag === "ol") {
      const items = queryAll(el, "li").map((li) => plainText(li)).filter(Boolean);
      if (items.length) current.lists.push({ ordered: el.tag === "ol", items });
    }
  }
  push();

  return {
    url,
    path: pathname,
    subject: subject?.key ?? null,
    chapter: segs[1] ?? null,
    page: segs[2] ?? null,
    title,
    priority,
    priorityNote,
    sections,
  };
}

/** 生成前的内容体检（危险片段 / 空白），有问题直接在生成阶段拦下 */
export function findUnsafe(text) {
  const dangerous = /<\s*(script|iframe|object|embed|style|link|meta)\b|on(error|load|click)\s*=|\bjavascript:/i;
  return dangerous.test(String(text ?? ""));
}
