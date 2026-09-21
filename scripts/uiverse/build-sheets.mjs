// 用法:
//   node scripts/uiverse/build-sheets.mjs --src .local/uiverse/elements --out .local/uiverse/sheets
//   node scripts/uiverse/build-sheets.mjs --picks scripts/uiverse/picks.json   # 只出「精选」页
// 评分挑选：从每个分类里按「技法丰富度 + 调色偏好」排序取头部，生成 4 列 iframe 拼版页（配合 screenshot-sheets.mjs 出图）。
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const SRC = path.resolve(arg("src", ".local/uiverse/elements"));
const OUT = path.resolve(arg("out", ".local/uiverse/sheets"));
const PICKS = arg("picks", "");
fs.mkdirSync(OUT, { recursive: true });

const HUE = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return -1;
  let h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return h;
};

/** 技法分：越"有技法且配色舒服"分越高；霓虹/青紫/柠檬刻意减分（与项目暖象牙+晴空蓝+阳光橘不符） */
export function score(css) {
  let s = 0;
  const has = (re) => re.test(css);
  if (has(/backdrop-filter/i)) s += 3;
  if (has(/conic-gradient/i)) s += 3.5;
  if (has(/radial-gradient/i)) s += 1;
  if (has(/linear-gradient/i)) s += 1;
  if (has(/@keyframes/i)) s += 2;
  if (has(/cubic-bezier/i)) s += 1.5;
  if (has(/perspective|rotate3d|rotateY|rotateX|translateZ/i)) s += 2;
  if (has(/clip-path|mask-image|-webkit-mask/i)) s += 1.5;
  if (has(/drop-shadow|filter:\s*blur/i)) s += 1;
  if (has(/mix-blend-mode/i)) s += 1;
  if (has(/inset\s+0\s+1px|inset 0 0/i)) s += 0.5;
  if (has(/var\(--/)) s += 1;
  s += Math.min(2, css.length / 2200);
  let good = 0, bad = 0;
  for (const m of [...css.matchAll(/#([0-9a-f]{6})\b/gi)].slice(0, 40)) {
    const hx = m[1];
    const r = parseInt(hx.slice(0, 2), 16), g = parseInt(hx.slice(2, 4), 16), b = parseInt(hx.slice(4, 6), 16);
    const hue = HUE(r, g, b);
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (hue === -1 || sat < 0.12) { good += 0.3; continue; }
    if ((hue >= 20 && hue <= 70) || (hue >= 190 && hue <= 235)) good += 1;
    else if ((hue >= 270 && hue <= 340) || (hue >= 160 && hue <= 185) || (hue >= 75 && hue <= 100)) bad += 1;
  }
  s += Math.min(2.5, good * 0.35) - Math.min(2.5, bad * 0.5);
  return s;
}

const PAGE_CSS =
  "body{margin:0;background:#f6f6f8;font:12px/1.35 system-ui,'PingFang SC',sans-serif;color:#333}" +
  "h1{font-size:15px;margin:0;padding:14px 14px 0}" +
  "p.sub{margin:4px 14px 0;color:#666;font-size:12px}" +
  ".grid{display:grid;grid-template-columns:repeat(4,320px);gap:10px;padding:12px}" +
  ".cell{margin:0;background:#fff;border:1px solid #ddd;border-radius:8px;overflow:hidden;display:flex;flex-direction:column}" +
  "iframe{width:320px;height:210px;border:0;background:#fff}" +
  "figcaption{padding:4px 6px;font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid #eee}" +
  "figcaption em{color:#999;font-style:normal}";

function cell(cat, file, srcPrefix) {
  const rel = srcPrefix + "/" + encodeURIComponent(cat) + "/" + encodeURIComponent(file) + ".html";
  return '<figure class="cell"><iframe loading="eager" src="' + rel + '"></iframe><figcaption>' + cat + " / " + file + "</figcaption></figure>";
}
function page(title, sub, cells) {
  return "<!doctype html><meta charset=\"utf-8\"><title>" + title + "</title><style>" + PAGE_CSS + "</style>" +
    "<h1>" + title + "</h1><p class=\"sub\">" + sub + "</p><div class=\"grid\">" + cells.join("\n") + "</div>";
}

if (PICKS) {
  const picks = JSON.parse(fs.readFileSync(path.resolve(PICKS), "utf8"));
  const rel = (p) => path.relative(OUT, SRC).split(path.sep).join("/") + p;
  let n = 0;
  for (const sheet of picks.sheets) {
    const cells = [];
    for (const [cat, file] of sheet.items) {
      const p = path.join(SRC, cat, file + ".html");
      if (!fs.existsSync(p)) { console.log("跳过（缺失）", cat + "/" + file); continue; }
      cells.push(cell(cat, file, rel("")));
    }
    fs.writeFileSync(path.join(OUT, sheet.name + ".html"), page(sheet.title, sheet.note ?? "来源：uiverse.io · MIT（uiverse-io/galaxy）", cells), "utf8");
    console.log("精选页 ->", sheet.name + ".html", cells.length, "格");
    n += cells.length;
  }
  console.log("精选合计", n, "格");
} else {
  const plan = { Buttons: 48, Cards: 40, loaders: 40, "Toggle-switches": 24, Inputs: 24, Forms: 24, Checkboxes: 20, "Radio-buttons": 16, Tooltips: 16, Notifications: 16, Patterns: 16 };
  for (const [cat, n] of Object.entries(plan)) {
    const dir = path.join(SRC, cat);
    if (!fs.existsSync(dir)) continue;
    const ranked = fs.readdirSync(dir).filter((f) => f.endsWith(".html"))
      .map((f) => ({ file: f, score: score(fs.readFileSync(path.join(dir, f), "utf8")) }))
      .sort((a, b) => b.score - a.score).slice(0, n);
    for (let i = 0; i < ranked.length; i += 24) {
      const tiles = ranked.slice(i, i + 24);
      const name = (ranked.length > 24 ? cat + "-" + (i / 24 + 1) : cat) + ".html";
      const cells = tiles.map((t) => cell(cat, t.file.replace(/\.html$/, ""), path.relative(OUT, SRC).split(path.sep).join("/")));
      fs.writeFileSync(path.join(OUT, name), page(cat, "自动排序（技法分）· 供人工挑选", cells), "utf8");
      console.log("拼版 ->", name, tiles.length, "格");
    }
  }
}
