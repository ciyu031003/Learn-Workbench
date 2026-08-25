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

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 坐标区 */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-white/6">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="技能市场地图：横轴需求职位数，纵轴平均薪资">
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
          {/* 气泡 */}
          {usable.map((n) => {
            const cx = px(n.avgSalary as number);
            const cy = py(n.count);
            const rad = Math.min(24, 6 + Math.sqrt(n.count) * 2.2);
            const r = ring(n.myLevel);
            const isSel = sel?.skill === n.skill;
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
                <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.95)">{n.skill.slice(0, 6)}</text>
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

      {/* 详情 / 状态条 */}
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

/* ================= 薪资分布带（SalaryDistributionBand）＝ 替换竖向直方图 =================
 * 用「100% 占比分布带」替代传统柱状直方图，直观体现「岗位薪资集中在哪些区间」：
 *  - 分布带：每个区间宽度=该区间职位占比，最宽=岗位最集中；主流区间高亮描边。
 *  - 值轴刻度：叠加 中位/平均 薪资标记（K/月），一眼看出集中度与中心趋势。
 *  - 图例 + 摘要：区间 · 数量 · 占比 + 主流区间 / 平均 / 中位。
 * 仅依赖 salaryDist + overview.avgSalary/medianSalary，无需新增后端字段。
 */

export function SalaryDistributionBand({
  items,
  avgSalary,
  medianSalary,
  className,
}: {
  items: { label: string; min: number; count: number }[];
  avgSalary: number | null;
  medianSalary: number | null;
  className?: string;
}) {
  const total = items.reduce((a, b) => a + b.count, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">暂无薪资数据</p>;
  const maxCount = Math.max(...items.map((b) => b.count));
  const main = items.find((b) => b.count === maxCount) ?? items[0];
  const CAP = 40; // 值轴封顶（K/月）
  const px = (v: number) => Math.max(0, Math.min(100, (v / CAP) * 100));
  const segs = items.map((b, i) => ({ ...b, pct: (b.count / total) * 100, main: b.label === main.label, idx: i }));

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {/* 占比分布带（100% 堆叠，宽度=占比） */}
      <div className="flex h-7 w-full overflow-hidden rounded-full bg-white/10">
        {segs.map((s) => (
          <div
            key={s.label}
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              width: `${s.pct}%`,
              background: grad(s.idx, true),
              ...(s.main ? { filter: "brightness(1.12)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.78)" } : {}),
            }}
            title={`${s.label}：${s.count} 个（${s.pct.toFixed(1)}%）`}
          >
            {s.main && s.pct >= 8 ? <span className="text-[10px] font-bold text-white/95">{s.pct.toFixed(0)}%</span> : null}
          </div>
        ))}
      </div>

      {/* 值轴刻度：中位 & 平均 */}
      <div className="relative h-6 w-full">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        {medianSalary != null ? (
          <div className="absolute top-0 h-3.5 w-px bg-sky-300" style={{ left: `${px(medianSalary)}%` }} title={`中位薪资 ${medianSalary}K`}>
            <span className="absolute left-1 top-[-1px] whitespace-nowrap text-[10px] font-semibold text-sky-300">中位 {medianSalary}K</span>
          </div>
        ) : null}
        {avgSalary != null ? (
          <div className="absolute top-0 h-3.5 w-px bg-indigo-300" style={{ left: `${px(avgSalary)}%` }} title={`平均薪资 ${avgSalary}K`}>
            <span className="absolute left-1 top-[-1px] whitespace-nowrap text-[10px] font-semibold text-indigo-300">平均 {avgSalary}K</span>
          </div>
        ) : null}
        <span className="absolute -bottom-2 left-0 text-[9px] text-muted-foreground/70">0K</span>
        <span className="absolute -bottom-2 right-0 text-[9px] text-muted-foreground/70">{CAP}K</span>
      </div>

      {/* 图例：区间 · 数量 · 占比 */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {segs.map((s) => (
          <span key={s.label} className="text-[11px] text-muted-foreground">
            <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: fillColor(s.idx) }} />
            {s.label}
            <span className="ml-1 font-bold tabular-nums text-foreground">{s.count}</span>
            <span className="ml-0.5 text-[10px]">({s.pct.toFixed(1)}%)</span>
          </span>
        ))}
      </div>

      {/* 主区间 + 中位 摘要 */}
      <p className="text-xs text-muted-foreground">
        主流区间 <span className="font-bold text-foreground">{main.label}</span>
        {avgSalary != null ? <> · 平均 <span className="font-bold tabular-nums text-foreground">{avgSalary}K</span></> : null}
        {medianSalary != null ? <> · 中位 <span className="font-bold tabular-nums text-foreground">{medianSalary}K</span></> : null}
      </p>
    </div>
  );
}
