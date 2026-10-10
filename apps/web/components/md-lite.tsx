import * as React from "react";
import { cn } from "@/lib/utils";
import { splitInlineCode, parseMarkdownLite, type MdBlock } from "@/lib/md-lite";

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, index) =>
        part.code ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {part.value}
          </code>
        ) : (
          <React.Fragment key={index}>{part.value}</React.Fragment>
        )
      )}
    </>
  );
}

function Heading({ level, text }: { level: number; text: string }) {
  const className = cn(
    "font-semibold text-foreground",
    level <= 1 && "text-base",
    level === 2 && "text-[0.95rem]",
    level >= 3 && "text-sm text-muted-foreground"
  );
  return React.createElement(`h${Math.min(6, Math.max(3, level + 2))}`, { className }, <Inline text={text} />);
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "heading":
      return <Heading level={block.level} text={block.text} />;
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-3">
          <code className="font-mono text-xs leading-relaxed text-foreground">{block.code}</code>
        </pre>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
          <Inline text={block.text} />
        </blockquote>
      );
    case "paragraph":
      return (
        <p className="leading-relaxed text-muted-foreground">
          <Inline text={block.text} />
        </p>
      );
    default:
      return null;
  }
}

/** 渲染 MD 导入的学习内容：结构块 → React 文本节点，不注入 HTML（无 XSS 面） */
export function MarkdownLite({ markdown, className }: { markdown: string; className?: string }) {
  const blocks = parseMarkdownLite(markdown);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-2.5 text-sm", className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
