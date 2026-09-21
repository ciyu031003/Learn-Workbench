// 用法: node scripts/uiverse/fetch-elements.mjs [--out <dir>] [--categories a,b] [--tree <path>]
// 拉取 uiverse-io/galaxy（MIT，3000+ 元素）的元素 HTML 到本地，供离线挑选。
// 网络说明：本机 github.com:443 直连不通，但 api.github.com / raw.githubusercontent.com 可用，
// 因此用 API 取文件树、用 raw 取单文件；已存在的文件默认跳过（可断点续跑）。
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(arg("out", ".local/uiverse/elements"));
const CATS = arg("categories", "Buttons,Cards,loaders,Toggle-switches,Inputs,Forms,Checkboxes,Radio-buttons,Tooltips,Notifications,Patterns").split(",");
const TREE_PATH = path.resolve(arg("tree", path.join(path.dirname(OUT), "tree.json")));
const CONC = Number(arg("conc", "24"));

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(TREE_PATH), { recursive: true });

if (!fs.existsSync(TREE_PATH)) {
  const res = await fetch("https://api.github.com/repos/uiverse-io/galaxy/git/trees/main?recursive=1", { headers: { "user-agent": "lwb-uiverse" } });
  if (!res.ok) throw new Error("tree 拉取失败 " + res.status);
  fs.writeFileSync(TREE_PATH, await res.text(), "utf8");
  console.log("tree 已缓存 ->", TREE_PATH);
}
const tree = JSON.parse(fs.readFileSync(TREE_PATH, "utf8"));
const files = tree.tree.filter((e) => e.type === "blob" && e.path.endsWith(".html") && CATS.includes(e.path.split("/")[0]));
console.log("元素总数", tree.tree.filter((e) => e.type === "blob" && e.path.endsWith(".html")).length, "本次目标", files.length);

const url = (p) => "https://raw.githubusercontent.com/uiverse-io/galaxy/main/" + p.split("/").map(encodeURIComponent).join("/");
let idx = 0, ok = 0, fail = 0;
const failures = [];
async function worker() {
  while (true) {
    const i = idx++;
    if (i >= files.length) return;
    const rel = files[i].path;
    const dest = path.join(OUT, rel);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { ok++; continue; }
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url(rel), { headers: { "user-agent": "lwb-uiverse" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, text, "utf8");
        ok++;
        break;
      } catch (e) {
        if (attempt === 3) { fail++; failures.push(rel + " :: " + e.message); }
        else await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if ((ok + fail) % 400 === 0) console.log("进度", ok + fail, "/", files.length);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log("完成 ok=", ok, "fail=", fail);
if (failures.length) fs.writeFileSync(path.join(path.dirname(OUT), "fetch-failures.txt"), failures.join("\n"), "utf8");
