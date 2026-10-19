"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobCrawlerConfig, JobRun, JobSource, JobSourceInfo, JobStats, JobSubscription } from "@learn-workbench/shared/schemas";
import { useToastStore } from "@/store/toast-store";

/**
 * 「招聘爬虫 / 订阅提醒」领域状态（S6-4：从 settings/page.tsx 抽出）。
 *
 * 网络调用都抽成可注入 fetcher 的纯 async 函数（便于单测），hook 只负责状态与 toast。
 */

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function toggleListValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function patchCrawler(
  crawler: JobCrawlerConfig | null,
  patch: Partial<JobCrawlerConfig>
): JobCrawlerConfig | null {
  return crawler ? { ...crawler, ...patch } : crawler;
}

export function buildSubscriptionPayload(sub: {
  id?: number;
  name: string;
  categories: string[];
  keywords: string[];
  cities: string[];
  enabled?: boolean;
}) {
  return { subscription: { ...sub, enabled: sub.enabled ?? true } };
}

export interface JobsSettingsSnapshot {
  config: JobCrawlerConfig | null;
  runs: JobRun[];
  stats: JobStats | null;
  sources: JobSourceInfo[];
  version: number;
  updatedAt: string | null;
  errors: string[];
}

/** 并发拉取招聘配置/运行日志/统计/信息源/订阅；部分失败也返回其余数据 */
export async function fetchJobsSettings(fetcher: Fetcher = fetch): Promise<JobsSettingsSnapshot> {
  const [configR, runsR, statsR, sourcesR, subsR] = await Promise.allSettled([
    fetcher("/api/jobs/config").then(async (r) => {
      if (!r.ok) throw new Error("招聘配置加载失败");
      return (await r.json()) as { config: JobCrawlerConfig };
    }),
    fetcher("/api/jobs/runs").then(async (r) => {
      if (!r.ok) throw new Error("运行日志加载失败");
      return (await r.json()) as { runs: JobRun[] };
    }),
    fetcher("/api/jobs/stats").then(async (r) => {
      if (!r.ok) throw new Error("招聘统计加载失败");
      return (await r.json()) as JobStats;
    }),
    fetcher("/api/jobs/sources").then(async (r) => {
      if (!r.ok) throw new Error("信息源加载失败");
      return (await r.json()) as { sources: JobSourceInfo[]; version: number; updatedAt: string | null };
    }),
    fetcher("/api/jobs/subscriptions").then(async (r) => {
      if (!r.ok) throw new Error("订阅加载失败");
      return (await r.json()) as { subscriptions: JobSubscription[] };
    }),
  ]);

  const errors: string[] = [];
  const config = configR.status === "fulfilled" ? configR.value.config : (errors.push("招聘配置加载失败"), null);
  const runs = runsR.status === "fulfilled" ? runsR.value.runs ?? [] : (errors.push("运行日志加载失败"), []);
  const stats = statsR.status === "fulfilled" ? statsR.value : (errors.push("招聘统计加载失败"), null);
  const sources = sourcesR.status === "fulfilled" ? sourcesR.value.sources ?? [] : (errors.push("信息源加载失败"), []);
  const version = sourcesR.status === "fulfilled" ? sourcesR.value.version ?? 0 : 0;
  const updatedAt = sourcesR.status === "fulfilled" ? sourcesR.value.updatedAt ?? null : null;
  const subscriptions = subsR.status === "fulfilled" ? subsR.value.subscriptions ?? [] : (errors.push("订阅加载失败"), []);
  return { config, runs, stats, sources, version, updatedAt, errors, subscriptions } as JobsSettingsSnapshot & { subscriptions: JobSubscription[] };
}

export async function saveJobsConfig(fetcher: Fetcher, config: JobCrawlerConfig): Promise<JobCrawlerConfig> {
  const r = await fetcher("/api/jobs/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  const data = (await r.json().catch(() => null)) as { config?: JobCrawlerConfig; error?: string } | null;
  if (!r.ok || !data?.config) throw new Error(data?.error || "招聘配置保存失败");
  return data.config;
}

export async function startJobsCrawlerRun(fetcher: Fetcher): Promise<void> {
  const r = await fetcher("/api/jobs/run", { method: "POST" });
  const data = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(data?.error || "启动抓取失败");
}

export async function updateJobsHosts(fetcher: Fetcher): Promise<void> {
  const r = await fetcher("/api/jobs/hosts/update", { method: "POST" });
  const data = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(data?.error || "hosts 更新失败");
}

export async function saveJobsSubscription(fetcher: Fetcher, sub: Parameters<typeof buildSubscriptionPayload>[0]): Promise<JobSubscription[]> {
  const r = await fetcher("/api/jobs/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSubscriptionPayload(sub)),
  });
  const d = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(d?.error || "订阅保存失败");
  const sr = await fetcher("/api/jobs/subscriptions");
  const sd = (await sr.json()) as { subscriptions: JobSubscription[] };
  return sd.subscriptions ?? [];
}

export async function deleteJobsSubscription(fetcher: Fetcher, id: number): Promise<void> {
  const r = await fetcher(`/api/jobs/subscriptions/${id}`, { method: "DELETE" });
  const d = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(d?.error || "删除订阅失败");
}

export interface JobsSettingsApi {
  crawler: JobCrawlerConfig | null;
  setCrawler: React.Dispatch<React.SetStateAction<JobCrawlerConfig | null>>;
  crawlerBusy: boolean;
  crawlerRunBusy: boolean;
  jobRuns: JobRun[];
  jobStats: JobStats | null;
  sources: JobSourceInfo[];
  hostsVersion: number;
  hostsUpdatedAt: string | null;
  hostsBusy: boolean;
  subscriptions: JobSubscription[];
  loadCrawlerData: () => Promise<void>;
  saveCrawler: () => Promise<void>;
  toggleCategory: (cat: string) => void;
  toggleSourceWhitelist: (id: string) => void;
  togglePlatform: (source: JobSource) => void;
  updateHosts: () => Promise<void>;
  saveSubscription: (sub: { id?: number; name: string; categories: string[]; keywords: string[]; cities: string[]; enabled?: boolean }) => Promise<void>;
  removeSubscription: (id: number) => Promise<void>;
  runCrawler: () => Promise<void>;
}

export function useJobsSettings(): JobsSettingsApi {
  const pushToast = useToastStore((s) => s.push);
  const [crawler, setCrawler] = useState<JobCrawlerConfig | null>(null);
  const [crawlerBusy, setCrawlerBusy] = useState(false);
  const [crawlerRunBusy, setCrawlerRunBusy] = useState(false);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [sources, setSources] = useState<JobSourceInfo[]>([]);
  const [hostsVersion, setHostsVersion] = useState(0);
  const [hostsUpdatedAt, setHostsUpdatedAt] = useState<string | null>(null);
  const [hostsBusy, setHostsBusy] = useState(false);
  const [subscriptions, setSubscriptions] = useState<JobSubscription[]>([]);

  const loadCrawlerData = useCallback(async () => {
    try {
      const d = await fetchJobsSettings();
      setCrawler(d.config);
      setJobRuns(d.runs);
      setJobStats(d.stats);
      setSources(d.sources);
      setHostsVersion(d.version);
      setHostsUpdatedAt(d.updatedAt);
      if ("subscriptions" in d) setSubscriptions((d as JobsSettingsSnapshot & { subscriptions: JobSubscription[] }).subscriptions);
      for (const err of d.errors) pushToast(err, "error");
    } catch {
      pushToast("招聘爬虫数据加载失败", "error");
    }
  }, [pushToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCrawlerData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCrawlerData]);

  const saveCrawler = useCallback(async () => {
    if (!crawler) return;
    setCrawlerBusy(true);
    try {
      setCrawler(await saveJobsConfig(fetch, crawler));
      pushToast("招聘爬虫配置已保存", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "招聘配置保存失败", "error");
    } finally {
      setCrawlerBusy(false);
    }
  }, [crawler, pushToast]);

  const toggleCategory = useCallback((cat: string) => {
    setCrawler((prev) => (prev ? { ...prev, categories: toggleListValue(prev.categories, cat as never) } : prev));
  }, []);

  const toggleSourceWhitelist = useCallback((id: string) => {
    setCrawler((prev) => (prev ? { ...prev, sources: toggleListValue(prev.sources, id) } : prev));
  }, []);

  const togglePlatform = useCallback((source: JobSource) => {
    setCrawler((prev) => (prev ? { ...prev, platforms: toggleListValue(prev.platforms, source) } : prev));
  }, []);

  const updateHosts = useCallback(async () => {
    setHostsBusy(true);
    try {
      await updateJobsHosts(fetch);
      pushToast("hosts 更新已启动，稍后自动刷新", "success");
      window.setTimeout(() => void loadCrawlerData(), 2500);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "hosts 更新失败", "error");
    } finally {
      setHostsBusy(false);
    }
  }, [pushToast, loadCrawlerData]);

  const saveSubscription = useCallback(async (sub: Parameters<typeof saveJobsSubscription>[1]) => {
    try {
      setSubscriptions(await saveJobsSubscription(fetch, sub));
      pushToast("订阅已保存", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "订阅保存失败", "error");
    }
  }, [pushToast]);

  const removeSubscription = useCallback(async (id: number) => {
    try {
      await deleteJobsSubscription(fetch, id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      pushToast("订阅已删除", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除订阅失败", "error");
    }
  }, [pushToast]);

  const runCrawler = useCallback(async () => {
    setCrawlerRunBusy(true);
    try {
      await startJobsCrawlerRun(fetch);
      pushToast("抓取已启动，稍后自动刷新", "success");
      window.setTimeout(() => void loadCrawlerData(), 1800);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "启动抓取失败", "error");
    } finally {
      setCrawlerRunBusy(false);
    }
  }, [pushToast, loadCrawlerData]);

  return {
    crawler, setCrawler, crawlerBusy, crawlerRunBusy, jobRuns, jobStats, sources,
    hostsVersion, hostsUpdatedAt, hostsBusy, subscriptions,
    loadCrawlerData, saveCrawler, toggleCategory, toggleSourceWhitelist, togglePlatform,
    updateHosts, saveSubscription, removeSubscription, runCrawler,
  };
}
