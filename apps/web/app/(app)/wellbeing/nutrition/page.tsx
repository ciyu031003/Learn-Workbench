"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Food, MealEntry, MealKind } from "@learn-workbench/shared/schemas";
import { DEFAULT_NUTRITION_TARGETS, mealKindLabels } from "@learn-workbench/shared/labels";
import { sumNutrition } from "@learn-workbench/shared/pure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Salad, Loader2, ChevronLeft, Search, Flame, Utensils } from "lucide-react";
import { FoodLibrarySearch } from "@/components/nutrition/food-library-search";
import { RecipeInspiration } from "@/components/nutrition/recipe-inspiration";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 环形进度（Kcal / 蛋白 / 碳水 / 脂肪）—— 颜色一律走主题 token，深浅色自动切换 */
function MacroRing({
  label, value, target, unit, color,
}: { label: string; value: number; target: number; unit: string; color: string }) {
  const size = 84;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={7} className="text-muted" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset .4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-body-semibold tabular-nums text-text-primary">{Math.round(value)}</span>
          <span className="text-caption-2-medium text-text-tertiary">/ {target}{unit}</span>
        </div>
      </div>
      <span className="text-caption-1-medium text-text-secondary">{label}</span>
    </div>
  );
}

/** 卡片头部（图标块 + 标题 + 右侧徽标），滚动区留在外部，长列表不顶掉标题 */
function CardHead({
  icon: Icon,
  title,
  badge,
}: {
  icon: typeof Flame;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default text-foreground-icon-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <h2 className="min-w-0 truncate text-title-3-semibold text-text-primary">{title}</h2>
      {badge ? (
        <span className="ms-auto shrink-0 rounded-full bg-background-tertiary-default px-2 py-0.5 text-caption-1-medium text-text-secondary">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export default function NutritionPage() {
  const pushToast = useToastStore((s) => s.push);
  const [date, setDate] = useState(todayKey);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [meal, setMeal] = useState<MealKind>("lunch");
  const [picked, setPicked] = useState<Food | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [manual, setManual] = useState({ kcal: "", proteinG: "", carbsG: "", fatG: "" });

  const totals = useMemo(() => sumNutrition(entries), [entries]);
  const targets = DEFAULT_NUTRITION_TARGETS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/nutrition?date=${date}`);
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setEntries(Array.isArray(d.entries) ? d.entries : []);
    } catch {
      pushToast("饮食记录加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [date, pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据加载后在 effect 中写状态（既有模式）
    void load();
  }, [load]);

  const searchFoods = useCallback(async (query: string) => {
    try {
      const r = await fetch(`/api/nutrition/foods${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      if (!r.ok) return;
      const d = await r.json();
      setFoods(Array.isArray(d.foods) ? d.foods : []);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹窗时搜索食物（既有模式）
    void searchFoods(q);
  }, [open, q, searchFoods]);

  const addEntry = async () => {
    if (!picked && !name.trim()) {
      pushToast("请选择食物或填写名称", "error");
      return;
    }
    setSaving(true);
    try {
      const body = picked
        ? { date, meal, name: picked.name, foodId: picked.id, amount: Number(amount) || 1 }
        : {
            date, meal, name: name.trim(), amount: Number(amount) || 1,
            kcal: Number(manual.kcal) || 0,
            proteinG: Number(manual.proteinG) || 0,
            carbsG: Number(manual.carbsG) || 0,
            fatG: Number(manual.fatG) || 0,
          };
      const r = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast("已添加");
      setOpen(false);
      setPicked(null);
      setName("");
      setAmount("1");
      setManual({ kcal: "", proteinG: "", carbsG: "", fatG: "" });
      await load();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      const r = await fetch(`/api/nutrition?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      await load();
    } catch {
      pushToast("删除失败", "error");
    }
  };

  const saveAsFood = async () => {
    if (!name.trim()) {
      pushToast("请先填写名称", "error");
      return;
    }
    try {
      const r = await fetch("/api/nutrition/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), unit: "份",
          kcal: Number(manual.kcal) || 0,
          proteinG: Number(manual.proteinG) || 0,
          carbsG: Number(manual.carbsG) || 0,
          fatG: Number(manual.fatG) || 0,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "保存失败");
      }
      pushToast("已存入常用食物");
      await searchFoods(q);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败", "error");
    }
  };

  return (
    <div className="page-enter flex flex-col gap-5">
      <PageHeader
        title="今日饮食"
        description="记录三餐与营养摄入 · 食物库搜索或手动填写，自动汇总到今日营养环"
        icon={<Salad className="size-5" />}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wellbeing">
                <ChevronLeft className="size-4" /> 健康
              </Link>
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40"
              aria-label="用餐日期"
            />
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="size-4" /> 添加
            </Button>
          </>
        }
      />

      {/* 指标卡 + 记录卡：桌面 2 列等宽，窄屏 1 列 */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* 营养环 */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:h-[340px]">
          <CardHead icon={Flame} title="今日营养" badge={`目标 ${targets.kcal} kcal`} />
          <div className="flex flex-1 flex-wrap items-center justify-around gap-4 px-5 pb-5">
            {[
              { label: "热量", value: totals.kcal, target: targets.kcal, unit: "kcal", color: "var(--color-primary)" },
              { label: "蛋白质", value: totals.proteinG, target: targets.proteinG, unit: "g", color: "var(--color-success)" },
              { label: "碳水", value: totals.carbsG, target: targets.carbsG, unit: "g", color: "var(--color-warning)" },
              { label: "脂肪", value: totals.fatG, target: targets.fatG, unit: "g", color: "var(--color-danger)" },
            ].map((r, i) => (
              <span key={r.label} className="rise-in" style={{ animationDelay: `${i * 70}ms` }}>
                <MacroRing label={r.label} value={r.value} target={r.target} unit={r.unit} color={r.color} />
              </span>
            ))}
          </div>
        </section>

        {/* 今日记录：按餐次分组，卡内滚动 + 顶部柔和渐隐 */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-secondary-default lg:h-[340px]">
          <CardHead icon={Utensils} title="今日记录" badge={`${entries.length} 条`} />
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
            {loading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-body-medium text-text-secondary">
                <Loader2 className="size-4 animate-spin" /> 加载中…
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={Salad}
                title="今天还没有记录"
                hint="从常用食物里挑一个，或手动填写营养"
                pattern="bauhaus"
                className="flex-1 justify-center"
              />
            ) : (
              <ScrollFade className="h-full">
                {MEALS.map((m) => {
                  const list = entries.filter((e) => e.meal === m);
                  if (list.length === 0) return null;
                  const sub = sumNutrition(list);
                  return (
                    <div key={m} className="border-b border-separator-border pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-caption-1-semibold text-text-secondary">{mealKindLabels[m]}</span>
                        <span className="text-caption-1-medium tabular-nums text-text-tertiary">{sub.kcal} kcal</span>
                      </div>
                      <div className="flex flex-col divide-y divide-separator-border">
                        {list.map((e) => (
                          <div
                            key={e.id}
                            className="press-soft flex items-center justify-between gap-3 rounded-lg py-2 transition-colors hover:bg-background-tertiary-default/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-body-medium text-text-primary">{e.name}</p>
                              <p className="text-caption-2-medium tabular-nums text-text-tertiary">
                                {e.amount} {e.unit} · {e.kcal} kcal · P{e.proteinG} C{e.carbsG} F{e.fatG}
                              </p>
                            </div>
                            <button
                              onClick={() => void remove(e.id)}
                              className="press shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger/12 hover:text-danger"
                              aria-label="删除"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </ScrollFade>
            )}
          </div>
        </section>
      </div>

      {/* v8 P1：食物营养库搜索 + 按克录入（与 APP v6 对齐） */}
      <FoodLibrarySearch date={date} meal={meal} onAdded={load} />

      {/* 2026-10 扩充：共享精选食谱（Web / App 同一份内容） */}
      <RecipeInspiration />

      <GlassModal open={open} onClose={() => setOpen(false)} title="添加饮食" className="max-w-lg">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium">餐次</label>
            <div className="flex gap-1.5">
              {MEALS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMeal(m)}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-1.5 text-sm",
                    meal === m ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  {mealKindLabels[m]}
                </button>
              ))}
            </div>
          </div>

          {/* 常用食物搜索 */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
              <Search className="size-3.5" /> 常用食物
            </label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索（鸡蛋 / 米饭…）" />
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {foods.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setPicked(f); setName(f.name); }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-caption-2-medium transition-colors",
                    picked?.id === f.id ? "border-primary/60 bg-primary/15" : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  {f.name} · {f.kcal}kcal/{f.unit}
                </button>
              ))}
              {foods.length === 0 ? <span className="text-caption-2-medium text-muted-foreground">没有匹配的常用食物</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium">名称</label>
              <Input value={name} onChange={(e) => { setName(e.target.value); setPicked(null); }} placeholder="如：鸡蛋" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">数量</label>
              <Input type="number" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          {!picked ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ["kcal", "热量"], ["proteinG", "蛋白"], ["carbsG", "碳水"], ["fatG", "脂肪"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1 block text-caption-2-medium font-medium">{label}</label>
                    <Input
                      type="number"
                      value={manual[key]}
                      onChange={(e) => setManual((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="self-start" onClick={saveAsFood}>
                存入常用食物
              </Button>
            </>
          ) : (
            <p className="text-caption-2-medium text-muted-foreground">
              将按「{picked.name}」每 {picked.unit} {picked.kcal} kcal 计算 × {amount || 1}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={addEntry} disabled={saving}>{saving ? "保存中…" : "添加"}</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
