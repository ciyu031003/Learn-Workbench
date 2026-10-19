"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DomainIcon } from "@/components/domain-icon";
import { useDomainStore } from "@/store/domain-store";
import type { ShellData } from "@/lib/shell-data";

/**
 * 顶栏「领域胶囊」：图标/颜色/名称/整体进度（S6-2 改为服务端数据驱动）。
 *
 * - 数据来自 (app)/layout.tsx → AppShell props（不在这里 fetch）；
 * - 首次挂载把服务端解析出的当前领域写进 zustand store，供 dashboard/roadmap 等页面联动；
 * - 领域切换由 roadmap 页写 store；若与服务端 currentCareer 不一致就 router.refresh()，
 *   让外壳（含整体进度）按新领域重新服务端渲染。
 */
export function DomainPill({
  domains,
  currentCareer,
  overallPercent,
}: Pick<ShellData, "domains" | "currentCareer" | "overallPercent">) {
  const router = useRouter();
  const current = useDomainStore((s) => s.current);
  const row =
    domains.find((d) => d.careerKey === current?.careerKey) ??
    domains.find((d) => d.careerKey === currentCareer) ??
    domains[0] ??
    null;

  // 首次挂载：把服务端领域身份写进 store（原逻辑在 shell 里 fetch /api/domains + /api/settings/career）
  const rowKey = row?.careerKey ?? null;
  useEffect(() => {
    if (!rowKey) return;
    if (useDomainStore.getState().current) return;
    const target = domains.find((d) => d.careerKey === rowKey);
    if (target) useDomainStore.getState().setCurrent(target);
  }, [rowKey, domains]);

  // 领域切换后：让服务端重算当前领域整体进度并重渲染（替代原来客户端 fetch /api/summary）
  const storeKey = current?.careerKey;
  useEffect(() => {
    if (storeKey && storeKey !== currentCareer) router.refresh();
  }, [storeKey, currentCareer, router]);

  if (!row) return null;

  return (
    <div className="paper-chip flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${row.color}26`, color: row.color }}
      >
        <DomainIcon icon={row.icon} className="size-3.5" />
      </span>
      <span className="max-w-24 truncate font-medium text-foreground">{row.name}</span>
      <span className="tabular-nums text-muted-foreground">{overallPercent}%</span>
    </div>
  );
}
