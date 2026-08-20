"use client";

import { cn } from "@/lib/utils";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

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
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
        active
          ? "border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
          : "border-white/20 bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h4>
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

  const toggle = (key: "education" | "experience", value: string) => {
    const list = filters[key];
    set({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as never);
  };

  return (
    <div className={cn("flex flex-col gap-4", !compact && "rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <SlidersHorizontal className="size-4 text-emerald-500" />
          高级筛选
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          重置
        </button>
      </div>

      <Group title="薪资区间">
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

      <Group title="学历">
        {EDUCATION_OPTIONS.map((e) => (
          <Chip key={e} active={filters.education.includes(e)} onClick={() => toggle("education", e)}>
            {e}
          </Chip>
        ))}
      </Group>

      <Group title="经验">
        {EXPERIENCE_OPTIONS.map((e) => (
          <Chip key={e} active={filters.experience.includes(e)} onClick={() => toggle("experience", e)}>
            {e}
          </Chip>
        ))}
      </Group>

      <Group title="发布时间">
        {PUBLISHED_OPTIONS.map((p) => (
          <Chip key={p.value} active={filters.publishedWithin === p.value} onClick={() => set({ publishedWithin: p.value as never })}>
            {p.label}
          </Chip>
        ))}
      </Group>

      <Group title="技能标签">
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
