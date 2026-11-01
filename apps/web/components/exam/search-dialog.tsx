"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpen,
  FileText,
  Layers3,
  ListChecks,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 408 专区全局搜索弹窗（P5，⌘K / Ctrl+K）。
 *
 * 为什么这里不 import @/lib/exam-408-search：
 * 该模块顶层 import 了 @/lib/db（pg 连接池），是 server-only；客户端组件若引用它，
 * 会把 pg 拉进浏览器包。这里只复制「高亮切分」这一个 20 行纯函数与最小类型，
 * 排序/查询口径仍以 API（lib/exam-408-search.ts）为准。
 *
 * 交互：Cmd/Ctrl+K 开合；输入 200ms 防抖请求；分类 tab；↑↓ 选择、Enter 跳转、Esc 关闭；
 * 移动端全屏；结果用 combobox + listbox + aria-activedescendant 暴露给读屏。
 */

type SearchKind = "point" | "study" | "card" | "question";

const KIND_ORDER: SearchKind[] = ["point", "study", "card", "question"];

const KIND_LABELS: Record<SearchKind, string> = {
  point: "知识点",
  study: "精读",
  card: "速记卡",
  question: "真题",
};

const KIND_ICONS: Record<SearchKind, typeof BookOpen> = {
  point: BookOpen,
  study: FileText,
  card: Layers3,
  question: ListChecks,
};

interface SearchHit {
  kind: SearchKind;
  key: string;
  title: string;
  snippet: string;
  href: string;
  meta: string;
}

interface SearchGroup {
  kind: SearchKind;
  label: string;
  total: number;
  hits: SearchHit[];
}

interface SearchResult {
  query: string;
  total: number;
  limit: number;
  groups: SearchGroup[];
}

const EXAMPLE_QUERIES = ["死锁", "ASL", "Dijkstra", "三次握手"];

const EMPTY_HINT = "搜知识点标题/摘要、精读标题、速记卡问题、真题题干";

/** 与 lib/exam-408-search 的 highlightSearchText 同口径（客户端安全副本）。 */
function splitHighlight(text: string, query: string): Array<{ text: string; match: boolean }> {
  const source = text ?? "";
  const needle = query.trim().toLowerCase();
  if (!source) return [];
  if (!needle) return [{ text: source, match: false }];
  const haystack = source.toLowerCase();
  const segments: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) {
      segments.push({ text: source.slice(cursor), match: false });
      break;
    }
    if (index > cursor) segments.push({ text: source.slice(cursor, index), match: false });
    segments.push({ text: source.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  return segments.filter((segment) => segment.text.length > 0);
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  const segments = splitHighlight(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="rounded-[3px] bg-primary/15 px-0.5 font-medium text-primary-strong"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

const SUBSCRIBE_NOOP = () => () => {};

function readShortcutLabel(): string {
  const platform = typeof navigator === "undefined" ? "" : navigator.platform ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘K" : "Ctrl K";
}

/**
 * 快捷键文案：用 useSyncExternalStore 读 navigator，避免「effect 里 setState」
 * 触发级联渲染（仓库的 react-hooks 规则会拦），服务端快照固定 ⌘K。
 */
function useCommandShortcutLabel(): string {
  return React.useSyncExternalStore(SUBSCRIBE_NOOP, readShortcutLabel, () => "⌘K");
}

export function Exam408SearchDialog({ className }: { className?: string }) {
  const router = useRouter();
  const shortcutLabel = useCommandShortcutLabel();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeKind, setActiveKind] = React.useState<"all" | SearchKind>("all");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  /* 全局快捷键：⌘K / Ctrl+K 开合 */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* 关闭时复位，下次打开是干净状态 */
  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResult(null);
      setStatus("idle");
      setActiveKind("all");
      setActiveIndex(-1);
    }
  }, []);

  /* 200ms 防抖 + AbortController（输入快时取消上一次请求） */
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const controller = new AbortController();
    // 所有 setState 都放到定时器/异步回调里：effect 体内同步 setState 会触发级联渲染（lint 规则）。
    const timer = window.setTimeout(() => {
      if (!trimmed) {
        setResult(null);
        setStatus("idle");
        setActiveIndex(-1);
        return;
      }
      setStatus("loading");
      fetch("/api/exam/408/search?q=" + encodeURIComponent(trimmed), {
        signal: controller.signal,
        headers: { accept: "application/json" },
      })
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json() as Promise<SearchResult>;
        })
        .then((data) => {
          setResult(data);
          setStatus("ready");
          setActiveIndex(data.total > 0 ? 0 : -1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("error");
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, retryNonce]);

  const visibleGroups = React.useMemo(() => {
    if (!result) return [] as SearchGroup[];
    if (activeKind === "all") return result.groups.filter((group) => group.hits.length > 0);
    return result.groups.filter((group) => group.kind === activeKind);
  }, [result, activeKind]);

  const flatHits = React.useMemo(
    () => visibleGroups.flatMap((group) => group.hits),
    [visibleGroups],
  );

  // 结果变化后不写 effect 重置（lint）；渲染期夹取，越界自然回到 0。
  const resolvedActiveIndex =
    flatHits.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), flatHits.length - 1);

  /* 当前高亮项滚进可视区 */
  React.useEffect(() => {
    if (resolvedActiveIndex < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      "[data-search-index='" + resolvedActiveIndex + "']",
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [resolvedActiveIndex]);

  const go = React.useCallback(
    (hit: SearchHit | undefined) => {
      if (!hit) return;
      setOpen(false);
      setQuery("");
      setResult(null);
      setStatus("idle");
      router.push(hit.href);
    },
    [router],
  );

  const onContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (flatHits.length === 0) return;
    const current = Math.max(0, resolvedActiveIndex);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current + 1) % flatHits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current - 1 + flatHits.length) % flatHits.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flatHits.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(flatHits[resolvedActiveIndex]);
    }
  };

  const tabs: Array<{ key: "all" | SearchKind; label: string; count: number | null }> = [
    { key: "all", label: "全部", count: result ? result.total : null },
    ...KIND_ORDER.map((kind) => ({
      key: kind,
      label: KIND_LABELS[kind],
      count: result ? result.groups.find((group) => group.kind === kind)?.hits.length ?? 0 : null,
    })),
  ];

  let flatOffset = 0;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("gap-2", className)}
      >
        <Search className="size-4" aria-hidden="true" />
        搜索 408
        <kbd className="ml-1 hidden rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          {shortcutLabel}
        </kbd>
      </Button>

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
            onKeyDown={onContentKeyDown}
            className="dialog-content fixed left-1/2 top-[10dvh] z-[80] flex max-h-[80dvh] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--elev-3)] outline-none max-sm:inset-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none max-sm:border-0"
          >
            <Dialog.Title className="sr-only">搜索 408 内容</Dialog.Title>

            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                role="combobox"
                aria-label="搜索 408 知识点、精读、速记卡与真题"
                aria-expanded={status === "ready" && flatHits.length > 0}
                aria-controls="exam-408-search-results"
                aria-activedescendant={
                  resolvedActiveIndex >= 0
                    ? "exam-408-search-option-" + resolvedActiveIndex
                    : undefined
                }
                placeholder="搜索知识点 / 精读 / 速记卡 / 真题…"
                autoComplete="off"
                spellCheck={false}
                className="h-8 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {status === "loading" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : null}
              <Dialog.Close
                aria-label="关闭搜索"
                className="press-soft rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="-mx-0 flex gap-1.5 overflow-x-auto border-b border-border/60 px-4 py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={activeKind === tab.key}
                  onClick={() => {
                    setActiveKind(tab.key);
                    setActiveIndex(0);
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    activeKind === tab.key
                      ? "border-primary/35 bg-primary/10 font-medium text-primary-strong"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.count !== null ? (
                    <span className="tabular-nums text-[10px] opacity-80">{tab.count}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <p aria-live="polite" className="sr-only">
              {status === "loading"
                ? "搜索中"
                : status === "ready"
                  ? "找到 " + (result?.total ?? 0) + " 条结果"
                  : status === "error"
                    ? "搜索失败"
                    : ""}
            </p>

            <div
              ref={listRef}
              id="exam-408-search-results"
              role="listbox"
              aria-label="408 搜索结果"
              className="min-h-[9rem] flex-1 overflow-y-auto overscroll-contain px-2 py-2 max-sm:flex-1"
            >
              {status === "idle" ? (
                <div className="flex flex-col gap-3 px-2 py-4">
                  <p className="text-xs text-muted-foreground">{EMPTY_HINT}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">试试：</span>
                    {EXAMPLE_QUERIES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setQuery(example)}
                        className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {status === "loading" && !result ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> 搜索中…
                </div>
              ) : null}

              {status === "error" ? (
                <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground">
                  <p>搜索失败，请稍后重试。</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRetryNonce((nonce) => nonce + 1)}
                  >
                    重试
                  </Button>
                </div>
              ) : null}

              {status === "ready" && flatHits.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  没有找到「{result?.query ?? query.trim()}」相关内容
                </div>
              ) : null}

              {status === "ready"
                ? visibleGroups.map((group) => {
                    const groupItems = group.hits.map((hit) => {
                      const index = flatOffset;
                      flatOffset += 1;
                      const Icon = KIND_ICONS[hit.kind];
                      const active = index === resolvedActiveIndex;
                      return (
                        <div
                          key={hit.kind + ":" + hit.key}
                          id={"exam-408-search-option-" + index}
                          role="option"
                          aria-selected={active}
                          data-search-index={index}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => go(hit)}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                            active ? "bg-primary/[0.08]" : "hover:bg-muted/50",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                              active ? "bg-primary/15 text-primary-strong" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-3.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              <Highlight text={hit.title} query={query} />
                            </span>
                            {hit.snippet ? (
                              <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                                <Highlight text={hit.snippet} query={query} />
                              </span>
                            ) : null}
                            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                              {hit.meta}
                            </span>
                          </span>
                        </div>
                      );
                    });
                    return (
                      <section key={group.kind} role="group" aria-label={group.label} className="mb-1">
                        {activeKind === "all" ? (
                          <h3 className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                            {group.label}
                            <span className="ml-1 tabular-nums opacity-70">{group.hits.length}</span>
                          </h3>
                        ) : null}
                        {groupItems}
                      </section>
                    );
                  })
                : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1">↑</kbd>
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1">↓</kbd>
                  选择
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1">↵</kbd>
                  打开
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1">Esc</kbd>
                  关闭
                </span>
              </span>
              <span className="hidden shrink-0 tabular-nums sm:inline">
                {result ? "共 " + result.total + " 条 · " : ""}
                {shortcutLabel} 呼出
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
