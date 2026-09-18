"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/store/toast-store";
import { formatBasisLabel, mealKindLabels, scaleFoodByAmount, type FoodItemHit, type MealKind } from "@learn-workbench/shared";

/**
 * 食物营养库搜索 + 按克录入（v8 P1，与 APP v6 的功能对齐）
 *
 * 流程：搜菜名（支持错别字「鸡旦 → 鸡蛋」）→ 选一条 → 填**实际吃了多少克** → 服务端按基准量换算后入账。
 * 服务端 `/api/nutrition` 的 `foodItemId + grams` 分支负责最终换算（不信任客户端算数）。
 */
export function FoodLibrarySearch({
  date,
  meal,
  onAdded,
}: {
  date: string;
  meal: MealKind;
  onAdded: () => void | Promise<void>;
}) {
  const pushToast = useToastStore((s) => s.push);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoodItemHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FoodItemHit | null>(null);
  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);
  /** 请求序号守卫：后发的搜索先返回时不覆盖新结果 */
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      // 清空放到异步回调里：effect 体内同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）
      const idle = setTimeout(() => setItems([]), 0);
      return () => clearTimeout(idle);
    }
    const my = ++seq.current;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const r = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}&meal=${meal}&limit=12`);
          const d = await r.json();
          if (my === seq.current && r.ok) setItems(Array.isArray(d.items) ? d.items : []);
        } catch {
          if (my === seq.current) setItems([]);
        } finally {
          if (my === seq.current) setSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, meal]);

  const gramsNum = Number(grams);
  const preview = useMemo(
    () => (picked ? scaleFoodByAmount(picked, Number.isFinite(gramsNum) ? gramsNum : 0) : null),
    [picked, gramsNum]
  );

  const submit = useCallback(async () => {
    if (!picked) return;
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
      pushToast("请填写实际摄入量", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          meal,
          name: picked.name,
          foodItemId: picked.id,
          grams: gramsNum,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error((d as { error?: string } | null)?.error ?? "保存失败");
      }
      pushToast(`已记入${mealKindLabels[meal]}：${picked.name} ${gramsNum}g`);
      setPicked(null);
      setQuery("");
      setItems([]);
      await onAdded();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }, [date, gramsNum, meal, onAdded, picked, pushToast]);

  return (
    <Card className="relative overflow-hidden border-white/20 bg-gradient-to-br from-accent/10 via-card/70 to-primary/10 backdrop-blur-xl">
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Sparkles className="size-5 text-accent" />
        <CardTitle className="text-base">食物营养库</CardTitle>
        <span className="ml-auto text-[11px] text-muted-foreground">搜菜名 → 填实际克数 → 自动换算入账</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            placeholder="搜食物 / 菜品，支持错别字（如「鸡旦」「番茄鸡蛋面」）"
            className="h-11 pl-9"
          />
          {searching ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
        </div>

        {picked ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{picked.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatBasisLabel(picked)} · {Math.round(Number(picked.kcal))} kcal
                  {picked.category ? ` · ${picked.category}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                返回搜索
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">实际摄入量（{picked.basisUnit}）</span>
                <Input
                  value={grams}
                  onChange={(e) => setGrams(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
                  inputMode="decimal"
                  className="h-10 w-32 text-lg font-bold tabular-nums"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[100, 200, 300, 500].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrams(String(g))}
                    className="rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors hover:bg-muted/70"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-primary tabular-nums">
                {preview
                  ? `≈ ${Math.round(preview.kcal)} kcal · P${preview.proteinG} C${preview.carbsG} F${preview.fatG}`
                  : "—"}
              </div>
              <Button onClick={() => void submit()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                添加到{mealKindLabels[meal]}
              </Button>
            </div>
          </div>
        ) : items.length > 0 ? (
          <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setPicked(it);
                  setGrams(String(Number(it.basisAmount) || 100));
                }}
                className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{it.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {formatBasisLabel(it)} · {Math.round(Number(it.kcal))} kcal
                    {it.category ? ` · ${it.category}` : ""}
                  </span>
                </span>
                <span className="text-muted-foreground">›</span>
              </button>
            ))}
          </div>
        ) : query.trim().length > 0 && !searching ? (
          <p className="text-xs text-muted-foreground">营养库没有匹配，换个词或手动添加。</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            输入菜名即可（含 108 条自建中餐库；已接入 Open Food Facts / USDA 导入脚本）。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
