"use client";

import { useEffect, useState } from "react";
import { DomainIcon, toDomainIdentity } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";

/**
 * 顶栏「领域胶囊」：图标/颜色/名称/整体进度。
 *
 * 从 `components/app-shell.tsx` 抽出（行为、类名、DOM 均保持原样）：
 * - 挂载时解析当前领域身份（/api/domains + /api/settings/career）；
 * - 领域切换后重新拉 /api/summary 的整体进度；
 * - 无当前领域时不渲染（返回 null）。
 */
export function DomainPill() {
  const domain = useDomainStore((s) => s.current);
  const setDomain = useDomainStore((s) => s.setCurrent);
  const [percent, setPercent] = useState<number | null>(null);

  // 顶栏领域胶囊：初始化解析当前领域身份（图标/颜色/名称），并随全局 store 实时联动
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/domains").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/settings/career").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, c]) => {
      if (!alive) return;
      if (useDomainStore.getState().current) return;
      const list = (d?.domains ?? []) as Array<{
        career_key: string;
        name: string;
        color?: string | null;
        icon?: string | null;
        kind_label?: string | null;
        is_locked?: boolean | null;
      }>;
      const saved = (c?.career as string | undefined) ?? "ict";
      const row = list.find((x) => x.career_key === saved) ?? list[0] ?? null;
      if (row) setDomain(toDomainIdentity(row));
    });
    return () => {
      alive = false;
    };
  }, [setDomain]);

  // 领域切换后刷新整体进度（percent 实时跟随当前领域）
  const domainKey = domain?.careerKey;
  useEffect(() => {
    if (!domainKey) return;
    let alive = true;
    fetch("/api/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive || !s) return;
        setPercent((s as { overallPercent?: number }).overallPercent ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [domainKey]);

  if (!domain) return null;

  return (
    <div className="paper-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${domain.color}26`, color: domain.color }}
      >
        <DomainIcon icon={domain.icon} className="size-3.5" />
      </span>
      <span className="max-w-24 truncate font-medium text-foreground">{domain.name}</span>
      <span className="tabular-nums text-muted-foreground">{percent === null ? "…" : `${percent}%`}</span>
    </div>
  );
}
