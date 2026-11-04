import * as React from "react";
import { cn } from "@/lib/utils";
import { parseMarkdownLite, type MdBlock } from "@/lib/md-lite";
import { RichText } from "@/components/rich-text";

/**
 * MD 导入的学习内容渲染器（内容主题正文）。
 *
 * v2.3：行内不再只切反引号代码，统一走 `RichText`（shared parseInlineRich）——
 * `**加粗**` / `` `代码` `` / `$公式$` / `\(公式\)` 都按 token 渲染成原生节点，
 * 标题、列表、引用、段落共用同一条行内路径，正文里不会再露出标记符号。
 * 结构块仍由 parseMarkdownLite 解析，不注入 HTML。
 */
function Inline({ text }: { text: string }) {
  return <RichText text={text} />;
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
