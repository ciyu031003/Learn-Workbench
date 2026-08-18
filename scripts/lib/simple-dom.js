// ============================================================================
// simple-dom —— 极简 HTML 解析 + 选择器（无第三方依赖）
// 面向政府/公告静态页：支持 tag / .class / #id / [attr] / 后代 / 子选择器
// 仅供招花 http 轻引擎使用；复杂页面请走 browser 引擎。
// ============================================================================

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"]);

export function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&");
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    attrs[m[1].toLowerCase()] = decodeEntities(v);
  }
  const bare = /([\w:-]+)(?=\s|$)/g;
  while ((m = bare.exec(raw)) !== null) {
    const k = m[1].toLowerCase();
    if (!(k in attrs)) attrs[k] = "";
  }
  return attrs;
}

/** 解析 HTML 返回元素树根数组（每个元素：{tag, attrs, children, text, parent}） */
export function parseHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [], parent: null, text: "" };
  const stack = [root];
  const src = String(html || "");
  let i = 0;
  const n = src.length;
  let textBuf = "";

  const flushText = () => {
    if (textBuf.trim() !== "") {
      const parent = stack[stack.length - 1];
      parent.children.push({ tag: "#text", attrs: {}, children: [], parent, text: decodeEntities(textBuf) });
    }
    textBuf = "";
  };

  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      textBuf += src.slice(i);
      break;
    }
    textBuf += src.slice(i, lt);
    // 注释 / DOCTYPE / CDATA
    if (src.startsWith("<!--", lt)) {
      flushText();
      const end = src.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src.startsWith("<!", lt)) {
      flushText();
      const end = src.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    // 闭合标签
    if (src.startsWith("</", lt)) {
      flushText();
      const end = src.indexOf(">", lt);
      const tagName = src.slice(lt + 2, end === -1 ? lt + 4 : end).trim().toLowerCase();
      if (tagName) {
        // 弹出到匹配标签
        for (let k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag === tagName) {
            stack.length = k;
            break;
          }
        }
      }
      i = end === -1 ? n : end + 1;
      continue;
    }
    // 开始标签
    const gt = findTagEnd(src, lt);
    const rawTag = src.slice(lt + 1, gt === -1 ? n : gt);
    i = gt === -1 ? n : gt + 1;
    flushText();
    const m = rawTag.match(/^([\w:-]+)/);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(rawTag.slice(m[0].length));
    const selfClose = /\/\s*$/.test(rawTag.trim()) || VOID_TAGS.has(tag);
    const parent = stack[stack.length - 1];
    const el = { tag, attrs, children: [], parent, text: "" };
    parent.children.push(el);
    if (!selfClose) stack.push(el);
  }
  flushText();
  return root;
}

function findTagEnd(s, lt) {
  let quote = null;
  for (let k = lt + 1; k < s.length; k++) {
    const ch = s[k];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return k;
    }
  }
  return -1;
}

/** 选择器解析：支持 tag / .class / #id / [attr] / [attr=val] / 空格后代 / > 子 */
function parseSelector(sel) {
  const parts = sel.trim().split(/\s+/);
  const groups = [];
  let cur = [];
  for (const p of parts) {
    if (p === ">") {
      cur.push({ combinator: "child" });
      continue;
    }
    if (cur.length === 0) cur.push({ combinator: "descendant" });
    const comp = { combinator: cur.length > 1 ? cur[cur.length - 1].combinator : "descendant", tag: null, classNames: [], id: null, attrs: [] };
    const re = /([.#]?)([\w:-]+)|\[([\w:-]+)(?:=(["']?)([^\]]*?)\4)?\]/g;
    let m;
    while ((m = re.exec(p)) !== null) {
      if (m[1] === ".") comp.classNames.push(m[2]);
      else if (m[1] === "#") comp.id = m[2];
      else if (m[1] === "") comp.tag = m[2].toLowerCase();
      else if (m[3]) comp.attrs.push({ name: m[3].toLowerCase(), value: m[5] ?? null });
    }
    cur.push(comp);
  }
  // cur = [first, {combinator}, comp, ...] 展平
  const seq = [];
  let prevCombinator = "descendant";
  for (let k = 1; k < cur.length; k++) {
    if (cur[k].combinator === "child") {
      prevCombinator = "child";
      continue;
    }
    seq.push({ ...cur[k], combinator: prevCombinator });
    prevCombinator = "descendant";
  }
  return seq;
}

function matches(el, comp) {
  if (!el || el.tag === "#text" || el.tag === "#root") return false;
  if (comp.tag && el.tag !== comp.tag) return false;
  if (comp.id && el.attrs.id !== comp.id) return false;
  for (const c of comp.classNames) {
    const cls = (el.attrs.class || "").split(/\s+/);
    if (!cls.includes(c)) return false;
  }
  for (const a of comp.attrs) {
    const v = el.attrs[a.name];
    if (v === undefined) return false;
    if (a.value !== null && v !== a.value) return false;
  }
  return true;
}

function descendants(el, out) {
  for (const c of el.children) {
    if (c.tag === "#text") continue;
    out.push(c);
    descendants(c, out);
  }
}

/** 匹配一个选择器序列（最后一段）在 el 下的元素 */
function matchSeq(el, seq, idx, out) {
  const comp = seq[idx];
  if (comp.combinator === "descendant") {
    const all = [];
    descendants(el, all);
    for (const d of all) {
      if (matches(d, comp)) {
        if (idx === seq.length - 1) out.push(d);
        else matchSeq(d, seq, idx + 1, out);
      }
    }
  } else {
    for (const c of el.children) {
      if (c.tag === "#text") continue;
      if (matches(c, comp)) {
        if (idx === seq.length - 1) out.push(c);
        else matchSeq(c, seq, idx + 1, out);
      }
    }
  }
}

/** queryAll(root, selector) -> 元素数组 */
export function queryAll(root, selector) {
  const seq = parseSelector(selector);
  if (seq.length === 0) return [];
  const out = [];
  matchSeq(root, seq, 0, out);
  return out;
}

export function query(root, selector) {
  return queryAll(root, selector)[0] || null;
}

/** 元素可见文本（含后代） */
export function textContent(el) {
  if (!el) return "";
  if (el.tag === "#text") return el.text || "";
  let s = "";
  for (const c of el.children) s += textContent(c);
  return s;
}

/** 取属性 */
export function attr(el, name) {
  return el ? el.attrs[name.toLowerCase()] ?? "" : "";
}

/** 清理文本：合并空白 */
export function cleanText(s) {
  return String(s || "")
    .replace(/[\t\r\u3000]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}
