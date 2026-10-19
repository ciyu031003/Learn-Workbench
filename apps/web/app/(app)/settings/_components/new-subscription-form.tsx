"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { allJobCategories, jobCategoryLabels } from "@learn-workbench/shared/labels";

export interface NewSubscriptionDraft {
  name: string;
  categories: string[];
  keywords: string[];
  cities: string[];
}

/** 新建订阅表单（从 settings/page.tsx 抽出；提交后清空输入） */
export function NewSubscriptionForm({ onSave }: { onSave: (sub: NewSubscriptionDraft) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cats, setCats] = useState<string[]>(["yangqi"]);
  const [kw, setKw] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleCat = (c: string) => {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const submit = async () => {
    const keywords = kw.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
    const cities = city.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!name.trim() && keywords.length === 0) return;
    setBusy(true);
    try {
      await onSave({
        name: name.trim() || (cats.length ? cats.map((c) => jobCategoryLabels[c as never] ?? c).join("·") : "我的订阅"),
        categories: cats,
        keywords,
        cities,
      });
      setName("");
      setKw("");
      setCity("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-3">
      <p className="text-xs font-medium text-muted-foreground">新建订阅</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {allJobCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggleCat(c)}
            className={cats.includes(c)
              ? "rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-2.5 py-1 text-[11px] font-semibold text-white"
              : "rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            }
          >
            {jobCategoryLabels[c]}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="订阅名称，如 央国企×北京（可选）"
        className="mt-2 h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="关键词：如 网络工程、数据分析"
          className="h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="地区：如 北京、乌鲁木齐"
          className="h-9 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60"
        />
      </div>
      <Button size="sm" onClick={submit} disabled={busy} className="mt-2">
        {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        创建订阅
      </Button>
    </div>
  );
}
