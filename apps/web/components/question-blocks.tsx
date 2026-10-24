import { Fragment } from "react";
import { parseQuestionBlocks, type QuestionBlock } from "@learn-workbench/shared/md-lite";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";

/**
 * 题库块级富文本（408 真题 / 面试题的题干与答案）。
 *
 * 为什么不复用 `MarkdownLite`：标准 markdown 会把段落内的手工换行合并成一句，
 * 而题干里的换行是排版语义（伪代码、`[ data | link ]` 结构图、①②③ 分步）。
 * `parseQuestionBlocks` 保留原始行，这里逐行渲染 `RichText` 行内标记。
 */
function Block({ block }: { block: QuestionBlock }) {
  switch (block.type) {
    case "heading": {
      const size = block.level <= 2 ? "text-sm" : "text-xs";
      return (
        <p className={cn("font-semibold text-foreground", size)}>
          <RichText text={block.text} />
        </p>
      );
    }
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-3">
          <code className="font-mono text-xs leading-relaxed text-foreground">{block.code}</code>
        </pre>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {block.rows.map((row, i) => (
                <tr
                  key={i}
                  className={
                    i === 0
                      ? "bg-muted/50 font-semibold text-foreground"
                      : "text-muted-foreground even:bg-muted/20"
                  }
                >
                  {row.map((cell, j) => (
                    <td key={j} className="border border-border/50 px-2.5 py-1.5 leading-relaxed">
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-inside list-decimal space-y-1">
          {block.items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              <RichText text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-inside list-disc space-y-1">
          {block.items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap leading-relaxed">
          {block.lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 ? "\n" : null}
              <RichText text={line} />
            </Fragment>
          ))}
        </p>
      );
    default:
      return null;
  }
}

export function QuestionBlocks({
  text,
  className,
  compact,
}: {
  text: string;
  className?: string;
  /** 紧凑场景（选项内、对比栏）压一档间距 */
  compact?: boolean;
}) {
  const blocks = parseQuestionBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2.5", className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
