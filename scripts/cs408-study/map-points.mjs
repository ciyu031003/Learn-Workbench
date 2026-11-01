#!/usr/bin/env node
/**
 * 408 知识点映射：把 cs408 精读(181)/速记卡(529)/演示/真题 挂到专区 99 个知识点上（迁移 085/086/087）。
 *
 * 用法：
 *   node scripts/cs408-study/map-points.mjs --dry-run [--verbose] [--cards=N]   # 只算不写，输出覆盖率报告
 *   node scripts/cs408-study/map-points.mjs --apply   [--verbose]                # 事务写入 knowledge_point_key
 *   （--verbose 打印 181 篇精读的逐条映射；--cards=N 每科等距抽 N 张速记卡，便于人工抽查）
 *
 * 映射思路（与 scripts/cs408-study/import.mjs 的 CHAPTER_MAP 一致，按科目+章节收窄候选）：
 *   1) 章节标题 → 专区章节前缀（如「线性数据结构」→ ds-03，「总线和输入输出系统」→ co-06/co-07 两章）；
 *      速记卡的 chapter 是序号，用 SUBJECT 内的序号表映射到同样的章节前缀。
 *   2) 候选只在同科目同章节的知识点里选，避免跨章误挂；章节标题没命中时退化为整科候选。
 *   3) 命中优先级：
 *      a. 章节级文章（「📊 章节知识图谱」「必看 · XX 补充考点」）→ 本章第一个知识点（合并章按标题关键词分流）；
 *      b. 人工兜底 OVERRIDES（标题正则，只在候选内生效）→ 纠正「浮点数格式」这类包含关系误配；
 *      c. 标题完全相等 > 标题互相包含（长度差越小越可信，同分用正文相似度决胜）；
 *      d. 标题 + 正文的 bigram TF-IDF 余弦。
 *      速记卡另有 CROSS_CHAPTER_OVERRIDES：源站分章偏粗时（如 AVL 被分到树章）拉回正确章节。
 *   4) 演示先按「同一 demo_key 的速记卡投票」定知识点，没有票再走标题+逐帧说明的余弦。
 *   5) 幂等：只更新 knowledge_point_key 与目标不一致的行，可反复重跑。
 *
 * 连接：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD（默认 127.0.0.1/Learn-Workbench/postgres）。
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const args = new Set(process.argv.slice(2));
const MODE = args.has("--apply") ? "apply" : args.has("--dry-run") ? "dry-run" : "";
const VERBOSE = args.has("--verbose");
/** --cards=N：抽样打印 N 张速记卡的映射，便于人工抽查（0=不打印）。 */
const CARD_SAMPLE = (() => {
  const flag = process.argv.slice(2).find((value) => value.startsWith("--cards="));
  const count = flag ? Number(flag.slice("--cards=".length)) : 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
})();
if (!MODE) {
  console.error("用法：node scripts/cs408-study/map-points.mjs --dry-run|--apply [--verbose]");
  process.exit(2);
}

/** 验收门槛：精读 ≥90%、速记卡 ≥85%、演示 ≥80%（库里还没有演示时按 EMPTY 跳过，不算失败）。 */
const TARGETS = { topics: 0.9, cards: 0.85, demos: 0.8 };

/**
 * 精读章节标题 → 专区章节前缀列表（一章可能拆成两章，如组成原理的「总线和输入输出系统」）。
 * 与 import.mjs 的 CHAPTER_MAP 同源，另补上 cs408 实际用的标题写法。
 */
const TOPIC_CHAPTER_MAP = {
  "data-structure": {
    绪论: ["ds-01"],
    线性表: ["ds-02"],
    线性数据结构: ["ds-03"],
    字符串: ["ds-03"],
    树与二叉树: ["ds-04"],
    图: ["ds-05"],
    查找: ["ds-06"],
    排序: ["ds-07"],
  },
  "computer-organization": {
    概述: ["co-01"],
    计算机系统概述: ["co-01"],
    数据表示和计算: ["co-02"],
    数据的表示和运算: ["co-02"],
    存储系统: ["co-03"],
    存储器层次结构: ["co-03"],
    指令系统: ["co-04"],
    中央处理器: ["co-05"],
    总线: ["co-06"],
    总线系统: ["co-06"],
    "总线和输入输出系统": ["co-06", "co-07"],
    "输入/输出系统": ["co-07"],
    输入输出系统: ["co-07"],
  },
  "operating-system": {
    计算机系统概述: ["os-01"],
    操作系统概述: ["os-01"],
    操作系统基础: ["os-01"],
    进程管理: ["os-02"],
    内存管理: ["os-03"],
    文件管理: ["os-04"],
    "I/O 管理": ["os-05"],
    "输入/输出管理": ["os-05"],
    输入输出管理: ["os-05"],
  },
  "computer-network": {
    计算机网络体系结构: ["cn-01"],
    物理层: ["cn-02"],
    数据链路层: ["cn-03"],
    网络层: ["cn-04"],
    传输层: ["cn-05"],
    应用层: ["cn-06"],
  },
};

/**
 * 章节整体挂到单一知识点的例外：数据结构把「串」并进 ds-03，但串的 4 篇文章都只对应 ds-03-05。
 * 章节级文章（知识图谱/补充考点）与其它串文章都走这个提示，避免落到本章第一个点（栈）。
 */
const CHAPTER_POINT_HINT = {
  "data-structure|字符串": "ds-03-05",
};

/**
 * 速记卡 chapter（序号）→ 专区章节前缀。
 * 数据结构在 cs408 里把「串」单列一章（8 章），专区把串并进 ds-03（栈、队列和数组）。
 */
const CARD_CHAPTER_MAP = {
  "data-structure": {
    1: ["ds-01"],
    2: ["ds-02"],
    3: ["ds-03"],
    4: ["ds-03"],
    5: ["ds-04"],
    6: ["ds-05"],
    7: ["ds-06"],
    8: ["ds-07"],
  },
  "computer-organization": {
    1: ["co-01"],
    2: ["co-02"],
    3: ["co-03"],
    4: ["co-04"],
    5: ["co-05"],
    6: ["co-06"],
    7: ["co-07"],
  },
  "operating-system": { 1: ["os-01"], 2: ["os-02"], 3: ["os-03"], 4: ["os-04"], 5: ["os-05"] },
  "computer-network": {
    1: ["cn-01"],
    2: ["cn-02"],
    3: ["cn-03"],
    4: ["cn-04"],
    5: ["cn-05"],
    6: ["cn-06"],
  },
};

/**
 * 人工兜底：标题正则 → 专区知识点 key 尾段。只在「本章候选内」生效（不会跨章误拉），
 * 顺序敏感（先写更具体的规则，例如「一位乘」要在「原码」之前）。
 */
const OVERRIDES = [
  // 数据结构
  { subject: "data-structure", pattern: /双链表|循环链表|静态链表/, point: "ds-02-03" },
  { subject: "data-structure", pattern: /链式队列|双端队列|循环队列/, point: "ds-03-02" },
  { subject: "data-structure", pattern: /模式匹配|KMP|串的定义|字符串/, point: "ds-03-05" },
  { subject: "data-structure", pattern: /^二叉树$/, point: "ds-04-03" },
  { subject: "data-structure", pattern: /线索二叉树|二叉树的遍历/, point: "ds-04-04" },
  { subject: "data-structure", pattern: /森林|树的存储结构|转换/, point: "ds-04-05" },
  { subject: "data-structure", pattern: /分块查找/, point: "ds-06-01" },
  { subject: "data-structure", pattern: /平衡二叉树|AVL|红黑树|树形查找/, point: "ds-06-02" },
  { subject: "data-structure", pattern: /B ?\+? ?树/, point: "ds-06-03" },
  { subject: "data-structure", pattern: /散列表|散列|哈希/, point: "ds-06-04" },
  { subject: "data-structure", pattern: /外部排序|多路归并/, point: "ds-07-08" },
  { subject: "data-structure", pattern: /基数排序|计数排序/, point: "ds-07-06" },
  { subject: "data-structure", pattern: /归并排序/, point: "ds-07-05" },
  { subject: "data-structure", pattern: /快速排序|快排|冒泡排序/, point: "ds-07-03" },
  { subject: "data-structure", pattern: /选择排序|堆排序|堆$/, point: "ds-07-04" },
  { subject: "data-structure", pattern: /插入排序|希尔/, point: "ds-07-02" },
  { subject: "data-structure", pattern: /内部排序/, point: "ds-07-07" },
  // 组成原理
  { subject: "computer-organization", pattern: /乘法|除法|乘除|一位乘|一位除|Booth|加减交替|运算电路|加法器|溢出|移位/, point: "co-02-02" },
  { subject: "computer-organization", pattern: /奇偶校验|海明|CRC|校验/, point: "co-02-01" },
  { subject: "computer-organization", pattern: /整数的表示|定点数的表示|原码|补码|移码/, point: "co-02-01" },
  { subject: "computer-organization", pattern: /^存储系统$|存储系统概述|存储器层次结构/, point: "co-03-01" },
  { subject: "computer-organization", pattern: /对齐|标志位|条件码|条件转移/, point: "co-04-03" },
  { subject: "computer-organization", pattern: /多模块/, point: "co-03-02" },
  { subject: "computer-organization", pattern: /Cache|高速缓存/, point: "co-03-05" },
  { subject: "computer-organization", pattern: /虚拟存储器/, point: "co-03-06" },
  { subject: "computer-organization", pattern: /外存/, point: "co-03-04" },
  { subject: "computer-organization", pattern: /指令集|CISC|RISC/, point: "co-04-04" },
  { subject: "computer-organization", pattern: /寻址|格式/, point: "co-04-02" },
  { subject: "computer-organization", pattern: /高级语言|机器码/, point: "co-04-03" },
  { subject: "computer-organization", pattern: /数据通路/, point: "co-05-02" },
  { subject: "computer-organization", pattern: /控制器/, point: "co-05-03" },
  { subject: "computer-organization", pattern: /异常与中断|异常和中断/, point: "co-05-04" },
  { subject: "computer-organization", pattern: /指令执行/, point: "co-05-05" },
  { subject: "computer-organization", pattern: /流水/, point: "co-05-06" },
  { subject: "computer-organization", pattern: /超标量|多核|多处理机|多处理器/, point: "co-05-07" },
  { subject: "computer-organization", pattern: /总线仲裁|总线带宽|总线事务|定时/, point: "co-06-02" },
  { subject: "computer-organization", pattern: /^总线$|总线概述/, point: "co-06-01" },
  { subject: "computer-organization", pattern: /I\/O ?接口|端口/, point: "co-07-02" },
  { subject: "computer-organization", pattern: /I\/O ?方式|DMA|程序查询/, point: "co-07-03" },
  { subject: "computer-organization", pattern: /I\/O|输入输出/, point: "co-07-01" },
  // 操作系统
  { subject: "operating-system", pattern: /管程|经典同步|信号量/, point: "os-02-03" },
  { subject: "operating-system", pattern: /进程通信|IPC/, point: "os-02-01" },
  { subject: "operating-system", pattern: /处理机调度|CPU 调度/, point: "os-02-02" },
  { subject: "operating-system", pattern: /连续内存|动态分区|段式|段页式/, point: "os-03-01" },
  { subject: "operating-system", pattern: /工作集|抖动/, point: "os-03-02" },
  { subject: "operating-system", pattern: /磁盘空间|空闲空间/, point: "os-04-03" },
  { subject: "operating-system", pattern: /^文件$|文件的物理结构/, point: "os-04-01" },
  { subject: "operating-system", pattern: /文件共享|文件保护/, point: "os-04-02" },
  { subject: "operating-system", pattern: /缓冲技术|缓冲区|SPOOLing|假脱机/, point: "os-05-02" },
  { subject: "operating-system", pattern: /设备管理|设备分配/, point: "os-05-02" },
  { subject: "operating-system", pattern: /^磁盘$|磁盘调度/, point: "os-05-03" },
  { subject: "operating-system", pattern: /I\/O 设备|设备分类/, point: "os-05-01" },
  // 计算机网络
  { subject: "computer-network", pattern: /编码和调制|奈奎斯特|香农|交换方式|同步传输|异步传输/, point: "cn-02-01" },
  { subject: "computer-network", pattern: /流量控制|滑动窗口|可靠传输/, point: "cn-03-03" },
  { subject: "computer-network", pattern: /ALOHA|介质访问|信道利用率/, point: "cn-03-04" },
  { subject: "computer-network", pattern: /PPP/, point: "cn-03-01" },
  { subject: "computer-network", pattern: /VLAN|局域网|广域网/, point: "cn-03-05" },
  { subject: "computer-network", pattern: /粘包|字节流/, point: "cn-05-03" },
  { subject: "computer-network", pattern: /IPv6/, point: "cn-04-03" },
  { subject: "computer-network", pattern: /ARP|DHCP|ICMP|NAT|IP 数据报分片|分片|Ping|CIDR|最长前缀|前缀匹配/, point: "cn-04-02" },
  { subject: "computer-network", pattern: /路由算法|路由协议|RIP|OSPF|BGP/, point: "cn-04-04" },
  { subject: "computer-network", pattern: /SDN|拥塞/, point: "cn-04-01" },
  { subject: "computer-network", pattern: /DNS/, point: "cn-06-02" },
  { subject: "computer-network", pattern: /HTTP|HTTPS|万维网|TLS|SSL/, point: "cn-06-05" },
  { subject: "computer-network", pattern: /电子邮件|SMTP|POP3|IMAP/, point: "cn-06-04" },
  { subject: "computer-network", pattern: /FTP|文件传输/, point: "cn-06-03" },
];

/**
 * 跨章兜底：速记卡的 chapter 是源站粗略分章，个别卡片的知识点实际在别的章。
 * 只在「本章候选里没有任何标题命中」时生效，用于纠正如「平衡因子调整」被分到树章的情况。
 */
const CROSS_CHAPTER_OVERRIDES = [
  { subject: "data-structure", pattern: /平衡二叉树|AVL|平衡因子|旋转调整/, point: "ds-06-02" },
];

/** 章节级文章（知识图谱 / 补充考点）：语义上覆盖整章，统一挂到本章第一个知识点。 */
const GENERIC_TITLE = /知识图谱|补充考点|章节总览/;

/** 合并章节（组成原理「总线和输入输出系统」）里，按标题关键词把章节级文章分到对应章。 */
const GENERIC_CHAPTER_HINTS = [
  { subject: "computer-organization", pattern: /总线/, chapters: ["co-06"] },
  { subject: "computer-organization", pattern: /I\/O|输入输出/, chapters: ["co-07"] },
  { subject: "data-structure", pattern: /串|模式匹配/, chapters: ["ds-03"] },
];

const PREFIX = "beokayy-408/";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
}

function tokenize(value) {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, " ")
    .trim();
  const tokens = [];
  for (const part of text.split(/\s+/)) {
    if (!part) continue;
    if (/^[a-z0-9]+$/.test(part)) {
      if (part.length >= 2 && part.length <= 24) tokens.push(part);
      continue;
    }
    const chars = [...part];
    if (chars.length === 1) {
      tokens.push(chars[0]);
      continue;
    }
    for (let i = 0; i + 1 < chars.length; i += 1) tokens.push(chars[i] + chars[i + 1]);
  }
  return tokens;
}

function termCounts(text) {
  const counts = new Map();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function buildIdf(documents) {
  const df = new Map();
  for (const doc of documents) {
    for (const term of new Set(tokenize(doc))) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const total = Math.max(1, documents.length);
  const idf = new Map();
  for (const [term, count] of df) idf.set(term, Math.log(1 + total / count));
  return {
    weight: (term) => idf.get(term) ?? Math.log(1 + total),
  };
}

function vectorize(text, idf) {
  const counts = termCounts(text);
  const vector = new Map();
  let norm = 0;
  for (const [term, count] of counts) {
    const weight = (1 + Math.log(count)) * idf.weight(term);
    vector.set(term, weight);
    norm += weight * weight;
  }
  const length = Math.sqrt(norm) || 1;
  for (const [term, weight] of vector) vector.set(term, weight / length);
  return vector;
}

function cosine(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  return dot;
}

/** 标题比较前去掉「的/与/和/及/等/其」这类虚词，避免「计算机系统的层次结构」漏配「计算机系统层次结构」。 */
function normalizeTitle(value) {
  return normalizeText(value).replace(/[的地得与和及等其]/gu, "");
}

/** 标题命中：完全相等 1.0；互相包含时按长度差给分（差越小越可信）；不命中 0。 */
function titleMatch(topicTitle, pointTitle) {
  const topic = normalizeTitle(topicTitle);
  const point = normalizeTitle(pointTitle);
  if (!topic || !point) return 0;
  if (topic === point) return 1;
  const min = Math.min(topic.length, point.length);
  if (min < 2) return 0;
  if (topic.includes(point)) return 0.9 - Math.min(0.08, (topic.length - point.length) * 0.01);
  if (point.includes(topic)) return 0.88 - Math.min(0.08, (point.length - topic.length) * 0.01);
  return 0;
}

function trimText(value, max) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
}

function subjectSlug(subjectKey) {
  const raw = String(subjectKey ?? "");
  return raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
}

function parseMode() {
  return MODE;
}

async function loadData(client) {
  // pg 同一连接不允许并发 query：这里逐条 await（181+529 行，串行也够快）。
  const points = await client.query(
    `SELECT key, subject_key, chapter_key, point_number, sort_order, title, summary, body
       FROM exam_408_knowledge_points
      WHERE status = 'published'
      ORDER BY subject_key, chapter_key, sort_order, point_number`,
  );
  const topics = await client.query(
    `SELECT key, subject_key, chapter, chapter_order, sort_order, title, content_md, knowledge_point_key
       FROM exam_408_study_topics
      WHERE status = 'published'
      ORDER BY subject_key, chapter_order, sort_order, key`,
  );
  const cards = await client.query(
    `SELECT key, subject_key, chapter, sort_order, question, answer_steps, pitfall, mnemonic, demo_key,
            knowledge_point_key
       FROM exam_408_cards
      WHERE status = 'published'
      ORDER BY subject_key, chapter, sort_order, key`,
  );
  const demos = await client.query(
    `SELECT key, subject_key, title, description, steps, knowledge_point_key
       FROM exam_408_demos
      WHERE status = 'published'
      ORDER BY subject_key, sort_order, key`,
  );
  return {
    points: points.rows,
    topics: topics.rows,
    cards: cards.rows,
    demos: demos.rows,
  };
}

function buildPointIndex(points) {
  const documents = points.map((row) =>
    [
      String(row.title ?? ""),
      String(row.title ?? ""),
      String(row.title ?? ""),
      String(row.title ?? ""),
      String(row.summary ?? ""),
      Array.isArray(row.body) ? row.body.join("") : "",
    ].join(" "),
  );
  const idf = buildIdf(documents);
  const entries = points.map((row, index) => ({
    key: row.key,
    slug: subjectSlug(row.subject_key),
    chapterKey: String(row.chapter_key ?? ""),
    chapterPrefix: String(row.chapter_key ?? "").replace(PREFIX, ""),
    pointNumber: Number(row.point_number ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    title: String(row.title ?? ""),
    titleNormalized: normalizeText(row.title),
    vector: vectorize(documents[index], idf),
    titleVector: vectorize(String(row.title ?? "") + " " + String(row.title ?? ""), idf),
  }));
  const bySubject = new Map();
  for (const entry of entries) {
    const list = bySubject.get(entry.slug) ?? [];
    list.push(entry);
    bySubject.set(entry.slug, list);
  }
  return { idf, entries, bySubject };
}

function candidatesForChapter(index, slug, chapterPrefixes) {
  const all = index.bySubject.get(slug) ?? [];
  const prefixes = (chapterPrefixes ?? []).map((prefix) => String(prefix).replace(PREFIX, ""));
  if (prefixes.length === 0) return all;
  const scoped = all.filter((entry) => prefixes.includes(entry.chapterPrefix));
  return scoped.length > 0 ? scoped : all;
}

function firstPointOf(candidates) {
  return [...candidates].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.pointNumber - right.pointNumber || left.key.localeCompare(right.key),
  )[0];
}

function pickPoint(index, slug, chapterPrefixes, text, titleText, options = {}) {
  let candidates = candidatesForChapter(index, slug, chapterPrefixes);
  if (candidates.length === 0) return null;
  const title = String(titleText ?? "");

  // 0) 章节级文章（知识图谱 / 补充考点）：语义覆盖整章，统一挂本章第一个知识点。
  if (options.allowGeneric && GENERIC_TITLE.test(title)) {
    const hint = GENERIC_CHAPTER_HINTS.find((rule) => rule.subject === slug && rule.pattern.test(title));
    if (hint) {
      const narrowed = candidates.filter((entry) => hint.chapters.includes(entry.chapterPrefix));
      if (narrowed.length > 0) candidates = narrowed;
    }
    return { entry: firstPointOf(candidates), score: 1, method: "chapter" };
  }

  // 1) 人工兜底：只对标题做正则匹配（正文命中太容易误挂，例如「磁盘」）；
  //    放在标题命中之前，用来纠正「二叉树→二叉树的遍历」这类包含关系误配。
  const override = applyOverride(slug, title, candidates);
  if (override) return override;

  // 1.5) 跨章兜底（源站分章偏粗时，把明确属于别章的知识点拉回正确章节）。
  const cross = applyCrossOverride(slug, title, index);
  if (cross) return cross;

  // 2) 标题命中（完全相等 > 互相包含；包含按长度差越近越可信；同分用正文相似度决胜）。
  const vector = vectorize(trimText(text, 8000), index.idf);
  let best = null;
  for (const entry of candidates) {
    const match = titleMatch(title, entry.title);
    if (match <= 0) continue;
    const contentScore = cosine(vector, entry.vector);
    if (!best || match > best.match || (match === best.match && contentScore > best.contentScore)) {
      best = { entry, match, contentScore, score: match, method: match >= 1 ? "title" : "contains" };
    }
  }
  if (best) return best;

  // 3) 正文 bigram TF-IDF 余弦（内容相似度 + 标题相似度加权）。
  for (const entry of candidates) {
    const contentScore = cosine(vector, entry.vector);
    const titleScore = cosine(vectorize(title, index.idf), entry.titleVector);
    const score = contentScore * 0.65 + titleScore * 0.35;
    if (!best || score > best.score) best = { entry, score, method: "content" };
  }
  return best;
}

function applyCrossOverride(slug, titleText, index) {
  for (const rule of CROSS_CHAPTER_OVERRIDES) {
    if (rule.subject !== slug) continue;
    if (!rule.pattern.test(titleText)) continue;
    const target = index.entries.find((entry) => entry.key === PREFIX + rule.point);
    if (target) return { entry: target, score: 1, method: "cross-chapter" };
  }
  return null;
}

function applyOverride(slug, titleText, candidates) {
  // 只在本章节候选内生效：兜底规则不得把章节 A 的文章拉到章节 B（例如组成原理「浮点数格式」被 /格式/ 拉到寻址方式）。
  const scoped = new Map(candidates.map((entry) => [entry.key, entry]));
  for (const rule of OVERRIDES) {
    if (rule.subject !== slug) continue;
    if (!rule.pattern.test(titleText)) continue;
    const target = scoped.get(PREFIX + rule.point);
    if (target) return { entry: target, score: 1, method: "override" };
  }
  return null;
}

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
    database: process.env.PGDATABASE || "Learn-Workbench",
  });
  const client = await pool.connect();
  try {
    const data = await loadData(client);
    const index = buildPointIndex(data.points);
    const pointByKey = new Map(index.entries.map((entry) => [entry.key, entry]));

    const assignments = { topics: new Map(), cards: new Map(), demos: new Map() };
    const methods = { topics: new Map(), cards: new Map(), demos: new Map() };
    const unmapped = { topics: [], cards: [], demos: [] };

    const record = (bucket, rowKey, result) => {
      if (!result) {
        unmapped[bucket].push(rowKey);
        return;
      }
      assignments[bucket].set(rowKey, result.entry.key);
      const counter = methods[bucket];
      counter.set(result.method, (counter.get(result.method) ?? 0) + 1);
    };

    // 精读
    for (const row of data.topics) {
      const slug = subjectSlug(row.subject_key);
      const chapterName = String(row.chapter ?? "").trim();
      const chapters = TOPIC_CHAPTER_MAP[slug]?.[chapterName] ?? null;
      const hinted = CHAPTER_POINT_HINT[slug + "|" + chapterName];
      const hintedEntry = hinted ? pointByKey.get(PREFIX + hinted) : null;
      record(
        "topics",
        row.key,
        hintedEntry
          ? { entry: hintedEntry, score: 1, method: "chapter" }
          : pickPoint(index, slug, chapters, String(row.content_md ?? ""), String(row.title ?? ""), { allowGeneric: true }),
      );
    }

    // 速记卡：先按卡自身的章节序号收窄，再按题干+答案匹配。
    for (const row of data.cards) {
      const slug = subjectSlug(row.subject_key);
      const chapter = Number(row.chapter ?? 0);
      const chapters = CARD_CHAPTER_MAP[slug]?.[chapter] ?? null;
      const text = [
        String(row.question ?? ""),
        Array.isArray(row.answer_steps) ? row.answer_steps.join(" ") : "",
        String(row.pitfall ?? ""),
        String(row.mnemonic ?? ""),
      ].join(" ");
      record("cards", row.key, pickPoint(index, slug, chapters, text, String(row.question ?? "")));
    }

    // 演示：按标题+描述+逐帧说明，全科内选；卡片里已有 demo_key 的优先投票。
    const demoVotes = new Map();
    for (const row of data.cards) {
      if (!row.demo_key || !assignments.cards.has(row.key)) continue;
      const pointKey = assignments.cards.get(row.key);
      const bucket = demoVotes.get(row.demo_key) ?? new Map();
      bucket.set(pointKey, (bucket.get(pointKey) ?? 0) + 1);
      demoVotes.set(row.demo_key, bucket);
    }
    for (const row of data.demos) {
      const slug = subjectSlug(row.subject_key);
      const text = [
        String(row.title ?? ""),
        String(row.description ?? ""),
        Array.isArray(row.steps)
          ? row.steps.map((step) => String(step?.explain ?? "")).join(" ")
          : "",
      ].join(" ");
      const votes = demoVotes.get(row.key);
      if (votes && votes.size > 0) {
        const [pointKey] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
        const entry = pointByKey.get(pointKey);
        record("demos", row.key, entry ? { entry, score: 1, method: "card-vote" } : null);
        continue;
      }
      record("demos", row.key, pickPoint(index, slug, null, text, String(row.title ?? "")));
    }

    // ---- 报告 ----
    const report = { topics: {}, cards: {}, demos: {} };
    const summarize = (bucket, rows) => {
      const total = rows.length;
      let mapped = 0;
      const bySubject = new Map();
      for (const row of rows) {
        const slug = subjectSlug(row.subject_key);
        const stat = bySubject.get(slug) ?? { total: 0, mapped: 0 };
        stat.total += 1;
        if (assignments[bucket].has(row.key)) {
          stat.mapped += 1;
          mapped += 1;
        }
        bySubject.set(slug, stat);
      }
      report[bucket] = { total, mapped, bySubject };
    };
    summarize("topics", data.topics);
    summarize("cards", data.cards);
    summarize("demos", data.demos);

    const rate = (bucket) => {
      const { total, mapped } = report[bucket];
      return total === 0 ? 1 : mapped / total;
    };

    console.log("[map-points] mode=" + MODE + " points=" + index.entries.length);
    const fmt = (bucket, label, target) => {
      const { total, mapped } = report[bucket];
      const pct = total === 0 ? 100 : Math.round((mapped / total) * 1000) / 10;
      const verdict = total === 0 ? "EMPTY" : rate(bucket) >= target ? "PASS" : "FAIL";
      console.log(
        "[" + label + "] total=" + total + " mapped=" + mapped + " (" + pct + "%) target>=" + Math.round(target * 100) + "% " + verdict,
      );
      for (const [slug, stat] of report[bucket].bySubject) {
        console.log("  - " + slug + ": " + stat.mapped + "/" + stat.total);
      }
      const methodText = [...methods[bucket].entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "=" + v).join(" ");
      console.log("  method: " + (methodText || "-"));
      if (unmapped[bucket].length > 0) {
        console.log("  unmapped: " + unmapped[bucket].slice(0, 10).join(", ") + (unmapped[bucket].length > 10 ? " …" : ""));
      }
    };
    fmt("topics", "topics", TARGETS.topics);
    fmt("cards", "cards", TARGETS.cards);
    fmt("demos", "demos", TARGETS.demos);

    if (VERBOSE) {
      console.log("\n--- 精读映射明细（章节 | 文章 → 知识点）---");
      for (const row of data.topics) {
        const pointKey = assignments.topics.get(row.key);
        const point = pointKey ? pointByKey.get(pointKey) : null;
        const chapter = TOPIC_CHAPTER_MAP[subjectSlug(row.subject_key)]?.[String(row.chapter ?? "").trim()];
        console.log(
          "  " + String(row.chapter) + " | " + String(row.title) + " → " + (point ? point.chapterPrefix + "-" + point.pointNumber + " " + point.title : "(未映射)") + " [" + (chapter ? chapter.join(",") : "全科") + "]",
        );
      }
    }

    if (CARD_SAMPLE > 0) {
      console.log("\n--- 速记卡抽样（每科等距抽 " + CARD_SAMPLE + " 张）---");
      const bySlug = new Map();
      for (const row of data.cards) {
        const slug = subjectSlug(row.subject_key);
        const list = bySlug.get(slug) ?? [];
        list.push(row);
        bySlug.set(slug, list);
      }
      for (const [slug, list] of bySlug) {
        const step = Math.max(1, Math.floor(list.length / CARD_SAMPLE));
        for (let index = 0, printed = 0; index < list.length && printed < CARD_SAMPLE; index += step, printed += 1) {
          const row = list[index];
          const pointKey = assignments.cards.get(row.key);
          const point = pointKey ? pointByKey.get(pointKey) : null;
          console.log(
            "  " + slug + " ch" + row.chapter + " | " + trimText(String(row.question ?? ""), 40) + " → " + (point ? point.chapterPrefix + "-" + point.pointNumber + " " + point.title : "(未映射)"),
          );
        }
      }
    }

    const changed = { topics: 0, cards: 0, demos: 0 };
    const pending = { topics: [], cards: [], demos: [] };
    const collect = (bucket, rows) => {
      for (const row of rows) {
        const next = assignments[bucket].get(row.key) ?? null;
        if (next !== (row.knowledge_point_key ?? null)) pending[bucket].push([row.key, next]);
      }
    };
    collect("topics", data.topics);
    collect("cards", data.cards);
    collect("demos", data.demos);

    if (MODE === "dry-run") {
      console.log(
        "\n[map-points] dry-run：将更新 topics=" + pending.topics.length + " cards=" + pending.cards.length + " demos=" + pending.demos.length,
      );
      const ok =
        rate("topics") >= TARGETS.topics &&
        rate("cards") >= TARGETS.cards &&
        rate("demos") >= TARGETS.demos;
      console.log("[map-points] 覆盖率验收：" + (ok ? "PASS" : "FAIL"));
      if (!ok) process.exitCode = 1;
      return;
    }

    await client.query("BEGIN");
    try {
      const write = async (table, bucket) => {
        const byPoint = new Map();
        for (const [key, pointKey] of pending[bucket]) {
          const list = byPoint.get(pointKey ?? null) ?? [];
          list.push(key);
          byPoint.set(pointKey ?? null, list);
        }
        let updated = 0;
        for (const [pointKey, keys] of byPoint) {
          const result = await client.query(
            "UPDATE " + table + " SET knowledge_point_key = $1 WHERE key = ANY($2::text[])",
            [pointKey, keys],
          );
          updated += result.rowCount ?? 0;
          changed[bucket] += result.rowCount ?? 0;
        }
        return updated;
      };
      const t = await write("exam_408_study_topics", "topics");
      const c = await write("exam_408_cards", "cards");
      const d = await write("exam_408_demos", "demos");
      await client.query("COMMIT");
      console.log("[map-points] 已写入 topics=" + t + " cards=" + c + " demos=" + d);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    // 写入后复核覆盖率（从库里重读，确认持久化正确）
    const verify = async (table) => {
      const { rows } = await client.query(
        "SELECT count(*)::int AS total, count(knowledge_point_key)::int AS mapped FROM " + table + " WHERE status = 'published'",
      );
      return rows[0];
    };
    const vTopics = await verify("exam_408_study_topics");
    const vCards = await verify("exam_408_cards");
    const vDemos = await verify("exam_408_demos");
    const topicsOk = vTopics.total === 0 || vTopics.mapped / vTopics.total >= TARGETS.topics;
    const cardsOk = vCards.total === 0 || vCards.mapped / vCards.total >= TARGETS.cards;
    const demosOk = vDemos.total === 0 || vDemos.mapped / vDemos.total >= TARGETS.demos;
    console.log(
      "[map-points] 复核：topics " + vTopics.mapped + "/" + vTopics.total + (topicsOk ? " PASS" : " FAIL") +
        "，cards " + vCards.mapped + "/" + vCards.total + (cardsOk ? " PASS" : " FAIL") +
        "，demos " + vDemos.mapped + "/" + vDemos.total + (demosOk ? " PASS" : " FAIL"),
    );
    if (!topicsOk || !cardsOk || !demosOk) process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[map-points] 失败：" + error.message);
  process.exit(1);
});
