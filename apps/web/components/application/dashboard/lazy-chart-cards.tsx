"use client";

import dynamic from "next/dynamic";

/**
 * BoardUI 图表卡的懒加载包装（v2.1）。
 *
 * 为什么需要：revenue-chart-card / orders-chart-card 基于 recharts + react-aria，
 * 静态 import 会把它们算进路由首载 JS（/dashboard 327KB、/career/market 320KB，
 * 超出 app 类 300KB 预算）。用 next/dynamic + ssr:false 拆成异步 chunk，
 * 首载只留占位骨架，图表在客户端空闲时加载。
 */
function ChartSkeleton() {
  return <div className="h-[320px] w-full animate-pulse rounded-3xl border border-border-button-default bg-background-secondary-default" aria-hidden />;
}

export const LazyRevenueChartCard = dynamic(
  () => import("./revenue-chart-card").then((m) => m.RevenueChartCard),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const LazyOrdersChartCard = dynamic(
  () => import("./orders-chart-card").then((m) => m.OrdersChartCard),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
