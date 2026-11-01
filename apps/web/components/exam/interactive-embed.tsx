"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, MonitorPlay, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 精读页里的「本地交互演示」卡片。
 *
 * 背景：cs408 原文的交互可视化是外链 iframe（https://cs408.cloud/interactive/*.html）。task-25 已把 35 个页面
 * 静态镜像到 apps/web/public/content-interactive/<name>/index.html（见 scripts/cs408-study/mirror-interactive.mjs
 * 与 interactive-manifest.json，作者已授权个人学习、非商业用途）。
 *
 * 设计约束：
 * - 只允许本地路径（/content-interactive/…）：外链 src 直接降级成禁用提示，避免任何外部域名/脚本进来。
 * - sandbox="allow-scripts allow-same-origin"：页面是单文件内联 JS/SVG，脚本要跑；同源能保证 SVG <use href="#id">
 *   与内联 fetch 正常。若将来出现跨源/权限问题，可只留 allow-scripts（本组件集中一处，便于切换）。
 * - iframe 高度：优先用原文 iframe 的像素高度（Lead 集成时从解析结果传入）；缺省按 16:10 自适应宽度。
 * - 加载失败/超时不白屏：给出「在新窗口打开」的本地链接与提示文案。
 */

const LOCAL_PREFIX = "/content-interactive/";
const DEFAULT_ASPECT_RATIO = "16 / 10";
/** 页面是本地静态文件，正常 <1s；留 12s 兜底，慢盘/首帧也能起来 */
const LOAD_TIMEOUT_MS = 12_000;
const SANDBOX = "allow-scripts allow-same-origin";

export interface InteractiveEmbedProps {
  /** 本地镜像路径，形如 /content-interactive/kmp-visualizer/index.html */
  src: string;
  /** 卡片标题（原文 iframe 的 title，如「KMP 可视化」） */
  title?: string;
  /** 一句话说明（可选，集成方按需从正文补充） */
  description?: string;
  /** 原文 iframe 的像素高度（如 660/700），传入则固定高度，否则按 16:10 自适应 */
  height?: number;
  className?: string;
}

type LoadState = "loading" | "ready" | "failed";

export function InteractiveEmbed({ src, title, description, height, className }: InteractiveEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [fullscreen, setFullscreen] = useState(false);

  const isLocal = typeof src === "string" && src.startsWith(LOCAL_PREFIX);
  const safeTitle = title?.trim() || "交互演示";
  const label = isLocal ? safeTitle : "该演示需要本地镜像，外链已禁用";

  // 超时兜底：iframe 的 onError 对 404 不触发，慢资源也要有出口
  useEffect(() => {
    if (!isLocal || state !== "loading") return;
    const timer = window.setTimeout(() => {
      setState((current) => (current === "loading" ? "failed" : current));
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLocal, state, src]);

  // 全屏状态跟随浏览器（用户按 Esc 退出时同步 UI）
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
      return;
    }
    void shell.requestFullscreen?.().catch(() => {});
  }, []);

  const handleLoad = useCallback(() => setState("ready"), []);
  const handleError = useCallback(() => setState("failed"), []);

  return (
    <section
      ref={shellRef}
      className={cn(
        "my-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--elev-1)]",
        fullscreen && "flex h-full w-full flex-col rounded-none border-0",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-2.5 sm:px-4">
        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
          <MonitorPlay className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        <Badge variant={isLocal ? "accent" : "warning"} className="shrink-0">
          {isLocal ? "本地交互演示" : "外链已禁用"}
        </Badge>
        <span className="ml-auto flex items-center gap-1.5">
          {isLocal ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "退出全屏" : "全屏查看"}
                title={fullscreen ? "退出全屏" : "全屏查看"}
              >
                {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
              </Button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/8 hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                在新窗口打开
              </a>
            </>
          ) : null}
        </span>
      </header>

      {description ? (
        <p className="border-b border-border/60 px-3 py-2 text-xs leading-5 text-muted-foreground sm:px-4">{description}</p>
      ) : null}

      {isLocal ? (
        <div
          className={cn("relative w-full bg-white", fullscreen && "flex-1")}
          style={height ? { height } : { aspectRatio: DEFAULT_ASPECT_RATIO }}
        >
          <iframe
            ref={frameRef}
            src={src}
            title={safeTitle}
            sandbox={SANDBOX}
            loading="lazy"
            referrerPolicy="no-referrer"
            allow="fullscreen"
            onLoad={handleLoad}
            onError={handleError}
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
          {state === "loading" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-muted-foreground">
              正在加载交互演示…
            </div>
          ) : null}
          {state === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 px-6 text-center">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <TriangleAlert className="size-4 text-warning" aria-hidden />
                交互演示加载失败
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                本地镜像可能缺失或浏览器拦截了内嵌页面，可先在新窗口打开确认；若仍打不开，请反馈给维护者重新运行镜像脚本。
              </span>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                在新窗口打开
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <TriangleAlert className="size-4 text-warning" aria-hidden />
            该交互演示暂未本地化
          </span>
          <span className="text-xs leading-5">
            为避免在精读页加载外部域名脚本，这里不会嵌入外链页面。请反馈给维护者运行
            {" "}scripts/cs408-study/mirror-interactive.mjs{" "}
            完成镜像。
          </span>
        </div>
      )}
    </section>
  );
}
