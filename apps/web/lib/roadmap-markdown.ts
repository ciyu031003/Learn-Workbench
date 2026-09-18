/**
 * 学习路线 Markdown 解析（v6 P3-2）
 *
 * 规则（与方案文档一致）：
 *   # H1  → 阶段（content_phases）
 *   ## H2 → 主题（content_topics）
 *   ### H3 → 主题内的「学习内容」条目（content_topic_items），H3 到下一个标题之间的正文存 content_md
 *   #### H4+ → 归入当前条目的内容行（原样保留，前端再渲染）
 *
 * 容错：代码块内的 # 不计；缺 H1 时自动建「导入的学习内容」阶段；缺 H2 时自动建「默认主题」；
 * 空标题忽略；标题超长按层级截断；CRLF 归一。纯函数，无 I/O —— 由 /api/roadmap/import 调用（dryRun 时做预览）。
 */

export interface ParsedTopicItem {
  title: string;
  contentMd: string;
}

export interface ParsedTopic {
  title: string;
  summary: string | null;
  items: ParsedTopicItem[];
}

export interface ParsedPhase {
  title: string;
  summary: string | null;
  topics: ParsedTopic[];
}

export const MD_ROADMAP_LIMITS = {
  phase: 60,
  topic: 80,
  item: 80,
  summary: 200,
  maxPhases: 50,
  maxTopics: 500,
  maxItems: 2000,
} as const;

export const MD_DEFAULT_PHASE_TITLE = "导入的学习内容";
export const MD_DEFAULT_TOPIC_TITLE = "默认主题";

function truncate(value: string, max: number): string {
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** 解析 ATX 标题；返回 null 表示不是标题（或标题为空） */
function heading(line: string): { level: number; title: string } | null {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  if (!m) return null;
  const title = m[2].replace(/\s+#+\s*$/, "").trim();
  if (!title) return null;
  return { level: m[1].length, title };
}

/** 取正文里第一个有内容的行，去掉列表/引用标记，作为阶段或主题的 summary */
function firstNonEmptyLine(lines: string[]): string | null {
  for (const line of lines) {
    const t = line.replace(/^\s*(?:[-*+>]|\d+\.)\s*/, "").trim();
    if (t) return truncate(t, MD_ROADMAP_LIMITS.summary);
  }
  return null;
}

export function parseRoadmapMarkdown(markdown: string): ParsedPhase[] {
  const text = String(markdown ?? "").replace(/\r\n?/g, "\n");
  const phases: ParsedPhase[] = [];
  let phase: ParsedPhase | null = null;
  let topic: ParsedTopic | null = null;
  let item: ParsedTopicItem | null = null;
  let body: string[] = [];
  let inFence = false;

  const ensurePhase = (): ParsedPhase => {
    if (!phase) {
      phase = { title: MD_DEFAULT_PHASE_TITLE, summary: null, topics: [] };
      phases.push(phase);
    }
    return phase;
  };
  const ensureTopic = (): ParsedTopic => {
    const p = ensurePhase();
    if (!topic) {
      topic = { title: MD_DEFAULT_TOPIC_TITLE, summary: null, items: [] };
      p.topics.push(topic);
    }
    return topic;
  };
  /** 遇到下一个标题时收尾：正文归给条目，或作为阶段/主题的 summary */
  const closeSection = () => {
    if (item) item.contentMd = body.join("\n").trim();
    else if (topic) topic.summary = topic.summary ?? firstNonEmptyLine(body);
    else if (phase) phase.summary = phase.summary ?? firstNonEmptyLine(body);
    body = [];
  };

  for (const line of text.split("\n")) {
    if (/^\s*(?:```|~~~)/.test(line)) inFence = !inFence;
    const h = inFence ? null : heading(line);
    if (!h) {
      // 第一个标题之前的引言丢弃，避免污染第一个阶段/主题的 summary
      if (phase) body.push(line);
      continue;
    }
    closeSection();
    if (h.level === 1) {
      phase = { title: truncate(h.title, MD_ROADMAP_LIMITS.phase), summary: null, topics: [] };
      phases.push(phase);
      topic = null;
      item = null;
    } else if (h.level === 2) {
      const p = ensurePhase();
      topic = { title: truncate(h.title, MD_ROADMAP_LIMITS.topic), summary: null, items: [] };
      p.topics.push(topic);
      item = null;
    } else if (h.level === 3) {
      const t = ensureTopic();
      item = { title: truncate(h.title, MD_ROADMAP_LIMITS.item), contentMd: "" };
      t.items.push(item);
    } else {
      ensureTopic();
      body.push(`${'#'.repeat(h.level)} ${h.title}`);
    }
  }
  closeSection();
  return phases;
}

export function countParsed(phases: ParsedPhase[]): { phases: number; topics: number; items: number } {
  let topics = 0;
  let items = 0;
  for (const p of phases) {
    topics += p.topics.length;
    for (const t of p.topics) items += t.items.length;
  }
  return { phases: phases.length, topics, items };
}
