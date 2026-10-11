/**
 * runoob.com（菜鸟教程）内容的纯解析层。
 *
 * 站点事实（2026-10 实测）：
 *   - WordPress 站，教程页是静态 HTML；`robots.txt` 只禁 `/try/`、`/wp-admin/`、feed、`/?s=`；
 *   - 测验页 `/quiz/<slug>-quiz.html`：题目**直接内嵌**在页面 `<script>` 里的
 *     `const quizData = { title, description, questions: [...] }`（JS 对象字面量，不是 JSON，
 *     键有时带引号有时不带、字符串单双引号混用）→ 用自带的容错字面量解析器读，不做 eval。
 *   - 教程页 `<div id="content">`：正文由 `<h1..h4>` / `<p>` / `<pre>` / `<div class="example">` 组成；
 *     左侧 `<div id="leftcolumn">` 是该教程的全部子页链接（同目录 `*.html`）。
 */
import {
  attr,
  cleanText,
  decodeEntities,
  parseHtml,
  query,
  queryAll,
  textContent,
} from "./simple-dom.js";

export const RUNOOB_ORIGIN = "https://www.runoob.com";

/**
 * 抓取目录（阶段 = 一个教程；题目 = 该教程配套的测验）。
 *
 * 课程分组（3 门）：前端开发 / 编程语言 / 数据库与开发工具。
 * 只收录**有官方测验**的教程 —— 因为内容契约要求每个知识点至少配套 2 道题。
 */
export const RUNOOB_STAGES = [
  // ---- 前端开发 ----
  { id: "html", track: "rn-frontend", title: "HTML 教程", tutorial: "/html/html-tutorial.html", quizzes: ["html", "html5"], language: "html" },
  { id: "css", track: "rn-frontend", title: "CSS 教程", tutorial: "/css/css-tutorial.html", quizzes: ["css", "css3"], language: "css" },
  { id: "javascript", track: "rn-frontend", title: "JavaScript 教程", tutorial: "/js/js-tutorial.html", quizzes: ["javascript"], language: "javascript" },
  { id: "jquery", track: "rn-frontend", title: "jQuery 教程", tutorial: "/jquery/jquery-tutorial.html", quizzes: ["jquery"], language: "javascript" },
  { id: "typescript", track: "rn-frontend", title: "TypeScript 教程", tutorial: "/typescript/ts-tutorial.html", quizzes: ["ts"], language: "typescript" },
  { id: "vue3", track: "rn-frontend", title: "Vue 3 教程", tutorial: "/vue3/vue3-tutorial.html", quizzes: ["vue3"], language: "vue" },
  { id: "xml", track: "rn-frontend", title: "XML 教程", tutorial: "/xml/xml-tutorial.html", quizzes: ["xml"], language: "xml" },
  // ---- 编程语言 ----
  { id: "python", track: "rn-lang", title: "Python 3 教程", tutorial: "/python3/python3-tutorial.html", quizzes: ["python"], language: "python" },
  { id: "java", track: "rn-lang", title: "Java 教程", tutorial: "/java/java-tutorial.html", quizzes: ["java"], language: "java" },
  { id: "cpp", track: "rn-lang", title: "C++ 教程", tutorial: "/cplusplus/cpp-tutorial.html", quizzes: ["cpp"], language: "cpp" },
  { id: "csharp", track: "rn-lang", title: "C# 教程", tutorial: "/csharp/csharp-tutorial.html", quizzes: ["csharp"], language: "csharp" },
  { id: "go", track: "rn-lang", title: "Go 教程", tutorial: "/go/go-tutorial.html", quizzes: ["go"], language: "go" },
  { id: "php", track: "rn-lang", title: "PHP 教程", tutorial: "/php/php-tutorial.html", quizzes: ["php"], language: "php" },
  { id: "asp", track: "rn-lang", title: "ASP 教程", tutorial: "/asp/asp-tutorial.html", quizzes: ["asp"], language: "asp" },
  // ---- 数据库与开发工具 ----
  { id: "sql", track: "rn-cs-tools", title: "SQL 教程", tutorial: "/sql/sql-tutorial.html", quizzes: ["sql"], language: "sql" },
  { id: "numpy", track: "rn-cs-tools", title: "NumPy 教程", tutorial: "/numpy/numpy-tutorial.html", quizzes: ["numpy"], language: "python" },
  { id: "pandas", track: "rn-cs-tools", title: "Pandas 教程", tutorial: "/pandas/pandas-tutorial.html", quizzes: ["pandas"], language: "python" },
  { id: "git", track: "rn-cs-tools", title: "Git 教程", tutorial: "/git/git-tutorial.html", quizzes: ["git"], language: "bash" },
  { id: "linux", track: "rn-cs-tools", title: "Linux 教程", tutorial: "/linux/linux-tutorial.html", quizzes: ["linux"], language: "bash" },
];

export const RUNOOB_TRACKS = [
  {
    slug: "rn-frontend",
    title: "菜鸟教程 · Web 前端",
    category: "前端开发",
    level: "入门",
    accent: "#D97757",
    softAccent: "#FBEDE7",
    icon: "logo-html5",
  },
  {
    slug: "rn-lang",
    title: "菜鸟教程 · 编程语言",
    category: "编程语言",
    level: "入门",
    accent: "#3C7DD9",
    softAccent: "#E8F1FC",
    icon: "code-slash-outline",
  },
  {
    slug: "rn-cs-tools",
    title: "菜鸟教程 · 数据库与开发工具",
    category: "计算机基础",
    level: "入门",
    accent: "#2F855A",
    softAccent: "#E6F4EC",
    icon: "terminal-outline",
  },
];

/** 文档序的元素列表（`queryAll` 的分支顺序不跨兄弟节点，这里需要严格文档序）。 */
export function elementsInOrder(root) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.tag === "#text") continue;
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

// ------------------------------------------------------------------ JS 字面量解析
/**
 * 容错解析 JS 对象/数组字面量（只支持 JSON 子集 + 单引号 + 无引号键）。
 * 安全：纯词法/语法解析，不执行任何代码。
 */
export function parseJsLiteral(src, startIndex = 0) {
  let i = src.indexOf("{", startIndex);
  if (i < 0) throw new Error("找不到对象起始 '{'");
  const skipWs = () => {
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) i += 1;
      else if (ch === "/" && src[i + 1] === "/") {
        while (i < src.length && src[i] !== "\n") i += 1;
      } else if (ch === "/" && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end < 0 ? src.length : end + 2;
      } else break;
    }
  };
  const readString = (quote) => {
    i += 1; // opening quote
    let out = "";
    while (i < src.length) {
      const ch = src[i];
      if (ch === "\\") {
        const next = src[i + 1];
        if (next === "n") out += "\n";
        else if (next === "r") out += "\r";
        else if (next === "t") out += "\t";
        else if (next === "u") {
          const hex = src.slice(i + 2, i + 6);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        } else out += next;
        i += 2;
        continue;
      }
      if (ch === quote) {
        i += 1;
        break;
      }
      out += ch;
      i += 1;
    }
    return out;
  };
  const readValue = () => {
    skipWs();
    const ch = src[i];
    if (ch === "{") {
      const obj = {};
      i += 1;
      skipWs();
      if (src[i] === "}") {
        i += 1;
        return obj;
      }
      for (;;) {
        skipWs();
        let key;
        if (src[i] === "'" || src[i] === '"') key = readString(src[i]);
        else {
          const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
          if (!m) throw new Error(`对象键解析失败 @${i}`);
          key = m[0];
          i += m[0].length;
        }
        skipWs();
        if (src[i] !== ":") throw new Error(`缺少 ':' @${i}`);
        i += 1;
        obj[key] = readValue();
        skipWs();
        if (src[i] === ",") {
          i += 1;
          skipWs();
          if (src[i] === "}") {
            i += 1;
            break;
          }
          continue;
        }
        if (src[i] === "}") {
          i += 1;
          break;
        }
        throw new Error(`对象内缺少 ',' 或 '}' @${i}`);
      }
      return obj;
    }
    if (ch === "[") {
      const arr = [];
      i += 1;
      skipWs();
      if (src[i] === "]") {
        i += 1;
        return arr;
      }
      for (;;) {
        arr.push(readValue());
        skipWs();
        if (src[i] === ",") {
          i += 1;
          skipWs();
          if (src[i] === "]") {
            i += 1;
            break;
          }
          continue;
        }
        if (src[i] === "]") {
          i += 1;
          break;
        }
        throw new Error(`数组内缺少 ',' 或 ']' @${i}`);
      }
      return arr;
    }
    if (ch === "'" || ch === '"') return readString(ch);
    const rest = src.slice(i);
    const num = /^-?\d+(\.\d+)?/.exec(rest);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const word = /^(true|false|null|undefined)/.exec(rest);
    if (word) {
      i += word[0].length;
      return word[0] === "true" ? true : word[0] === "false" ? false : null;
    }
    throw new Error(`无法解析的值 @${i}: ${JSON.stringify(rest.slice(0, 40))}`);
  };
  const value = readValue();
  return { value, end: i };
}

// ------------------------------------------------------------------ 测验页
const entityDecode = (text) => decodeEntities(String(text ?? "")).replace(/\u00a0/g, " ");

/** 从 `/quiz/<slug>-quiz.html` 抽出内嵌的 quizData（题目/选项/正确下标/解析）。 */
export function extractQuizData(html) {
  const m = /\b(?:const|let|var)\s+quizData\s*=/.exec(html);
  if (!m) return null;
  let parsed;
  try {
    parsed = parseJsLiteral(html, m.index + m[0].length);
  } catch {
    return null;
  }
  const data = parsed.value;
  const title = entityDecode(data?.title ?? "").trim();
  const questions = [];
  for (const raw of Array.isArray(data?.questions) ? data.questions : []) {
    const stem = entityDecode(raw?.q ?? "").replace(/\s+/g, " ").trim();
    const options = (Array.isArray(raw?.options) ? raw.options : []).map((opt) =>
      entityDecode(opt ?? "").replace(/\s+/g, " ").trim()
    );
    const correctIndex = Number(raw?.correctIndex);
    if (!stem || options.length < 2) continue;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) continue;
    const incorrect = entityDecode(raw?.incorrectResponse ?? "").replace(/\s+/g, " ").trim();
    questions.push({
      stem,
      options,
      correctIndex,
      correctResponse: entityDecode(raw?.correctResponse ?? "").replace(/\s+/g, " ").trim(),
      incorrectResponse: incorrect,
    });
  }
  return { title, questions };
}

// ------------------------------------------------------------------ 教程页
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt",
  "figcaption", "figure", "footer", "header", "hr", "li", "main", "nav", "ol", "p",
  "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const cjkSpacing = (text) => {
  const CJK = "\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef";
  return text.replace(new RegExp(`([${CJK}]) +([${CJK}])`, "g"), "$1$2");
};

/** 归一化一段行内文本（解实体 → 合并空白 → 中文间空格收口）。 */
export function normalizeText(raw) {
  const collapsed = decodeEntities(String(raw ?? ""))
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u3000]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cjkSpacing(collapsed).trim();
}

/** 纯文本（`<br>` 转行，其余按块级换行）。 */
export function plainTextOf(node) {
  const parts = [];
  const walk = (n) => {
    if (n.tag === "#text") {
      const value = String(n.text ?? "");
      if (value.trim()) parts.push(value);
      return;
    }
    if (n.tag === "script" || n.tag === "style") return;
    if (n.tag === "br") {
      parts.push("\n");
      return;
    }
    const block = BLOCK_TAGS.has(n.tag);
    if (block) parts.push("\n");
    for (const child of n.children ?? []) walk(child);
    if (block) parts.push("\n");
  };
  walk(node);
  return normalizeText(parts.join(""));
}

/** 代码块文本：`<br>` 转行、保留行首缩进（`pre` 与 `div.example_code` 共用）。 */
export function codeTextOf(node) {
  let out = "";
  const walk = (n) => {
    if (n.tag === "#text") {
      out += String(n.text ?? "");
      return;
    }
    if (n.tag === "script" || n.tag === "style") return;
    if (n.tag === "br") {
      out += "\n";
      return;
    }
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return out
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
}

/** 站点页脚的噪声小节（笔记/评论/推荐位）——不进知识点。 */
const NOISE_HEADING_RE = /分享笔记|笔记前必须登录|发表评论|评论\s*$|^评论|^关注|^更多测验|^更多内容|^相关文章|^热门|扫码|微信|打赏|广告|版权|友情链接|^上一章|^下一章/;

/** 教程页正文：标题 + 按 `h2/h3` 分节的段落与代码。 */
export function parseTutorialPage(html) {
  const root = parseHtml(html);
  const content = query(root, "#content") ?? root;
  const title = cleanText(textContent(query(content, "h1") ?? query(root, "title")));
  const sections = [];
  const state = { current: null };

  const ensureSection = () => {
    if (!state.current) {
      state.current = { heading: "", text: "", codes: [] };
      sections.push(state.current);
    }
    return state.current;
  };

  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.tag === "#text" || child.tag === "script" || child.tag === "style") continue;
      const cls = String(attr(child, "class") ?? "");
      if (child.tag === "pre" || /example_code/.test(cls)) {
        const code = codeTextOf(child);
        if (code) ensureSection().codes.push(code);
        continue;
      }
      if (child.tag === "div" && /\bexample\b/.test(cls)) {
        const label = query(child, "h2");
        const codeNode = query(child, ".example_code") ?? query(child, "pre");
        const code = codeNode ? codeTextOf(codeNode) : "";
        const section = ensureSection();
        if (label) section.text = `${section.text}\n${cleanText(textContent(label))}`.trim();
        if (code) section.codes.push(code);
        continue;
      }
      if (/^h[1-3]$/.test(child.tag)) {
        const heading = cleanText(textContent(child));
        if (!heading || NOISE_HEADING_RE.test(heading)) {
          state.current = null;
          continue;
        }
        state.current = { heading, text: "", codes: [] };
        sections.push(state.current);
        continue;
      }
      if (["p", "ul", "ol", "table", "blockquote", "dl"].includes(child.tag)) {
        const text = plainTextOf(child);
        if (text) {
          const section = ensureSection();
          section.text = `${section.text}\n${text}`.trim();
        }
        continue;
      }
      state.current = state.current; // 容器：递归但不重置当前小节
      walk(child);
    }
  };
  walk(content);

  const cleaned = sections
    .map((section) => ({ ...section, text: normalizeText(section.text), codes: section.codes.filter(Boolean) }))
    .filter((section) => section.heading || section.text || section.codes.length > 0);
  return { title, sections: cleaned };
}

/** 教程首页左侧栏里的同目录子页链接（保持站内顺序，去重）。 */
export function tutorialPages(html, pagePath) {
  const root = parseHtml(html);
  const sidebar = query(root, "#leftcolumn");
  const dir = String(pagePath).replace(/^\/+/, "").split("/")[0];
  const dirPath = pagePath.includes("/") ? `${dir}/` : "";
  const out = [];
  const seen = new Set();
  for (const link of queryAll(sidebar ?? root, "a")) {
    const href = attr(link, "href");
    if (!href) continue;
    const clean = href.split("#")[0].split("?")[0];
    if (!/\.html?$/.test(clean)) continue;
    const full = clean.startsWith("/") ? clean.slice(1) : `${dirPath}${clean}`;
    if (!full.startsWith(dirPath)) continue;
    if (seen.has(full)) continue;
    seen.add(full);
    out.push({ path: "/" + full, title: cleanText(textContent(link)) });
  }
  return out;
}

/** 危险片段（脚本/事件/外链跟踪）——生成阶段据此拒绝入库。 */
export function findUnsafe(text) {
  const raw = String(text ?? "");
  const hits = [];
  if (/<script\b/i.test(raw)) hits.push("script");
  if (/<iframe\b/i.test(raw)) hits.push("iframe");
  if (/\son[a-z]+\s*=/i.test(raw)) hits.push("event-handler");
  if (/javascript:/i.test(raw)) hits.push("javascript-url");
  if (/data:text\/html/i.test(raw)) hits.push("data-url");
  return hits;
}
