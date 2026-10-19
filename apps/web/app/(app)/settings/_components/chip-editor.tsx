"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type ChipEditorProps = {
  label: string;
  placeholder?: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

/** 关键词/城市等「回车添加、点击删除」的 chip 编辑器（从 settings/page.tsx 抽出） */
export function ChipEditor({ label, placeholder, items, onAdd, onRemove }: ChipEditorProps) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft("");
  };
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`删除 ${item}`} className="text-emerald-600/70 hover:text-emerald-700 dark:hover:text-emerald-200">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder ?? "输入后回车添加"}
          className="h-8 w-28 rounded-full border border-dashed border-white/30 bg-transparent px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
      </div>
    </div>
  );
}
