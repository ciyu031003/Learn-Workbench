import { Fragment } from "react";
import { Info, MonitorPlay, Sigma } from "lucide-react";

import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";
import type { StudyBlock } from "@/lib/exam-408-study";

/**
 * 408 精读正文渲染器（cs408.cloud Markdown 镜像）。
 *
 * 输入是 lib/exam-408-study 解析好的结构块（纯数据，可序列化），这里只做「原生节点」渲染：
 * 不注入 HTML、不用 dangerouslySetInnerHTML，因此外部 Markdown 里的标签（含 iframe）不会执行。
 *
 * 版面目标（用户反馈「密集干巴」）：
 *  - 段落 1.9 行高 + 段间距，长文可读；
 *  - 标题带锚点、留白更大，便于跳读；
 *  - 表格横向滚动、代码块等宽、公式单独成块、提示块做成 callout、插图带图注；
 *  - 交互图谱（iframe）不内嵌脚本，改成「去原文看」的占位卡。
 */
export function MarkdownArticle({
  blocks,
  sourceUrl,
  className,
}: {
  blocks: StudyBlock[];
  /** 原文链接：交互图谱 / 外链图片的出入口 */
  sourceUrl?: string | null;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col gap-4 text-[0.9375rem] leading-[1.9] text-foreground/90", className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} sourceUrl={sourceUrl} />
      ))}
    </article>
  );
}

function BlockView({ block, sourceUrl }: { block: StudyBlock; sourceUrl?: string | null }) {
  switch (block.type) {
    case "heading": {
      // 一级标题就是文章标题（页面头部已经渲染），正文里跳过避免重复
      if (block.level <= 1) return null;
      const size =
        block.level === 2
          ? "mt-4 text-lg font-semibold tracking-tight"
          : block.level === 3
            ? "mt-2 text-base font-semibold tracking-tight"
            : "mt-1 text-sm font-semibold";
      const Tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
      return (
        <Tag id={block.id} className={cn("group scroll-mt-24 text-foreground", size)}>
          <a href={"#" + block.id} className="inline-flex items-baseline gap-1.5 hover:text-primary">
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
        <p className="whitespace-pre-wrap">
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
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full border-collapse text-sm">
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
        <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/40">
          {block.lang ? (
            <div className="border-b border-border/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {block.lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4">
            <code className="font-mono text-[0.8125rem] leading-relaxed text-foreground">{block.code}</code>
          </pre>
        </div>
      );
    case "quote":
      return (
        <aside className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
          <Info className="mt-1 size-4 shrink-0 text-primary" />
          <div className="flex min-w-0 flex-col gap-1">
            {block.lines.map((line, index) => (
              <p key={index}>
                <RichText text={line} />
              </p>
            ))}
          </div>
        </aside>
      );
    case "image":
      return <ArticleImage src={block.src} alt={block.alt} />;
    case "math":
      return (
        <div className="flex items-center gap-3 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <Sigma className="size-4 shrink-0 text-muted-foreground" />
          <code className="whitespace-pre font-mono text-[0.8125rem] leading-7 text-foreground">{block.tex}</code>
        </div>
      );
    case "iframe":
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
      return <hr className="my-2 border-border/60" />;
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
    <ListTag className={cn("flex flex-col gap-1.5 pl-5 marker:text-muted-foreground", outerClass)}>
      {groups.map((group, index) => (
        <li key={index} className="pl-1">
          <RichText text={group.text} />
          {group.children.length > 0 ? (
            <ul className="mt-1.5 flex list-[circle] flex-col gap-1 pl-5 marker:text-muted-foreground/70">
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
    <figure className="flex flex-col gap-2">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-border/60 bg-white p-2"
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
