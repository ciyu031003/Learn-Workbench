"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Quote } from "lucide-react";

const QUOTES: { text: string; author?: string }[] = [
  { text: "每天前进 1%，一年后你就是 37.8 倍的自己。", author: "学习复利" },
  { text: "HCIP 不是终点，能讲清楚、能演示、能写进简历，才是真的会。", author: "验收标准" },
  { text: "费曼技巧：教不会别人，就说明还没真正学会。", author: "学习方法" },
  { text: "先跑通最小闭环，再谈完美——完成比完美重要。", author: "行动原则" },
  { text: "刻意练习：只练跳一跳够得着的题，并记录错误原因。", author: "刻意练习" },
  { text: "输出倒逼输入，一篇复盘、一个演示，胜过十节收藏的课。", author: "输出式学习" },
  { text: "Anki 间隔重复，是对遗忘曲线最好的尊重。", author: "记忆方法" },
  { text: "网络、数据、云运维、Agent——一条主线，交叉推进，避免同质化疲劳。", author: "双轨制" },
  { text: "每一行配置、每一条 SQL、每一个 Agent，都是未来简历上的项目资产。", author: "项目资产" },
  { text: "专注 25 分钟，胜过心不在焉的两小时。", author: "番茄专注" },
  { text: "模拟面试是最快的反馈闭环：能答出来，才算掌握。", author: "反馈闭环" },
  { text: "工具会过时，但解决问题的能力永远稀缺。", author: "ICT 心法" },
];

export function QuoteWidget({ className }: { className?: string }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % QUOTES.length);
  }, []);

  useEffect(() => {
    timer.current = setInterval(next, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [next]);

  const quote = QUOTES[index];

  return (
    <div className={className}>
      <div className="glass glass-hover flex max-w-md flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Quote className="size-3.5" /> 每日一言
          </span>
          <button
            onClick={next}
            aria-label="换一句"
            className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/15 hover:text-foreground"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{quote.text}</p>
        {quote.author ? (
          <span className="self-end text-xs text-muted-foreground">—— {quote.author}</span>
        ) : null}
      </div>
    </div>
  );
}
