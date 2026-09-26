"use client";

import { cn } from "@/lib/utils";
import { Check, RotateCcw, SlidersHorizontal } from "lucide-react";

/**
 * 局部样式：只在筛选面板内生效（不动 globals.css，避免与其它流互相覆盖）。
 * 全局的 prefers-reduced-motion 兜底会把这里的 animation 一并关掉，无需重复处理。
 */
const FILTER_STYLES = `
@keyframes jf-check-pop {
  0%   { transform: scale(0.2) rotate(-25deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(0deg);  opacity: 1; }
  100% { transform: scale(1) rotate(0deg);     opacity: 1; }
}
@keyframes jf-group-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
@keyframes jf-badge-in {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
}
.jf-chip { will-change: transform; }
.jf-chip:active { transform: scale(0.94); }
.jf-chip[data-active="true"] { box-shadow: 0 2px 10px -2px rgba(16, 185, 129, 0.55); }
.jf-check { animation: jf-check-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.jf-group { animation: jf-group-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
.jf-badge { animation: jf-badge-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.jf-reset-icon { transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
.jf-reset:hover .jf-reset-icon { transform: rotate(-180deg); }
@media (prefers-reduced-motion: reduce) {
  .jf-chip:active { transform: none; }
}
`;

export interface JobFilterState {
  salaryMin: number | null;      // K
  salaryMax: number | null;      // K
  education: string[];
  experience: string[];
  publishedWithin: "today" | "3d" | "7d" | "";
  skills: string[];
}

export const DEFAULT_FILTERS: JobFilterState = {
  salaryMin: null,
  salaryMax: null,
  education: [],
  experience: [],
  publishedWithin: "",
  skills: [],
};

export const SALARY_PRESETS = [
  { label: "不限", min: null, max: null },
  { label: "10K 以下", min: null, max: 10 },
  { label: "10-20K", min: 10, max: 20 },
  { label: "20-30K", min: 20, max: 30 },
  { label: "30K 以上", min: 30, max: null },
] as const;

export const EDUCATION_OPTIONS = ["大专", "本科", "硕士", "博士"];
export const EXPERIENCE_OPTIONS = ["应届", "1-3年", "3-5年", "5-10年", "10年以上"];
export const PUBLISHED_OPTIONS = [
  { value: "", label: "不限时间" },
  { value: "today", label: "今天" },
  { value: "3d", label: "3 天内" },
  { value: "7d", label: "7 天内" },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-active={active ? "true" : "false"}
      className={cn(
        "jf-chip inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        "transition-[transform,background-color,border-color,color,box-shadow] duration-200",
        active
          ? "border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
          : "border-white/20 bg-white/10 text-muted-foreground hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/15 hover:text-foreground"
      )}
    >
      {/* 选中项多一枚弹入的对勾：给"已生效"即时反馈 */}
      {active ? <Check className="jf-check size-3" strokeWidth={3.5} /> : null}
      {children}
    </button>
  );
}

function Group({ title, count = 0, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="jf-group flex flex-col gap-2 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
        {count > 0 ? (
          <span className="jf-badge inline-flex min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-300">
            {count}
          </span>
        ) : null}
      </h4>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * P1 多条件筛选面板（Web 侧栏 + Mobile 可折叠共用）
 * 通过 filters 受控 + onChange 上报，父页面负责拼接到 /api/jobs 查询参数。
 */
export function JobFilterPanel({
  filters,
  onChange,
  compact = false,
}: {
  filters: JobFilterState;
  onChange: (next: JobFilterState) => void;
  compact?: boolean;
}) {
  const set = (patch: Partial<JobFilterState>) => onChange({ ...filters, ...patch });

  // 已生效条件数：让用户一眼知道"我筛了几项"，也是重置按钮的启用依据
  const activeCount =
    (filters.salaryMin != null || filters.salaryMax != null ? 1 : 0) +
    filters.education.length +
    filters.experience.length +
    (filters.publishedWithin ? 1 : 0) +
    filters.skills.length;

  const toggle = (key: "education" | "experience", value: string) => {
    const list = filters[key];
    set({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as never);
  };

  return (
    <div className={cn("flex flex-col gap-4", !compact && "rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md")}>
      <style>{FILTER_STYLES}</style>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <SlidersHorizontal className={cn("size-4 text-emerald-500 transition-transform duration-300", activeCount > 0 && "scale-110")} />
          高级筛选
          {activeCount > 0 ? (
            <span className="jf-badge inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-600 dark:text-emerald-300">
              已选 {activeCount}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          disabled={activeCount === 0}
          className={cn(
            "jf-reset inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
            activeCount === 0
              ? "cursor-not-allowed text-muted-foreground/40"
              : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
          )}
        >
          <RotateCcw className="jf-reset-icon size-3.5" />
          重置
        </button>
      </div>

      <Group title="薪资区间" count={filters.salaryMin != null || filters.salaryMax != null ? 1 : 0}>
        {SALARY_PRESETS.map((p) => {
          const active = filters.salaryMin === p.min && filters.salaryMax === p.max;
          return (
            <Chip
              key={p.label}
              active={active}
              onClick={() => set({ salaryMin: p.min, salaryMax: p.max })}
            >
              {p.label}
            </Chip>
          );
        })}
      </Group>

      <Group title="学历" count={filters.education.length}>
        {EDUCATION_OPTIONS.map((e) => (
          <Chip key={e} active={filters.education.includes(e)} onClick={() => toggle("education", e)}>
            {e}
          </Chip>
        ))}
      </Group>

      <Group title="经验" count={filters.experience.length}>
        {EXPERIENCE_OPTIONS.map((e) => (
          <Chip key={e} active={filters.experience.includes(e)} onClick={() => toggle("experience", e)}>
            {e}
          </Chip>
        ))}
      </Group>

      <Group title="发布时间" count={filters.publishedWithin ? 1 : 0}>
        {PUBLISHED_OPTIONS.map((p) => (
          <Chip key={p.value} active={filters.publishedWithin === p.value} onClick={() => set({ publishedWithin: p.value as never })}>
            {p.label}
          </Chip>
        ))}
      </Group>

      <Group title="技能标签" count={filters.skills.length}>
        {filters.skills.length === 0 ? (
          <p className="text-xs text-muted-foreground">在搜索框输入技能关键词（如 Python / Docker）即可匹配</p>
        ) : (
          filters.skills.map((s) => (
            <Chip key={s} active onClick={() => set({ skills: filters.skills.filter((v) => v !== s) })}>
              {s} ✕
            </Chip>
          ))
        )}
      </Group>
    </div>
  );
}
