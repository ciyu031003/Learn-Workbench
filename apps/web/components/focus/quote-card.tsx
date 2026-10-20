"use client";

import { useState } from "react";
import { Check, Pencil, Quote } from "lucide-react";
import { QUOTES } from "@/components/quote-widget";
import { useFocusBgStore } from "@/store/focus-bg-store";

/** 每日一言（可自定义，写 focus-bg store）。S8-a 从 focus-timer.tsx 原样搬出。 */
export function QuoteCard() {
  const bg = useFocusBgStore();
  const [quote, setQuote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const shownQuote = bg.customQuote ? { text: bg.customQuote, author: undefined as string | undefined } : quote;

  const saveQuote = () => {
    const v = quoteInput.trim();
    if (v) {
      bg.setCustomQuote(v);
      setQuote({ text: v });
    } else {
      bg.setCustomQuote(null);
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }
    setEditingQuote(false);
  };

  return (
    <div className="glass flex max-w-lg flex-col gap-1.5 rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Quote className="size-3.5" /> 励志短句
        </span>
        <button
          onClick={() => {
            setEditingQuote((v) => !v);
            setQuoteInput(bg.customQuote ?? "");
          }}
          className="rounded-lg p-1 text-white/60 transition-all hover:bg-white/15 hover:text-white"
          aria-label="编辑励志短句"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      {editingQuote ? (
        <div className="flex items-center gap-2">
          <input
            value={quoteInput}
            onChange={(e) => setQuoteInput(e.target.value)}
            placeholder="输入你的励志短句…"
            className="h-9 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70 placeholder:text-white/40"
          />
          <button
            onClick={saveQuote}
            className="rounded-lg border border-white/25 bg-white/15 p-2 text-white transition-all hover:bg-white/25"
            aria-label="保存"
          >
            <Check className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-white/90">{shownQuote.text}</p>
          {shownQuote.author ? (
            <span className="self-end text-xs text-white/60">—— {shownQuote.author}</span>
          ) : null}
        </>
      )}
    </div>
  );
}
