"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Minus, Move, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Exam408MapLayout,
  Exam408MapPresentation,
  Exam408MapViewBox,
} from "@/lib/exam-408-map";

/**
 * 章节知识图谱（原生 SVG 自绘），替代 cs408 精读里原本的 iframe 交互图谱。
 *
 * 数据链路：迁移 088 的 exam_408_knowledge_maps → lib/exam-408-map 查询并 enrich（studySlug/href/统计）
 * → buildKnowledgeMapPresentation 在**服务端**把布局、折行标题、副信息行、强调色都算好 → 本组件只画与交互。
 * 为什么客户端只收纯数据：lib/exam-408-map.ts 依赖 pg 连接池，客户端 import 它会把数据库驱动打进浏览器包
 * （实测 Turbopack 直接报 pg 的 node 内建模块解析失败），所以服务端预计算、客户端零服务端依赖。
 *
 * 交互：拖拽平移、滚轮缩放、+/−/重置按钮；节点可 Tab 聚焦、Enter/Space 打开（⌘/Ctrl+点击新标签页）；
 * hover/focus 出 tooltip；prefers-reduced-motion 下不加过渡。
 * 小屏（<sm）：同一份数据降级为纵向路径列表，点击区域更大、无需缩放。
 */
export function KnowledgeMap({ data, className }: { data: Exam408MapPresentation; className?: string }) {
  const router = useRouter();
  const markerId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startView: Exam408MapViewBox;
    moved: boolean;
  } | null>(null);

  const layout = data.layout;
  const [view, setView] = useState<Exam408MapViewBox>(() => createView(layout));
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const visuals = useMemo(() => new Map(data.nodes.map((node) => [node.slug, node])), [data.nodes]);
  const placements = useMemo(() => [...layout.cores, ...layout.exts], [layout]);
  const activePlacement = useMemo(
    () => placements.find((placement) => placement.node.slug === activeSlug) ?? null,
    [placements, activeSlug],
  );
  const activeVisual = activePlacement ? visuals.get(activePlacement.node.slug) ?? null : null;

  const zoom = useCallback(
    (factor: number) => {
      setView((current) =>
        zoomView(current, layout, factor, current.x + current.w / 2, current.y + current.h / 2),
      );
    },
    [layout],
  );

  const reset = useCallback(() => setView(createView(layout)), [layout]);

  // 滚轮缩放：React 的 onWheel 在根节点是 passive 的，preventDefault 无效，这里挂原生非 passive 监听
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fractionX = (event.clientX - rect.left) / rect.width;
      const fractionY = (event.clientY - rect.top) / rect.height;
      setView((current) => {
        const focusX = current.x + fractionX * current.w;
        const focusY = current.y + fractionY * current.h;
        return zoomView(current, layout, event.deltaY < 0 ? 1.15 : 1 / 1.15, focusX, focusY);
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [layout]);

  const activate = useCallback(
    (href: string | null, event?: { metaKey?: boolean; ctrlKey?: boolean }) => {
      if (!href) return;
      if (dragRef.current?.moved) return;
      if (event && (event.metaKey || event.ctrlKey)) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(href);
    },
    [router],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startView: view,
        moved: false,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    },
    [view],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const element = viewportRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const dxPixels = event.clientX - drag.startX;
      const dyPixels = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(dxPixels) + Math.abs(dyPixels) < 4) return;
      drag.moved = true;
      const dx = -(dxPixels * drag.startView.w) / Math.max(1, rect.width);
      const dy = -(dyPixels * drag.startView.h) / Math.max(1, rect.height);
      setView(panView(drag.startView, layout, dx, dy));
    },
    [layout],
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    // 让落在节点上的点击先读到 moved 标记，再异步清空
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
    setDragging(false);
  }, []);

  const tooltipStyle = activePlacement ? tooltipPosition(activePlacement, view) : null;

  return (
    <section
      className={cn("flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60", className)}
      aria-label={"章节知识图谱：" + data.chapter}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] text-primary">章节知识图谱</span>
            {data.subjectTitle ? <span className="text-muted-foreground">{data.subjectTitle}</span> : null}
            <span className="text-muted-foreground">·</span>
            <span>{data.chapter}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="muted">{data.summary.nodes} 个知识点</Badge>
            {data.summary.cards > 0 ? <span>卡片 {data.summary.cards}</span> : null}
            {data.summary.demos > 0 ? <span>演示 {data.summary.demos}</span> : null}
            {data.summary.questions > 0 ? <span>真题 {data.summary.questions}</span> : null}
          </div>
        </div>
        {/* 缩放控件只对可缩放画布有意义，小屏走列表降级，直接隐藏 */}
        <div className="hidden items-center gap-1 sm:flex">
          <Button type="button" size="icon" variant="secondary" aria-label="缩小图谱" onClick={() => zoom(1 / 1.2)}>
            <Minus />
          </Button>
          <span className="min-w-10 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round((layout.width / view.w) * 100)}%
          </span>
          <Button type="button" size="icon" variant="secondary" aria-label="放大图谱" onClick={() => zoom(1.2)}>
            <Plus />
          </Button>
          <Button type="button" size="icon" variant="secondary" aria-label="查看整张图谱" onClick={() => setView({ x: 0, y: 0, w: layout.width, h: layout.height })}>
            <Minimize2 />
          </Button>
          <Button type="button" size="icon" variant="secondary" aria-label="重置图谱视图" onClick={reset}>
            <Maximize2 />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <svg width="22" height="8" aria-hidden><line x1="1" y1="4" x2="21" y2="4" className="stroke-primary/60" strokeWidth="2" /></svg>
          核心主线
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="22" height="8" aria-hidden><line x1="1" y1="4" x2="21" y2="4" className="stroke-muted-foreground/60" strokeWidth="1.6" strokeDasharray="4 3" /></svg>
          补充旁支
        </span>
        <span className="hidden items-center gap-1 sm:inline-flex">
          <Move className="size-3" aria-hidden /> 拖拽平移 · 滚轮缩放 · Tab 选中后 Enter 打开
        </span>
      </div>

      {data.nodes.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">该章节暂无图谱数据。</p>
      ) : null}

      {/* 桌面 / 平板：可缩放画布 */}
      <div
        ref={viewportRef}
        className={cn(
          "relative hidden h-[440px] touch-none select-none overflow-hidden sm:block md:h-[520px]",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setActiveSlug(null)}
      >
        <svg
          viewBox={[view.x, view.y, view.w, view.h].join(" ")}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="group"
          aria-label={"知识图谱画布，共 " + data.nodes.length + " 个节点"}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary/55" />
            </marker>
          </defs>

          {layout.links.map((link, index) => (
            <polyline
              key={"link-" + index}
              points={link.points.map((point) => point[0] + "," + point[1]).join(" ")}
              fill="none"
              strokeWidth={link.kind === "branch" ? 1.5 : 2}
              strokeDasharray={link.kind === "branch" ? "5 4" : undefined}
              markerEnd={"url(#" + markerId + ")"}
              className={link.kind === "branch" ? "stroke-muted-foreground/45" : "stroke-primary/45"}
            />
          ))}

          <g>
            <rect
              x={layout.start.x}
              y={layout.start.y}
              width={layout.start.width}
              height={layout.start.height}
              rx={16}
              className="fill-primary/10 stroke-primary/35"
              strokeWidth={1.5}
            />
            <text
              x={layout.start.centerX}
              y={layout.start.y + 23}
              textAnchor="middle"
              className="fill-foreground text-[15px] font-semibold"
            >
              {data.chapter}
            </text>
            <text
              x={layout.start.centerX}
              y={layout.start.y + 40}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {"本章学习路径 · " + layout.cores.length + " 个核心知识点" + (layout.exts.length > 0 ? " · " + layout.exts.length + " 个补充" : "")}
            </text>
          </g>

          {placements.map((placement) => {
            const visual = visuals.get(placement.node.slug);
            return visual ? (
              <MapNodeCard
                key={placement.node.slug}
                placement={placement}
                visual={visual}
                active={activeSlug === placement.node.slug}
                onHover={setActiveSlug}
                onActivate={activate}
              />
            ) : null;
          })}
        </svg>

        {activeVisual && tooltipStyle ? <MapTooltip visual={activeVisual} style={tooltipStyle} /> : null}
        {layout.height > view.h + 2 ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card/90 to-transparent" aria-hidden />
            <p className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
              拖拽查看下方节点 · 或点「查看整张图谱」
            </p>
          </>
        ) : null}
      </div>

      {/* 移动端：纵向路径列表（点击区域大、无需缩放） */}
      <ol className="flex flex-col gap-2 px-3 py-3 sm:hidden">
        {data.nodes.map((node, index) => (
          <li key={node.slug} className="flex items-stretch gap-2">
            <span className="flex w-6 shrink-0 flex-col items-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
                {index + 1}
              </span>
              {index < data.nodes.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
            </span>
            {node.href ? (
              <Link
                href={node.href}
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border/60 bg-card/70 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <MobileNodeBody node={node} />
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-dashed border-border/60 bg-card/40 px-3 py-2">
                <MobileNodeBody node={node} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function MapNodeCard({
  placement,
  visual,
  active,
  onHover,
  onActivate,
}: {
  placement: Exam408MapPresentation["layout"]["cores"][number];
  visual: Exam408MapPresentation["nodes"][number];
  active: boolean;
  onHover: (slug: string | null) => void;
  onActivate: (href: string | null, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
}) {
  const clickable = Boolean(visual.href);
  const isExt = visual.type !== "core";

  return (
    <g
      role={clickable ? "link" : "group"}
      tabIndex={clickable ? 0 : undefined}
      aria-label={visual.title + "（" + visual.metaLine + "）" + (clickable ? "，回车打开" : "")}
      className={cn("outline-none", clickable ? "cursor-pointer" : "cursor-default")}
      onClick={(event) => onActivate(visual.href, event)}
      onKeyDown={(event) => {
        if (!clickable) return;
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          onActivate(visual.href, event);
        }
      }}
      onPointerEnter={() => onHover(visual.slug)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(visual.slug)}
      onBlur={() => onHover(null)}
    >
      <rect
        x={placement.x}
        y={placement.y}
        width={placement.width}
        height={placement.height}
        rx={14}
        strokeWidth={active ? 2 : 1}
        strokeDasharray={isExt ? "5 4" : undefined}
        className={cn(
          active ? "fill-primary/10 stroke-primary" : "fill-card stroke-border",
          "transition-colors motion-reduce:transition-none",
        )}
      />
      <rect
        x={placement.x + 1}
        y={placement.y + 12}
        width={4}
        height={placement.height - 24}
        rx={2}
        className={visual.accent}
      />
      {visual.titleLines.map((line, index) => (
        <text
          key={index}
          x={placement.x + 16}
          y={placement.y + (visual.titleLines.length > 1 ? 25 : 30) + index * 17}
          className="fill-foreground text-[13px] font-semibold"
        >
          {line}
        </text>
      ))}
      <text
        x={placement.x + 16}
        y={placement.y + placement.height - 14}
        className="fill-muted-foreground text-[10.5px]"
      >
        {visual.metaLine}
      </text>
      {clickable ? (
        <path
          d={"M " + (placement.x + placement.width - 24) + " " + (placement.centerY - 5) + " l 6 5 l -6 5"}
          fill="none"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-muted-foreground"
        />
      ) : null}
    </g>
  );
}

function MapTooltip({
  visual,
  style,
}: {
  visual: Exam408MapPresentation["nodes"][number];
  style: { left: string; top: string; transform: string };
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-56 rounded-lg border border-border/70 bg-card/95 p-2.5 text-left shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none"
      style={style}
    >
      <p className="text-xs font-semibold leading-5 text-foreground">{visual.title}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{visual.metaLine}</p>
      {visual.desc ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{visual.desc}</p> : null}
      <p className="mt-1.5 text-[11px] font-medium text-primary">
        {visual.href
          ? visual.target === "study"
            ? "点击阅读该知识点"
            : "点击查看关联知识点与真题"
          : "暂无可跳转页面"}
      </p>
    </div>
  );
}

function MobileNodeBody({ node }: { node: Exam408MapPresentation["nodes"][number] }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium leading-5 text-foreground">{node.title}</span>
        {node.type === "ext" ? <Badge variant="muted">补充</Badge> : null}
        {node.importanceLabel === "重点必读" ? <Badge variant="default">重点</Badge> : null}
      </span>
      <span className="text-[11px] leading-4 text-muted-foreground">{node.metaLine}</span>
      {node.desc ? <span className="text-[11px] leading-4 text-muted-foreground">{node.desc}</span> : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 视窗数学（客户端镜像一份）：lib/exam-408-map.ts 里同口径的实现有单测， */
/* 但客户端不能 import 那个模块（它依赖 pg），所以这里等价实现。          */
/* ------------------------------------------------------------------ */

const MIN_VIEW_WIDTH = 240;

function createView(layout: Exam408MapLayout): Exam408MapViewBox {
  return { x: 0, y: 0, w: layout.width, h: Math.min(layout.height, Math.round(layout.width * 0.8)) };
}

function clampAxis(value: number, viewSize: number, contentSize: number): number {
  const slack = viewSize * 0.15;
  const min = Math.min(0, contentSize - viewSize) - slack;
  const max = Math.max(0, contentSize - viewSize) + slack;
  return Math.min(max, Math.max(min, value));
}

function zoomView(
  view: Exam408MapViewBox,
  layout: Exam408MapLayout,
  factor: number,
  focusX: number,
  focusY: number,
): Exam408MapViewBox {
  const bounded = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const nextWidth = Math.min(Math.max(view.w / bounded, MIN_VIEW_WIDTH), layout.width);
  const scale = nextWidth / view.w;
  const nextHeight = view.h * scale;
  return {
    x: clampAxis(focusX - (focusX - view.x) * scale, nextWidth, layout.width),
    y: clampAxis(focusY - (focusY - view.y) * scale, nextHeight, layout.height),
    w: nextWidth,
    h: nextHeight,
  };
}

function panView(
  view: Exam408MapViewBox,
  layout: Exam408MapLayout,
  dx: number,
  dy: number,
): Exam408MapViewBox {
  return {
    x: clampAxis(view.x + (Number.isFinite(dx) ? dx : 0), view.w, layout.width),
    y: clampAxis(view.y + (Number.isFinite(dy) ? dy : 0), view.h, layout.height),
    w: view.w,
    h: view.h,
  };
}

function tooltipPosition(
  placement: Exam408MapPresentation["layout"]["cores"][number],
  view: Exam408MapViewBox,
): { left: string; top: string; transform: string } {
  const clamp = (value: number) => Math.min(92, Math.max(8, value));
  const left = clamp(((placement.centerX - view.x) / view.w) * 100);
  const top = clamp(((placement.y - view.y) / view.h) * 100);
  return {
    left: left + "%",
    top: top + "%",
    transform: top < 22 ? "translate(-50%, 14px)" : "translate(-50%, -115%)",
  };
}
