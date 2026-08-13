// inventory.mjs — Step 3: 盘点 Travel-Notes 学习内容
// 读取 migration/source/travel-notes 下的内容，按方案 §9/§10 分类，输出 JSON + Markdown 报告。
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.join(process.cwd(), "migration/source/travel-notes");
const REPORT_DIR = path.join(process.cwd(), "migration/reports");

function parseFrontmatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    meta[key] = val;
  }
  return { meta, body: text.slice(m[0].length) };
}

function countBlocks(body, fence) {
  const re = new RegExp("^\\s*\\`\\`\\`" + fence + "\\s*$", "gm");
  let n = 0;
  while (re.exec(body)) n++;
  return n;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(md|markdown|py)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function firstH1(body) {
  const m = /^#\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : null;
}

function groupRepoFiles(files) {
  // content/tech/repos/<repo>/... -> 一个 repo 项
  const repos = {};
  const others = [];
  for (const f of files) {
    const rel = path.relative(SOURCE_ROOT, f).replace(/\\/g, "/");
    const m = /^content\/tech\/repos\/([^/]+)\//.exec(rel);
    if (m) {
      (repos[m[1]] ||= []).push(f);
    } else {
      others.push(f);
    }
  }
  return { repos, others };
}

export function buildInventory() {
  const items = [];
  const files = walk(path.join(SOURCE_ROOT, "content"));
  const { repos, others } = groupRepoFiles(files);

  // 1) repo 项：每个 repo 一个 item
  for (const [repoName, repoFiles] of Object.entries(repos)) {
    const readme = repoFiles.find((f) => /README\.md$/i.test(f)) || repoFiles[0];
    const assets = repoFiles.filter((f) => f !== readme);
    const text = fs.readFileSync(readme, "utf8").replace(/^\uFEFF/, "");
    const { meta, body } = parseFrontmatter(text);
    const mermaid = countBlocks(body, "mermaid");
    const codeBlocks = countBlocks(body, "") - mermaid;
    const images = (body.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
    const title = meta.title || firstH1(body) || repoName;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    items.push({
      sourceType: "repo",
      slug: repoName,
      title,
      date: meta.date || null,
      category: meta.category || null,
      description: meta.description || null,
      tags,
      sourcePath: "content/tech/repos/" + repoName,
      target: "project:PROJECT_NOTE",
      content: { lines: body.split(/\r?\n/).length, chars: body.length, codeBlocks, mermaid, images },
      assets: assets.map((a) => path.relative(SOURCE_ROOT, a).replace(/\\/g, "/")),
    });
  }

  // 2) 其他 md（blog/mindmap）
  for (const file of others) {
    const rel = path.relative(SOURCE_ROOT, file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const { meta, body } = parseFrontmatter(text);
    const lower = rel.toLowerCase();
    let sourceType = "unknown";
    if (lower.includes("/blog/")) sourceType = "blog";
    else if (lower.includes("/mindmap")) sourceType = "mindmap";
    if (sourceType === "unknown") continue; // life/travel 不迁移
    const title = meta.title || path.basename(file, path.extname(file));
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const date = meta.date || null;
    const mermaid = countBlocks(body, "mermaid");
    const codeBlocks = countBlocks(body, "") - mermaid;
    const images = (body.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
    const target = sourceType === "mindmap" ? "knowledge:MINDMAP" : "knowledge:NOTE";
    items.push({
      sourceType,
      slug: meta.slug || path.basename(file, path.extname(file)),
      title,
      date,
      category: meta.category || null,
      description: meta.description || null,
      tags,
      sourcePath: rel,
      target,
      content: { lines: body.split(/\r?\n/).length, chars: body.length, codeBlocks, mermaid, images },
      assets: [],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "Travel-Notes@fb9978a (git HEAD), 工作区学习文件已被并发会话 staged 删除，本清单基于 git HEAD 提取",
    mysqlPostTypes: { travel: 3, blog: 0, mindmap: 0, repo: 0 },
    mysqlRepoRows: 0,
    items,
  };
}

export function writeReports() {
  const inv = buildInventory();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "inventory.json"), JSON.stringify(inv, null, 2), "utf8");
  const lines = [];
  lines.push("# Travel-Notes 学习内容盘点报告（第 77 节 · 步骤 3）");
  lines.push("");
  lines.push("> 生成时间：" + inv.generatedAt);
  lines.push("> 数据源：Travel-Notes git HEAD（commit fb9978a），MySQL `Travel_And_Study`");
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push("| 类别 | 数量 | 迁移去向 |");
  lines.push("|---|---|---|");
  const byTarget = {};
  for (const it of inv.items) byTarget[it.target] = (byTarget[it.target] || 0) + 1;
  const targetNames = {
    "knowledge:NOTE": "学习知识（KnowledgeNote·NOTE）",
    "knowledge:MINDMAP": "思维导图（KnowledgeNote·MINDMAP）",
    "project:PROJECT_NOTE": "技术项目（KnowledgeNote·PROJECT_NOTE）",
    "keep:travel-notes": "情侣/旅行/生活（保留在 Travel-Notes）",
  };
  for (const [t, n] of Object.entries(byTarget)) lines.push("| " + (targetNames[t] || t) + " | " + n + " | Learn-Workbench |");
  lines.push("| **合计** | **" + inv.items.length + "** | |");
  lines.push("");
  lines.push("## 明细");
  lines.push("");
  for (const it of inv.items) {
    lines.push("### " + it.title);
    lines.push("");
    lines.push("- 类型：" + it.sourceType + "（→ " + it.target + "）");
    lines.push("- Slug：" + it.slug);
    lines.push("- 日期：" + (it.date || "—"));
    lines.push("- 标签：" + (it.tags.join("、") || "—"));
    lines.push("- 来源路径：" + it.sourcePath);
    lines.push("- 内容：" + it.content.lines + " 行 / " + it.content.chars + " 字符；代码块 " + it.content.codeBlocks + "；Mermaid " + it.content.mermaid + "；图片 " + it.content.images);
    lines.push("");
  }
  lines.push("## MySQL 侧情况");
  lines.push("");
  lines.push("- Post 表仅包含 3 条 travel 类型（旅行内容，不迁移）。");
  lines.push("- Repo 表 0 行。");
  lines.push("- 学习内容全部以 Markdown 形式存在于 git HEAD，已提取到 `migration/source/travel-notes`。");
  fs.writeFileSync(path.join(REPORT_DIR, "inventory.md"), lines.join("\n"), "utf8");
  return inv;
}
