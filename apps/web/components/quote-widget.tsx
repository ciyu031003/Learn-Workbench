"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Quote } from "lucide-react";

export const QUOTES: { text: string; author?: string }[] = [
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

export function QuoteWidget({
  className,
  variant = "card",
}: {
  className?: string;
  variant?: "card" | "inline";
}) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % QUOTES.length);
  }, []);

  useEffect(() => {
    // 客户端随机起始句，避免 SSR 水合不一致
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(Math.floor(Math.random() * QUOTES.length));
    timer.current = setInterval(next, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [next]);

  const quote = QUOTES[index];

  if (variant === "inline") {
    return (
      <div className={className}>
        <style dangerouslySetInnerHTML={{ __html: QUOTE_CSS }} />
        <div className="lwb-quote-inline flex min-h-full flex-col gap-1.5 pl-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-strong">
              <Quote className="size-3.5" /> 每日一言
            </span>
            <button
              onClick={next}
              aria-label="换一句"
              className="rounded-lg p-1.5 text-muted-foreground transition-all active:rotate-90 hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          <p key={"quote-" + index} className="quote-fade text-sm leading-relaxed text-foreground">{quote.text}</p>
          {quote.author ? (
            <span key={"author-" + index} className="quote-fade self-end text-xs text-muted-foreground">
              —— {quote.author}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <style dangerouslySetInnerHTML={{ __html: QUOTE_CSS }} />
      <div className="paper-card paper-hover lwb-quote flex max-w-md flex-col gap-2 overflow-hidden p-4">
        {/* 巨型引号水印：只做氛围，永远待在文字后面 */}
        <span className="lwb-quote-mark" aria-hidden>
          &ldquo;
        </span>
        <div className="relative z-[1] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Quote className="size-3.5" /> 每日一言
          </span>
          <button
            onClick={next}
            aria-label="换一句"
            className="lwb-quote-refresh rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <p key={"quote-" + index} className="quote-fade lwb-quote-text relative z-[1] text-sm leading-relaxed text-foreground">
          {quote.text}
        </p>
        {quote.author ? (
          <span key={"author-" + index} className="quote-fade relative z-[1] self-end text-xs text-muted-foreground">
            —— {quote.author}
          </span>
        ) : null}
        {/* 轮播进度条：与 8s 定时器同周期，换句时重新开始 */}
        <span key={"bar-" + index} className="lwb-quote-bar" aria-hidden />
      </div>
    </div>
  );
}

/**
 * 每日一言的动效样式（v1.27 Web 精修）。
 * 全部为纯 CSS；prefers-reduced-motion 下关掉位移与进度条，文字仍然正常显示。
 */
const QUOTE_CSS = [
  ".lwb-quote{position:relative;isolation:isolate}",
  ".lwb-quote-mark{position:absolute;top:-18px;right:8px;z-index:0;font-family:Georgia,'Times New Roman',serif;font-size:88px;font-weight:800;line-height:1;color:color-mix(in srgb,var(--color-primary) 13%,transparent);pointer-events:none;user-select:none}",
  ".lwb-quote-text{animation:lwb-quote-in .5s cubic-bezier(.22,.68,.32,1) both}",
  "@keyframes lwb-quote-in{from{opacity:0;transform:translate3d(0,7px,0)}to{opacity:1;transform:none}}",
  ".lwb-quote-bar{position:absolute;left:0;bottom:0;height:2px;width:100%;transform-origin:left;background:linear-gradient(90deg,var(--color-primary),var(--color-accent));opacity:.7;animation:lwb-quote-bar 8s linear both}",
  "@keyframes lwb-quote-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
  ".lwb-quote-refresh{transition:transform .45s cubic-bezier(.22,.68,.32,1),background-color .2s,color .2s}",
  ".lwb-quote-refresh:hover{transform:rotate(-90deg)}",
  ".lwb-quote-refresh:active{transform:rotate(-180deg)}",
  ".lwb-quote-inline{position:relative}",
  ".lwb-quote-inline::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;border-radius:9999px;background:linear-gradient(180deg,var(--color-primary),var(--color-accent));transform-origin:top;animation:lwb-quote-grow .6s cubic-bezier(.22,.68,.32,1) both}",
  "@keyframes lwb-quote-grow{from{transform:scaleY(.25);opacity:0}to{transform:scaleY(1);opacity:1}}",
  "@media (prefers-reduced-motion:reduce){.lwb-quote-text,.lwb-quote-bar,.lwb-quote-inline::before{animation:none}.lwb-quote-bar{display:none}.lwb-quote-refresh{transition:none}}",
].join("\n");


