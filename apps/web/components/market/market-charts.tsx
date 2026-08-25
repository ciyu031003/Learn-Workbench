"use client";

/**
 * 招聘市场分析 · 胶囊化图表组件
 * 参照 mav-charts 目录选型：C05 横向排名 / F01 矩形树图 / D07 直方图 / P02 环形 / D03 气泡象限
 * 全部手绘 SVG/HTML，贴合 apps/web 玻璃拟态 + 冷调强调，不引入 recharts 依赖。
 * 另含：SkillMarketMap（技能市场地图，四象限 + 我的技能状态 + 学习入口）。
 */
import { useState } from "react";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";

/** 冷调渐变对（胶囊填充）—— P1 收敛到全站 token 冷调体系（primary=靛蓝、accent=天蓝），去暖色/绿冲突 */
const G = [
  ["#6366f1", "#818cf8"], // indigo（≈primary）
  ["#0ea5e9", "#38bdf8"], // sky（accent）
  ["#8b5cf6", "#a78bfa"], // violet
  ["#3b82f6", "#60a5fa"], // blue
  ["#06b6d4", "#22d3ee"], // cyan
  ["#14b8a6", "#2dd4bf"], // teal
] as const;
const grad = (i: number, vertical = false) =>
  `linear-gradient(${vertical ? "180" : "90"}deg, ${G[i % G.length][0]}, ${G[i % G.length][1]})`;
const fillColor = (i: number) => G[i % G.length][0];

/** 排序后的横向排名胶囊条 */
export function CapsuleRank({
  items,
  className,
}: {
  items: { label: string; value: number; note?: string }[];
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((s) => s.value));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {sorted.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
              i < 3 ? "text-white" : "bg-white/12 text-muted-foreground"
            )}
            style={i < 3 ? { background: fillColor(i) } : undefined}
          >
            {i + 1}
          </span>
          <span className="w-16 shrink-0 truncate text-xs font-medium text-muted-foreground" title={it.label}>
            {it.label}
          </span>
          <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(6, Math.round((it.value / max) * 100))}%`, background: grad(i) }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
            {it.value}
            {it.note ? <span className="ml-1 text-[10px] font-medium text-muted-foreground">{it.note}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 矩形树图（一个整体中各类别规模）— squarify 面积成正比，胶囊圆角 */
export function TreemapChart({ items, className }: { items: { label: string; value: number }[]; className?: string }) {
  const rects = squarify(items, 0, 0, 400, 260);
  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl bg-white/6", className)} style={{ height: 260 }}>
      {rects.map((r) => {
        const big = r.w > 84 && r.h > 46;
        const mid = r.w > 48 && r.h > 30;
        return (
          <div
            key={r.label}
            className="absolute flex flex-col justify-between overflow-hidden rounded-[8px] p-1.5"
            style={{
              left: `${(r.x / 400) * 100}%`,
              top: `${(r.y / 260) * 100}%`,
              width: `${(r.w / 400) * 100}%`,
              height: `${(r.h / 260) * 100}%`,
              background: grad(rects.indexOf(r), true),
            }}
          >
            <span className="truncate text-[10px] font-semibold leading-tight text-white/95">
              {big || mid ? r.label : ""}
            </span>
            {big ? (
              <span className="text-sm font-black tabular-nums leading-none text-white">{r.value}</span>
            ) : mid ? (
              <span className="text-[10px] font-bold tabular-nums text-white/90">{r.value}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** 直方图（等宽区间分布）— 竖向胶囊柱 */
export function HistogramBars({ items, className }: { items: { label: string; value: number }[]; className?: string }) {
  const max = Math.max(1, ...items.map((h) => h.value));
  return (
    <div className={cn("flex h-40 items-end gap-2", className)}>
      {items.map((d, i) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${d.label}：${d.value} 个`}>
          <span className="text-xs font-bold tabular-nums text-foreground">{d.value}</span>
          <div className="flex w-full flex-col justify-end overflow-hidden rounded-md bg-white/10" style={{ height: "100%" }}>
            <div
              className="w-full rounded-md transition-[height] duration-700 ease-out"
              style={{ height: `${Math.max(8, Math.round((d.value / max) * 100))}%`, background: grad(i, true) }}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 环形图（占比）— 中心总量 + 图例 */
export function DonutChart({
  items,
  centerLabel,
  centerValue,
  className,
}: {
  items: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = items.reduce((a, d) => a + d.value, 0);
  const size = 120;
  const t = 18;
  const r = (size - t) / 2;
  const c = 2 * Math.PI * r;
  const segs = items.reduce<{ label: string; value: number; color: string; dash: number; off: number }[]>((acc, d, i) => {
    const prevOff = acc.length > 0 ? acc[acc.length - 1].off + acc[acc.length - 1].dash : 0;
    const frac = total > 0 ? d.value / total : 0;
    acc.push({ label: d.label, value: d.value, color: fillColor(i), dash: frac * c, off: prevOff });
    return acc;
  }, []);
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={t} />
          {segs.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={t}
              strokeLinecap="butt"
              strokeDasharray={`${s.dash} ${c}`}
              strokeDashoffset={-s.off}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums text-foreground">{centerValue ?? total}</span>
          {centerLabel ? <span className="text-[10px] text-muted-foreground">{centerLabel}</span> : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-bold tabular-nums text-foreground">{s.value}</span>
          </div>
        ))}
        {segs.length === 0 ? <span className="text-[11px] text-muted-foreground">暂无数据</span> : null}
      </div>
    </div>
  );
}

/** 气泡象限图（关系 + 规模）— 中位数十字参考线 */
export function BubbleQuadrant({
  items,
  xLabel,
  yLabel,
  className,
}: {
  items: { label: string; x: number; y: number; r: number }[];
  xLabel?: string;
  yLabel?: string;
  className?: string;
}) {
  const W = 280, H = 170, P = 14;
  const xs = items.map((d) => d.x).filter((n) => Number.isFinite(n));
  const ys = items.map((d) => d.y).filter((n) => Number.isFinite(n));
  const maxX = Math.max(1, ...xs);
  const maxY = Math.max(1, ...ys);
  const midX = median(xs) || maxX / 2;
  const midY = median(ys) || maxY / 2;
  const tone = (x: number, y: number) => (x >= midX && y >= midY ? "#34d399" : x >= midX ? "#22d3ee" : y >= midY ? "#818cf8" : "#a78bfa");
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative w-full overflow-hidden rounded-xl bg-white/6" style={{ height: 168 }}>
        {/* 网格 */}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={H - P - (H - 2 * P) * f} y2={H - P - (H - 2 * P) * f} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          ))}
          {/* 参考十字线 */}
          <line x1={P} x2={W - P} y1={Y(midY, maxY, H, P)} y2={Y(midY, maxY, H, P)} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={X(midX, maxX, W, P)} x2={X(midX, maxX, W, P)} y1={P} y2={H - P} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
          {items.map((d) => {
            const cx = X(d.x, maxX, W, P);
            const cy = Y(d.y, maxY, H, P);
            const rad = Math.min(16, 3 + d.r * 1.6);
            return (
              <g key={d.label}>
                <circle cx={cx} cy={cy} r={rad} fill={tone(d.x, d.y)} opacity={0.82} />
                <title>{d.label} · 均 {d.x}K · {d.y} 个职位</title>
              </g>
            );
          })}
        </svg>
        <span className="absolute left-1.5 top-1 text-[9px] font-semibold text-muted-foreground">{yLabel ?? "需求热度"}</span>
        <span className="absolute bottom-1.5 right-2 text-[9px] font-semibold text-muted-foreground">{xLabel ?? "平均薪资"}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {items.slice(0, 6).map((d) => (
          <span key={d.label} className="text-[10px] text-muted-foreground">
            {d.label} <span className="font-bold tabular-nums text-foreground">{d.x}K</span>
          </span>
        ))}
        {items.length > 6 ? <span className="text-[10px] text-muted-foreground">+{items.length - 6}…</span> : null}
      </div>
    </div>
  );
}

/* ---------- 数学工具 ---------- */
function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function X(v: number, max: number, W: number, P: number) {
  return P + ((W - 2 * P) * v) / max;
}
function Y(v: number, max: number, H: number, P: number) {
  return H - P - ((H - 2 * P) * v) / max;
}

/** squarify 矩形树图布局（已验证：填充 100% / 面积成正比 / 无重叠） */
function squarify(
  items: { label: string; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): { label: string; value: number; x: number; y: number; w: number; h: number }[] {
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0) return [];
  const AREA = w * h;
  const stack = items
    .filter((it) => it.value > 0)
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((it) => ({ label: it.label, value: it.value, wt: (it.value * AREA) / total }));
  let rect = { x, y, w, h };
  let row: typeof stack = [];
  const worst = (rw: typeof stack, side: number) => {
    if (rw.length === 0) return Infinity;
    const s = rw.reduce((a, b) => a + b.wt, 0);
    const mx = Math.max(...rw.map((r) => r.wt));
    const mn = Math.min(...rw.map((r) => r.wt));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layout = (rw: typeof stack, rect: { x: number; y: number; w: number; h: number }) => {
    const s = rw.reduce((a, b) => a + b.wt, 0);
    const placed: { label: string; value: number; x: number; y: number; w: number; h: number }[] = [];
    if (rect.w >= rect.h) {
      const rowW = s / rect.h;
      let yOff = rect.y;
      for (const r of rw) {
        const rh = r.wt / rowW;
        placed.push({ label: r.label, value: r.value, x: rect.x, y: yOff, w: rowW, h: rh });
        yOff += rh;
      }
      return {
        rect: { ...rect, x: rect.x + rowW, w: rect.w - rowW },
        placed,
      };
    } else {
      const rowH = s / rect.w;
      let xOff = rect.x;
      for (const r of rw) {
        const cw = r.wt / rowH;
        placed.push({ label: r.label, value: r.value, x: xOff, y: rect.y, w: cw, h: rowH });
        xOff += cw;
      }
      return {
        rect: { ...rect, y: rect.y + rowH, h: rect.h - rowH },
        placed,
      };
    }
  };
  const result: { label: string; value: number; x: number; y: number; w: number; h: number }[] = [];
  while (stack.length) {
    const side = Math.min(rect.w, rect.h);
    const c = stack[0];
    if (row.length === 0 || worst([...row, c], side) <= worst(row, side)) {
      row.push(c);
      stack.shift();
    } else {
      const l = layout(row, rect);
      result.push(...l.placed);
      rect = l.rect;
      row = [];
    }
  }
  if (row.length) {
    const l = layout(row, rect);
    result.push(...l.placed);
  }
  return result;
}

/* ================= 技能市场地图（Skill Market Map）＝ 升级版 BubbleQuadrant =================
 * 语义迁移：X=市场需求(职位数) / Y=平均薪资 / Size=职位数 / 状态=我的掌握。
 * 四象限：明星(高需高薪) / 潜力(低需高薪) / 基础(高需低薪) / 长尾(低需低薪)。
 * 冷调 token 着色（呼应全站 primary/accent），我的状态用语义色描边（不引入彩虹色板）。
 */

export interface SkillMapNode {
  skill: string;
  avgSalary: number | null;   // Y：平均薪资（K/月）
  count: number;              // X + Size：需求职位数
  myLevel: number | null;     // 0-5；null=未登录/未维护
  enrollable: boolean;        // 是否有对应学习主题可加入
  topicId: number | null;
  topicTitle: string | null;
  estimateHours: number | null;
  phaseId: number | null;
}

export const SKILL_LEVEL_LABELS = ["未掌握", "了解", "入门", "熟练", "精通", "专家"];

const HEAT_STARS = (jobCount: number, ref: number) => {
  const scale = jobCount / Math.max(1, ref);
  return scale >= 1.8 ? 5 : scale >= 1.2 ? 4 : scale >= 0.7 ? 3 : scale >= 0.35 ? 2 : 1;
};

export function SkillMarketMap({
  nodes,
  loggedIn,
  className,
}: {
  nodes: SkillMapNode[];
  loggedIn: boolean;
  className?: string;
}) {
  const pushToast = useToastStore((s) => s.push);
  const [sel, setSel] = useState<SkillMapNode | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  // X=需求 / Y=薪资
  const usable = nodes.filter((n) => n.avgSalary != null && n.count > 0);
  const xs = usable.map((n) => n.avgSalary as number);
  const ys = usable.map((n) => n.count);
  const maxX = Math.max(1, ...xs);
  const maxY = Math.max(1, ...ys);
  const midX = median(xs) || maxX / 2;
  const midY = median(ys) || maxY / 2;

  const W = 720, H = 340, P = 18;
  const px = (v: number) => X(v, maxX, W, P);
  const py = (v: number) => Y(v, maxY, H, P);

  // 冷调象限色
  const tone = (x: number, y: number) =>
    x >= midX && y >= midY ? "#6366f1" // 明星（高需高薪）
    : x >= midX ? "#0ea5e9"           // 基础（高需低薪）
    : y >= midY ? "#8b5cf6"           // 潜力（低需高薪）
    : "#94a3b8";                      // 长尾（低需低薪）

  const ring = (level: number | null) =>
    level == null ? null
    : level >= 3 ? "#10b981"
    : level >= 1 ? "#f59e0b"
    : "#e4e4e7";

  const enroll = async (n: SkillMapNode) => {
    if (!loggedIn) { pushToast("请先登录，才能把技能加入学习路线", "error"); return; }
    if (!n.enrollable || n.topicId == null) { pushToast("该技能暂无可加入的学习主题", "error"); return; }
    setEnrolling(n.skill);
    try {
      const r = await fetch("/api/jobs/gaps/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaps: [{ skill: n.skill, topicId: n.topicId, hours: n.estimateHours }] }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "加入失败");
      pushToast(`已加入「${n.skill}」学习任务到今日计划`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "加入失败", "error");
    } finally {
      setEnrolling(null);
    }
  };

  const heatStars = sel ? HEAT_STARS(sel.count, midY) : 0;

  const topByCount = [...usable].sort((a, b) => b.count - a.count);
  // 标签：点不多一律显示每个点名；点多只显示权重 Top N（选中节点始终显示）
  const LABEL_LIMIT = 12;
  const labelSet = new Set(topByCount.slice(0, LABEL_LIMIT).map((n) => n.skill));
  const showAllLabels = usable.length <= LABEL_LIMIT;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 桌面完整技能市场地图（lg 及以上） */}
      <div className="hidden lg:block">
        <div className="relative w-full overflow-hidden rounded-2xl bg-white/6">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="技能市场地图：横轴需求职位数，纵轴平均薪资">
            {/* 四象限背景（弱色着色，区分区域） */}
            <rect x={px(midX)} y={P} width={Math.max(0, W - P - px(midX))} height={Math.max(0, py(midY) - P)} fill="rgba(99,102,241,0.07)" />
            <rect x={P} y={P} width={Math.max(0, px(midX) - P)} height={Math.max(0, py(midY) - P)} fill="rgba(139,92,246,0.07)" />
            <rect x={px(midX)} y={py(midY)} width={Math.max(0, W - P - px(midX))} height={Math.max(0, H - P - py(midY))} fill="rgba(14,165,233,0.07)" />
            <rect x={P} y={py(midY)} width={Math.max(0, px(midX) - P)} height={Math.max(0, H - P - py(midY))} fill="rgba(148,163,184,0.07)" />
            {/* 浅网格（弱网格） */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={`h${f}`} x1={P} x2={W - P} y1={H - P - (H - 2 * P) * f} y2={H - P - (H - 2 * P) * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={`v${f}`} x1={P + (W - 2 * P) * f} x2={P + (W - 2 * P) * f} y1={P} y2={H - P} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {/* 中位参考十字线 */}
            <line x1={P} x2={W - P} y1={py(midY)} y2={py(midY)} stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={px(midX)} x2={px(midX)} y1={P} y2={H - P} stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="4 4" />
            {/* 气泡（标签仅大气泡/选中显示，防重叠） */}
            {usable.map((n) => {
              const cx = px(n.avgSalary as number);
              const cy = py(n.count);
              const rad = Math.min(24, 6 + Math.sqrt(n.count) * 2.2);
              const r = ring(n.myLevel);
              const isSel = sel?.skill === n.skill;
              const showLabel = isSel || showAllLabels || labelSet.has(n.skill);
              return (
                <g
                  key={n.skill}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.skill}：${n.count} 个岗位，均薪 ${n.avgSalary}K`}
                  className="cursor-pointer outline-none"
                  onClick={() => setSel(n)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n); } }}
                >
                  <title>{n.skill} · {n.count} 个岗位 · 均 {n.avgSalary}K</title>
                  {isSel ? <circle cx={cx} cy={cy} r={rad + 4} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" /> : null}
                  <circle cx={cx} cy={cy} r={rad} fill={tone(n.avgSalary as number, n.count)} opacity="0.86" />
                  {r ? <circle cx={cx} cy={cy} r={rad + 2} fill="none" stroke={r} strokeWidth={n.myLevel! >= 3 ? 2.5 : 2} strokeDasharray={n.myLevel === 0 ? "3 3" : undefined} /> : null}
                  {showLabel ? (
                    <text
                      x={cx}
                      y={cy - rad - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="rgba(255,255,255,0.96)"
                      paintOrder="stroke"
                      stroke="rgba(0,0,0,0.55)"
                      strokeWidth={3}
                    >
                      {n.skill.slice(0, 10)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {/* 象限标签 */}
          <span className="pointer-events-none absolute right-2 top-1.5 text-[10px] font-semibold text-muted-foreground/60">明星技能</span>
          <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] font-semibold text-muted-foreground/60">潜力技能</span>
          <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-semibold text-muted-foreground/60">基础技能</span>
          <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] font-semibold text-muted-foreground/60">长尾技能</span>
          {/* 轴标签 */}
          <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] text-muted-foreground/70">平均薪资（K/月）</span>
          <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/70">需求职位数 →</span>
        </div>
        {/* 状态描边图例（登录后） */}
        {loggedIn ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />已熟练/掌握</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-amber-500" />学习中</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-zinc-400" />未掌握</span>
          </div>
        ) : null}
      </div>

      {/* 窄屏降级：技能矩阵摘要 + Top 榜 */}
      <div className="lg:hidden">
        <p className="mb-2 text-xs font-semibold text-foreground">技能机会摘要 · 点一下查看详情</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {topByCount.slice(0, 12).map((n) => (
            <button
              key={n.skill}
              type="button"
              onClick={() => setSel(n)}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-muted/20 px-2.5 py-2 text-left transition-colors hover:bg-muted/30"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: tone(n.avgSalary as number, n.count) }} />
                {n.skill}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {n.count} 岗 · {n.avgSalary}K
                {loggedIn && n.myLevel != null ? ` · ${SKILL_LEVEL_LABELS[n.myLevel]}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <CapsuleRank items={topByCount.slice(0, 6).map((n) => ({ label: n.skill, value: n.count, note: n.avgSalary != null ? `${n.avgSalary}K` : undefined }))} />
        </div>
      </div>

      {/* 详情 / 状态条（共用） */}
      {sel ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/15 bg-muted/30 px-3 py-2.5 text-xs">
          <span className="text-sm font-bold text-foreground">{sel.skill}</span>
          <span className="text-muted-foreground">在招 {sel.count} 岗</span>
          <span className="text-muted-foreground">均薪 {sel.avgSalary}K</span>
          <span className="text-muted-foreground">热度 {"★".repeat(heatStars)}{"☆".repeat(5 - heatStars)}</span>
          <span className="text-muted-foreground">
            我的：{sel.myLevel == null ? (loggedIn ? "未维护" : "未登录") : SKILL_LEVEL_LABELS[sel.myLevel]}
          </span>
          {sel.topicTitle ? (
            <a
              href={sel.phaseId ? `/roadmap#phase-${sel.phaseId}` : "/roadmap"}
              className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              → {sel.topicTitle}{sel.estimateHours ? `（约 ${sel.estimateHours}h）` : ""}
            </a>
          ) : null}
          {loggedIn && sel.enrollable && sel.topicId != null ? (
            <button
              type="button"
              onClick={() => enroll(sel)}
              disabled={enrolling === sel.skill}
              className="ml-auto rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary disabled:opacity-50"
            >
              {enrolling === sel.skill ? "加入中…" : "加入学习路线"}
            </button>
          ) : loggedIn && sel.myLevel != null && sel.myLevel >= 2 ? (
            <span className="ml-auto text-success">已达标，无需补齐 ✓</span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">点击气泡查看技能详情；登录后叠加你的掌握状态，可直接加入学习路线。</p>
      )}
    </div>
  );
}

/* ================= 薪资箱线图（SalaryBoxPlot）＝ 替换竖向直方图/分布带 =================
 * 用箱线图（Box Plot）直观表达「薪资分布区间」：下须(P5) → 下四分位(P25) → 中位(P50) → 上四分位(P75) → 上须(P95)。
 * 用分位数而非绝对 min/max，抗「面议/极高」等离群值（否则箱体被压扁）。
 *  - 箱体 = 约 50% 岗位所在的「主流区间」；中位线（粗）与平均（琥珀虚线）标注中心趋势。
 *  - 下方：数值刻度 + 各区间数量/占比图例 + 摘要（主流区间 Q1-Q3 · 平均 · 中位）。
 * 数据来自 overview 的 salaryMin/Q1/Q3/Max + salaryDist。
 */

export function SalaryBoxPlot({
  items,
  min,
  q1,
  median,
  q3,
  max,
  avg,
  className,
}: {
  items: { label: string; min: number; count: number }[];
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  avg: number | null;
  className?: string;
}) {
  if (min == null || q1 == null || median == null || q3 == null || max == null || q1 >= q3) {
    return <p className="text-xs text-muted-foreground">暂无薪资数据</p>;
  }
  const total = items.reduce((a, b) => a + b.count, 0);
  const lo = Math.min(min, q1 - 2);
  const hi = Math.max(max, q3 + 2);
  const range = Math.max(1, hi - lo);
  const W = 640, H = 104, PX = 14, yc = 44;
  const X = (v: number) => PX + ((v - lo) / range) * (W - 2 * PX);

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="薪资分布箱线图：下须、下四分位、中位、上四分位、上须">
        {/* 须线（min..max） */}
        <line x1={X(min)} y1={yc} x2={X(max)} y2={yc} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        {/* 两端须帽 */}
        <line x1={X(min)} y1={yc - 7} x2={X(min)} y2={yc + 7} stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1={X(max)} y1={yc - 7} x2={X(max)} y2={yc + 7} stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        {/* 箱体（Q1..Q3，主流区间） */}
        <rect x={X(q1)} y={yc - 16} width={X(q3) - X(q1)} height={32} rx={6} fill="rgba(99,102,241,0.26)" stroke="rgba(129,140,248,0.7)" strokeWidth="1.2" />
        {/* 中位线（粗白） */}
        <line x1={X(median)} y1={yc - 20} x2={X(median)} y2={yc + 20} stroke="rgba(255,255,255,0.92)" strokeWidth="2.5" />
        {/* 平均（琥珀虚线） */}
        {avg != null ? <line x1={X(avg)} y1={yc - 20} x2={X(avg)} y2={yc + 20} stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3" /> : null}
        {/* 数值刻度标签 */}
        <text x={X(min)} y={H - 8} textAnchor="start" fontSize="9" fill="rgba(255,255,255,0.75)">{min}K</text>
        <text x={X(q1)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.75)">{q1}K</text>
        <text x={X(median)} y={H - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.95)">{median}K</text>
        <text x={X(q3)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.75)">{q3}K</text>
        <text x={X(max)} y={H - 8} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.75)">{max}K</text>
      </svg>

      {/* 图例：区间 · 数量 · 占比 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((b, i) => (
          <span key={b.label} className="text-[11px] text-muted-foreground">
            <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: fillColor(i) }} />
            {b.label}
            <span className="ml-1 font-bold tabular-nums text-foreground">{b.count}</span>
            <span className="ml-0.5 text-[10px]">({total ? ((b.count / total) * 100).toFixed(1) : 0}%)</span>
          </span>
        ))}
      </div>

      {/* 摘要：主流区间 · 平均 · 中位 */}
      <p className="text-xs text-muted-foreground">
        主流区间 <span className="font-bold text-foreground">{q1}-{q3}K</span>
        {avg != null ? <> · 平均 <span className="font-bold tabular-nums text-foreground">{avg}K</span></> : null}
        {median != null ? <> · 中位 <span className="font-bold tabular-nums text-foreground">{median}K</span></> : null}
      </p>
    </div>
  );
}
