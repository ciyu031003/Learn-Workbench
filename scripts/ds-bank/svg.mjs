/**
 * 算法 SVG 动图生成器（数据结构知识点配套）。
 *
 * 设计：把每个算法拆成「若干帧」，每帧是一张 SVG 场景（矩形/圆 + 箭头 + 文本）。
 * 渲染层按帧顺序自动播放（浏览器内联 SVG + 移动端 react-native-svg 的 SvgXml），
 * 因此不依赖 SMIL（react-native-svg 不支持 <animate>）。
 *
 * 输出：packages/content/src/learning/algorithm-animations.ts
 *   export const algorithmAnimations: Record<string, { caption: string; svg: string }[]>
 *
 * 约束：只用 presentation attribute，禁止 <style>/<script>/on*=/javascript:，
 *       以免触发内容质量门禁的「危险片段」正则。
 */
import fs from "node:fs";

const PALETTE = {
  idle: { fill: "#EEF2F5", stroke: "#9AA7B4", text: "#1F2937" },
  active: { fill: "#D9EDEA", stroke: "#1F6F6B", text: "#0F3D3A" },
  compare: { fill: "#FDE8C8", stroke: "#C9821B", text: "#6B3F04" },
  done: { fill: "#D7F0D8", stroke: "#2E7D32", text: "#1B4D1E" },
  muted: { fill: "#F5F7FA", stroke: "#CBD5E1", text: "#94A3B8" },
  warn: { fill: "#FBE0E0", stroke: "#C0392B", text: "#7A1F16" },
};

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderSvg(scene) {
  const w = scene.w ?? 440;
  const h = scene.h ?? 240;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img">`,
    `<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="#ffffff"/>`,
  ];
  for (const a of scene.arrows ?? []) {
    const color = a.state === "hot" ? "#1F6F6B" : a.state === "muted" ? "#CBD5E1" : "#94A3B8";
    const width = a.state === "hot" ? 2.4 : 1.6;
    out.push(
      `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
    );
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const len = 8;
    const spread = 0.42;
    const p1 = `${a.x2},${a.y2}`;
    const p2 = `${a.x2 - len * Math.cos(angle - spread)},${a.y2 - len * Math.sin(angle - spread)}`;
    const p3 = `${a.x2 - len * Math.cos(angle + spread)},${a.y2 - len * Math.sin(angle + spread)}`;
    out.push(`<polygon points="${p1} ${p2} ${p3}" fill="${color}"/>`);
  }
  for (const b of scene.boxes ?? []) {
    const p = PALETTE[b.state ?? "idle"];
    out.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.6"/>`
    );
    const labelY = b.sub ? b.y + b.h / 2 - 4 : b.y + b.h / 2 + 5;
    out.push(
      `<text x="${b.x + b.w / 2}" y="${labelY}" font-size="${b.labelSize ?? 15}" font-weight="600" text-anchor="middle" fill="${p.text}">${esc(b.label)}</text>`
    );
    if (b.sub) {
      out.push(
        `<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 13}" font-size="10" text-anchor="middle" fill="${p.text}" opacity="0.7">${esc(b.sub)}</text>`
      );
    }
  }
  for (const c of scene.circles ?? []) {
    const p = PALETTE[c.state ?? "idle"];
    out.push(
      `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r ?? 20}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.8"/>`
    );
    out.push(
      `<text x="${c.cx}" y="${c.cy + 5}" font-size="${c.labelSize ?? 13}" font-weight="600" text-anchor="middle" fill="${p.text}">${esc(c.label)}</text>`
    );
  }
  for (const l of scene.labels ?? []) {
    out.push(
      `<text x="${l.x}" y="${l.y}" font-size="${l.size ?? 12}" font-weight="${l.weight ?? 400}" text-anchor="${l.anchor ?? "start"}" fill="${l.color ?? "#334155"}">${esc(l.text)}</text>`
    );
  }
  out.push("</svg>");
  return out.join("");
}

function arr(values, states = {}, y = 54, opts = {}) {
  const bw = opts.bw ?? 50;
  const bh = opts.bh ?? 42;
  const g = opts.g ?? 10;
  const x0 = opts.x0 ?? 20;
  const showIndex = opts.showIndex !== false;
  return values.map((value, i) => ({
    x: x0 + i * (bw + g),
    y,
    w: bw,
    h: bh,
    label: value === null || value === "" ? "·" : String(value),
    sub: showIndex ? String(i) : undefined,
    state: states[i] ?? "idle",
  }));
}

const f = (caption, scene) => ({ caption, scene });

const boxAt = (x, y, label, state = "idle", opts = {}) => ({
  x,
  y,
  w: opts.w ?? 54,
  h: opts.h ?? 44,
  label,
  sub: opts.sub,
  state,
});

const circleAt = (cx, cy, label, state = "idle", r = 20) => ({ cx, cy, label, state, r });

const arrow = (x1, y1, x2, y2, state = "idle") => ({ x1, y1, x2, y2, state });

// ---------------------------------------------------------------- 动图定义

/** 单链表插入：s->next = p->next; p->next = s; */
const listInsert = [
  f("初始：p 指向结点 A，A 的后继是 B，链表 A→B→C", {
    w: 440, h: 140,
    boxes: [boxAt(24, 40, "A", "active", { sub: "p" }), boxAt(200, 40, "B"), boxAt(320, 40, "C")],
    arrows: [arrow(78, 62, 200, 62, "hot"), arrow(254, 62, 320, 62)],
  }),
  f("① s->next = p->next：先让 s 接上 B，此时是 A→s→B→C（A 的指针还没改，不能先改它）", {
    w: 440, h: 140,
    boxes: [boxAt(24, 40, "A", "active", { sub: "p" }), boxAt(120, 40, "s", "compare", { w: 44, sub: "s" }), boxAt(200, 40, "B"), boxAt(320, 40, "C")],
    arrows: [arrow(164, 62, 200, 62, "hot"), arrow(254, 62, 320, 62)],
  }),
  f("② p->next = s：A 改指向 s，链表恢复单链 A→s→B→C，插入完成", {
    w: 440, h: 140,
    boxes: [boxAt(24, 40, "A", "done", { sub: "p" }), boxAt(120, 40, "s", "done", { w: 44, sub: "s" }), boxAt(200, 40, "B"), boxAt(320, 40, "C")],
    arrows: [arrow(78, 62, 120, 62, "hot"), arrow(164, 62, 200, 62), arrow(254, 62, 320, 62)],
  }),
];

/** 顺序栈：入栈 / 出栈只动栈顶。 */
function stackScene(top, values, note) {
  const boxes = [];
  for (let i = 3; i >= 0; i--) {
    const filled = i <= top;
    boxes.push({
      x: 140, y: 30 + (3 - i) * 40, w: 150, h: 34,
      label: filled ? String(values[i]) : "·",
      state: filled ? (i === top ? "active" : "done") : "muted",
    });
  }
  const pointerY = top < 0 ? 144 + 40 : 30 + (3 - top) * 40 + 17;
  return {
    w: 440, h: 220, boxes,
    labels: [
      { x: 300, y: pointerY + 4, text: "← top", weight: 600, color: "#1F6F6B" },
      { x: 20, y: 40, text: "栈顶在右侧方向：数组末端为栈顶", size: 11 },
      { x: 20, y: 200, text: note, size: 12, color: "#334155" },
    ],
  };
}

const stackOps = [
  f("空栈：top = -1，任何出栈都是下溢错误", stackScene(-1, [], "top = -1")),
  f("push(3)：元素放到 top+1 位置，top 上移到 0，O(1)", stackScene(0, [3], "top = 0")),
  f("push(7)：top 上移到 1，栈内自底向上是 3、7", stackScene(1, [3, 7], "top = 1")),
  f("push(1)：top = 2，栈满前不需要搬动任何已有元素", stackScene(2, [3, 7, 1], "top = 2")),
  f("pop()：弹出栈顶 1，top 回到 1；栈是 LIFO，最后进的先出", stackScene(1, [3, 7, 1], "pop → 1，top = 1")),
];

/** 循环队列：front / rear 都靠取模环绕。 */
function queueScene(values, front, rear, note) {
  const slots = [];
  for (let i = 0; i < 6; i++) {
    slots.push({
      x: 20 + i * 62, y: 70, w: 54, h: 44,
      label: values[i] ?? "·",
      sub: String(i),
      state: values[i] ? "done" : "muted",
    });
  }
  if (values[front]) slots[front].state = "active";
  if (values[rear] && rear !== front) slots[rear].state = "active";
  return {
    w: 440, h: 190, boxes: slots,
    labels: [
      { x: 20, y: 56, text: "front = " + front + "，rear = " + rear, weight: 600, color: "#1F6F6B" },
      { x: 20, y: 150, text: "容量 6 的循环队列：(rear + 1) % 6 得到下一格，避免搬移", size: 11 },
      { x: 20, y: 176, text: note, size: 12 },
    ],
  };
}

const queueOps = [
  f("空队列：front == rear == 0，判空用 front == rear", queueScene([], 0, 0, "空队列")),
  f("入队 A、B、C：rear 依次后移，元素放在 rear 指向的格子里", queueScene(["A", "B", "C"], 0, 3, "front=0，rear=3")),
  f("出队 A：只把 front 后移，不搬动其它元素，O(1)", queueScene(["", "B", "C"], 1, 3, "front=1，rear=3")),
  f("继续入队 D、E：队列内容为 B、C、D、E", queueScene(["", "B", "C", "D", "E"], 1, 5, "front=1，rear=5")),
  f("入队 F：rear 到 5 后再前进就环绕回 0，空间被重复利用", queueScene(["", "B", "C", "D", "E", "F"], 1, 0, "rear = (5+1)%6 = 0")),
];

// 二叉树（中序遍历演示用）
const treeNodes = [
  { id: "A", x: 220, y: 40 },
  { id: "B", x: 130, y: 110 },
  { id: "C", x: 310, y: 110 },
  { id: "D", x: 70, y: 180 },
  { id: "E", x: 190, y: 180 },
  { id: "F", x: 250, y: 180 },
  { id: "G", x: 370, y: 180 },
];
const treeEdges = [["A", "B"], ["A", "C"], ["B", "D"], ["B", "E"], ["C", "F"], ["C", "G"]];
function treeScene(visited, current) {
  const byId = Object.fromEntries(treeNodes.map((n) => [n.id, n]));
  const edges = treeEdges.map(([a, b]) =>
    arrow(byId[a].x, byId[a].y + 20, byId[b].x, byId[b].y - 20, visited.has(b) ? "hot" : "idle")
  );
  const circles = treeNodes.map((n) =>
    circleAt(n.x, n.y, n.id, n.id === current ? "compare" : visited.has(n.id) ? "done" : "idle")
  );
  return {
    w: 440, h: 240, circles, arrows: edges,
    labels: [
      { x: 20, y: 226, text: "已输出：" + [...visited].join(" "), size: 12, weight: 600, color: "#1F6F6B" },
    ],
  };
}

const treeOrder = ["D", "B", "E", "A", "F", "C", "G"];
const treeTraversal = [f("中序遍历：左 → 根 → 右。从根 A 出发，先一路向左到底", treeScene(new Set(), "A"))];
{
  const visited = new Set();
  for (const id of treeOrder) {
    treeTraversal.push(f("访问 " + id + "；访问完左子树回到根，再进入右子树", treeScene(new Set(visited), id)));
    visited.add(id);
  }
  treeTraversal.push(f("中序遍历序列：D B E A F C G（对 BST 而言这就是升序）", treeScene(new Set(treeOrder), null)));
}

// BST 查找
const bstNodes = [
  { id: "50", x: 220, y: 40 },
  { id: "30", x: 130, y: 110 },
  { id: "70", x: 310, y: 110 },
  { id: "20", x: 70, y: 180 },
  { id: "40", x: 190, y: 180 },
  { id: "60", x: 250, y: 180 },
  { id: "80", x: 370, y: 180 },
];
const bstEdges = [["50", "30"], ["50", "70"], ["30", "20"], ["30", "40"], ["70", "60"], ["70", "80"]];
function bstScene(states, note) {
  const byId = Object.fromEntries(bstNodes.map((n) => [n.id, n]));
  return {
    w: 440, h: 240,
    circles: bstNodes.map((n) => circleAt(n.x, n.y, n.id, states[n.id] ?? "idle", 22)),
    arrows: bstEdges.map(([a, b]) => arrow(byId[a].x, byId[a].y + 22, byId[b].x, byId[b].y - 22, "idle")),
    labels: [{ x: 20, y: 226, text: note, size: 12, weight: 600, color: "#1F6F6B" }],
  };
}

const bstSearch = [
  f("在二叉排序树中查找 40：从根 50 开始", bstScene({ "50": "active" }, "40 < 50")),
  f("40 比 50 小，走左子树到 30（右子树整体更大，整块排除）", bstScene({ "50": "muted", "30": "active" }, "40 > 30")),
  f("40 比 30 大，走右子树到 40", bstScene({ "50": "muted", "30": "muted", "40": "compare" }, "命中 40")),
  f("命中 40，查找成功；每层只走一个分支，代价是树高 O(log n)（平衡时）", bstScene({ "50": "muted", "30": "muted", "40": "done" }, "查找成功")),
];

/** 堆下沉（sift down）：父结点与较大的孩子交换，直到满足堆序。 */
function heapScene(values, states, note) {
  return {
    w: 440, h: 150,
    boxes: arr(values, states, 40),
    labels: [{ x: 20, y: 130, text: note, size: 12, weight: 600, color: "#1F6F6B" }],
  };
}

const heapSift = [
  f("下沉 sift_down(0)：比较根 3 与两个孩子 9、2，选出较大者", heapScene([3, 9, 2, 1, 4], { 0: "active", 1: "compare", 2: "compare" }, "孩子里最大的是 9")),
  f("9 > 3，与最大孩子交换，让 3 往下走", heapScene([9, 3, 2, 1, 4], { 0: "done", 1: "active" }, "交换 3 与 9")),
  f("继续在 1 号位下沉：比较 3 与孩子 1、4", heapScene([9, 3, 2, 1, 4], { 1: "active", 3: "compare", 4: "compare" }, "孩子里最大的是 4")),
  f("4 > 3，再与 4 交换", heapScene([9, 4, 2, 1, 3], { 1: "done", 4: "active" }, "交换 3 与 4")),
  f("4 号位已是叶子，停止；大根堆性质恢复，代价 O(log n)", heapScene([9, 4, 2, 1, 3], { 0: "done", 1: "done", 4: "done" }, "到叶子，堆序恢复")),
];

// 图：BFS / DFS 对比
const graphNodes = [
  { id: "A", x: 50, y: 120 },
  { id: "B", x: 170, y: 55 },
  { id: "C", x: 170, y: 185 },
  { id: "D", x: 300, y: 55 },
  { id: "E", x: 300, y: 185 },
  { id: "F", x: 410, y: 120 },
];
const graphEdges = [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"], ["E", "F"]];
function graphScene(visited, current, note) {
  const byId = Object.fromEntries(graphNodes.map((n) => [n.id, n]));
  return {
    w: 440, h: 240,
    circles: graphNodes.map((n) => circleAt(n.x, n.y, n.id, n.id === current ? "compare" : visited.has(n.id) ? "done" : "idle", 20)),
    arrows: graphEdges.map(([a, b]) => arrow(byId[a].x, byId[a].y, byId[b].x, byId[b].y, visited.has(a) && visited.has(b) ? "hot" : "idle")),
    labels: [{ x: 20, y: 226, text: note, size: 12, weight: 600, color: "#1F6F6B" }],
  };
}

const bfsOrder = ["A", "B", "C", "D", "E", "F"];
const bfsFrames = [f("BFS：从 A 出发，按「一层一层」扩展，用队列保存待访问结点", graphScene(new Set(), "A", "队列：[A]"))];
{
  const visited = new Set();
  const queue = ["A"];
  for (let i = 0; i < bfsOrder.length; i++) {
    const id = bfsOrder[i];
    visited.add(id);
    const nextQueue = bfsOrder.slice(i + 1, i + 3);
    bfsFrames.push(f("出队 " + id + "，把它未访问的邻居入队", graphScene(new Set(visited), id, "队列：[" + (nextQueue.join(", ") || "空") + "]")));
  }
  bfsFrames.push(f("BFS 访问序列：A B C D E F；队列保证层数小的先被访问，因此能求无权最短路", graphScene(new Set(bfsOrder), null, "A B C D E F")));
}

const dfsOrder = ["A", "B", "D", "F", "E", "C"];
const dfsFrames = [f("DFS：从 A 出发，一条路走到底再回头，用栈保存回溯点", graphScene(new Set(), "A", "栈：[A]"))];
{
  const visited = new Set();
  for (let i = 0; i < dfsOrder.length; i++) {
    const id = dfsOrder[i];
    visited.add(id);
    dfsFrames.push(f("深入访问 " + id + "；没有未访问邻居时回溯到上一个分叉", graphScene(new Set(visited), id, "栈：[" + dfsOrder.slice(0, i + 1).join(", ") + "]")));
  }
  dfsFrames.push(f("DFS 访问序列：A B D F E C；递归或显式栈实现，适合连通性与路径枚举", graphScene(new Set(dfsOrder), null, "A B D F E C")));
}

// 哈希表链地址法
function hashScene(buckets, note) {
  const boxes = [];
  const labels = [{ x: 30, y: 14, text: "桶号（h(k)=k mod 7）", size: 11 }];
  for (let i = 0; i < 7; i++) {
    const y = 24 + i * 30;
    boxes.push({ x: 30, y, w: 64, h: 24, label: String(i), state: buckets[i]?.length ? "active" : "muted", labelSize: 12 });
    (buckets[i] ?? []).forEach((value, j) => {
      boxes.push({ x: 110 + j * 56, y, w: 46, h: 24, label: String(value), state: "done", labelSize: 12 });
    });
  }
  return {
    w: 440, h: 250, boxes,
    labels: [...labels, { x: 30, y: 240, text: note, size: 12, weight: 600, color: "#1F6F6B" }],
  };
}

const hashChain = [
  f("哈希表长度 m = 7，哈希函数 h(k) = k mod 7，先看空表", hashScene({}, "空表")),
  f("插入 10：h(10)=3，放到 3 号桶，一次定位，平均 O(1)", hashScene({ 3: [10] }, "10 → 桶 3")),
  f("插入 22：h(22)=1，放到 1 号桶", hashScene({ 3: [10], 1: [22] }, "22 → 桶 1")),
  f("插入 8：h(8)=1 与 22 冲突 → 链地址法把 8 挂到 1 号桶的链上", hashScene({ 3: [10], 1: [8, 22] }, "8 冲突 → 链到桶 1")),
  f("插入 17：h(17)=3 冲突 → 链到 3 号桶；同义子（同桶）用链表串起来", hashScene({ 3: [17, 10], 1: [8, 22] }, "17 冲突 → 链到桶 3")),
  f("插入 6：h(6)=6，落到 6 号桶，不冲突", hashScene({ 3: [17, 10], 1: [8, 22], 6: [6] }, "6 → 桶 6")),
  f("查找 8：先算桶号 1，再沿链比较 8 与 22 —— 冲突越多链越长，查找越慢", hashScene({ 3: [17, 10], 1: [8, 22], 6: [6] }, "定位桶 1 → 沿链比较")),
];

// 排序类
const sortScene = (values, states, note) => ({
  w: 440, h: 150,
  boxes: arr(values, states, 40),
  labels: [{ x: 20, y: 132, text: note, size: 12, weight: 600, color: "#1F6F6B" }],
});

const insertionSort = [
  f("直接插入排序：左边是已排好的有序区，把右边第一个元素插进有序区", sortScene([5, 2, 9, 1, 6, 3], { 0: "done", 1: "active" }, "有序区：[5]")),
  f("2 < 5，5 后移一格，腾出位置", sortScene([5, 5, 9, 1, 6, 3], { 1: "compare" }, "5 后移")),
  f("把 2 放进 0 号位：有序区 [2, 5]", sortScene([2, 5, 9, 1, 6, 3], { 0: "done", 1: "done" }, "有序区：[2, 5]")),
  f("9 比有序区最大值 5 还大，就地不动", sortScene([2, 5, 9, 1, 6, 3], { 0: "done", 1: "done", 2: "done" }, "有序区：[2, 5, 9]")),
  f("1 一直比到最前，插到 0 号位", sortScene([1, 2, 5, 9, 6, 3], { 0: "done", 1: "done", 2: "done", 3: "done" }, "有序区：[1, 2, 5, 9]")),
  f("6 插到 5 和 9 之间", sortScene([1, 2, 5, 6, 9, 3], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done" }, "有序区：[1, 2, 5, 6, 9]")),
  f("3 插到 2 和 5 之间，全部有序；最坏 O(n²)，小规模与近乎有序时很快", sortScene([1, 2, 3, 5, 6, 9], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }, "完成")),
];

const bubbleSort = [
  f("冒泡排序：相邻两个比较，逆序就交换，大的往右冒", sortScene([5, 1, 4, 2, 8], { 0: "compare", 1: "compare" }, "比较 5 与 1")),
  f("5 > 1，交换", sortScene([1, 5, 4, 2, 8], { 1: "compare", 2: "compare" }, "比较 5 与 4")),
  f("5 > 4，交换", sortScene([1, 4, 5, 2, 8], { 2: "compare", 3: "compare" }, "比较 5 与 2")),
  f("5 > 2，交换", sortScene([1, 4, 2, 5, 8], { 3: "compare", 4: "compare" }, "比较 5 与 8")),
  f("5 < 8 不交换，本轮最大者 8 已冒到最右，右边界收紧", sortScene([1, 4, 2, 5, 8], { 3: "active", 4: "done" }, "8 归位")),
  f("下一轮：4 > 2 交换，之后 4<5、5<8 不再交换，全部有序", sortScene([1, 2, 4, 5, 8], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done" }, "完成")),
];

const quickSort = [
  f("快速排序：选首元素 6 作基准，目标是让左边都 ≤6、右边都 ≥6", sortScene([6, 2, 8, 3, 7, 1], { 0: "active" }, "基准 pivot = 6")),
  f("右指针从右往左找比基准小的：命中 1", sortScene([6, 2, 8, 3, 7, 1], { 0: "active", 5: "compare" }, "j 命中 1")),
  f("左指针从左往右找比基准大的：命中 8", sortScene([6, 2, 8, 3, 7, 1], { 0: "active", 2: "compare" }, "i 命中 8")),
  f("交换 8 与 1，两端继续向中间靠拢", sortScene([6, 2, 1, 3, 7, 8], { 2: "done", 5: "done" }, "交换 8 ↔ 1")),
  f("继续：右指针命中 3，左指针命中 7，但两指针已交错，停止", sortScene([6, 2, 1, 3, 7, 8], { 3: "compare", 4: "compare" }, "指针交错，停止")),
  f("把基准 6 与 j 位置的 3 交换，6 落到最终位置", sortScene([3, 2, 1, 6, 7, 8], { 3: "done" }, "6 归位")),
  f("基准左侧全 ≤6、右侧全 ≥6，再对两段递归；平均 O(n log n)", sortScene([3, 2, 1, 6, 7, 8], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }, "递归左右两段")),
];

const selectionSort = [
  f("简单选择排序：每一轮在未排序区找最小值，换到未排序区最前面", sortScene([5, 3, 8, 1, 4], { 0: "active" }, "在 [5,3,8,1,4] 中找最小")),
  f("扫一遍发现最小值是 1（下标 3）", sortScene([5, 3, 8, 1, 4], { 0: "active", 3: "compare" }, "最小是 1")),
  f("交换 0 号与 3 号，1 落到最终位置", sortScene([1, 3, 8, 5, 4], { 0: "done" }, "交换 5 ↔ 1")),
  f("第 2 轮在 [3,8,5,4] 中找最小，最小值 3 已在最前，无需交换", sortScene([1, 3, 8, 5, 4], { 0: "done", 1: "done" }, "3 已在位")),
  f("第 3 轮在 [8,5,4] 中找最小 4，交换到 2 号位", sortScene([1, 3, 4, 5, 8], { 0: "done", 1: "done", 2: "done" }, "交换 8 ↔ 4")),
  f("第 4 轮 [5,8] 已有序，完成；比较次数固定 O(n²)，但交换次数最少", sortScene([1, 3, 4, 5, 8], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done" }, "完成")),
];

const heapSortA = [
  f("堆排序：先把数组调整成大根堆，从最后一个非叶结点开始下沉", heapScene([4, 10, 3, 5, 1], { 0: "active" }, "建堆")),
  f("结点 1 的值 10 已大于它的孩子 5、1，不动", heapScene([4, 10, 3, 5, 1], { 1: "active", 3: "compare", 4: "compare" }, "10 是最大")),
  f("结点 0 的值 4 比孩子 10 小，与最大孩子 10 交换", heapScene([10, 4, 3, 5, 1], { 0: "done", 1: "active" }, "交换 4 ↔ 10")),
  f("继续下沉 1 号位：4 与孩子 5 交换，大根堆建成，堆顶最大", heapScene([10, 5, 3, 4, 1], { 0: "done", 1: "done" }, "堆建成")),
  f("堆顶 10 与末尾 1 交换，最大值归位，堆的有效范围缩小 1", heapScene([1, 5, 3, 4, 10], { 0: "active", 4: "done" }, "10 归位")),
  f("对堆顶下沉恢复堆序：1 与较大孩子 5 交换", heapScene([5, 4, 3, 1, 10], { 0: "active", 4: "done" }, "恢复堆序")),
  f("重复「取堆顶 ↔ 末尾交换 + 下沉」，最终得到升序序列，O(n log n)", heapScene([1, 3, 4, 5, 10], { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done" }, "完成")),
];

function mergeScene(left, right, out, states, note) {
  return {
    w: 440, h: 210,
    boxes: [
      ...arr(left, states.left ?? {}, 20, { bw: 46, g: 8, showIndex: false }),
      ...arr(right, states.right ?? {}, 86, { bw: 46, g: 8, showIndex: false }),
      ...arr(out, states.out ?? {}, 152, { bw: 46, g: 8, showIndex: false }),
    ],
    labels: [
      { x: 300, y: 46, text: "左段（已有序）", size: 11 },
      { x: 300, y: 112, text: "右段（已有序）", size: 11 },
      { x: 300, y: 178, text: "输出区", size: 11, weight: 600, color: "#1F6F6B" },
      { x: 16, y: 206, text: note, size: 12, weight: 600, color: "#1F6F6B" },
    ],
  };
}

const mergeSortFrames = [
  f("归并排序的合并步：左右两段各自有序，比较两段的头元素，谁小先输出", mergeScene([2, 5, 9], [1, 6, 8], [null, null, null, null, null, null], {}, "比较 2 与 1")),
  f("1 更小，先输出 1，右段头指针后移", mergeScene([2, 5, 9], [1, 6, 8], [1, null, null, null, null, null], { right: { 0: "done" } }, "输出 1")),
  f("比较 2 与 6，输出 2", mergeScene([2, 5, 9], [1, 6, 8], [1, 2, null, null, null, null], { left: { 0: "done" }, right: { 0: "done" } }, "输出 2")),
  f("比较 5 与 6，输出 5", mergeScene([2, 5, 9], [1, 6, 8], [1, 2, 5, null, null, null], { left: { 0: "done", 1: "done" }, right: { 0: "done" } }, "输出 5")),
  f("比较 9 与 6，输出 6", mergeScene([2, 5, 9], [1, 6, 8], [1, 2, 5, 6, null, null], { left: { 0: "done", 1: "done" }, right: { 0: "done", 1: "done" } }, "输出 6")),
  f("比较 9 与 8，输出 8，右段取完", mergeScene([2, 5, 9], [1, 6, 8], [1, 2, 5, 6, 8, null], { left: { 0: "done", 1: "done" }, right: { 0: "done", 1: "done", 2: "done" } }, "输出 8")),
  f("右段空，左段剩余的 9 直接搬到输出区，合并完成", mergeScene([2, 5, 9], [1, 6, 8], [1, 2, 5, 6, 8, 9], { left: { 0: "done", 1: "done", 2: "done" }, right: { 0: "done", 1: "done", 2: "done" }, out: { 0: "done", 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" } }, "合并完成")),
];

const ANIMATIONS = {
  "anim-list-insert": listInsert,
  "anim-stack-ops": stackOps,
  "anim-queue-ops": queueOps,
  "anim-tree-traversal": treeTraversal,
  "anim-bst-search": bstSearch,
  "anim-heap-sift": heapSift,
  "anim-graph-bfs": bfsFrames,
  "anim-graph-dfs": dfsFrames,
  "anim-hash-chain": hashChain,
  "anim-insertion-sort": insertionSort,
  "anim-bubble-sort": bubbleSort,
  "anim-quick-sort": quickSort,
  "anim-selection-sort": selectionSort,
  "anim-heap-sort": heapSortA,
  "anim-merge-sort": mergeSortFrames,
};

const DANGEROUS = /<\s*(script|iframe|object|embed|style|link|meta)\b|on(error|load|click)\s*=|\bjavascript:/i;

function build() {
  const entries = [];
  for (const [key, frames] of Object.entries(ANIMATIONS)) {
    const rows = frames.map((frame) => {
      const svg = renderSvg(frame.scene);
      if (DANGEROUS.test(svg)) throw new Error("动图 " + key + " 含危险片段");
      if (DANGEROUS.test(frame.caption)) throw new Error("动图 " + key + " 说明含危险片段");
      return "    { caption: " + JSON.stringify(frame.caption) + ", svg: " + JSON.stringify(svg) + " },";
    });
    entries.push("  " + JSON.stringify(key) + ": [\n" + rows.join("\n") + "\n  ],");
  }
  const header = [
    "/**",
    " * 算法 SVG 动图（数据结构知识点配套）。",
    " *",
    " * 由 `scripts/ds-bank/svg.mjs` 生成，请勿手改。每个 key 对应一组按帧播放的 SVG：",
    " * 渲染层自动逐帧切换，Web 内联 SVG、移动端 react-native-svg 的 SvgXml 均可播放。",
    " * 只用 presentation attribute，不含 <style>/<script>/on*=/javascript:。",
    " */",
    "export interface AlgorithmAnimationFrame {",
    "  caption: string;",
    "  svg: string;",
    "}",
    "",
    "export const algorithmAnimations: Record<string, AlgorithmAnimationFrame[]> = {",
  ].join("\n");
  const footer = "};\n\nexport const algorithmAnimationKeys = Object.keys(algorithmAnimations);\n";
  return header + "\n" + entries.join("\n") + "\n" + footer;
}

export const ANIMATION_KEYS = Object.keys(ANIMATIONS);

if (process.argv[1] && process.argv[1].endsWith("svg.mjs")) {
  const target = "packages/content/src/learning/algorithm-animations.ts";
  fs.writeFileSync(target, build(), "utf8");
  let frameCount = 0;
  for (const frames of Object.values(ANIMATIONS)) frameCount += frames.length;
  console.log("[ds-anim] 写入 " + target + "：" + Object.keys(ANIMATIONS).length + " 个动图 / " + frameCount + " 帧");
}
