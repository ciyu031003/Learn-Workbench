import { Fragment, type ReactNode } from "react";
import katex from "katex";
import { Info, MonitorPlay } from "lucide-react";

import { InteractiveEmbed } from "@/components/exam/interactive-embed";
import { KnowledgeMap } from "@/components/exam/knowledge-map";
import { isKnowledgeMapBlock, type Exam408MapPresentation } from "@/lib/exam-408-map";

import { cn } from "@/lib/utils";
import type { StudyBlock } from "@/lib/exam-408-study";

/**
 * 408 精读正文渲染器（cs408.cloud Markdown 镜像）。
 *
 * 输入是 lib/exam-408-study 解析好的结构块（纯数据，可序列化），这里只做原生节点渲染：
 * 外部 Markdown 里的 HTML/iframe 不会执行；唯一的 HTML 注入点是 KaTeX 生成的公式 DOM
 * （trust: false、throwOnError: false，输入来自自家内容库，且失败时回退源码）。
 *
 * 公式渲染：$...$ / \(...\) 行内公式、以及解析器产出的 math 块（$$...$$）全部用 KaTeX 排版。
 * KaTeX 只在本组件（服务端）执行，不会把 ~270KB 的 katex.js 打进客户端首载包。
 *
 * 版面（用户反馈「公式显示源码 / 正文干巴」）：
 *  - 正文 15.5px、行高 1.95，段落/列表/标题之间留足气口；
 *  - 表格横滚 + zebra、代码块带语言条、提示块做成 callout、图片带图注；
 *  - 块级公式居中并可横向滚动，行内公式按字体比例缩放。
 */
export function MarkdownArticle({
  blocks,
  sourceUrl,
  knowledgeMap,
  className,
}: {
  blocks: StudyBlock[];
  /** 原文链接：交互图谱 / 外链图片的出入口 */
  sourceUrl?: string | null;
  /** 章节知识图谱（服务端预计算的展示数据）：命中 knowledge-map iframe 时渲染原生 SVG，不再给外链 */
  knowledgeMap?: Exam408MapPresentation | null;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 text-[15.5px] leading-[1.95] text-foreground/90 [&>*:first-child]:mt-0",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} sourceUrl={sourceUrl} knowledgeMap={knowledgeMap} />
      ))}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 公式：KaTeX（服务端渲染成 HTML 字符串）                              */
/* ------------------------------------------------------------------ */

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false as const,
  trust: false,
  output: "html" as const,
  macros: { "\\R": "\\mathbb{R}" },
};

function renderTex(tex: string, displayMode: boolean): string | null {
  const source = String(tex ?? "").trim();
  if (!source) return null;
  try {
    return katex.renderToString(source, { ...KATEX_OPTIONS, displayMode });
  } catch {
    return null;
  }
}

/** 块级公式：渲染失败时回退源码（带「源码」标签），不会整段吞掉。 */
function MathBlock({ tex }: { tex: string }) {
  const html = renderTex(tex, true);
  const ok = html !== null && !html.includes("katex-error");
  return (
    <div className="my-1 flex flex-col gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
      {ok ? (
        <div
          className="text-center text-foreground [&_.katex-display]:my-0 [&_.katex]:text-[1.06em]"
          // KaTeX 输出：trust:false + throwOnError:false，来源为自家内容库
          dangerouslySetInnerHTML={{ __html: html as string }}
        />
      ) : (
        <>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">公式源码</span>
          <code className="whitespace-pre font-mono text-[13px] leading-6 text-foreground">{tex}</code>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 行内富文本：**强调** / 反引号代码 / $公式$（含长公式）               */
/* ------------------------------------------------------------------ */

type InlineToken = { type: "text" | "code" | "strong" | "math"; value: string };

/**
 * 行内标记解析。
 *
 * 为什么不用共享的 parseInlineRich：它把 $...$ 限制在 40 字符以内（避免误伤 $VAR），
 * 但 408 精读里有 445 处行内公式超过 40 字符（最长 168），全被当成文本原样显示；
 * 这里放宽到 240 字符，并保留「纯数字不当公式」的保守口径（避免把金额 $100 渲染成公式）。
 * 同时补上共享解析器支持的 `\(...\)` LaTeX 行内定界符（真题答案里 150+ 处），
 * 保证精读正文与题库/知识点正文的行内公式口径一致。
 */
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]{1,200}\*\*)|(\\\([^\\\n]{1,160}?\\\))|(\$[^$\n]{1,240}\$)/g;

function lookLikeMath(inner: string): boolean {
  if (!inner) return false;
  if (inner !== inner.trim()) return false;
  // 资料里 $...$ 既表示数学式，也用来标注数值/数列；实测 10111 处候选 KaTeX 全部可排版，
  // 因此这里只挡「首尾有空格」这类明显配对错误，渲染失败再回退成纯文本。
  return true;
}

export function parseInlineTokens(text: string): InlineToken[] {
  const source = String(text ?? "");
  if (!source) return [];
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE_RE)) {
    const raw = match[0];
    const index = match.index ?? 0;
    let token: InlineToken | null = null;
    if (raw.startsWith("`")) token = { type: "code", value: raw.slice(1, -1) };
    else if (raw.startsWith("**")) token = { type: "strong", value: raw.slice(2, -2) };
    else if (raw.startsWith("\\(")) {
      const inner = raw.slice(2, -2).trim();
      if (inner) token = { type: "math", value: inner };
    } else if (raw.startsWith("$")) {
      const inner = raw.slice(1, -1);
      if (lookLikeMath(inner)) token = { type: "math", value: inner };
    }
    if (!token) continue;
    if (index > last) tokens.push({ type: "text", value: source.slice(last, index) });
    tokens.push(token);
    last = index + raw.length;
  }
  if (last < source.length) tokens.push({ type: "text", value: source.slice(last) });
  return tokens.length > 0 ? tokens : [{ type: "text", value: source }];
}

/** 行内文本渲染（含 KaTeX 行内公式）。 */
function RichText({ text }: { text: string }) {
  return <>{renderInlineTokens(parseInlineTokens(text), 0)}</>;
}

/**
 * 行内 token → React 节点。
 *
 * 注意 **强调** 内部也可能夹公式（如「别把 $n/2$ 与 $(n-1)/2$ 记混」整句加粗），
 * 所以 strong 的内容要再走一遍解析（depth 限制防递归）。
 */
function renderInlineTokens(tokens: InlineToken[], depth: number): ReactNode {
  if (tokens.length === 1 && tokens[0]?.type === "text") {
    return tokens[0].value;
  }
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === "strong") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {depth < 3 ? renderInlineTokens(parseInlineTokens(token.value), depth + 1) : token.value}
            </strong>
          );
        }
        if (token.type === "code") {
          return (
            <code
              key={index}
              className="rounded-md bg-muted/70 px-1 py-0.5 font-mono text-[0.88em] text-foreground"
            >
              {token.value}
            </code>
          );
        }
        if (token.type === "math") {
          const html = renderTex(token.value, false);
          if (html && !html.includes("katex-error")) {
            return (
              <span
                key={index}
                className="[&_.katex]:text-[1.02em]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          // 排版失败：退回纯文本（不再显示 $ 定界符，避免看起来像源码）
          return (
            <span key={index} className="font-mono text-[0.92em] text-foreground">
              {token.value}
            </span>
          );
        }
        return <Fragment key={index}>{token.value}</Fragment>;
      })}
    </>
  );
}

/** 导出给页面头部摘要用：摘要里也可能带 $公式$，用同一套行内渲染避免露出源码。 */
export function InlineRichText({ text, className }: { text: string; className?: string }) {
  return <span className={className}><RichText text={text} /></span>;
}

/* ------------------------------------------------------------------ */
/* 块渲染                                                              */
/* ------------------------------------------------------------------ */

function BlockView({
  block,
  sourceUrl,
  knowledgeMap,
}: {
  block: StudyBlock;
  sourceUrl?: string | null;
  knowledgeMap?: Exam408MapPresentation | null;
}) {
  switch (block.type) {
    case "heading": {
      // 一级标题就是文章标题（页面头部已经渲染），正文里跳过避免重复
      if (block.level <= 1) return null;
      const style =
        block.level === 2
          ? "mt-9 text-[1.3rem] leading-snug"
          : block.level === 3
            ? "mt-7 text-[1.08rem] leading-snug"
            : "mt-5 text-[0.98rem]";
      const Tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
      return (
        <Tag id={block.id} className={cn("group scroll-mt-28 font-semibold tracking-tight text-foreground", style)}>
          <a href={"#" + block.id} className="inline-flex items-baseline gap-2 hover:text-primary-strong">
            <RichText text={block.text} />
            <span className="text-xs font-normal text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">
              #
            </span>
          </a>
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap text-pretty">
          {block.lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 ? <br /> : null}
              <RichText text={line} />
            </Fragment>
          ))}
        </p>
      );
    case "list":
      return <ArticleList block={block} />;
    case "table":
      return (
        <div className="my-1 overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full border-collapse text-[13.5px] leading-[1.7]">
            <thead>
              <tr className="bg-muted/50">
                {block.header.map((cell, index) => (
                  <th
                    key={index}
                    className="border-b border-border/60 px-3 py-2 text-left font-semibold text-foreground"
                  >
                    <RichText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 1 ? "bg-muted/20" : undefined}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-border/40 px-3 py-2 align-top"
                      style={{ textAlign: block.align[cellIndex] ?? "left" }}
                    >
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <div className="my-1 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
          {block.lang ? (
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-3 py-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{block.lang}</span>
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4">
            <code className="font-mono text-[13px] leading-[1.75] text-foreground">{block.code}</code>
          </pre>
        </div>
      );
    case "quote":
      return (
        <aside className="my-1 flex gap-2.5 rounded-r-lg border-l-2 border-primary/60 bg-primary/[0.05] py-2.5 pl-4 pr-3 text-[14.5px] leading-[1.85]">
          <Info className="mt-1 size-4 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-col gap-1.5">
            {block.lines.map((line, index) => (
              <p key={index} className="text-foreground/85">
                <RichText text={line} />
              </p>
            ))}
          </div>
        </aside>
      );
    case "image":
      return <ArticleImage src={block.src} alt={block.alt} />;
    case "math":
      return <MathBlock tex={block.tex} />;
    case "iframe":
      // 章节知识图谱：渲染原生 SVG（数据来自迁移 088），彻底去掉 iframe 与外链
      if (knowledgeMap && isKnowledgeMapBlock(block)) {
        // key 保证换章节时重置缩放/平移状态（组件内部不再用 effect 重置）
        return <KnowledgeMap key={knowledgeMap.key} data={knowledgeMap} />;
      }
      // cs408 交互可视化（KMP/树/图/排序/流水线等 35 页）已静态镜像到本站，用本地 iframe 渲染
      if (block.src.startsWith("/content-interactive/")) {
        return <InteractiveEmbed src={block.src} title={block.title} />;
      }
      return (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <MonitorPlay className="size-4 text-primary" />
            {block.title || "交互式知识图谱"}
          </span>
          <span>该图谱是交互页面，为避免在精读页加载外部脚本，这里只保留入口。</span>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              去原文查看交互图谱
            </a>
          ) : null}
        </div>
      );
    case "divider":
      return <hr className="my-3 border-border/60" />;
    default:
      return null;
  }
}

function ArticleList({ block }: { block: Extract<StudyBlock, { type: "list" }> }) {
  // 两层缩进：depth 0 是外层，depth 1 挂到上一个外层项下面
  const groups: Array<{ text: string; children: string[] }> = [];
  for (const item of block.items) {
    if (item.depth === 0 || groups.length === 0) groups.push({ text: item.text, children: [] });
    else groups.at(-1)!.children.push(item.text);
  }
  const ListTag = block.ordered ? "ol" : "ul";
  const outerClass = block.ordered ? "list-decimal" : "list-disc";
  return (
    <ListTag className={cn("my-1 flex flex-col gap-2 pl-6 marker:text-muted-foreground", outerClass)}>
      {groups.map((group, index) => (
        <li key={index} className="pl-1">
          <RichText text={group.text} />
          {group.children.length > 0 ? (
            <ul className="mt-2 flex list-[circle] flex-col gap-1.5 pl-5 marker:text-muted-foreground/70">
              {group.children.map((child, childIndex) => (
                <li key={childIndex} className="pl-1">
                  <RichText text={child} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ListTag>
  );
}

function ArticleImage({ src, alt }: { src: string; alt: string }) {
  const local = src.startsWith("/") && !src.startsWith("//");
  if (!local) {
    return (
      <span className="text-sm text-muted-foreground">
        外链图片：{alt || src}（
        <a href={src} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          打开
        </a>
        ）
      </span>
    );
  }
  return (
    <figure className="my-2 flex flex-col gap-2">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-border/60 bg-white p-2 transition-colors hover:border-primary/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 本地 SVG 原图，next/image 对 SVG 需额外 dangerouslyAllowSVG 配置 */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="mx-auto h-auto max-w-full object-contain"
        />
      </a>
      {alt ? <figcaption className="text-center text-xs text-muted-foreground">{alt}</figcaption> : null}
    </figure>
  );
}

export type { StudyBlock };
