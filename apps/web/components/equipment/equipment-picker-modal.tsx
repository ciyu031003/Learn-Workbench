"use client";

import { useEffect, useState } from "react";
import { equipmentCategoriesForSport } from "@learn-workbench/shared";
import { GlassModal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EquipmentPickerItem {
  id: number;
  brand: string;
  model: string;
  imageUrl: string;
}

/**
 * 装备图库选择弹层（Web，与 App 同一接口）：类别 chips + 搜索 + 三列白底图网格。
 */
export function EquipmentPickerModal({
  open,
  onClose,
  onPick,
  sportKey,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: EquipmentPickerItem) => void;
  sportKey: string;
  defaultCategory?: string;
}) {
  const categories = equipmentCategoriesForSport(sportKey);
  const [category, setCategory] = useState(defaultCategory ?? categories[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EquipmentPickerItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const search = new URLSearchParams();
      if (category) search.set("category", category);
      if (query.trim()) search.set("q", query.trim());
      search.set("limit", "60");
      fetch("/api/equipment?" + search.toString())
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => {
          if (alive) setItems(Array.isArray(d.items) ? d.items : []);
        })
        .catch(() => {
          if (alive) setItems([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, query ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, category, query]);

  return (
    <GlassModal open={open} onClose={onClose} title="从装备图库选择" className="max-w-2xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                item.key === category ? "border-primary bg-primary/15 text-primary" : "border-border/60 hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="搜型号或品牌，如 ASTROX / 天斧"
          className="[&_button]:hidden"
        />

        {loading ? (
          <SkeletonList rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="这一类暂时没有图库素材"
            hint="换个类别或关键词，也可以自己上传照片"
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick(item);
                    onClose();
                  }}
                  className="lift group flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-surface p-2 text-left hover:border-primary/50"
                >
                  <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt="" className="size-full object-contain" loading="lazy" />
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      选它
                    </span>
                  </span>
                  <span className="line-clamp-2 text-[11px] font-semibold">{item.model}</span>
                  <span className="mt-auto inline-flex w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {item.brand}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  );
}
